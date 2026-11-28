const assert = require("node:assert/strict");
const {test} = require("node:test");
const {mkdtempSync,rmSync} = require("node:fs");
const {tmpdir} = require("node:os");
const {join} = require("node:path");
const SQLite = require("better-sqlite3");
const {fight} = require("../shared/combatEngine");
const {calculateCargoCapacity} = require("../database/pvpLoot");
const {equipmentCombatBonuses,normalizeEquipmentItem} = require("../src/shared/cyberKnightEquipment");

const troop = "Explorer Trooper";
const army = count => ({[troop]:count});
const groups = (count,row=4) => [{unit:troop,count,row}];
const events = result => result.report.flatMap(round => round.events.filter(event=>event.deserted));
function stationary(attacker,defender,options={}) {
  return fight(army(100),army(100),groups(100),attacker,{
    playerDefense:true,defenderFormation:groups(100),defenderBonuses:defender,
    maxRounds:2,trackCasualties:true,hospitalSides:[0,1],random:()=>0,...options
  });
}

test("equal tiers and absent protocols cancel, and legacy leadership no longer affects attacks",()=>{
  for(const rate of [0,2,4,6]) assert.deepEqual(events(stationary({desertion:rate},{desertion:rate})),[]);
  const options={playerDefense:true,defenderFormation:groups(100,1),maxRounds:1,random:()=>0};
  const baseline=fight(army(100),army(100),groups(100,1),{},options);
  assert.deepEqual(fight(army(100),army(100),groups(100,1),{leadership:30},options),baseline);
});

test("only current active troops desert each round; no wounds, kills or regeneration credit",()=>{
  const result=stationary({desertion:2,revive:15},{desertion:6});
  assert.deepEqual(result.report.map(round=>round.events[0]),[
    {phase:-1,side:"attacker",unit:troop,deserted:4},
    {phase:-1,side:"attacker",unit:troop,deserted:3},
  ]);
  assert.deepEqual(result.survivors,army(100));
  assert.deepEqual(result.activeSurvivors,army(93));
  assert.deepEqual(result.creditedKills,{});
  assert.ok(result.report.every(round=>round.events.length===1));
  const opposing=stationary({desertion:6},{revive:15});
  assert.equal(opposing.report[0].events[0].deserted,6);
  assert.equal(opposing.defendersRemaining,89);
  assert.deepEqual(opposing.defenderSurvivors,army(100));
  assert.deepEqual(opposing.creditedKills,{});
  assert.ok(opposing.report.every(round=>round.events.length===1));
});

test("rounding is per owner across formations and reinforcements keep their own survivors",()=>{
  const support={id:7,army:army(50),formation:[...groups(16),...groups(17),...groups(17)]};
  const result=stationary({desertion:6},{},{
    maxRounds:1,defenderContingents:[support],
    defenderFormation:[...groups(33),...groups(33),...groups(34)]
  });
  assert.deepEqual(events(result),[
    {phase:-1,side:"defender",unit:troop,deserted:6},
    {phase:-1,side:"defender",unit:troop,deserted:3,contingentId:7}
  ]);
  assert.deepEqual(result.defenderSurvivors,army(100));
  assert.deepEqual(result.contingentSurvivors,{7:army(50)});
  assert.equal(result.defendersRemaining,141);
  assert.deepEqual(events(stationary({desertion:6},{},{defenderContingents:[{...support,bonuses:{desertion:6}}]})),[]);
  assert.deepEqual(events(fight(army(15),army(15),groups(15),{desertion:6},{
    playerDefense:true,defenderFormation:groups(15),maxRounds:1
  })),[]);
});

test("stored protocol tiers and gear adjust effective rates, and PvP returns deserters without cargo or wounds",()=>{
  const dir=mkdtempSync(join(tmpdir(),"neural-command-"));
  process.env.DATABASE_PATH=join(dir,"game.sqlite");
  const Game=require("../database/database");
  const game=new Game(), sql=new SQLite(process.env.DATABASE_PATH);
  try {
    const add=(name,tier,count)=>{
      const player=game.createUser(name+"@example.test",name,"fixture");
      game.playerTalents(player.userId);
      sql.prepare("UPDATE users SET created_at='2020-01-01' WHERE id=?").run(player.userId);
      sql.prepare("UPDATE player_talents SET talents=? WHERE user_id=?").run(JSON.stringify({"Battle Command":tier}),player.userId);
      game.runtime(player.userId);
      sql.prepare("UPDATE game_runtime SET army=? WHERE user_id=?").run(JSON.stringify(army(count)),player.userId);
      return player;
    };
    const attacker=add("Attacker",1,1000), defender=add("Defender",3,40);
    const boost=normalizeEquipmentItem({id:"boots",slot:"BOOTS",level:50,stars:1,effects:[{kind:"protocolBoost",target:"Battle Command"}]});
    const gloves=normalizeEquipmentItem({id:"gloves",slot:"GLOVES",level:50,stars:1,effects:[{kind:"enemyProtocol",target:"Battle Command"}]});
    const own=equipmentCombatBonuses({BOOTS:boost}), enemy=equipmentCombatBonuses({GLOVES:gloves});
    assert.equal(boost.id,"boots");
    assert.equal(boost.effects[0].target,"Battle Command");
    assert.equal(game.protocolCombatBonuses(attacker.userId,own).desertion,12);
    assert.equal(game.protocolCombatBonuses(attacker.userId,own,enemy).desertion,2);
    assert.equal(game.protocolCombatBonuses(attacker.userId,{},enemy).desertion,0);
    assert.deepEqual(game.playerTalents(attacker.userId).talents,{"Battle Command":1});

    const march=game.launchPlayerAttack(attacker.userId,army(1000),null,{username:"Defender",...defender.position},false,true);
    assert.ok(march.missionId,march.error);
    game.advanceCampaignTimeline(march.arrivesAt);
    const mission=sql.prepare("SELECT * FROM player_missions WHERE id=?").get(march.missionId);
    const result=JSON.parse(mission.result);
    assert.equal(result.victory,true);
    assert.equal(events(result)[0].deserted,40);
    const ret=result.survivors[troop];
    const active=result.activeSurvivors[troop];
    assert.ok(ret>active);
    assert.equal(result.cargoCapacity,calculateCargoCapacity(army(active)));
    assert.equal(result.attackerWounded[troop]||0,Math.floor((1000-ret)*0.3));
    assert.equal(result.creditedKills.defender?.[troop]||0,1000-ret-(result.attackerWounded[troop]||0));
    assert.ok(game.shareBattleReport(attacker.userId,"player",mission.id,"private","Defender").success);
    assert.match(sql.prepare("SELECT body FROM player_messages WHERE sender_id=?").get(attacker.userId).body,/Round 1 \/ Рунд 1 · Attacker desertion/);
    game.advanceCampaignTimeline(mission.returns_at);
    game.advanceCampaignTimeline(mission.returns_at+1000);
    assert.equal(JSON.parse(game.runtime(attacker.userId).army)[troop],ret);

    const player=add("PvECommander",3,10000);
    const id=player.userId;
    const now=mission.returns_at+2000;
    sql.prepare("UPDATE game_progress SET structures=? WHERE user_id=?").run('{"Combat Simulator":1}',id);
    const realNow=Date.now;
    Date.now=()=>now;
    try {
      const liveArmy=()=>JSON.parse(game.runtime(id).army);
      const simulation=game.simulateAlienBattle(id,1,army(10000),groups(10000,1));
      assert.ok(simulation.result,simulation.error);
      assert.ok(events(simulation.result).every(event=>event.side==="defender"));
      assert.ok(events(simulation.result).length>0);
      assert.deepEqual(liveArmy(),army(10000));

      const pve=game.attackAlienBase(id,1,army(10000),groups(10000,1),true);
      assert.ok(pve.missionId,pve.error);
      game.advanceCampaignTimeline(pve.arrivesAt);
      const alien=JSON.parse(sql.prepare("SELECT result FROM alien_missions WHERE id=?").get(pve.missionId).result);
      assert.ok(events(alien).some(event=>event.side==="defender"));
      assert.deepEqual(alien.wounded, Object.fromEntries(Object.entries(alien.survivors)
        .map(([unit,count])=>[unit,Math.floor((10000-count)*0.3)]).filter(([,count])=>count>0)));

      const saturday=Date.UTC(2030,0,12);
      Date.now=()=>saturday;
      game.createAlliance(id,"Saturday Command");
      const invasion=game.startSaturdayAllianceInvasion(id);
      assert.ok(invasion.runId,invasion.error);
      game.advanceCampaignTimeline(saturday+60000);
      const wave=JSON.parse(sql.prepare("SELECT result FROM saturday_invasion_attacks WHERE run_id=? AND resolved_at IS NOT NULL LIMIT 1").get(invasion.runId).result);
      const deserters=events(wave).filter(event=>event.side==="attacker").reduce((sum,event)=>sum+event.deserted,0);
      assert.ok(deserters>0);
      assert.ok(wave.alienCasualties+deserters<=wave.enemyUnits);

      const eventId=sql.prepare("INSERT INTO mothership_events(week_start,starts_at,ends_at,hp_remaining) VALUES (?,?,?,?)")
        .run(now,now,now+10000,10000000).lastInsertRowid;
      const addShipAttack=sql.prepare(`INSERT INTO mothership_attacks(event_id,user_id,army,formation,origin_x,origin_y,launched_at,arrives_at)
        VALUES (?,?,?,?,0,0,?,?)`);
      const score=tier=>{
        sql.prepare("UPDATE player_talents SET talents=? WHERE user_id=?").run(JSON.stringify({"Battle Command":tier}),id);
        const {lastInsertRowid}=addShipAttack.run(eventId,id,JSON.stringify(army(100)),JSON.stringify(groups(100,1)),now,now+1000);
        game.resolveMothershipAttacks(eventId,now+1000);
        return sql.prepare("SELECT damage FROM mothership_attacks WHERE id=?").get(lastInsertRowid).damage;
      };
      const untrained=score(0);
      assert.ok(untrained>0);
      assert.equal(score(3),untrained);
    } finally {
      Date.now=realNow;
    }
  } finally {
    sql.close();
    game.close();
    rmSync(dir,{recursive:true,force:true});
  }
});
