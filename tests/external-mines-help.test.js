const assert=require("node:assert/strict");
const {test}=require("node:test");
const {mkdtempSync,rmSync}=require("node:fs");
const {tmpdir}=require("node:os");
const {join}=require("node:path");
const {spawnSync}=require("node:child_process");
const SQLite=require("better-sqlite3");
const work=mkdtempSync(join(tmpdir(),"cm106-"));
process.env.DATABASE_PATH=join(work,"game.sqlite");
const Game=require("../database/database");

test("external mines replenish independently and alliance help includes all active jobs",()=>{
  const game=new Game(), db=new SQLite(process.env.DATABASE_PATH);
  const clock=Date.now;
  let now=clock();
  Date.now=()=>now;
  try{
    const player=game.createUser("one@example.test","One","hash").userId;
    const player2=game.createUser("two@example.test","Two","hash").userId;
    game.createAlliance(player,"Demo Alliance");
    assert.match(game.requestAllianceHelp(player).error,/No active/);
    game.runtime(player);
    const endsAt=now+120000;
    db.prepare("UPDATE game_runtime SET building_job=?,upgrade_jobs=? WHERE user_id=?").run(
      JSON.stringify({name:"Gold Synthesizer",level:1,startedAt:now,duration:120000,endsAt}),
      JSON.stringify([{unit:"Railgunner",stat:"attack",level:2,startedAt:now,endsAt},
        {unit:"Rover Scout",stat:"defense",level:2,startedAt:now,endsAt}]),player);
    assert.equal(game.requestAllianceHelp(player).requestIds.length,3);
    assert.match(game.requestAllianceHelp(player).error,/already/);
    const baseline=db.prepare("SELECT resource,COUNT(*) AS n FROM resource_mines GROUP BY resource ORDER BY resource").all();
    assert.equal(baseline.length,4);
    assert.ok(baseline.every(row=>row.n===10));
    game.runtime(player2);
    const grant=db.prepare("UPDATE game_runtime SET army=? WHERE user_id=?");
    for(const user of [player,player2])grant.run(JSON.stringify({"Explorer Trooper":100}),user);
    const select=db.prepare("SELECT * FROM resource_mines WHERE resource=? ORDER BY id LIMIT 2");
    const ids=[];
    const claim=db.prepare("UPDATE resource_mines SET amount=?,gathering_started_at=?,arrives_at=? WHERE id=?");
    for(const [i,{resource}] of baseline.entries()){
      const [mine, untouched]=select.all(resource);
      const owner=i<2?player:player2;
      assert.equal(game.startGathering(owner,mine.id,{"Explorer Trooper":1}).success,true);
      claim.run(17,now+3600,now+3600,mine.id);
      ids.push([mine,untouched]);
      if(i===1)break;
    }
    // Two depleted mines and another occupied, partial mine are reconciled in one pass.
    const [water]=select.all("water");
    assert.equal(game.startGathering(player2,water.id,{"Explorer Trooper":1}).success,true);
    claim.run(85,now+17*3600,now+17*3600,water.id);
    const [solar]=select.all("solar");
    if(!ids.some(([mine])=>mine.id===solar.id)){
      assert.equal(game.startGathering(player2,solar.id,{"Explorer Trooper":1}).success,true);
      claim.run(13,now+3600+4*3600,now+3600+4*3600,solar.id);
      ids.push([solar,select.all("solar")[1]]);
    }
    now+=18*3600;
    game.settleResourceMines(now);
    for(const [mine,untouched] of ids){
      assert.equal(db.prepare("SELECT 1 FROM resource_mines WHERE id=?").get(mine.id),undefined);
      assert.deepEqual(db.prepare("SELECT * FROM resource_mines WHERE id=?").get(untouched.id),untouched);
      const report=db.prepare("SELECT * FROM resource_gathering_reports WHERE mine_id=?").get(mine.id);
      assert.equal(report.reason,"depleted");
      assert.equal(report.x,mine.x);
      const replacement=db.prepare("SELECT * FROM resource_mines WHERE resource=? ORDER BY id DESC LIMIT 1").get(mine.resource);
      assert.equal(replacement.amount,5000);
      assert.notDeepEqual([replacement.x,replacement.y],[mine.x,mine.y]);
    }
    const iron=db.prepare("SELECT * FROM resource_mines WHERE resource='water' ORDER BY id LIMIT 1").get();
    assert.equal(iron.claimed_by,player2);
    assert.equal(iron.amount,85);
    now+=2*3600;
    assert.equal(game.recallGathering(player2,water.id).amountCollected,3);
    assert.equal(db.prepare("SELECT amount FROM resource_mines WHERE id=?").get(water.id).amount,82);
    const final=game.startGathering(player2,water.id,{"Explorer Trooper":3});
    assert.equal(final.success,true);
    now=final.arrivesAt+82*3600;
    game.settleResourceMines(now);
    assert.equal(db.prepare("SELECT 1 FROM resource_mines WHERE id=?").get(water.id),undefined);
    const before=db.prepare("SELECT * FROM resource_mines ORDER BY id").all();
    assert.deepEqual(db.prepare("SELECT resource,COUNT(*) AS n FROM resource_mines GROUP BY resource ORDER BY resource").all(),baseline);
    const restart=spawnSync(process.execPath,["-e","const Game=require('./database/database'); new Game().close()"],{env:process.env,encoding:"utf8"});
    assert.equal(restart.status,0,restart.stderr);
    assert.deepEqual(db.prepare("SELECT * FROM resource_mines ORDER BY id").all(),before);
    assert.equal(game.settleResourceMines(now),0);
    const pending=game.listPlayerNotifications(player).notifications.filter(notice=>notice.kind==="gathering_return");
    assert.equal(pending.length,2);
    assert.equal(new Set(pending.map(notice=>notice.id)).size,2);
    const notification=pending[0];
    assert.equal(game.markPlayerNotificationRead(player2,notification.id).success,false);
    assert.equal(game.markPlayerNotificationRead(player,notification.id).success,true);
    const readAt=db.prepare("SELECT read_at FROM player_notifications WHERE id=?");
    const acknowledgedAt=readAt.get(notification.id).read_at;
    now+=1;
    assert.equal(game.markPlayerNotificationRead(player,notification.id).success,true);
    assert.equal(readAt.get(notification.id).read_at,acknowledgedAt);
    assert.deepEqual(game.listPlayerNotifications(player).notifications
      .filter(notice=>notice.kind==="gathering_return").map(notice=>notice.id),[pending[1].id]);
    assert.equal(game.getResourceGatheringReports(player).length,2);
    assert.equal(game.syncGame(player).army["Explorer Trooper"],100);
    assert.equal(game.syncGame(player2).army["Explorer Trooper"],100);
  }finally{
    Date.now=clock;
    game.close();
    db.close();
    rmSync(work,{recursive:true,force:true});
  }
});
