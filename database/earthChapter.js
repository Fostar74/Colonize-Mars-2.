const spaceshipDuration = 7 * 86400000;

function migrate(db) {
  db.exec(`CREATE TABLE IF NOT EXISTS earth_chapter_winner (
    chapter INTEGER PRIMARY KEY CHECK(chapter=1),
    station_id INTEGER NOT NULL,
    alliance_id INTEGER NOT NULL,
    alliance_name TEXT NOT NULL,
    user_id INTEGER NOT NULL REFERENCES users(id),
    completed_at INTEGER NOT NULL
  )`);
}

function completeSpaceships(db, now) {
  const due = db.prepare(`SELECT s.station_id,s.spaceport_started_at,a.id AS alliance_id,a.name
    FROM alliance_space_stations s JOIN alliances a ON a.id=s.alliance_id
    WHERE s.spaceport_status='building' AND s.spaceport_started_at<=?
    ORDER BY s.spaceport_started_at,s.station_id`).all(now-spaceshipDuration);
  for (const station of due) {
    db.prepare("UPDATE alliance_space_stations SET spaceport_status='built',spaceport_started_at=NULL WHERE station_id=?")
      .run(station.station_id);
    db.prepare(`INSERT OR IGNORE INTO earth_chapter_winner(chapter,station_id,alliance_id,alliance_name,user_id,completed_at)
      SELECT 1,?,?,?,user_id,? FROM (
        SELECT m.user_id FROM alliance_members m LEFT JOIN player_talents t ON t.user_id=m.user_id
        WHERE m.alliance_id=? ORDER BY COALESCE(t.xp,0) DESC,m.user_id LIMIT 1
      )`)
      .run(station.station_id,station.alliance_id,station.name,station.spaceport_started_at+spaceshipDuration,station.alliance_id);
  }
}

function winner(db) {
  return db.prepare("SELECT station_id AS stationId,alliance_id AS allianceId,alliance_name AS allianceName,user_id AS userId,completed_at AS completedAt FROM earth_chapter_winner").get() || null;
}

module.exports = {migrate, completeSpaceships, winner, spaceshipDuration};
