const assert = require("node:assert/strict");
const {test} = require("node:test");
const {mkdtempSync,rmSync} = require("node:fs");
const {tmpdir} = require("node:os");
const {join} = require("node:path");
const {spawnSync} = require("node:child_process");
const SQLite = require("better-sqlite3");
const {armyPopulation,profileFor} = require("../src/shared/unitProfiles");
const {unitPrice} = require("../src/shared/unitEconomy");
const {fight} = require("../shared/combatEngine");
const {xpForKills} = require("../database/combatXp");
const tactics = require("../database/orangeEmpireTactics");
const {spaceshipDuration} = require("../database/earthChapter");

const dir = mkdtempSync(join(tmpdir(),"earth-orange-139-"));
process.env.DATABASE_PATH = join(dir,"game.sqlite");
process.env.ORANGE_EMPIRE_ENABLED = "true";
delete process.env.ORANGE_EMPIRE_ATTACKS_ENABLED;
const Game = require("../database/database");

test("NPC mine leases, practice and Earth chapter victory survive restart",()=>{
  const game = new Game();
  const sql = new SQLite(process.env.DATABASE_PATH);
  const player = name=>game.createUser(name+"@example.test",name,"fixture").userId;
  const now = Date.now();
  const state = id=>JSON.parse(sql.prepare("SELECT state FROM orange_empire_commanders WHERE id=?").get(id).state);
  const leases = ()=>sql.prepare("SELECT * FROM orange_empire_mine_marches ORDER BY id").all();
  try {
    const leader=player("Leader"), senior=player("Senior"), tied=player("Tied"), rival=player("Rival");
    game.createAlliance(leader,"First");
    game.createAlliance(rival,"Rival");
    const first = game.allianceState(leader).alliance.id;
    const second = game.allianceState(rival).alliance.id;
    for (const member of [senior,tied]) {
      sql.prepare("INSERT INTO alliance_members(user_id,alliance_id) VALUES (?,?)").run(member,first);
      game.awardPlayerXp(member,9000);
    }
    game.awardPlayerXp(rival,40000);
    game.runtime(leader);
    sql.prepare("UPDATE game_runtime SET army=? WHERE user_id=?").run('{"Explorer Trooper":100}',leader);
    const initialMines = sql.prepare("SELECT * FROM resource_mines ORDER BY id").all();
    assert.equal(initialMines.length,80);
    assert.equal(game.startGathering(leader,initialMines[0].id,{"Explorer Trooper":100}).success,true);
    game.advanceOrangeEmpire(now);
    const before = state(1);
    game.scheduleOrangeEmpireGathering(now);
    const active = leases();
    const external = active.find(march=>march.commander_id===1 && march.mode==="external");
    assert.ok(external);
    assert.equal(external.rate,1000);
    assert.ok(external.arrives_at>=now+10000);
    assert.ok(active.every(march=>march.external_id!==initialMines[0].id));
    assert.ok(state(1).army["Explorer Trooper"] < before.army["Explorer Trooper"]);
    assert.match(game.startGathering(leader,external.external_id,{"Explorer Trooper":1}).error,/already/);
    const map = game.getMapResources(leader);
    assert.ok(map.allianceMines.some(mine=>mine.npc && mine.status==="construction"));
    assert.ok(map.mines.find(mine=>mine.id===external.external_id).npc_claimed);
    assert.equal(map.mines.find(mine=>mine.id===initialMines[0].id).claimed_by,leader);
    assert.equal(new Set(active.filter(row=>row.external_id).map(row=>row.external_id)).size,10);
    const finish = now+6*3600000;
    game.advanceCampaignTimeline(finish);
    assert.ok(!leases().some(march=>march.id===external.id));
    const resource = initialMines.find(mine=>mine.id===external.external_id).resource;
    const key = resource[0].toUpperCase()+resource.slice(1);
    assert.equal(state(1).resources[key]-before.resources[key],Math.min(external.capacity,5000));
    assert.equal(sql.prepare("SELECT COUNT(*) AS n FROM resource_mines WHERE amount>0").get().n,80);
    assert.equal(sql.prepare("SELECT status FROM orange_empire_alliance_mine").get().status,"gathering");
    const armyWithMarches = armyPopulation(state(1).army)+leases().filter(m=>m.commander_id===1).reduce((sum,m)=>sum+m.population,0);
    assert.equal(armyWithMarches,armyPopulation(before.army));
    const after = state(1);
    game.advanceCampaignTimeline(finish);
    assert.deepEqual(state(1),after);

    const nextTick = finish+10000;
    game.advanceOrangeEmpire(nextTick);
    const practice = sql.prepare("SELECT * FROM orange_empire_practice ORDER BY commander_id").all();
    assert.equal(practice.length,10);
    assert.ok(practice.every(row=>row.simulations===3));
    game.advanceOrangeEmpire(nextTick+10000);
    assert.deepEqual(sql.prepare("SELECT * FROM orange_empire_practice ORDER BY commander_id").all(),practice);
    const deployed=tactics.balancedArmy(state(1).army,50000);
    assert.ok(Object.keys(deployed).length>=4);
    assert.ok(armyPopulation(deployed)<=50000);
    for (const {unit,row} of tactics.formation(deployed,practice[0].plan)) {
      assert.ok(row>=1 && row<=4 && row<=profileFor(unit).range);
    }

    const station = sql.prepare(`INSERT INTO alliance_space_stations(station_id,alliance_id,unlocked_at,spaceport_status,spaceport_started_at)
      VALUES (?,?,0,'building',?)`);
    station.run(1,second,finish-spaceshipDuration+2);
    station.run(2,first,finish-spaceshipDuration+1);
    game.advanceCampaignTimeline(finish+3);
    const winner=game.rankings(leader).earthWinner;
    assert.deepEqual(winner,{stationId:2,allianceId:first,allianceName:"First",userId:senior,completedAt:finish+1});
    assert.equal(game.getPlayerProfile(senior).earthDefender,true);
    assert.equal(game.getPlayerProfile(leader).earthDefender,undefined);
    assert.equal(game.rankings(leader).cyberKnights.find(row=>row.id===senior).earthDefender,true);
    assert.equal(sql.prepare("SELECT COUNT(*) AS n FROM alliance_space_stations WHERE spaceport_status='built'").get().n,2);
    sql.prepare("DELETE FROM alliance_members WHERE user_id=?").run(senior);

    const restart=spawnSync(process.execPath,["-e",`
      const game=new (require("./database/database"))();
      game.advanceCampaignTimeline(${finish+3});
      const assert=require("node:assert/strict");
      assert.deepEqual(game.rankings(${leader}).earthWinner,${JSON.stringify(winner)});
      assert.equal(game.getPlayerProfile(${senior}).earthDefender,true);
    `],{encoding:"utf8",env:process.env});
    assert.equal(restart.status,0,restart.stderr);
    assert.equal(sql.prepare("SELECT COUNT(*) AS n FROM orange_empire_attacks").get().n,0);
  } finally {
    sql.close();
    game.close();
    rmSync(dir,{force:true,recursive:true});
  }
});

test("XP counts actual deaths once and splits credit among participating owners",()=>{
  const attack={"Explorer Trooper":10000};
  const defense={"Railgunner":7000};
  const contingent={id:9,army:{"Railgunner":7000},formation:[{unit:"Railgunner",count:7000,row:1}]};
  const result = fight(attack,defense,[{unit:"Explorer Trooper",count:10000,row:1}],{},{
    playerDefense:true,defenderFormation:[{unit:"Railgunner",count:7000,row:1}],defenderContingents:[contingent],
    random:()=>0,trackCasualties:true,hospitalSides:[0,1]
  });
  const lost = attack["Explorer Trooper"]-result.survivors["Explorer Trooper"];
  const cost = Object.values(unitPrice("Explorer Trooper")).reduce((a,b)=>a+b,0);
  assert.ok(result.creditedKills.defender["Explorer Trooper"]>0 && result.creditedKills["support:9"]["Explorer Trooper"]>0);
  assert.equal(xpForKills(result.creditedKills.defender)+xpForKills(result.creditedKills["support:9"]),
    (lost-Math.floor(lost*0.3))*cost);
  process.env.COMBAT_XP_MULTIPLIER="0.5";
  try { assert.equal(xpForKills({"Explorer Trooper":2}),cost); }
  finally {delete process.env.COMBAT_XP_MULTIPLIER;}
});
