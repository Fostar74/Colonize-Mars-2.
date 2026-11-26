const castleMarkerSize = tileSize => Math.max(108, tileSize * 2.5);

function nearestMapMarker(markers, pixel, offset, tileSize, radius) {
  let nearest = null;
  let distance = radius ** 2;
  for (const marker of markers) {
    const dx = (Number(marker.x) - .5) * tileSize + offset.x - pixel.x;
    const dy = (Number(marker.y) - .5) * tileSize + offset.y - pixel.y;
    const squared = dx ** 2 + dy ** 2;
    if (squared <= distance) {
      nearest = marker;
      distance = squared;
    }
  }
  return nearest;
}

module.exports = {castleMarkerSize, nearestMapMarker};
