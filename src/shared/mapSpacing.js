const tileKey = (x, y) => x + ":" + y;
const touchesTile = (tile, x, y) => Math.abs(tile.x - x) <= 1 && Math.abs(tile.y - y) <= 1;

function reserveTileAndNeighbors(blocked, x, y) {
  for (let dx = -1; dx <= 1; dx++) {
    for (let dy = -1; dy <= 1; dy++) blocked.add(tileKey(x + dx, y + dy));
  }
}

function blockedMapTiles(objects) {
  const blocked = new Set();
  for (const {x, y} of objects) reserveTileAndNeighbors(blocked, x, y);
  return blocked;
}

module.exports = {tileKey, touchesTile, reserveTileAndNeighbors, blockedMapTiles};
