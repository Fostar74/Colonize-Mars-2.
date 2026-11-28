const neuralCommandTiers = [2, 4, 6];
const toRate = value => Math.round(Math.max(0, Math.min(100, Number(value) || 0)) * 10000);

function applyDesertion(sides, bonusesForGroup, events) {
  // Each side uses its strongest commander with troops still in the fight.
  const rates = sides.map((groups, side) => groups.reduce((max, group) =>
    group.count > 0 ? Math.max(max, toRate(bonusesForGroup(side, group)?.desertion)) : max, 0));
  if (rates[0] === rates[1]) return;
  const side = rates[0] < rates[1] ? 0 : 1;
  const rate = Math.abs(rates[0] - rates[1]);
  const divisor = 1000000; // Ten-thousandths of a percentage point.
  const owners = new Map();
  for (const group of sides[side]) {
    if (!group.count) continue;
    const id = group.contingent?.id ?? null;
    if (!owners.has(id)) owners.set(id, []);
    const amount = group.count * rate;
    owners.get(id).push({group, count: Math.floor(amount / divisor), remainder: amount % divisor});
  }

  // Round down once per owner. Distribute leftover whole troops across
  // formations by largest remainder, with stable formation order for ties.
  for (const [contingentId, entries] of owners) {
    let extra = Math.floor(entries.reduce((sum, entry) => sum + entry.remainder, 0) / divisor);
    for (const entry of [...entries].sort((a, b) => b.remainder - a.remainder)) {
      if (!extra) break;
      entry.count++;
      extra--;
    }
    const byUnit = new Map();
    for (const {group, count} of entries) {
      if (!count) continue;
      group.count -= count;
      group.deserted = (group.deserted || 0) + count;
      byUnit.set(group.unit, (byUnit.get(group.unit) || 0) + count);
    }
    for (const [unit, deserted] of byUnit) events.push({
      phase: -1, unit, deserted, side: side === 0 ? "attacker" : "defender",
      ...(contingentId === null ? {} : {contingentId}),
    });
  }
}

module.exports = {neuralCommandTiers, applyDesertion};
