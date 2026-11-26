function migrateSideQuests(db) {
  db.transaction(()=>{
    db.exec(`
      CREATE TABLE IF NOT EXISTS player_side_quests (
        user_id INTEGER PRIMARY KEY REFERENCES users(id),
        mission INTEGER NOT NULL DEFAULT 1,
        progress INTEGER NOT NULL DEFAULT 0,
        path TEXT,
        unlocked_at INTEGER NOT NULL DEFAULT 0
      );
      CREATE TABLE IF NOT EXISTS side_quest_reward_reads (
        user_id INTEGER NOT NULL REFERENCES users(id),
        mission INTEGER NOT NULL,
        PRIMARY KEY(user_id,mission)
      );
      CREATE TABLE IF NOT EXISTS mobilization_requests (
        user_id INTEGER NOT NULL REFERENCES users(id),
        origin TEXT NOT NULL,
        request_id TEXT NOT NULL,
        PRIMARY KEY(user_id,origin,request_id)
      );
      CREATE TABLE IF NOT EXISTS hospital_mobilization (
        user_id INTEGER NOT NULL REFERENCES users(id),
        unit TEXT NOT NULL,
        quantity INTEGER NOT NULL CHECK(quantity>=0),
        PRIMARY KEY(user_id,unit)
      );
    `);
  }).immediate();
}

module.exports=migrateSideQuests;
