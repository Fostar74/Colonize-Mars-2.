const assert = require("node:assert/strict");
const {test} = require("node:test");
const {mkdtempSync,rmSync} = require("node:fs");
const {tmpdir} = require("node:os");
const {join} = require("node:path");
const {spawnSync} = require("node:child_process");
const SQLite = require("better-sqlite3");
const {calculateCargoCapacity} = require("../database/pvpLoot");

const folder = mkdtempSync(join(tmpdir(),"orange-empire-loot-"));
process.env.DATABASE_PATH = join(folder,"game.sqlite");
process.env.ORANGE_EMPIRE_ENABLED = "true";
process.env.ORANGE_EMPIRE_ATTACKS_ENABLED = "true";
const Game = require("../database/database");

test("home-base loot observes PvP protection and cargo, then survives restart and returns once",()=>{
  const game = new Game();
  const sql = new SQLite(process.env.DATABASE_PATH);
  const now = Date.now();
  const starting = {Gold:12005,Iron:10003,Water:9999,Solar:12007};
  const human = (name,army={}) => {
    const {userId,position} = game.createUser(name+"@example.test",name,"fixture");
    sql.prepare("UPDATE users SET created_at='2020-01-01' WHERE id=?").run(userId);
    game.awardPlayerXp(userId,39000);
    game.runtime(userId);
    sql.prepare("UPDATE game_progress SET resources=? WHERE user_id=?").run(JSON.stringify(starting),userId);
    sql.prepare("UPDATE game_runtime SET army=? WHERE user_id=?").run(JSON.stringify(army),userId);
    return {userId,...position};
  };
  const commander = () => JSON.parse(sql.prepare("SELECT state FROM orange_empire_commanders WHERE id=1").get().state);
  const balance = ({userId}) => JSON.parse(sql.prepare("SELECT resources FROM game_progress WHERE user_id=?").get(userId).resources);
  const getAttack = id => sql.prepare("SELECT * FROM orange_empire_attacks WHERE id=?").get(id);
  const result = id => JSON.parse(getAttack(id).result);
  const launch = (target,count,station=null) => {
    const {lastInsertRowid} = sql.prepare(`INSERT INTO orange_empire_attacks
      (commander_id,player_id,week_start,slot,station_id,station_alliance_id,origin_x,origin_y,x,y,launched_at,arrives_at,army,combat)
      VALUES (1,?,0,1,?,?,1,1,?,?,?,?,?,'{}')`).run(target.userId,station?.id??null,station?.allianceId??null,
      target.x,target.y,now,now+300000,JSON.stringify({"Explorer Trooper":count}));
    const state = commander();
    state.army["Explorer Trooper"]-=count;
    sql.prepare("UPDATE orange_empire_commanders SET state=? WHERE id=1").run(JSON.stringify(state));
    return Number(lastInsertRowid);
  };
  try {
    game.advanceOrangeEmpire(now);
    const empty=human("Empty"), cargo=human("Cargo"), defended=human("Defended",{"Explorer Trooper":10000});
    const shielded=human("Shielded"), ally=human("Ally");
    const commanderDefense=human("Commanded",{"Explorer Trooper":30});
    sql.prepare("UPDATE player_talents SET talents=? WHERE user_id=?").run('{"Battle Command":3}',commanderDefense.userId);
    game.createAlliance(ally.userId,"Station owners");
    const allianceId=game.allianceState(ally.userId).alliance.id;
    sql.prepare("INSERT INTO alliance_space_stations(station_id,alliance_id,unlocked_at,spaceport_status) VALUES (1,?,?,'building')")
      .run(allianceId,now);
    sql.prepare("INSERT INTO alliance_market_buffs(user_id,kind,expires_at) VALUES (?,'protection',?)")
      .run(shielded.userId,now+600001);
    const emptyId=launch(empty,100), cargoId=launch(cargo,1), defendedId=launch(defended,1);
    const shieldedId=launch(shielded,100), stationId=launch(ally,100,{id:1,allianceId});
    const commandId=launch(commanderDefense,1000);
    const npcBefore = commander();
    game.advanceCampaignTimeline(now+300000);

    const wideLoot={Gold:1002,Iron:1,Water:0,Solar:1003};
    const limitedLoot={Gold:15,Iron:1,Water:0,Solar:14};
    assert.equal(result(emptyId).victory,true);
    assert.deepEqual(result(emptyId).loot,wideLoot);
    assert.equal(result(emptyId).totalLoot,2006);
    assert.equal(result(cargoId).cargoCapacity,30);
    assert.deepEqual(result(cargoId).loot,limitedLoot);
    assert.equal(result(cargoId).totalLoot,30);
    const afterLoot = loot => Object.fromEntries(Object.entries(starting).map(([key,value])=>[key,value-loot[key]]));
    assert.deepEqual(balance(empty),afterLoot(wideLoot));
    assert.deepEqual(balance(cargo),afterLoot(limitedLoot));
    assert.equal(result(defendedId).victory,false);
    const commanded = result(commandId);
    assert.equal(commanded.victory,true);
    assert.equal(commanded.report[0].events[0].deserted,60);
    assert.ok(commanded.survivors["Explorer Trooper"]>commanded.activeSurvivors["Explorer Trooper"]);
    assert.equal(commanded.cargoCapacity,calculateCargoCapacity(commanded.activeSurvivors));
    assert.deepEqual(balance(commanderDefense),afterLoot(commanded.loot));
    assert.equal(result(shieldedId).cancelled,true);
    assert.equal(result(stationId).victory,true);
    for (const [target,id] of [[defended,defendedId],[shielded,shieldedId],[ally,stationId]]) {
      assert.equal(result(id).loot,undefined);
      assert.deepEqual(balance(target),starting);
    }
    assert.deepEqual(commander().resources,npcBefore.resources);
    game.advanceCampaignTimeline(now+300000);
    assert.deepEqual(balance(empty),afterLoot(wideLoot));

    const restart = spawnSync(process.execPath,["-e",`
      const game = new (require("./database/database"))();
      game.advanceCampaignTimeline(${now+600000});
    `],{encoding:"utf8",env:{...process.env,ORANGE_EMPIRE_ATTACKS_ENABLED:"false"}});
    assert.equal(restart.status,0,restart.stderr);
    const npcAfter = commander();
    assert.deepEqual(npcAfter.resources,Object.fromEntries(Object.entries(npcBefore.resources)
      .map(([key,value])=>[key,value+wideLoot[key]+limitedLoot[key]+commanded.loot[key]])));
    assert.equal(getAttack(emptyId).returned_at,now+600000);
    const returnedTroops = [emptyId,cargoId,defendedId,shieldedId,stationId,commandId].reduce((sum,id)=>
      sum+(result(id).cancelled?JSON.parse(getAttack(id).army):result(id).survivors)["Explorer Trooper"],0);
    assert.equal(npcAfter.army["Explorer Trooper"],npcBefore.army["Explorer Trooper"]+returnedTroops);
    game.advanceCampaignTimeline(now+700000);
    assert.deepEqual(commander(),npcAfter);
    assert.deepEqual(balance(empty),afterLoot(wideLoot));

    process.env.ORANGE_EMPIRE_ATTACKS_ENABLED="false";
    assert.deepEqual(game.getOrangeEmpireCombat(empty.userId),{});
    const report = game.getOrangeEmpireReports(empty.userId)[0];
    assert.equal(report.id,emptyId);
    assert.deepEqual(report.result.loot,wideLoot);
    assert.equal(report.result.totalLoot,2006);
    assert.equal(report.result.cargoCapacity,result(emptyId).cargoCapacity);
    assert.ok(!game.getOrangeEmpireReports(ally.userId).some(report=>report.id===emptyId));
  } finally {
    sql.close();
    game.close();
    rmSync(folder,{force:true,recursive:true});
  }
});
