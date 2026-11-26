const hour = 3600000;
const constructionTarget = 1000000 * hour;
const constructionApUnit = 100 * hour;
const gatheringInterval = hour / 2000;
const legacyGatheringInterval = hour / 1000;

function firstTime(low, high, reached) {
  while (low < high) {
    const middle = Math.floor((low + high) / 2);
    if (reached(middle)) high = middle;
    else low = middle + 1;
  }
  return low;
}

function gatheringStart(march) {
  return Math.max(march.arrives_at, march.gathering_started_at ?? march.arrives_at);
}

function priorRateDuration(march) {
  const start=gatheringStart(march);
  if (march.gathering_started_at!=null) return 0;
  return march.gathering_rate_changed_at==null ? Infinity : Math.max(0,march.gathering_rate_changed_at-start);
}

function cargoFullAt(march) {
  const prior=priorRateDuration(march);
  const atOldRate=march.capacity*legacyGatheringInterval;
  return gatheringStart(march)+(atOldRate<=prior ? atOldRate : prior+Math.ceil((atOldRate-prior)/2));
}

function settleWork(mine, marches, now) {
  const construction = mine.status === "construction";
  const remaining = construction ? constructionTarget - mine.work : mine.amount;
  const progress = (march, at) => {
    if (construction) return Math.max(0, at - Math.max(march.arrives_at, march.credited_at)) * march.population;
    const elapsed = Math.max(0, at - gatheringStart(march));
    const older=Math.min(elapsed,priorRateDuration(march));
    const collected=Math.floor((older+(legacyGatheringInterval/gatheringInterval)*(elapsed-older))/legacyGatheringInterval);
    return Math.max(0, Math.min(march.capacity, collected) - march.gathered);
  };
  const total = at => marches.reduce((sum, march) => sum + progress(march, at), 0);
  const finished = total(now) >= remaining;
  const at = finished ? firstTime(marches.reduce((earliest, march) => Math.min(earliest, march.launched_at), now), now,
    time => total(time) >= remaining) : now;
  const credits = marches.map(march => ({
    march,
    amount: progress(march, finished ? at - 1 : at),
  }));
  // Award earlier ticks first, breaking ties by march ID.
  let available = remaining - credits.reduce((sum, credit) => sum + credit.amount, 0);
  if (finished) {
    for (const credit of credits) {
      const amount = Math.min(available, progress(credit.march, at) - credit.amount);
      credit.amount += amount;
      available -= amount;
    }
  }
  return {credits, remaining:available, finished, at};
}

module.exports = {hour, constructionTarget, constructionApUnit, firstTime, gatheringStart, cargoFullAt, settleWork};
