const assert=require("node:assert/strict");
const {test}=require("node:test");
const {mkdtempSync,rmSync}=require("node:fs");
const {tmpdir}=require("node:os");
const {join}=require("node:path");
const SQLite=require("better-sqlite3");
const {fight}=require("../shared/combatEngine");

test("recording actual battle inputs leaves existing outcomes and random calls unchanged",()=>{
  const attacker={"Explorer Trooper":100,"Railgunner":50};
  const defender={"Alien Infantry":85};
  const formation=[{unit:"Explorer Trooper",count:100,row:1,column:2},{unit:"Railgunner",count:50,row:2,column:5}];
  const fightWithTrace=trace=>{
    let calls=0;
    const result=fight(attacker,defender,formation,{desertion:6,revive:15},{
      trace,trackCasualties:true,random:()=>{calls++;return 0.2;}, maxRounds:10
    });
    return {result,calls};
  };
  const plain=fightWithTrace(false),recorded=fightWithTrace(true);
  assert.equal(recorded.result.traceVersion,1);
  assert.equal(recorded.calls,plain.calls);
  for(const key of ["survivors","activeSurvivors","defenderSurvivors","victory","rounds","creditedKills"]){
    assert.deepEqual(recorded.result[key],plain.result[key]);
  }
  const rounds=recorded.result.report;
  assert.equal(rounds[0].start[0][0].column,2);
  assert.equal(rounds[0].start[1][0].column,null);
  assert.ok(rounds[0].events.some(event=>event.sourceGroup!==undefined&&event.targetGroup!==undefined));
  for(let i=1;i<rounds.length;i++)assert.deepEqual(rounds[i].start.map(side=>side.map(group=>group.count)),rounds[i-1].end);
});

test("completed alien reports can be shared, and attachments use the recorded snapshot only",()=>{
  const work=mkdtempSync(join(tmpdir(),"reports-152-"));
  process.env.DATABASE_PATH=join(work,"game.sqlite");
  const game=new(require("../database/database"))();
  const sql=new SQLite(process.env.DATABASE_PATH);
  try{
    const create=name=>game.createUser(name+"@example.test",name,"fixture").userId;
    const owner=create("Owner"),recipient=create("Receiver"),outsider=create("Outsider");
    game.runtime(owner);
    sql.prepare("UPDATE game_runtime SET army=? WHERE user_id=?").run('{"Explorer Trooper":1000}',owner);
    game.saveUserEquipment(owner,{BOOTS:{id:"snapshot-boots",name:"Plasma Boots",slot:"BOOTS",level:1,rarity:"Common",stars:1,effects:[{kind:"protocolBoost",target:"Battle Command",value:0.1}]}},[],{});
    const mission=game.attackAlienBase(owner,1,{"Explorer Trooper":1000},[{unit:"Explorer Trooper",count:1000,row:1,column:2}],true);
    assert.ok(mission.missionId,mission.error);
    const stored=JSON.parse(sql.prepare("SELECT result FROM alien_missions WHERE id=?").get(mission.missionId).result);
    assert.equal(stored.knights.attacker.equipped.BOOTS.id,"snapshot-boots");
    assert.equal(stored.traceVersion,1);
    game.saveUserEquipment(owner,{},[],{});
    assert.match(game.shareBattleReport(outsider,"alien",mission.missionId,"private","Receiver").error,/not found/);
    assert.ok(game.shareBattleReport(owner,"alien",mission.missionId,"private","Receiver").success);
    const message=game.listMessages(recipient,"private").messages[0];
    assert.match(message.body,/Alien base report/);
    assert.equal(message.hasBattleReport,1);
    assert.equal(game.getSharedBattleReport(outsider,message.id),null);
    assert.deepEqual(game.getSharedBattleReport(recipient,message.id).knights,stored.knights);

    const historical=sql.prepare("INSERT INTO alien_missions(user_id,level,army,launched_at,arrives_at,resolved_at,result) VALUES (?,1,'{}',0,0,0,'{}')").run(owner);
    assert.ok(game.shareBattleReport(owner,"alien",Number(historical.lastInsertRowid),"private","Receiver").success);
    const old=game.listMessages(recipient,"private").messages[0];
    assert.equal(game.getSharedBattleReport(recipient,old.id).knights,null);
  }finally{
    sql.close();
    game.close();
    rmSync(work,{recursive:true,force:true});
  }
});
