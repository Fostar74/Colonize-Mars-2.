const alienBases = require("../src/shared/alienBases");
const stations = require("../src/shared/spaceStations");

const {placedMapObjects} = require("./mapObjects");
const {tileKey, blockedMapTiles, reserveTileAndNeighbors} = require("../src/shared/mapSpacing");

const types = ["gold", "iron", "water", "solar"];
const stock = 5000;

function blockedMineTiles(db) {
  const blocked = blockedMapTiles(placedMapObjects(db));
  for (const {x,y} of [...alienBases,...stations]) blocked.add(tileKey(x,y));
  return blocked;
}

function createMine(db, resource, blocked=blockedMineTiles(db)) {
  const available=[];
  for (let x=1; x<=100; x++) {
    for (let y=1; y<=100; y++) {
      if (Math.hypot(x-50,y-50)>15 && !blocked.has(tileKey(x,y))) available.push({x,y});
    }
  }
  if (!available.length) throw new Error("No free map tile is available for a resource mine.");
  const {x,y}=available[Math.floor(Math.random()*available.length)];
  reserveTileAndNeighbors(blocked,x,y);
  db.prepare("INSERT INTO resource_mines(resource,x,y,amount) VALUES (?,?,?,?)").run(resource,x,y,stock);
}

function replenishMissingMines(db, retired=[]) {
  db.transaction(()=>{
    // Match the visible map boundary. Keep legacy deposits inside it available
    // to existing marches, without counting them against the visible quota.
    const counts=new Map(db.prepare(`SELECT resource,COUNT(*) AS count FROM resource_mines
      WHERE amount>0 AND (x-50)*(x-50)+(y-50)*(y-50)>225 GROUP BY resource`)
      .all().map(({resource,count})=>[resource,count]));
    if(types.every(resource=>(counts.get(resource)||0)>=10))return;
    const blocked=blockedMineTiles(db);
    for(const {x,y} of retired)reserveTileAndNeighbors(blocked,x,y);
    for (const resource of types) {
      for (let i=(counts.get(resource)||0);i<10;i++) createMine(db,resource,blocked);
    }
  }).immediate();
}

module.exports={replenishMissingMines};
