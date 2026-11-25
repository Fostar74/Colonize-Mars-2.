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
      CREATE TRIGGER IF NOT EXISTS side_quest_external_depletion
      AFTER INSERT ON resource_gathering_reports
      WHEN NEW.reason='depleted' AND NEW.amount>0 AND EXISTS (
        SELECT 1 FROM resource_mines
        WHERE id=NEW.mine_id AND claimed_by=NEW.user_id AND x=NEW.x AND y=NEW.y
          AND amount=NEW.amount AND resource=NEW.resource
      )
      BEGIN
        UPDATE player_side_quests SET progress=1
        WHERE user_id=NEW.user_id AND mission=7 AND unlocked_at<=(
          SELECT gathering_started_at+CAST(CEIL(amount*3600000.0/gathering_rate) AS INTEGER)
          FROM resource_mines WHERE id=NEW.mine_id
        );
      END;
    `);
  }).immediate();
}

module.exports=migrateSideQuests;
