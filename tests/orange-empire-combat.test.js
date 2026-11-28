const assert = require("node:assert/strict");
const {test} = require("node:test");
const {mkdtempSync,rmSync} = require("node:fs");
const {tmpdir} = require("node:os");
const {join} = require("node:path");
const SQLite = require("better-sqlite3");
const {armyPopulation} = require("../src/shared/unitProfiles");

const directory = mkdtempSync(join(tmpdir(),"orange-empire-combat-"));
process.env.DATABASE_PATH = join(directory,"game.sqlite");
process.env.ORANGE_EMPIRE_ENABLED = "true";
delete process.env.ORANGE_EMPIRE_ATTACKS_ENABLED;
const Game = require("../database/database");

test("weekly dispatch, protected players, per-owner defense, and station gates", () => {
  const game = new Game();
  const sql = new SQLite(process.env.DATABASE_PATH);
  const monday = Date.UTC(2030,0,7);
  const day = 86400000;
  const attacks = id => sql.prepare("SELECT * FROM orange_empire_attacks WHERE player_id=? ORDER BY id").all(id);
  const troops = id => JSON.parse(sql.prepare("SELECT army FROM game_runtime WHERE user_id=?").get(id).army);
  const addPlayer = (name,xp,starter=false,army={"Explorer Trooper":1000}) => {
    const {userId:id} = game.createUser(name+"@example.test",name,"fixture");
    if (!starter) sql.prepare("UPDATE users SET created_at='2020-01-01 00:00:00' WHERE id=?").run(id);
    else sql.prepare("UPDATE users SET created_at='2030-01-07 00:00:00' WHERE id=?").run(id);
    game.awardPlayerXp(id,xp);
    game.runtime(id);
    sql.prepare("UPDATE game_runtime SET army=? WHERE user_id=?").run(JSON.stringify(army),id);
    return id;
  };
  try {
    const leader = addPlayer("Leader",39000,false,{"Explorer Trooper":900000});
    const solo = addPlayer("Solo",39000,false,{});
    const lower = addPlayer("Lower",38999);
    const beginner = addPlayer("Beginner",39000,true);
    const shielded = addPlayer("Shielded",39000);
    sql.prepare("INSERT INTO alliance_market_buffs(user_id,kind,expires_at) VALUES (?,'protection',?)").run(shielded,monday+30*day);
    game.createAlliance(leader,"Defenders");
    const allianceId = game.allianceState(leader).alliance.id;
    const allies = ["Alpha","Bravo","Charlie","Delta"].map(name => addPlayer(name,0));
    for (const ally of allies) sql.prepare("INSERT INTO alliance_members(user_id,alliance_id) VALUES (?,?)").run(ally,allianceId);
    game.advanceOrangeEmpire(monday);
    assert.deepEqual(game.getOrangeEmpireBases().map(base=>[base.level,base.knightLevel]),Array(10).fill([45,50]));

    game.scheduleOrangeEmpireAttacks(monday);
    assert.equal(attacks(leader).length,0);
    assert.deepEqual(game.getOrangeEmpireCombat(leader),{});
    process.env.ORANGE_EMPIRE_ATTACKS_ENABLED = "true";
    game.scheduleOrangeEmpireAttacks(monday);
    game.scheduleOrangeEmpireAttacks(monday);
    assert.equal(attacks(leader).length,1);
    assert.equal(attacks(solo).length,1);
    assert.equal(attacks(lower).length,0);
    assert.equal(attacks(beginner).length,0);
    assert.equal(attacks(shielded).length,0);

    const first = attacks(leader)[0];
    assert.equal(first.commander_id,1);
    assert.equal(first.slot,1);
    assert.equal(first.arrives_at-first.launched_at,300000*Math.max(1,Math.abs(first.x-first.origin_x),Math.abs(first.y-first.origin_y)));
    assert.ok(armyPopulation(JSON.parse(first.army))<=50000);
    assert.ok(game.getOrangeEmpireCombat(allies[0]).orangeEmpireAttacks.some(attack=>attack.id===first.id));
    assert.match(game.sendOrangeEmpireSupport(solo,first.id,{"Explorer Trooper":100},monday).error,/ally/);
    assert.match(game.sendOrangeEmpireSupport(allies[0],first.id,{"Explorer Trooper":100},first.arrives_at-1).error,/late/);
    for (const ally of allies.slice(0,3)) {
      assert.ok(game.sendOrangeEmpireSupport(ally,first.id,{"Explorer Trooper":100},monday).missionId);
      assert.equal(troops(ally)["Explorer Trooper"],900);
    }
    assert.match(game.sendOrangeEmpireSupport(allies[3],first.id,{"Explorer Trooper":100},monday).error,/slot/);

    const setEliteSnapshot = id => sql.prepare("UPDATE orange_empire_attacks SET combat=json_set(combat,'$.protocols',json(?),'$.knight.equippedItems',json('{}')) WHERE id=?")
      .run('{"Battle Command":3}',id);
    setEliteSnapshot(first.id);
    const soloAttack = attacks(solo)[0];
    sql.prepare("INSERT INTO alliance_market_buffs(user_id,kind,expires_at) VALUES (?,'protection',?)").run(solo,monday+day);
    game.advanceCampaignTimeline(monday+day);
    const resolved = JSON.parse(attacks(leader)[0].result);
    assert.equal(resolved.victory,false);
    assert.ok(resolved.defenderSurvivors["Explorer Trooper"]>50000);
    assert.equal(Object.keys(resolved.contingentSurvivors).length,3);
    assert.ok(resolved.combatXp.defender>0);
    const desertions = resolved.report[0].events.filter(event=>event.deserted>0);
    assert.equal(desertions.find(event=>event.contingentId===undefined).deserted,54000);
    assert.deepEqual(desertions.filter(event=>event.contingentId!==undefined).map(event=>event.deserted),[6,6,6]);
    assert.deepEqual(game.getOrangeEmpireReports(leader).find(report=>report.id===first.id).result.report[0].events,desertions);
    const xp = id=>sql.prepare("SELECT xp FROM player_talents WHERE user_id=?").get(id).xp;
    assert.equal(xp(leader),39000+resolved.combatXp.defender);
    assert.ok(sql.prepare("SELECT 1 FROM orange_empire_lessons WHERE lesson='plan:balanced'").get());
    for (const row of sql.prepare("SELECT * FROM orange_empire_support WHERE attack_id=?").all(first.id)) {
      const returned = JSON.parse(row.army)["Explorer Trooper"];
      assert.equal(troops(row.sender_id)["Explorer Trooper"],900+returned);
      assert.ok(returned>=6);
      const wound = sql.prepare("SELECT wounded FROM hospital_entries WHERE user_id=? AND source=? AND source_id=?")
        .get(row.sender_id,"orange-empire-defense",first.id);
      assert.equal(wound ? JSON.parse(wound.wounded)["Explorer Trooper"] : 0,Math.floor((100-returned)*0.3));
      assert.ok(row.returned_at);
    }
    assert.deepEqual(JSON.parse(attacks(solo)[0].result),{cancelled:true});
    assert.equal(attacks(solo)[0].id,soloAttack.id);
    const after = troops(allies[0]);
    const credited = xp(leader);
    game.advanceCampaignTimeline(monday+day);
    assert.deepEqual(troops(allies[0]),after);
    assert.equal(xp(leader),credited);

    sql.prepare(`INSERT INTO alliance_space_stations(station_id,alliance_id,unlocked_at,spaceport_status)
      VALUES (1,?,?,'building')`).run(allianceId,monday);
    game.scheduleOrangeEmpireAttacks(monday+2*day);
    assert.equal(attacks(leader).length,1);
    assert.equal(attacks(solo).length,1);
    sql.prepare("UPDATE orange_empire_commanders SET state=json_set(state,'$.army',json(?)) WHERE id=2")
      .run('{"Mech Walker":25000}');
    game.scheduleOrangeEmpireAttacks(monday+3*day);
    const second = attacks(leader)[1];
    assert.equal(second.commander_id,2);
    assert.equal(second.slot,2);
    assert.equal(second.station_id,1);
    assert.equal(armyPopulation(JSON.parse(second.army)),50000);
    assert.equal(attacks(solo)[1].slot,2);
    const stationArmy = '{"Explorer Trooper":1000}';
    for (const member of [leader,...allies]) {
      sql.prepare(`INSERT INTO alliance_station_defenders(station_id,alliance_id,user_id,army,status,sent_at,arrives_at)
        VALUES (1,?,?,?,'garrison',?,?)`).run(allianceId,member,stationArmy,monday,monday);
    }
    setEliteSnapshot(second.id);
    const stationHomes = new Map([leader,...allies].map(id=>[id,troops(id)["Explorer Trooper"]]));
    game.scheduleOrangeEmpireAttacks(monday+4*day);
    const stationResult = JSON.parse(attacks(leader)[1].result);
    assert.deepEqual(Object.keys(stationResult.contingentSurvivors).map(Number),allies.slice(0,3));
    const stationDesertions = stationResult.report.flatMap(round=>round.events.filter(event=>event.deserted>0));
    const readStation = id => JSON.parse(sql.prepare("SELECT army FROM alliance_station_defenders WHERE user_id=?").get(id).army);
    for (const id of [leader,...allies.slice(0,3)]) {
      const owner = id===leader ? undefined : id;
      const deserters = stationDesertions.filter(event=>event.contingentId===owner).reduce((n,event)=>n+event.deserted,0);
      const survivors = id===leader ? stationResult.defenderSurvivors : stationResult.contingentSurvivors[id];
      assert.ok(deserters>=60);
      assert.equal(troops(id)["Explorer Trooper"],stationHomes.get(id)+deserters);
      assert.equal(readStation(id)["Explorer Trooper"]+deserters,survivors["Explorer Trooper"]);
    }
    assert.ok(game.getOrangeEmpireReports(allies[0]).find(report=>report.id===second.id).result.report.length);
    assert.ok(!game.getOrangeEmpireReports(allies[3]).some(report=>report.id===second.id));
    assert.equal(sql.prepare("SELECT army FROM alliance_station_defenders WHERE user_id=?").get(allies[3]).army,stationArmy);
    assert.equal(attacks(leader).length,2);
    assert.equal(attacks(solo).length,2);

    // Seven earlier weeks bring both players to the Emperor's turn.
    const history = sql.prepare(`INSERT INTO orange_empire_attacks
      (commander_id,player_id,week_start,slot,origin_x,origin_y,x,y,launched_at,arrives_at,army,combat,result,returned_at)
      VALUES (1,?,?,1,1,1,2,2,0,0,'{}','{}','{}',0)`);
    for (let week=1;week<=7;week++) for (const id of [leader,solo]) history.run(id,monday-week*7*day);
    game.scheduleOrangeEmpireAttacks(monday+7*day);
    assert.equal(attacks(leader).at(-1).commander_id,10);
    assert.equal(attacks(solo).at(-1).commander_id,9);

    delete process.env.ORANGE_EMPIRE_ATTACKS_ENABLED;
    game.advanceCampaignTimeline(monday+8*day);
    assert.deepEqual(JSON.parse(attacks(leader).at(-1).result),{cancelled:true});
    assert.ok(attacks(leader).at(-1).returned_at);
  } finally {
    sql.close();
    game.close();
    rmSync(directory,{force:true,recursive:true});
  }
});
