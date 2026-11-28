const path = require("node:path");
const SQLite = require("better-sqlite3");
const {recoveryEnabled, issueRecoveryToken} = require("../database/passwordRecovery");

function main() {
  const userId = Number(process.argv[2]);
  const dbPath = process.env.DATABASE_PATH;
  const origin = new URL(process.env.PASSWORD_RECOVERY_ORIGIN || "");
  const localTest = origin.protocol === "http:" && origin.hostname === "127.0.0.1" && !process.env.RENDER;
  if (!recoveryEnabled() || !path.isAbsolute(dbPath || "") ||
      process.argv.length !== 3 || !Number.isSafeInteger(userId) || userId < 1 ||
      (!localTest && origin.protocol !== "https:") || origin.pathname !== "/" ||
      origin.username || origin.password || origin.search || origin.hash) {
    throw new Error("Invalid recovery configuration");
  }

  const db = new SQLite(dbPath, {fileMustExist: true});
  try {
    db.pragma("foreign_keys = ON");
    db.pragma("busy_timeout = 5000");
    const token = issueRecoveryToken(db, userId);
    process.stdout.write(origin.origin + "/#/password-reset?token=" + token + "\n");
  } finally {
    db.close();
  }
}

try {
  main();
} catch {
  process.stderr.write("Could not issue a recovery link. Check configuration and the verified account ID.\n");
  process.exitCode = 1;
}
