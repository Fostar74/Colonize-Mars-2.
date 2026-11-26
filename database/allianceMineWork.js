const hour = 3600000;
const constructionTarget = 1000000 * hour;
const gatheringInterval = hour / 1000;

function firstTime(low, high, reached) {
  while (low < high) {
    const middle = Math.floor((low + high) / 2);
    if (reached(middle)) high = middle;
    else low = middle + 1;
  }
  return low;
}

function settleWork(mine, marches, now) {
  const construction = mine.status === "construction";
  const remaining = construction ? constructionTarget - mine.work : mine.amount;
  const progress = (march, at) => {
    const elapsed = Math.max(0, at - Math.max(march.arrives_at, construction ? march.credited_at : 0));
    return construction
      ? elapsed * march.population
      : Math.max(0, Math.min(march.capacity, Math.floor(elapsed / gatheringInterval)) - march.gathered);
  };
  const total = at => marches.reduce((sum, march) => sum + progress(march, at), 0);
  const finished = total(now) >= remaining;
  const at = finished ? firstTime(marches.reduce((earliest, march) => Math.min(earliest, march.launched_at), now), now,
    time => total(time) >= remaining) : now;
  const credits = marches.map(march => ({
    march,
    amount: progress(march, finished ? at - 1 : at),
  }));
  // A shared stock can run out during a simultaneous tick. Give each march
  // its earlier turns first, then break ties by launch order.
  let available = remaining - credits.reduce((sum, credit) => sum + credit.amount, 0);
  if (finished) {
    for (const credit of credits) {
      const amount = Math.min(available, progress(credit.march, at) - credit.amount);
      credit.amount += amount;
      available -= amount;
    }
  }
  return { credits, remaining: available, finished, at };
}

module.exports = { hour, constructionTarget, gatheringInterval, settleWork };
