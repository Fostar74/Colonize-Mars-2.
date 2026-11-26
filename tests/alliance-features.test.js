const assert = require("node:assert/strict");
const { mkdtempSync, rmSync } = require("node:fs");
const { tmpdir } = require("node:os");
const { join } = require("node:path");
const { test } = require("node:test");
const { spawnSync } = require("node:child_process");

const workDir = mkdtempSync(join(tmpdir(), "colonize-mars-tests-"));
process.env.DATABASE_PATH = join(workDir, "game.sqlite");

const SQLite = require("better-sqlite3");
const DatabaseManager = require("../database/database");
const migrateAllianceMines = require("../database/allianceMineSchema");
const { hour } = require("../database/allianceMineWork");

test("alliance mine, protocol reset, and protected resources use persistent transactions", async t => {
  const game = new DatabaseManager();
  const sql = new SQLite(process.env.DATABASE_PATH);
  const originalNow = Date.now;
  let now = originalNow();
  Date.now = () => now;
  try {
    const newPlayer = username => game.createUser(username+"@example.test",username,"unused-test-hash");
    const leader = newPlayer("Leader");
    const member = newPlayer("Member");
    const enemy = newPlayer("Enemy");
    const troop = "Explorer Trooper";
    const setArmy = (userId, units) => {
      game.runtime(userId);
      sql.prepare("UPDATE game_runtime SET army=? WHERE user_id=?").run(JSON.stringify(units),userId);
    };
    const army = userId => game.syncGame(userId).army;
    const points = userId => sql.prepare("SELECT points FROM alliance_wallets WHERE user_id=?").get(userId)?.points || 0;
    const createAlliance = game.createAlliance(leader.userId,"Test Alliance");
    assert.equal(createAlliance.error,undefined);
    const allianceId = game.allianceState(leader.userId).alliance.id;
    sql.prepare("INSERT INTO alliance_members(user_id,alliance_id) VALUES (?,?)").run(member.userId,allianceId);
    assert.match(game.placeAllianceMine(member.userId,40,40,"Gold").error,/leader/);
    assert.match(game.placeAllianceMine(leader.userId,leader.position.x,leader.position.y,"Gold").error,/empty/);
    const openTiles = [49,48,47,46,45].filter(y=>!sql.prepare("SELECT 1 FROM resource_mines WHERE x=50 AND y=?").get(y));
    const [mineY, otherY] = openTiles;
    const placed = game.placeAllianceMine(leader.userId,50,mineY,"Gold");
    assert.equal(placed.success,true);
    const mineId = placed.allianceMine.active.id;
    assert.match(game.placeAllianceMine(leader.userId,50,otherY,"Iron").error,/already/);
    const launch = (player,mode,count) => game.launchAllianceMineMarch(player.userId,mineId,mode,{[troop]:count});
    assert.match(launch(enemy,"construction",1).error,/unavailable/);
    setArmy(leader.userId,{[troop]:50001});
    setArmy(member.userId,{[troop]:50000});
    assert.match(launch(leader,"construction",50001).error,/50,000/);
    const first = launch(leader,"construction",50000);
    assert.equal(first.success,true);
    assert.equal(army(leader.userId)[troop],1);
    assert.equal(points(leader.userId),0);
    now = first.arrivesAt + hour / 2;
    game.settleAllianceMines();
    game.settleAllianceMines();
    assert.equal(points(leader.userId),250);
    assert.equal(game.withdrawAllianceMine(leader.userId,mineId).success,true);
    assert.match(game.withdrawAllianceMine(leader.userId,mineId).error,/no active/);
    assert.equal(army(leader.userId)[troop],50001);

    const builders = launch(member,"construction",50000);
    const completion=builders.arrivesAt+19.5*hour;
    now=completion-1000;
    game.settleAllianceMines();
    const late=launch(leader,"construction",5000);
    assert.ok(late.arrivesAt>completion);
    assert.equal(game.getAllianceMine(leader.userId).active.arrivedPopulation,50000);
    now=completion;
    const restarted=spawnSync(process.execPath,["-e",
      "Date.now=()=>Number(process.argv[1]); const Game=require('./database/database'); const game=new Game(); game.settleAllianceMines(); game.close();",
      String(now)],{env:process.env,encoding:"utf8"});
    assert.equal(restarted.status,0,restarted.stderr);
    game.settleAllianceMines();
    assert.equal(game.getAllianceMine(member.userId).active.status,"gathering");
    assert.equal(points(member.userId),9750);
    assert.equal(points(leader.userId),250);
    assert.equal(army(member.userId)[troop],0);
    assert.equal(game.getAllianceMineMarch(member.userId).mode,"gathering");
    assert.equal(game.getAllianceMineMarch(member.userId).gathering_started_at,completion);
    assert.equal(game.getAllianceMineMarch(leader.userId).gathering_started_at,late.arrivesAt);
    assert.equal(game.getAllianceMineMarch(leader.userId).gathered,0);
    assert.deepEqual(game.getAllianceMine(member.userId).contributions.map(entry=>entry.points),[975000,25000]);
    assert.deepEqual(game.listPlayerNotifications(member.userId).notifications.map(notice=>notice.kind),
      ["alliance_mine_started","alliance_mine_completed"]);
    assert.match(launch(member,"gathering",1).error,/already/);

    now=late.arrivesAt+hour;
    game.settleAllianceMines();
    assert.equal(game.getAllianceMineMarch(leader.userId).gathered,2000);
    assert.equal(game.getAllianceMineMarch(member.userId).gathered,Math.floor((now-completion)/1800));
    assert.equal(game.withdrawAllianceMine(member.userId,mineId).success,true);
    const collection = game.getResourceGatheringReports(member.userId)[0];
    assert.equal(collection.amount,Math.floor((now-completion)/1800));
    assert.equal(collection.reason,"recalled");
    assert.equal(collection.source,"alliance");
    assert.equal(game.withdrawAllianceMine(leader.userId,mineId).success,true);
    const small=launch(leader,"gathering",1);
    assert.equal(small.success,true);
    now=small.arrivesAt+30*1800;
    game.settleAllianceMines();
    assert.equal(game.getAllianceMineMarch(leader.userId),null);
    assert.equal(game.getResourceGatheringReports(leader.userId)[0].reason,"cargo_full");
    assert.equal(game.getResourceGatheringReports(leader.userId)[0].amount,30);
    assert.equal(game.getAllianceMine(member.userId).active.amount,1000000-2000-30-collection.amount);

    // A nearly depleted mine with two armies due on the same tick has one winner.
    sql.prepare("UPDATE alliance_mines SET amount=1 WHERE id=?").run(mineId);
    assert.equal(launch(leader,"gathering",100).success,true);
    const final = launch(member,"gathering",100);
    sql.prepare("UPDATE alliance_mine_marches SET arrives_at=?,gathering_started_at=? WHERE mine_id=? AND returned_at IS NULL").run(final.arrivesAt,final.arrivesAt,mineId);
    now = final.arrivesAt + 3600;
    game.settleAllianceMines();
    game.settleAllianceMines();
    const finalReports = [leader,member].map(player=>game.getResourceGatheringReports(player.userId)[0]);
    assert.equal(finalReports.reduce((sum,report)=>sum+report.amount,0),1);
    assert.ok(finalReports.every(report=>report.reason==="depleted"));
    assert.equal(game.getResourceGatheringReports(member.userId).length,2);
    assert.equal(game.placeAllianceMine(leader.userId,50,mineY,"Water").success,true);

    sql.prepare("UPDATE alliance_wallets SET points=points+50000 WHERE user_id=?").run(member.userId);
    assert.equal(game.buyAllianceMarket(member.userId,"protocol_reset").inventory.items.protocol_reset,1);
    assert.equal(points(member.userId),9750);
    game.playerTalents(member.userId);
    sql.prepare("UPDATE player_talents SET xp=? WHERE user_id=?").run(2800,member.userId);
    game.upgradePlayerTalent(member.userId,"Precision Fire");
    const allocated = game.playerTalents(member.userId);
    setArmy(member.userId,{[troop]:1000});
    sql.prepare("INSERT INTO beginner_protection_forfeits(user_id,forfeited_at) VALUES (?,?)").run(enemy.userId,now);
    const target = {username:"Enemy",...enemy.position};
    const resources = {Gold:11001,Iron:10000,Water:9999,Solar:10050};
    sql.prepare("UPDATE game_progress SET resources=? WHERE user_id=?").run(JSON.stringify(resources),enemy.userId);
    const attack = game.launchPlayerAttack(member.userId,{[troop]:1000},null,target,false,true);
    assert.equal(attack.error,undefined);
    assert.match(game.useInventoryItem(member.userId,"protocol_reset",1).error,/active combat/);
    assert.equal(game.getInventory(member.userId).items.protocol_reset,1);
    now = attack.arrivesAt;
    game.resolvePlayerMissions(member.userId);
    const result = JSON.parse(sql.prepare("SELECT result FROM player_missions WHERE id=?").get(attack.missionId).result);
    assert.deepEqual(result.loot,{Gold:500,Iron:0,Water:0,Solar:25});
    const afterBattle = game.syncGame(enemy.userId).resources;
    assert.deepEqual(afterBattle,{Gold:10501,Iron:10000,Water:9999,Solar:10025});
    assert.match(game.useInventoryItem(member.userId,"protocol_reset",1).error,/active combat/);
    now = sql.prepare("SELECT returns_at FROM player_missions WHERE id=?").get(attack.missionId).returns_at;
    assert.equal(game.useInventoryItem(member.userId,"protocol_reset",1).inventory.items.protocol_reset,undefined);
    const reset = game.playerTalents(member.userId);
    assert.deepEqual(reset.talents,{});
    assert.equal(reset.xp,allocated.xp);
    assert.equal(reset.skillPoints,allocated.skillPoints+1);

    setArmy(member.userId,{"Rover Scout":1});
    const scout = game.launchPlayerScout(member.userId,target,1);
    now = scout.arrivesAt;
    game.syncGame(member.userId);
    assert.deepEqual(game.getPlayerScoutMissions(member.userId)[0].report.resources,{Gold:501,Iron:0,Water:0,Solar:25});
    const historicReport = {success:true,resources};
    sql.prepare("UPDATE player_scout_missions SET report=? WHERE id=?").run(JSON.stringify(historicReport),scout.missionId);
    assert.deepEqual(game.getPlayerScoutMissions(member.userId)[0].report.resources,{Gold:1001,Iron:0,Water:0,Solar:50});
    const notice=game.listPlayerNotifications(member.userId).notifications.find(n=>n.kind==="espionage_report");
    assert.equal(notice.createdAt,scout.arrivesAt);
    assert.equal(game.markPlayerNotificationRead(member.userId,notice.id).success,true);
    now=scout.returnsAt;
    game.syncGame(member.userId);
    assert.equal(game.listPlayerNotifications(member.userId).notifications.some(n=>n.kind==="espionage_report"),false);
    const lastSeen=now-8*86400000;
    sql.prepare("INSERT INTO player_activity(user_id,last_seen_at) VALUES (?,?) ON CONFLICT(user_id) DO UPDATE SET last_seen_at=excluded.last_seen_at").run(enemy.userId,lastSeen);
    sql.prepare("UPDATE game_runtime SET production_at=? WHERE user_id=?").run(lastSeen,enemy.userId);
    sql.prepare("UPDATE game_progress SET resources=?,structures=? WHERE user_id=?")
      .run(JSON.stringify({Gold:10000,Iron:10000,Water:10000,Solar:10000}),JSON.stringify({"Iron Driller":1}),enemy.userId);
    const offlineScout=game.launchPlayerScout(member.userId,target,1);
    now=offlineScout.arrivesAt;
    const report=game.syncGame(member.userId)&&game.getPlayerScoutMissions(member.userId)[0].report;
    assert.equal(report.abandoned,true);
    assert.deepEqual(report.resources,{Gold:0,Iron:Math.floor((now-lastSeen)/10000),Water:0,Solar:0});
    assert.equal(game.lastPlayerActivity(enemy.userId),lastSeen);

    assert.equal(game.donateAlliance(member.userId,"Iron").error,undefined);
    assert.deepEqual(game.syncGame(member.userId).resources.Iron,9900);
    await t.test("5,000 population earns 50 AP per hour in the shared wallet across 720 polls", () => {
      const mine = game.getAllianceMine(member.userId).active;
      sql.prepare("UPDATE alliance_wallets SET points=49900,construction_ap_remainder=0 WHERE user_id=?").run(member.userId);
      setArmy(member.userId,{[troop]:5000});
      const march = game.launchAllianceMineMarch(member.userId,mine.id,"construction",{[troop]:5000});
      assert.equal(march.success,true);
      for (let tick=1; tick<=720; tick++) {
        now=march.arrivesAt+tick*10000;
        game.settleAllianceMines();
      }
      assert.equal(points(member.userId),50000);
      assert.equal(game.buyAllianceMarket(member.userId,"protocol_reset").inventory.items.protocol_reset,1);
      assert.equal(points(member.userId),0);
      assert.equal(sql.prepare("SELECT construction_ap_remainder FROM alliance_wallets WHERE user_id=?").get(member.userId).construction_ap_remainder,0);
    });

    await t.test("late processing gives the same PvP outcome and return as on-time processing", () => {
      const scenario = (name, late) => {
        const raider = newPlayer(name+"Raider");
        const defender = newPlayer(name+"Defender");
        setArmy(raider.userId,{[troop]:1000});
        setArmy(defender.userId,{[troop]:1});
        sql.prepare("INSERT INTO beginner_protection_forfeits(user_id,forfeited_at) VALUES (?,?)").run(defender.userId,now);
        game.createAlliance(defender.userId,name+" Alliance");
        const allianceId=game.allianceState(defender.userId).alliance.id;
        const tile=[39,38,37,36,35].find(y=>!sql.prepare(`SELECT 1 FROM alliance_mines WHERE x=50 AND y=?
          UNION ALL SELECT 1 FROM resource_mines WHERE x=50 AND y=?`).get(y,y));
        const mineId=sql.prepare(`INSERT INTO alliance_mines(alliance_id,x,y,resource,status,work)
          VALUES (?,50,?,'Gold','gathering',3600000000000)`).run(allianceId,tile).lastInsertRowid;
        const attack=game.launchPlayerAttack(raider.userId,{[troop]:1000},null,{username:name+"Defender",...defender.position},false,true);
        assert.ok(attack.arrivesAt,attack.error);
        assert.equal(game.launchAllianceMineMarch(defender.userId,mineId,"gathering",{[troop]:1}).success,true);
        const mineArrival=attack.arrivesAt-30000;
        const cargoFull=mineArrival+30*1800;
        sql.prepare("UPDATE alliance_mine_marches SET arrives_at=?,gathering_started_at=? WHERE mine_id=?").run(mineArrival,mineArrival,mineId);
        const returnAt=attack.arrivesAt+(attack.arrivesAt-attack.launchedAt);
        if(!late){
          now=attack.arrivesAt;
          game.settleAllianceMines();
          assert.equal(army(defender.userId)[troop],0);
        }
        now=Math.max(cargoFull,returnAt)+1000;
        // A map/report poll can settle the mine before anyone opens Campaigns.
        game.getResourceGatheringReports(defender.userId);
        const row=sql.prepare("SELECT * FROM player_missions WHERE id=?").get(attack.missionId);
        assert.equal(row.resolved_at,attack.arrivesAt);
        assert.equal(row.returned_at,returnAt);
        assert.equal(army(raider.userId)[troop],1000);
        assert.equal(army(defender.userId)[troop],1);
        assert.equal(game.syncGame(defender.userId).resources.Gold,10030);
        const result=JSON.parse(row.result);
        assert.deepEqual(result.defenderInitial,{});
        assert.equal(result.totalLoot,0);
        const report=game.getResourceGatheringReports(defender.userId)[0];
        assert.equal(report.returnedAt,cargoFull);
        return result;
      };
      assert.deepEqual(scenario("Late",true),scenario("OnTime",false));
    });

    migrateAllianceMines(sql);
    assert.equal(game.getResourceGatheringReports(member.userId).length,2);
    assert.deepEqual(sql.pragma("integrity_check"),[{integrity_check:"ok"}]);
    assert.deepEqual(sql.pragma("foreign_key_check"),[]);
  } finally {
    Date.now = originalNow;
    game.close();
    sql.close();
    rmSync(workDir,{recursive:true,force:true});
  }
});

test("the additive migration preserves existing report rows and can run twice", () => {
  const legacy = new SQLite(":memory:");
  try {
    legacy.exec(`CREATE TABLE resource_gathering_reports (id INTEGER PRIMARY KEY, amount INTEGER);
      CREATE TABLE alliance_wallets (user_id INTEGER PRIMARY KEY, points INTEGER);
      INSERT INTO alliance_wallets VALUES (1,50000), (2,17.25);
      INSERT INTO resource_gathering_reports VALUES (7,5000)`);
    migrateAllianceMines(legacy);
    migrateAllianceMines(legacy);
    assert.deepEqual(legacy.prepare("SELECT * FROM alliance_wallets ORDER BY user_id").all(), [
      {user_id:1,points:50000,construction_remainder:0,construction_ap_remainder:0},{user_id:2,points:17,construction_remainder:900000,construction_ap_remainder:0},
    ]);
    assert.deepEqual(legacy.prepare("SELECT * FROM resource_gathering_reports").all(),
      [{id:7,amount:5000,source:"resource"}]);
  } finally {
    legacy.close();
  }
});
