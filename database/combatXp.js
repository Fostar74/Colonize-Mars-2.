const {unitPrice} = require("../src/shared/unitEconomy");

function xpForKills(kills={}) {
  const setting = Number(process.env.COMBAT_XP_MULTIPLIER ?? 1);
  const multiplier = Number.isFinite(setting) && setting>=0 ? setting : 1;
  const total = Object.entries(kills).reduce((sum,[unit,count])=>{
    const cost = unitPrice(unit);
    return sum + count*Object.values(cost||{}).reduce((value,amount)=>value+amount,0);
  },0);
  return Math.min(Number.MAX_SAFE_INTEGER,Math.floor(total*multiplier));
}

function awardHuman(db, id, xp) {
  if (!xp) return;
  db.prepare(`INSERT INTO player_talents(user_id,xp) VALUES (?,?)
    ON CONFLICT(user_id) DO UPDATE SET xp=MIN(9007199254740991,xp+excluded.xp)`).run(id,xp);
}

module.exports = {xpForKills,awardHuman};
