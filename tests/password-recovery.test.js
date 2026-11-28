const assert = require("node:assert/strict");
const {test} = require("node:test");
const {once} = require("node:events");
const {mkdtempSync, rmSync} = require("node:fs");
const {join} = require("node:path");
const {tmpdir} = require("node:os");
const {spawn, execFileSync} = require("node:child_process");
const SQLite = require("better-sqlite3");
const {hashToken} = require("../database/passwordRecovery");

test("private recovery link resets only the fixture account and revokes its sessions", async () => {
  const dir = mkdtempSync(join(tmpdir(), "cm149-"));
  const env = {...process.env, DATABASE_PATH: join(dir, "game.sqlite"), ORANGE_EMPIRE_ENABLED: "false"};
  let child, sql, origin;
  async function start(enabled) {
    env.PASSWORD_RECOVERY_ENABLED = String(enabled);
    child = spawn(process.execPath, ["-e", `
      const express = require("express");
      const app = express().use(express.json()).use(require("./routes/auth"));
      const server = app.listen(0, "127.0.0.1", () => console.log("PORT=" + server.address().port));
    `], {env, stdio: ["ignore", "pipe", "inherit"]});
    origin = await new Promise((resolve, reject) => {
      child.once("exit", code => reject(new Error("Fixture server exited " + code)));
      child.stdout.on("data", chunk => {
        const port = String(chunk).match(/PORT=(\d+)/)?.[1];
        if (port) resolve("http://127.0.0.1:" + port);
      });
    });
  }
  async function stop() {
    const exited = once(child, "exit");
    child.kill();
    await exited;
    child = null;
  }
  const request = (path, body, session) => fetch(origin + path, {
    method: body ? "POST" : "GET",
    headers: {"Content-Type": "application/json", ...(session ? {Authorization: "Bearer " + session} : {})},
    body: body ? JSON.stringify(body) : undefined,
  });
  const identifier = "fixture@example.test";
  const original = "old-fixture-password";
  const updated = "new-fixture-password";
  const login = password => request("/login", {username: "  FIXTURE@example.test  ", password});
  const reset = (token, password = updated) => request("/password-reset", {token, password});
  const issue = userId => {
    const output = execFileSync(process.execPath, ["scripts/issue-password-reset.js", String(userId)], {
      env: {...env, PASSWORD_RECOVERY_ORIGIN: origin, RENDER: ""}, encoding: "utf8",
    }).trim();
    const link = new URL(output);
    assert.equal(link.origin, origin);
    assert.equal(link.search, "");
    assert.match(link.hash, /^#\/password-reset\?token=[a-f0-9]{64}$/);
    return new URLSearchParams(link.hash.split("?")[1]).get("token");
  };
  try {
    await start(false);
    const missing = await reset("a".repeat(64));
    assert.equal(missing.status, 404);
    assert.equal(missing.headers.get("cache-control"), "no-store");
    const registration = await request("/register", {username: "Fixture", email: identifier, password: original});
    assert.equal(registration.status, 201);
    const {userId} = await registration.json();
    const other = await request("/register", {username: identifier, email: "other@example.test", password: "other-password"});
    assert.equal(other.status, 201);
    const otherSession = await (await login("other-password")).json();
    sql = new SQLite(env.DATABASE_PATH);
    sql.prepare("UPDATE game_progress SET resources=? WHERE user_id=?")
      .run('{"Gold":12345,"Iron":10,"Water":10,"Solar":10}', userId);
    const before = await (await login(original)).json();
    assert.equal(before.userId, userId);
    await stop();

    await start(true);
    const expiredToken = issue(userId);
    sql.prepare("UPDATE password_resets SET expires_at=0 WHERE user_id=?").run(userId);
    const expiryResponse = await reset(expiredToken);
    assert.equal(expiryResponse.status, 400);
    assert.deepEqual(await expiryResponse.json(), {code: "invalid-link"});
    const superseded = issue(userId);
    const token = issue(userId);
    assert.equal(sql.prepare("SELECT token_hash FROM password_resets WHERE user_id=?").get(userId).token_hash, hashToken(token));
    const previous = await reset(superseded);
    assert.equal(previous.status, 400);
    assert.deepEqual(await previous.json(), {code: "invalid-link"});
    const beforeFinalReset = await (await login(original)).json();
    assert.equal(beforeFinalReset.userId, userId);
    await stop();

    await start(true);
    assert.equal((await reset(token, "short")).status, 400);
    const progress = () => sql.prepare("SELECT * FROM game_progress WHERE user_id=?").get(userId);
    const beforeProgress = progress();
    const results = await Promise.all([reset(token), reset(token)]);
    assert.deepEqual(progress(), beforeProgress);
    assert.deepEqual(results.map(result => result.status).sort(), [204, 400]);
    assert.deepEqual(await results.find(result => result.status === 400).json(), {code: "invalid-link"});
    assert.equal((await login(original)).status, 401);
    assert.equal((await request("/get-progress/" + userId, null, before.token)).status, 401);
    assert.equal((await request("/get-progress/" + userId, null, beforeFinalReset.token)).status, 401);
    assert.equal((await request("/get-progress/" + otherSession.userId, null, otherSession.token)).status, 200);
    const after = await (await login(updated)).json();
    assert.equal(after.userId, userId);
    assert.deepEqual(after.gameProgress.resources, before.gameProgress.resources);
    for (let i = 0; i < 3; i++) assert.equal((await reset(token)).status, 400);
    const throttled = await reset(token);
    assert.equal(throttled.status, 429);
    assert.ok(Number(throttled.headers.get("retry-after")) > 0);
  } finally {
    if (child && child.exitCode === null) await stop();
    sql?.close();
    rmSync(dir, {recursive: true, force: true});
  }
});
