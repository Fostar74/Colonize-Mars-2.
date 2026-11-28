const bcrypt = require("bcrypt");
const {recoveryEnabled, validToken, hashToken} = require("../database/passwordRecovery");

function passwordRecovery(db) {
  // Use the connection address without trusting client-supplied forwarding headers.
  const attempts = new Map();
  const windowMs = 15 * 60 * 1000;

  return async (req, res) => {
    res.set("Cache-Control", "no-store");
    const invalid = () => res.status(400).json({code: "invalid-link"});
    if (!recoveryEnabled()) return res.status(404).json({code: "invalid-link"});

    const now = Date.now();
    for (const [key, entry] of attempts) {
      if (entry.until <= now) attempts.delete(key);
    }
    const {token, password} = req.body || {};
    const hash = validToken(token) ? hashToken(token) : null;
    const limits = [[`ip:${req.socket.remoteAddress}`, 12], ["global", 120]];
    if (hash) limits.push([`token:${hash}`, 6]);
    for (const [key, limit] of limits) {
      const entry = attempts.get(key) || {count: 0, until: now + windowMs};
      if (entry.count >= limit) {
        res.set("Retry-After", String(Math.ceil((entry.until - now) / 1000)));
        return res.status(429).json({code: "rate-limit"});
      }
    }
    for (const [key] of limits) {
      const entry = attempts.get(key) || {count: 0, until: now + windowMs};
      entry.count++;
      attempts.set(key, entry);
    }

    if (!hash) return invalid();
    if (typeof password !== "string" || [...password].length < 8 ||
        Buffer.byteLength(password, "utf8") > 72 || password.includes("\0")) {
      return res.status(400).json({code: "invalid-password"});
    }
    try {
      if (!db.hasActivePasswordReset(hash)) return invalid();
      const passwordHash = await bcrypt.hash(password, 10);
      return db.redeemPasswordReset(hash, passwordHash) ? res.status(204).end() : invalid();
    } catch (error) {
      console.error("Password recovery failed:", error.code || error.name);
      return res.status(500).json({code: "unavailable"});
    }
  };
}

module.exports = passwordRecovery;
