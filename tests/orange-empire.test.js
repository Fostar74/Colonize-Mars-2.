const assert = require("node:assert/strict");
const {test} = require("node:test");
const {mkdtempSync, rmSync} = require("node:fs");
const {tmpdir} = require("node:os");
const {join} = require("node:path");
const {spawn, spawnSync} = require("node:child_process");
const {once} = require("node:events");
const SQLite = require("better-sqlite3");
const {touchesTile} = require("../src/shared/mapSpacing");
const {maxPlayerLevel} = require("../src/shared/playerTargeting");
const {profileFor} = require("../src/shared/unitProfiles");
const {eligibleHumanTarget, validAttackArmy} = require("../database/orangeEmpire");
const alienBases = require("../src/shared/alienBases");
const stations = require("../src/shared/spaceStations");

const directory = mkdtempSync(join(tmpdir(), "orange-empire-"));
process.env.DATABASE_PATH = join(directory, "game.sqlite");
delete process.env.ORANGE_EMPIRE_ENABLED;
const Game = require("../database/database");

async function getMap(flag, token) {
  const child = spawn(process.execPath, ["-e", `
    const app = require("express")().use(require("./routes/auth"));
    const server = app.listen(0, "127.0.0.1", () => console.log("PORT="+server.address().port));
  `], {env: {...process.env, ORANGE_EMPIRE_ENABLED: flag}, stdio: ["ignore", "pipe", "inherit"]});
  try {
    const port = await new Promise((resolve, reject) => {
      child.on("exit", code => reject(Error("Map test server exited " + code)));
      child.on("error", reject);
      child.stdout.on("data", chunk => {
        const match = String(chunk).match(/PORT=(\d+)/);
        if (match) resolve(match[1]);
      });
    });
    const res = await fetch("http://127.0.0.1:" + port + "/map/bases", {
      headers: {Authorization: "Bearer " + token}
    });
    assert.equal(res.status, 200);
    return await res.json();
  } finally {
    if (child.exitCode === null && child.signalCode === null) {
      const exited = once(child, "exit");
      child.kill();
      await exited;
    }
  }
}

test("opt-in map, idempotent placement, bounded development and persisted NPC-only data", async () => {
  const game = new Game();
  const sql = new SQLite(process.env.DATABASE_PATH);
  const states = () => sql.prepare("SELECT * FROM orange_empire_commanders ORDER BY id").all();
  const positionList = rows => rows.map(({id,x,y}) => ({id,x,y}));
  const playerSnapshot = () => Object.fromEntries([
    "users", "game_progress", "game_stats", "game_runtime", "base_positions", "player_talents", "alliances", "alliance_members"
  ].map(table => [table, sql.prepare("SELECT * FROM " + table).all()]));
  try {
    const {userId} = game.createUser("human@example.test", "Human", "fixture");
    game.createAlliance(userId, "Human Alliance");
    game.runtime(userId);
    game.awardPlayerXp(userId, 12345);
    sql.prepare("UPDATE game_progress SET resources=? WHERE user_id=?").run('{"Gold":76543,"Iron":99,"Water":70,"Solar":65}', userId);
    sql.prepare("UPDATE game_runtime SET army=? WHERE user_id=?").run('{"Railgunner":321}', userId);
    const token = "a".repeat(64);
    game.storeLoginSession(require("node:crypto").createHash("sha256").update(token).digest("hex"), userId, Date.now() + 60000, Date.now());
    const originalPlayer = playerSnapshot();
    const now = Date.now();

    game.advanceOrangeEmpire(now);
    assert.deepEqual(states(), []);
    assert.equal((await getMap("false", token)).orangeEmpireBases, undefined);

    process.env.ORANGE_EMPIRE_ENABLED = "true";
    game.advanceOrangeEmpire(now);
    const seeded = states();
    assert.equal(seeded.length, 10);
    assert.equal(sql.prepare("SELECT name FROM orange_empire_alliance").get().name, "The Orange Empire");
    assert.ok(seeded.every(row => row.alliance_id === "orange-empire"));
    assert.deepEqual(seeded.map(row => row.id), Array.from({length:10}, (_,i) => i + 1));
    game.advanceOrangeEmpire(now);
    assert.deepEqual(states(), seeded);

    const placed = sql.prepare("SELECT x,y FROM base_positions UNION ALL SELECT x,y FROM resource_mines").all();
    for (const [index, base] of seeded.entries()) {
      assert.ok([...placed, ...seeded.slice(0, index)].every(tile => !touchesTile(tile, base.x, base.y)));
      assert.ok([...alienBases, ...stations].every(tile => tile.x !== base.x || tile.y !== base.y));
    }
    const map = await getMap("true", token);
    assert.deepEqual(positionList(map.orangeEmpireBases), positionList(seeded));
    assert.deepEqual(map.orangeEmpireBases.filter(base => base.emperor).map(base => base.id), [10]);
    assert.ok(map.orangeEmpireBases.every(base => base.knightLevel === 1));
    assert.equal(map.bases.length, 1);

    for (let ticks = 1; ticks <= 180; ticks++) game.advanceOrangeEmpire(now + ticks * 10000);
    const grown = states();
    const state = JSON.parse(grown[0].state);
    const initial = JSON.parse(seeded[0].state);
    assert.ok(state.structures["Gold Synthesizer"] >= 1);
    assert.ok(state.xp > initial.xp);
    assert.ok(state.protocols["Resource Management"] >= 1);
    assert.ok(Object.keys(state.upgrades).length > 0);
    assert.ok(Object.keys(state.army).some(unit => state.army[unit] > (initial.army[unit] || 0)));

    const restart = spawnSync(process.execPath, ["-e", `
      const game = new (require("./database/database"))();
      game.advanceOrangeEmpire(${grown[0].last_processed_at});
      console.log(JSON.stringify(game.getOrangeEmpireBases()));
    `], {encoding:"utf8", env:process.env});
    assert.equal(restart.status, 0, restart.stderr);
    assert.deepEqual(positionList(JSON.parse(restart.stdout.trim().split("\n").at(-1))), positionList(seeded));
    assert.deepEqual(states(), grown);

    const day = 86400000;
    game.advanceOrangeEmpire(grown[0].last_processed_at + day * 30);
    const caughtUp = states();
    const after = JSON.parse(caughtUp[0].state);
    assert.ok(after.resources.Gold > state.resources.Gold);
    const theoreticalMaximum = (day / 10000) * (state.structures["Gold Synthesizer"] + 1) * 1.3;
    assert.ok(after.resources.Gold - state.resources.Gold <= theoreticalMaximum);
    game.advanceOrangeEmpire(caughtUp[0].last_processed_at);
    assert.deepEqual(states(), caughtUp);
    assert.deepEqual(playerSnapshot(), originalPlayer);

    delete process.env.ORANGE_EMPIRE_ENABLED;
    game.advanceOrangeEmpire(caughtUp[0].last_processed_at + day);
    assert.deepEqual(states(), caughtUp);
    assert.equal((await getMap("false", token)).orangeEmpireBases, undefined);

    // Future spawns and mine replacements still honor the reserved tiles.
    const newcomer = game.createUser("next@example.test", "Next", "fixture");
    assert.ok(seeded.every(tile => !touchesTile(tile, newcomer.position.x, newcomer.position.y)));
    sql.prepare("DELETE FROM resource_mines WHERE resource='gold'").run();
    game.settleResourceMines();
    for (const mine of sql.prepare("SELECT x,y FROM resource_mines WHERE resource='gold'").all()) {
      assert.ok(seeded.every(tile => !touchesTile(tile, mine.x, mine.y)));
    }
  } finally {
    delete process.env.ORANGE_EMPIRE_ENABLED;
    sql.close();
    game.close();
    rmSync(directory, {recursive:true, force:true});
  }
});

test("future NPC targeting requires a max-level human outside protection and a valid march population", () => {
  const now = 100;
  const maxXp = (maxPlayerLevel - 1) * 1000;
  assert.equal(eligibleHumanTarget({isHuman:true, xp:maxXp - 1}, now), false);
  assert.equal(eligibleHumanTarget({isHuman:false, xp:maxXp}, now), false);
  assert.equal(eligibleHumanTarget({isHuman:true, xp:maxXp, protectedUntil:now + 1}, now), false);
  assert.equal(eligibleHumanTarget({isHuman:true, xp:maxXp, protectedUntil:now, allianceId:3}, now), true);
  const unit = "Mech Walker";
  const population = profileFor(unit).population;
  const count = Math.floor(50000 / population);
  assert.ok(population > 1);
  assert.equal(validAttackArmy({[unit]: count}), true);
  assert.equal(validAttackArmy({[unit]: count + 1}), false);
  for (const invalid of [{}, {"Alien Overlord":1}, {[unit]:-2}, {[unit]:1.5}, {[unit]:"2"}]) {
    assert.equal(validAttackArmy(invalid), false);
  }
});
