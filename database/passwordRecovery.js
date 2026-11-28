const {createHash, randomBytes} = require("node:crypto");

const recoveryEnabled = () => process.env.PASSWORD_RECOVERY_ENABLED === "true";
const validToken = token => typeof token === "string" && /^[a-f0-9]{64}$/.test(token);
const hashToken = token => createHash("sha256").update(token).digest("hex");
const emailRequestsEnabled = () => recoveryEnabled() && process.env.PASSWORD_RECOVERY_EMAIL_ENABLED === "true";
const sendWindowMs = 24 * 60 * 60 * 1000;
const lifetimeMs = 30 * 60 * 1000;

function initializeRecovery(db) {
  db.exec(`CREATE TABLE IF NOT EXISTS password_resets (
    token_hash TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    expires_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS password_reset_sends (
    id INTEGER PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    attempted_at INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS password_reset_sends_time ON password_reset_sends(attempted_at);
  CREATE INDEX IF NOT EXISTS password_reset_sends_user ON password_reset_sends(user_id, attempted_at);`);
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

function reserveEmailReset(db, email) {
  return db.transaction(() => {
    const recipients = db.prepare("SELECT id, email FROM users WHERE email=? COLLATE NOCASE LIMIT 2").all(email);
    if (recipients.length !== 1) return null;
    const recipient = recipients[0];
    const now = Date.now();
    db.prepare("DELETE FROM password_reset_sends WHERE attempted_at<=?").run(now - sendWindowMs);
    if (db.prepare("SELECT COUNT(*) AS count FROM password_reset_sends").get().count >= 40 ||
        db.prepare("SELECT COUNT(*) AS count FROM password_reset_sends WHERE user_id=?").get(recipient.id).count >= 2 ||
        db.prepare("SELECT 1 FROM password_resets WHERE user_id=? AND expires_at>?").get(recipient.id, now)) {
      return null;
    }
    const token = issueRecoveryToken(db, recipient.id);
    db.prepare("INSERT INTO password_reset_sends(user_id, attempted_at) VALUES (?, ?)").run(recipient.id, now);
    return {email: recipient.email, token};
  }).immediate();
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

module.exports = {recoveryEnabled, emailRequestsEnabled, reserveEmailReset, validToken, hashToken, initializeRecovery, issueRecoveryToken, redeemRecoveryToken};
