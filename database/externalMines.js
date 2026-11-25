const alienBases = require("../src/shared/alienBases");
const stations = require("../src/shared/spaceStations");

const types = ["gold", "iron", "water", "solar"];
const stock = 5000;

function occupiedTiles(db) {
  const tiles = db.prepare("SELECT x,y FROM base_positions UNION SELECT x,y FROM resource_mines").all();
  if (db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='alliance_mines'").get()) {
    tiles.push(...db.prepare("SELECT x,y FROM alliance_mines WHERE status<>'closed' AND alliance_id IS NOT NULL").all());
  }
  return new Set([...tiles, ...alienBases, ...stations].map(({x,y}) => x+":"+y));
}

function createMine(db, resource, occupied=occupiedTiles(db)) {
  const available=[];
  for (let x=1; x<=100; x++) {
    for (let y=1; y<=100; y++) {
      if (Math.hypot(x-50,y-50)>15 && !occupied.has(x+":"+y)) available.push({x,y});
    }
  }
  if (!available.length) throw new Error("No free map tile is available for a resource mine.");
  const {x,y}=available[Math.floor(Math.random()*available.length)];
  occupied.add(x+":"+y);
  db.prepare("INSERT INTO resource_mines(resource,x,y,amount) VALUES (?,?,?,?)").run(resource,x,y,stock);
}

function replenishMissingMines(db) {
  db.transaction(()=>{
    const occupied=occupiedTiles(db);
    const count=db.prepare("SELECT COUNT(*) AS count FROM resource_mines WHERE resource=?");
    for (const resource of types) {
      for (let i=count.get(resource).count;i<10;i++) createMine(db,resource,occupied);
    }
  }).immediate();
}

module.exports={createMine,replenishMissingMines};
