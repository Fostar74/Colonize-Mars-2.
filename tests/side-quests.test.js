const assert=require("node:assert/strict");
const {test}=require("node:test");
const {mkdtempSync,rmSync}=require("node:fs");
const {tmpdir}=require("node:os");
const {join}=require("node:path");
const {randomUUID}=require("node:crypto");
const {Worker}=require("node:worker_threads");
const SQLite=require("better-sqlite3");
const dir=mkdtempSync(join(tmpdir(),"cm107-"));
process.env.DATABASE_PATH=join(dir,"game.sqlite");
const Game=require("../database/database");
const catalog=require("../database/sideQuestCatalog");
const {unitPrice}=require("../src/shared/unitEconomy");

function runInWorker(code){
  return new Promise((resolve,reject)=>{
    const worker=new Worker(`const {parentPort}=require("node:worker_threads");
      const Game=require("./database/database");const g=new Game();
      const result=(()=>{${code}})();g.close();parentPort.postMessage(result);`,{eval:true});
    worker.once("message",resolve);
    worker.once("error",reject);
    worker.once("exit",code=>{if(code!==0)reject(new Error("Worker exited: "+code));});
  });
}

test("sequential side quests persist, hide future content, and count only eligible actions",async()=>{
  const game=new Game(), db=new SQLite(process.env.DATABASE_PATH);
  const actualNow=Date.now;
  let now=actualNow();
  Date.now=()=>now;
  try{
    const user=game.createUser("owner@example.test","Owner","hash").userId;
    const other=game.createUser("other@example.test","Other","hash").userId;
    assert.equal(catalog.length,34);
    assert.ok(catalog.every(q=>q.title.bg&&q.title.en&&(q.kind!=="train"||unitPrice(q.detail))));
    const active=()=>game.sideQuests.state(user).missions.find(q=>q.status==="active"||q.status==="complete");
    db.prepare("INSERT INTO alien_side_quests(user_id,milestone) VALUES (?,?)").run(user,3);
    assert.equal(active().id,1);
    assert.equal(active().progress,0);
    assert.deepEqual(game.sideQuests.state(user).missions[1],{id:2,status:"locked"});
    game.runtime(user);
    db.prepare("UPDATE game_runtime SET barracks_reserve=? WHERE user_id=?").run(
      JSON.stringify({Railgunner:50,"Exo-Soldier":140}),user);
    game.addInventoryReward(user,"army","Railgunner",25);
    game.withdrawInventory(user,"army","Railgunner",25);
    assert.equal(active().progress,0);
    assert.equal(game.mobilizeBarracks(user,"Exo-Soldier",40).error,undefined);
    const retryId=randomUUID();
    assert.equal(game.mobilizeBarracks(user,"Railgunner",20,retryId).error,undefined);
    game.mobilizeBarracks(user,"Railgunner",20,retryId);
    assert.equal(active().progress,20);
    assert.equal(await runInWorker(`return g.sideQuests.state(${user}).missions[0].progress;`),20);
    assert.equal(game.sideQuests.unreadReward(user),null);
    game.sideQuests.acknowledgeReward(user,[1,2]);
    game.mobilizeBarracks(user,"Railgunner",30);
    db.exec("DROP TABLE side_quest_reward_reads");
    require("../database/sideQuestSchema")(db);
    assert.equal(game.sideQuests.unreadReward(user),1);
    assert.equal(game.sideQuests.unreadReward(other),null);
    game.sideQuests.acknowledgeReward(user,[1,2]);
    game.sideQuests.acknowledgeReward(user,[1]);
    assert.equal(await runInWorker(`return g.sideQuests.unreadReward(${user});`),null);
    assert.equal(active().progress,50);
    const claimCode=`return g.sideQuests.claim(${user},1).error?"denied":"claimed";`;
    assert.deepEqual((await Promise.all([runInWorker(claimCode),runInWorker(claimCode)])).sort(),["claimed","denied"]);
    assert.equal(game.getInventory(user).army.Railgunner,50);
    assert.equal(game.sideQuests.claim(user,1).error,"This side quest reward is unavailable.");
    now=actualNow();
    assert.equal(active().id,2);
    assert.equal(active().progress,0);
    game.mobilizeBarracks(user,"ALL",0);
    assert.equal(active().progress,100);
    assert.equal(game.sideQuests.unreadReward(user),2);
    game.sideQuests.acknowledgeReward(user,[1]);
    assert.equal(game.sideQuests.unreadReward(user),2);
    assert.equal(game.listPlayerNotifications(user).notifications[0].kind,"side_quest_unlocked");

    const unlock=(id)=>db.prepare("UPDATE player_side_quests SET mission=?,progress=0,path=NULL,unlocked_at=? WHERE user_id=?").run(id,now,user);
    unlock(7);
    db.prepare("UPDATE game_runtime SET army=? WHERE user_id=?").run(JSON.stringify({"Explorer Trooper":20}),user);
    const mine=db.prepare("SELECT * FROM resource_mines WHERE resource='gold' ORDER BY id LIMIT 1").get();
    db.prepare("UPDATE resource_mines SET amount=30 WHERE id=?").run(mine.id);
    const recall=game.startGathering(user,mine.id,{"Explorer Trooper":2});
    now=recall.arrivesAt+7*3600;
    assert.equal(game.recallGathering(user,mine.id).amountCollected,7);
    assert.equal(active().progress,0);
    const depleted=game.startGathering(user,mine.id,{"Explorer Trooper":2});
    now=depleted.arrivesAt+23*3600;
    game.settleResourceMines();
    game.settleResourceMines();
    assert.equal(active().progress,1);
    const ironBefore=game.getInventory(user).resources.Iron||0;
    assert.equal(game.sideQuests.claim(user,7).missions[6].status,"claimed");
    assert.equal(game.getInventory(user).resources.Iron,ironBefore+5000);
    assert.equal(db.prepare("SELECT COUNT(*) AS n FROM resource_mines WHERE resource='gold'").get().n,10);

    // An eligible dispatch fixes the path. A subsequent alternative never replaces it.
    game.createAlliance(user,"Defenders");
    const allianceId=game.allianceState(user).alliance.id;
    db.prepare("INSERT INTO alliance_members(user_id,alliance_id) VALUES (?,?)").run(other,allianceId);
    unlock(25);
    assert.ok(game.sendAllianceReinforcement(user,other,{"Explorer Trooper":1}).missionId);
    game.sideQuests.record(user,"path","conqueror");
    assert.equal(active().path,"defender");
    game.sideQuests.claim(user,25);
    assert.deepEqual(game.getInventory(user).items,{attack:5,health:5});

    unlock(34);
    const event=game.recordHospitalWounds(user,"saturday-invasion",999,{"Explorer Trooper":6},"event",now);
    assert.ok(event);
    game.recoverEventHospital("saturday-invasion",999,now);
    assert.equal(active().progress,0);
    assert.ok(db.prepare("SELECT 1 FROM alien_side_quests WHERE user_id=? AND milestone=3").get(user));
    const wound=game.recordHospitalWounds(user,"player-defense",123,{"Explorer Trooper":8});
    db.prepare("UPDATE hospital_entries SET status='healing',heals_at=? WHERE id=?").run(now,wound);
    assert.equal(game.getHospital(user).ready["Explorer Trooper"],8);
    assert.equal(active().progress,0);
    const hospitalRetry=randomUUID();
    assert.equal(game.mobilizeHealedTroops(user,"Explorer Trooper",5,hospitalRetry).ready["Explorer Trooper"],3);
    assert.equal(game.mobilizeHealedTroops(user,"Explorer Trooper",5,hospitalRetry).ready["Explorer Trooper"],3);
    assert.equal(active().progress,5);
    assert.match(game.mobilizeHealedTroops(user,"Explorer Trooper",5).error,/Not enough/);
    assert.equal(game.mobilizeHealedTroops(user,"Explorer Trooper",3).ready["Explorer Trooper"],undefined);
    assert.equal(active().progress,8);
    assert.deepEqual(db.pragma("foreign_key_check"),[]);
    assert.equal(game.sideQuests.state(other).missions[0].progress,0);
  }finally{
    Date.now=actualNow;
    game.close();
    db.close();
    rmSync(dir,{recursive:true,force:true});
  }
});
