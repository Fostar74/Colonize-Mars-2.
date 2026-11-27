const maxPlayerLevel = 40;
const playerLevelFromXp = (xp, maxLevel = maxPlayerLevel) => Math.min(maxLevel, 1 + Math.floor(Math.max(0, Number(xp) || 0) / 1000));

function hasPvpLevelGap(attackerLevel, targetLevel, abandoned) {
  return !abandoned && Math.abs(attackerLevel - targetLevel) >= 6;
}

module.exports = {playerLevelFromXp, hasPvpLevelGap, maxPlayerLevel};
