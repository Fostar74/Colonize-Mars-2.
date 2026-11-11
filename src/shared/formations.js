const {categories} = require("./unitEconomy");

const units = Object.values(categories).flat();
const cellsPerRow = 7;
const marchLimit = 50000;

function defaultFormation(defense = false) {
  const rows = defense
    ? {Ground:1, Ranged:3, Mobile:2, "Heavy Systems":4, Elite:4}
    : {Ground:1, Ranged:4, Mobile:1, "Heavy Systems":4, Elite:3};
  return Object.fromEntries(Object.entries(categories).flatMap(([category, troops]) =>
    troops.map((unit, index) => [unit, !defense && category === "Mobile" && index === 3 ? 2 : rows[category]])));
}

function normalizeFormation(formation) {
  const result = {};
  const columns = {};
  const grid = Array.from({ length: 4 }, () => Array(cellsPerRow).fill(null));
  for (const unit of units) {
    const row = formation[unit];
    if (!Number.isInteger(row) || row < 1 || row > 4) continue;
    const column = formation.columns?.[unit];
    if (!Number.isInteger(column) || column < 0 || column >= cellsPerRow || grid[row - 1][column]) continue;
    grid[row - 1][column] = unit;
    result[unit] = row;
    columns[unit] = column;
  }
  for (const unit of units) {
    const row = formation[unit];
    if (result[unit] || !Number.isInteger(row) || row < 1 || row > 4) continue;
    const target = grid[row - 1].includes(null) ? row - 1 : grid.findIndex(cells => cells.includes(null));
    const column = grid[target].indexOf(null);
    grid[target][column] = unit;
    result[unit] = target + 1;
    columns[unit] = column;
  }
  return { ...result, columns };
}

module.exports = {units, marchLimit, cellsPerRow, defaultFormation, normalizeFormation};
