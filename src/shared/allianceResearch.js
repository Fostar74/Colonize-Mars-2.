const { categories } = require("./unitEconomy");

const units = Object.values(categories).flat();
const combatRows = [];
for (let start = 0, width = 1; start < units.length; width = width === 1 ? 2 : 3) {
  combatRows.push(units.slice(start, start + width));
  start += width;
}

const development = [
  { kind: "growth", en: "Resource Production", bg: "Добив на ресурси", resource: "Water" },
  { kind: "speed", en: "Faster Upgrades", bg: "По-бързи подобрения", resource: "Solar", parent: "growth" },
  { kind: "discount", en: "Cheaper Upgrades", bg: "По-евтини подобрения", resource: "Gold", parent: "growth" }
];
const combatKey = (stat, unit) => `${stat}:${unit}`;
const catalog = Object.fromEntries(development.map(item => [item.kind, item]));
for (const [row, names] of combatRows.entries()) {
  for (const [column, unit] of names.entries()) {
    for (const [stat, resource] of [["attack", "Gold"], ["health", "Iron"]]) {
      const previous = combatRows[row - 1];
      const parent = previous?.[Math.min(column, previous.length - 1)];
      catalog[combatKey(stat, unit)] = {
        resource, parent: parent && combatKey(stat, parent), rank: row + 1
      };
    }
  }
}

const maxLevel = 10;
const bonusPerLevel = 2;
const prerequisiteLevel = 3;
const nextResearch = (item, level) => ({
  price: 1000 * (level + 1) * (item.rank || 1),
  durationMs: 3600000 * (level + 1) * (item.rank || 1)
});

module.exports = { units, combatRows, development, combatKey, catalog, maxLevel, bonusPerLevel, prerequisiteLevel, nextResearch };
