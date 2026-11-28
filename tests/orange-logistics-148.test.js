const assert=require("node:assert/strict");
const {test}=require("node:test");
const {mkdtempSync,rmSync}=require("node:fs");
const {tmpdir}=require("node:os");
const {join}=require("node:path");
const SQLite=require("better-sqlite3");
const work=mkdtempSync(join(tmpdir(),"cm148-"));
process.env.DATABASE_PATH=join(work,"game.sqlite");
process.env.ORANGE_EMPIRE_ENABLED="true";
const Game=require("../database/database");

test("daily NPC gear progression, trade caps and owned PvP support conserve state",()=>{
  const game=new Game(),sql=new SQLite(process.env.DATABASE_PATH),clock=Date.now;
  let now=Date.UTC(2026,10,27,23,59,59);
  Date.now=()=>now;
  try{
    game.advanceOrangeEmpire(now);
    assert.equal(game.getOrangeEmpireBases().length,10);
    assert.ok(game.getOrangeEmpireBases().every(base=>base.knightLevel===1));
    const knights=()=>sql.prepare("SELECT state FROM orange_empire_commanders ORDER BY id").all().map(row=>JSON.parse(row.state).knight);
    const old=knights();
    now+=1000;
    game.advanceOrangeEmpire(now);
    const first=knights();
    for(let i=0;i<10;i++) {
      assert.equal(first[i].level,2);
      assert.equal(Object.keys(first[i].equippedItems).length,6);
      for(const [slot,item] of Object.entries(first[i].equippedItems)) {
        assert.equal(item.level,2);
        assert.equal(item.id,old[i].equippedItems[slot].id);
        assert.equal(item.rarity,"Common");
      }
    }
    game.advanceOrangeEmpire(now+1);
    assert.deepEqual(knights(),first);
    now+=49*86400000;
    game.advanceOrangeEmpire(now);
    assert.ok(knights().every(knight=>knight.level===50&&knight.nextLevelAt===null&&Object.values(knight.equippedItems).every(item=>item.rarity==="Legendary"&&item.level===50)));

    const create=(name,x,y,count=1000)=>{
      const {userId}=game.createUser(name+"@example.test",name,"fixture");
      sql.prepare("UPDATE users SET created_at='2020-01-01' WHERE id=?").run(userId);
      sql.prepare("UPDATE base_positions SET x=?,y=? WHERE user_id=?").run(x,y,userId);
      sql.prepare("UPDATE game_progress SET castle_data=?,structures=?,resources=? WHERE user_id=?").run(JSON.stringify({username:name,x,y}),'{"Cargo Depot":4}','{"Gold":200000,"Iron":200000}',userId);
      game.runtime(userId);
      sql.prepare("UPDATE game_runtime SET army=? WHERE user_id=?").run(JSON.stringify({"Explorer Trooper":count}),userId);
      return userId;
    };
    const attacker=create("Narrator",1,1,1000);
    const defender=create("Guardian",50,50,1);
    const allies=[create("Alpha",49,50),create("Bravo",48,50),create("Charlie",47,50),create("Delta",46,50)];
    const outsider=create("Outsider",49,49);
    game.createAlliance(defender,"Defense Test");
    const alliance=game.allianceState(defender).alliance.id;
    for(const ally of allies)sql.prepare("INSERT INTO alliance_members(user_id,alliance_id) VALUES (?,?)").run(ally,alliance);
    const attack=game.launchPlayerAttack(attacker,{"Explorer Trooper":1000},null,{username:"Guardian",x:50,y:50},false,true);
    assert.ok(attack.missionId,attack.error);
    assert.equal(attack.arrivesAt-now,49*30000);
    assert.equal(game.getIncomingPlayerBattles(allies[0])[0].attacker,"Narrator");
    assert.deepEqual(game.getIncomingPlayerBattles(outsider),[]);
    assert.match(game.sendPlayerBattleSupport(outsider,attack.missionId,{"Explorer Trooper":10}).error,/ally/);
    for(const [index,ally] of allies.slice(0,3).entries()){
      assert.equal(game.sendPlayerBattleSupport(ally,attack.missionId,{"Explorer Trooper":100}).arrivesAt-now,(index+1)*60000);
    }
    assert.match(game.sendPlayerBattleSupport(allies[3],attack.missionId,{"Explorer Trooper":100}).error,/slot/);
    game.advanceCampaignTimeline(attack.arrivesAt);
    const result=JSON.parse(sql.prepare("SELECT result FROM player_missions WHERE id=?").get(attack.missionId).result);
    const rows=sql.prepare("SELECT * FROM player_battle_support WHERE mission_id=? ORDER BY id").all(attack.missionId);
    assert.equal(rows.length,3);
    assert.equal(Object.keys(result.contingentSurvivors).length,3);
    assert.ok(Object.hasOwn(result.combatXp,"support:"+rows[0].id));
    game.advanceCampaignTimeline(attack.arrivesAt+3600000);
    for(const row of rows){
      const survivorCount=JSON.parse(row.army)["Explorer Trooper"];
      assert.equal(JSON.parse(game.runtime(row.owner_id).army)["Explorer Trooper"],900+survivorCount);
      const record=sql.prepare("SELECT wounded FROM hospital_entries WHERE source='player-support' AND source_id=? AND user_id=?").get(row.id,row.owner_id);
      assert.equal(record?JSON.parse(record.wounded)["Explorer Trooper"]:0,Math.floor((100-survivorCount)*0.3));
    }

    now=attack.arrivesAt+3600000;
    assert.match(game.sendPlayerResources(defender,outsider,{Gold:20001}).error,/capacity/);
    for(let i=0;i<2;i++)assert.equal(game.sendPlayerResources(defender,outsider,{Gold:20000}).success,true);
    assert.equal(game.sendPlayerResources(defender,outsider,{Gold:1}).dailyRemaining,0);
    const listing=game.createMarketOffer(outsider,{Gold:100},{Iron:1});
    assert.ok(listing.offerId,listing.error);
    assert.match(game.acceptMarketOffer(defender,listing.offerId).error,/daily/i);
    now=Math.floor(now/86400000)*86400000+86400000;
    assert.equal(game.acceptMarketOffer(defender,listing.offerId).offerId,listing.offerId);
    assert.equal(game.resourcesSentToday(defender,now),1);
    assert.equal(game.resourcesSentToday(outsider,now),100);
  } finally {
    Date.now=clock;
    sql.close();game.close();rmSync(work,{recursive:true,force:true});
  }
});
