function migrateAllianceMines(db) {
  db.transaction(() => {
    db.exec(`
      CREATE TABLE IF NOT EXISTS alliance_mines (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        alliance_id INTEGER REFERENCES alliances(id) ON DELETE SET NULL,
        resource TEXT NOT NULL CHECK(resource IN ('Gold','Iron','Water','Solar')),
        x INTEGER NOT NULL CHECK(x BETWEEN 1 AND 100),
        y INTEGER NOT NULL CHECK(y BETWEEN 1 AND 100),
        status TEXT NOT NULL CHECK(status IN ('construction','gathering','closed')),
        work INTEGER NOT NULL DEFAULT 0,
        amount INTEGER NOT NULL DEFAULT 1000000
      );
      CREATE UNIQUE INDEX IF NOT EXISTS alliance_mines_active_alliance
        ON alliance_mines(alliance_id) WHERE status <> 'closed' AND alliance_id IS NOT NULL;
      CREATE UNIQUE INDEX IF NOT EXISTS alliance_mines_active_tile
        ON alliance_mines(x,y) WHERE status <> 'closed' AND alliance_id IS NOT NULL;
      CREATE TABLE IF NOT EXISTS alliance_mine_marches (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        mine_id INTEGER NOT NULL REFERENCES alliance_mines(id),
        user_id INTEGER NOT NULL REFERENCES users(id),
        mode TEXT NOT NULL CHECK(mode IN ('construction','gathering')),
        units TEXT NOT NULL,
        population INTEGER NOT NULL,
        capacity INTEGER NOT NULL,
        origin_x INTEGER NOT NULL,
        origin_y INTEGER NOT NULL,
        launched_at INTEGER NOT NULL,
        arrives_at INTEGER NOT NULL,
        credited_at INTEGER NOT NULL,
        work INTEGER NOT NULL DEFAULT 0,
        gathered INTEGER NOT NULL DEFAULT 0,
        returned_at INTEGER
      );
      CREATE UNIQUE INDEX IF NOT EXISTS alliance_mine_marches_active_user
        ON alliance_mine_marches(user_id) WHERE returned_at IS NULL;
      CREATE INDEX IF NOT EXISTS alliance_mine_marches_mine ON alliance_mine_marches(mine_id);
    `);
    const walletColumns = db.prepare("PRAGMA table_info(alliance_wallets)").all();
    if (!walletColumns.some(column => column.name === "construction_remainder")) {
      db.exec("ALTER TABLE alliance_wallets ADD COLUMN construction_remainder INTEGER NOT NULL DEFAULT 0");
      // Previous mine credits were stored as REAL AP. Round upward only when
      // converting old fractions to the smallest representable construction unit.
      db.exec(`UPDATE alliance_wallets SET construction_remainder=
        CAST(CEIL((points-CAST(points AS INTEGER))*3600000) AS INTEGER)
        WHERE typeof(points)='real';
        UPDATE alliance_wallets SET points=CAST(points AS INTEGER)+construction_remainder/3600000,
          construction_remainder=construction_remainder%3600000 WHERE typeof(points)='real'`);
    }
    if (!db.prepare("PRAGMA table_info(resource_gathering_reports)").all().some(column => column.name === "source")) {
      db.exec("ALTER TABLE resource_gathering_reports ADD COLUMN source TEXT NOT NULL DEFAULT 'resource'");
    }
  }).immediate();
}

module.exports = migrateAllianceMines;
