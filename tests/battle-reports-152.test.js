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
  assert.equal(rounds[0].start[1][0].column,0);
  assert.ok(rounds[0].events.some(event=>event.sourceGroup!=null&&event.targetGroup!=null));
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

const deployment=(unit,count,row,column=0)=>({unit,count,row,column});
test("standing Grid adds one range row and fires twice at full strength after heavy units",()=>{
  const attack=[deployment("Explorer Trooper",100,1),deployment("Exo-Soldier",100,2),
    deployment("Plasma Bladesman",100,3),deployment("Nano Shieldman",100,4)];
  const army=Object.fromEntries(attack.map(({unit,count})=>[unit,count]));
  const defense=[deployment("Mech Walker",50,2)];
  const options={trace:true,playerDefense:true,defenseGridLevel:1,defenderFormation:defense,maxRounds:1,random:()=>0.99};
  const events=fight(army,{"Mech Walker":50},attack,{},options).report[0].events;
  const turrets=events.filter(event=>event.kind==="grid-shot");
  assert.deepEqual(turrets.map(({turret,baseDamage,target})=>[turret,baseDamage,target]),[
    [1,2000,"Plasma Bladesman"],[2,2000,"Plasma Bladesman"]
  ]);
  const ranged=events.find(event=>event.unit==="Mech Walker"&&event.targetGroup!=null);
  assert.equal(ranged.phase,1);
  assert.equal(ranged.target,"Exo-Soldier");

  const siege=[deployment("Demolition Bot",100,1),...attack];
  const after=fight({...army,"Demolition Bot":100},{"Mech Walker":50},siege,{},options).report[0].events;
  assert.equal(after[0].kind,"grid-attack");
  assert.equal(after[0].units,100);
  assert.equal(after[0].destroyed,true);
  assert.ok(!after.some(event=>event.kind==="grid-shot"));
  assert.equal(after.find(event=>event.unit==="Mech Walker"&&event.targetGroup!=null).target,"Plasma Bladesman");
  assert.ok(!after.some(event=>event.unit==="Demolition Bot"&&event.targetGroup!=null));
});

test("heavy action can transition from grid to troops and eligibility follows the approved split brackets",()=>{
  const attack=[deployment("Demolition Bot",100,1),deployment("Missile Carrier",1001,2)];
  const options={trace:true,playerDefense:true,defenseGridLevel:1,maxRounds:1,random:()=>0};
  const result=fight({"Demolition Bot":100,"Missile Carrier":1001},{"Explorer Trooper":100000},attack,{},options);
  const actions=result.report[0].events;
  assert.equal(actions[0].kind,"grid-attack");
  assert.deepEqual(actions.filter(event=>event.unit==="Missile Carrier"&&event.targetGroup!=null).map(event=>event.units),[201,200,200,200,200]);
  const expected=[[99,1],[100,2],[499,2],[500,3],[999,3],[1000,5]];
  for(const [count,segments] of expected){
    const battle=fight({"Explorer Trooper":count},{"Explorer Trooper":100000},
      [deployment("Explorer Trooper",count,1)],{}, {...options,defenseGridLevel:0});
    const fire=battle.report[0].events.filter(event=>event.sourceSide===0&&event.targetGroup!=null);
    assert.equal(fire.length,segments);
    assert.equal(fire.reduce((sum,event)=>sum+event.units,0),count);
    assert.ok(Math.max(...fire.map(event=>event.units))-Math.min(...fire.map(event=>event.units))<=1);
    assert.ok(battle.report[0].events.some(event=>event.sourceSide===1&&event.targetGroup!=null));
  }
});

test("same-phase destroyed stacks still fire, without firing again in later phases",()=>{
  const army={"Railgunner":100,"Explorer Trooper":10};
  const formation=[deployment("Railgunner",100,1),deployment("Explorer Trooper",10,1,1)];
  const result=fight(army,army,formation,{allAttack:1000},{
    trace:true,playerDefense:true,defenderBonuses:{allAttack:1000},defenderFormation:formation,
    maxRounds:1,random:()=>0,
  });
  const fired=result.report[0].events.filter(event=>event.targetGroup!=null);
  const defenderRanged=fired.find(event=>event.sourceSide===1&&event.unit==="Railgunner");
  assert.equal(defenderRanged.units,50);
  assert.equal(defenderRanged.phase,1);
  assert.ok(fired.some(event=>event.sourceSide===0&&event.unit==="Railgunner"&&event.targetLoss===100));
  assert.ok(!fired.some(event=>event.phase===3&&event.unit==="Explorer Trooper"));
});

test("a Grid keeps an empty defense active until struck down",()=>{
  const attack={"Demolition Bot":1};
  const result=fight(attack,{},[deployment("Demolition Bot",1,1)],{},{
    trace:true,playerDefense:true,defenseGridLevel:1,maxRounds:2,random:()=>0,
  });
  assert.equal(result.victory,false);
  assert.equal(result.report[0].grid.startHealth,1000);
  assert.ok(result.report[0].events.some(event=>event.kind==="grid-shot"));
  assert.ok(!result.report.some(round=>round.grid.endHealth===0));
});
