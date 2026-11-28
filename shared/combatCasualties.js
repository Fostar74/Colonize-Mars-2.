const owner = (side, group) => side===0 ? "attacker" : group?.contingent ? "support:"+group.contingent.id : "defender";

function trackVolleys(shots, hits, casualties) {
  for (const {side,target,group,appliedDamage} of shots) {
    const killed = casualties.get(target);
    if (!killed || !appliedDamage) continue;
    const key = owner(side,group);
    target.killedBy ??= {};
    target.killedBy[key] = (target.killedBy[key]||0)+killed*appliedDamage/hits.get(target);
  }
}

function creditedKills(sides, hospitalSides) {
  const casualties = new Map();
  for (let side=0;side<2;side++) for (const group of sides[side]) {
    const lost = group.original-group.count-(group.deserted||0);
    if (!lost) continue;
    const key = owner(side,group)+"/"+group.unit;
    if (!casualties.has(key)) casualties.set(key,{unit:group.unit,lost:0,side,credit:{}});
    const row = casualties.get(key);
    const weight = Object.values(group.killedBy||{}).reduce((sum,value)=>sum+value,0);
    if (!weight) continue;
    row.lost += lost;
    for (const [id,count] of Object.entries(group.killedBy)) row.credit[id]=(row.credit[id]||0)+count*lost/weight;
  }
  const result = {};
  for (const {unit,lost,side,credit} of casualties.values()) {
    if (!lost) continue;
    const deaths = lost - (hospitalSides.includes(side) ? Math.floor(lost*0.3) : 0);
    const total = Object.values(credit).reduce((sum,weight)=>sum+weight,0);
    const split = Object.entries(credit).map(([id,weight])=>{
      const share=weight*deaths/total;
      return {id,count:Math.floor(share),fraction:share-Math.floor(share)};
    }).sort((a,b)=>b.fraction-a.fraction||a.id.localeCompare(b.id));
    let remainder=deaths-split.reduce((sum,row)=>sum+row.count,0);
    for (const row of split) {
      const extra = remainder > 0 ? 1 : 0;
      remainder -= extra;
      const count = row.count + extra;
      if (!count) continue;
      result[row.id] ??= {};
      result[row.id][unit]=(result[row.id][unit]||0)+count;
    }
  }
  return result;
}

module.exports = {trackVolleys,creditedKills};
