const {categories} = require("./unitEconomy");

const units = Object.values(categories).flat();
const marchLimit = 50000;

function defaultFormation(defense = false) {
  const rows = defense
    ? {Ground:1, Ranged:3, Mobile:2, "Heavy Systems":4, Elite:2}
    : {Ground:1, Ranged:4, Mobile:1, "Heavy Systems":4, Elite:1};
  return Object.fromEntries(Object.entries(categories).flatMap(([category, troops]) =>
    troops.map(unit => [unit, rows[category]])));
}

module.exports = {units, marchLimit, defaultFormation};
