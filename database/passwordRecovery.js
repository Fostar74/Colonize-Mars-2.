const {createHash, randomBytes} = require("node:crypto");

const recoveryEnabled = () => process.env.PASSWORD_RECOVERY_ENABLED === "true";
const validToken = token => typeof token === "string" && /^[a-f0-9]{64}$/.test(token);
const hashToken = token => createHash("sha256").update(token).digest("hex");
const lifetimeMs = 30 * 60 * 1000;

function initializeRecovery(db) {
  db.exec(`CREATE TABLE IF NOT EXISTS password_resets (
    token_hash TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    expires_at INTEGER NOT NULL
  )`);
}

function issueRecoveryToken(db, userId) {
  const token = randomBytes(32).toString("hex");
  db.transaction(() => {
    const now = Date.now();
    db.prepare("DELETE FROM password_resets WHERE expires_at<=? OR user_id=?").run(now, userId);
    db.prepare("INSERT INTO password_resets VALUES (?, ?, ?)").run(hashToken(token), userId, now + lifetimeMs);
  }).immediate();
  return token;
}

function redeemRecoveryToken(db, tokenHash, passwordHash) {
  return db.transaction(() => {
    const reset = db.prepare(`DELETE FROM password_resets WHERE token_hash=? AND expires_at>?
      RETURNING user_id`).get(tokenHash, Date.now());
    if (!reset) return false;
    db.prepare("UPDATE users SET password=? WHERE id=?").run(passwordHash, reset.user_id);
    db.prepare("DELETE FROM login_sessions WHERE user_id=?").run(reset.user_id);
    return true;
  }).immediate();
}

module.exports = {recoveryEnabled, validToken, hashToken, initializeRecovery, issueRecoveryToken, redeemRecoveryToken};
