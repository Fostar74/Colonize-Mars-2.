const assert = require("node:assert/strict");
const {test} = require("node:test");
const {mkdtempSync,rmSync} = require("node:fs");
const {tmpdir} = require("node:os");
const {join} = require("node:path");
const {spawnSync} = require("node:child_process");
const SQLite = require("better-sqlite3");
const {armyPopulation} = require("../src/shared/unitProfiles");
const {buildingNames,buildingMaxLevel,categories} = require("../src/shared/unitEconomy");

const directory = mkdtempSync(join(tmpdir(),"orange-empire-bootstrap-"));
process.env.DATABASE_PATH = join(directory,"game.sqlite");
process.env.ORANGE_EMPIRE_ENABLED = "true";
delete process.env.ORANGE_EMPIRE_ATTACKS_ENABLED;
const Game = require("../database/database");

test("boosts fresh and existing commanders exactly once, preserving earned progress", () => {
  const game = new Game();
  const sql = new SQLite(process.env.DATABASE_PATH);
  const now = Date.now();
  const rows = () => sql.prepare("SELECT * FROM orange_empire_commanders ORDER BY id").all();
  const markers = () => sql.prepare("SELECT * FROM orange_empire_bootstrap ORDER BY commander_id").all();
  const saveState = sql.prepare("UPDATE orange_empire_commanders SET state=? WHERE id=?");
  try {
    const {userId} = game.createUser("human@example.test","Human","fixture");
    game.runtime(userId);
    const getHuman = () => ({
      progress:sql.prepare("SELECT * FROM game_progress WHERE user_id=?").get(userId),
      runtime:sql.prepare("SELECT * FROM game_runtime WHERE user_id=?").get(userId)
    });
    const human = getHuman();

    game.advanceOrangeEmpire(now);
    const seeded = rows();
    assert.equal(seeded.length,10);
    assert.equal(markers().length,10);
    for (const {id,state:raw} of seeded) {
      const state = JSON.parse(raw);
      const target = id === 10 ? 25 : 14 + id;
      for (const name of buildingNames) assert.equal(state.structures[name],Math.min(target,buildingMaxLevel(name)));
      assert.equal(armyPopulation(state.army),id === 10 ? 500000 : 80000 + 20000 * id);
      assert.ok(state.army.Railgunner > 0 && state.army["Mech Walker"] > 0);
      assert.ok(Object.keys(state.army).every(unit => Object.values(categories).flat().includes(unit)));
      assert.equal(state.xp,0);
      assert.deepEqual(state.upgrades,{});
      assert.equal(state.knight.level,1);
    }

    // Recreate unmarked pre-bootstrap rows with low, high, and in-flight progress.
    sql.prepare("DELETE FROM orange_empire_bootstrap WHERE commander_id IN (1,2)").run();
    const existing = {
      resources:{Gold:1234,Iron:222,Water:333,Solar:444},
      structures:{"Gold Synthesizer":29,"Training Center":2,"Order":1},
      army:{"Explorer Trooper":33,"AI General":127},
      upgrades:{"AI General":{attack:3,defense:2}},
      protocols:{"Resource Management":2},
      knight:{level:8,equippedItems:{example:{level:6}}},
      jobs:{
        building:{name:"Training Center",level:3,endsAt:now+10000,xp:900},
        Elite:{unit:"AI General",endsAt:now+30000,xp:1000}
      },
      xp:5432, productionCarry:{Gold:42}
    };
    saveState.run(JSON.stringify(existing),1);
    const aboveTarget = {...existing,army:{"Explorer Trooper":150000}};
    saveState.run(JSON.stringify(aboveTarget),2);

    const before = rows();
    const beforeMarkers = markers();
    sql.exec(`CREATE TRIGGER reject_bootstrap BEFORE INSERT ON orange_empire_bootstrap
      WHEN NEW.commander_id=2 BEGIN SELECT RAISE(ABORT,'fixture rollback'); END`);
    assert.throws(()=>game.advanceOrangeEmpire(now),/fixture rollback/);
    assert.deepEqual(rows(),before);
    assert.deepEqual(markers(),beforeMarkers);
    sql.exec("DROP TRIGGER reject_bootstrap");

    game.advanceOrangeEmpire(now);
    const boosted = rows();
    const {structures,army,...progress} = JSON.parse(boosted[0].state);
    const {structures:oldStructures,army:oldArmy,...previousProgress} = existing;
    assert.deepEqual(progress,previousProgress);
    assert.equal(structures["Gold Synthesizer"],29);
    assert.equal(structures["Training Center"],15);
    assert.equal(structures.Order,3);
    assert.equal(armyPopulation(army),100000);
    assert.equal(army["AI General"],oldArmy["AI General"]);
    assert.ok(army["Explorer Trooper"]>=oldArmy["Explorer Trooper"]);
    assert.deepEqual(JSON.parse(boosted[1].state).army,aboveTarget.army);
    assert.deepEqual(boosted.map(({state,...row})=>row),before.map(({state,...row})=>row));

    game.advanceOrangeEmpire(now+10000);
    const afterJob = JSON.parse(rows()[0].state);
    assert.equal(afterJob.structures["Training Center"],15);
    assert.equal(afterJob.xp,existing.xp+900);
    assert.deepEqual(afterJob.jobs.Elite,existing.jobs.Elite);
    // Simulate losses after the grant. A restart must leave those losses recorded.
    saveState.run(JSON.stringify({...afterJob,army:{"Explorer Trooper":1}}),1);
    const beforeRestart = rows();
    const restart = spawnSync(process.execPath,["-e",`
      const game = new (require("./database/database"))();
      game.advanceOrangeEmpire(${now+10000});
    `],{encoding:"utf8",env:process.env});
    assert.equal(restart.status,0,restart.stderr);
    assert.deepEqual(rows(),beforeRestart);
    assert.equal(markers().length,10);
    assert.deepEqual(getHuman(),human);
    game.scheduleOrangeEmpireAttacks(now+10000);
    assert.equal(sql.prepare("SELECT COUNT(*) AS count FROM orange_empire_attacks").get().count,0);
  } finally {
    sql.close();
    game.close();
    rmSync(directory,{force:true,recursive:true});
  }
});
