function placedMapObjects(db) {
  const objects = db.prepare(`
    SELECT x,y FROM base_positions
    UNION ALL SELECT x,y FROM resource_mines
    UNION ALL
    SELECT json_extract(castle_data,'$.x') AS x, json_extract(castle_data,'$.y') AS y
    FROM game_progress p
    WHERE NOT EXISTS (SELECT 1 FROM base_positions b WHERE b.user_id=p.user_id)
      AND json_valid(castle_data)
  `).all().filter(({x,y})=>Number.isInteger(x)&&Number.isInteger(y));
  if (db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='alliance_mines'").get()) {
    objects.push(...db.prepare("SELECT x,y FROM alliance_mines WHERE status<>'closed' AND alliance_id IS NOT NULL").all());
  }
  return objects;
}

module.exports = {placedMapObjects};
