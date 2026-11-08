// Shared server/client troop economy: prices are per single unit.
const categories = {
  Ground: ["Explorer Trooper","Exo-Soldier","Plasma Bladesman","Nano Shieldman"],
  Ranged: ["Railgunner","Pulse Sniper","Drone Operator"],
  Mobile: ["Rover Scout","Hoverbike Rider","Mech Walker","Hover Drone Rider"],
  "Heavy Systems": ["Demolition Bot","Missile Carrier","Particle Blaster","Orbital Strike Beacon"],
  Elite: ["Martian Noble","AI General","Gene Warrior"]
};
const tiers = { Ground:1, Ranged:1.5, Mobile:2, "Heavy Systems":3, Elite:5 };
// Each unit has a dominant resource; rotate the emphasis within every class.
const emphasis = [
  {Gold:100,Iron:80,Water:60,Solar:40},
  {Gold:60,Iron:80,Water:120,Solar:40},
  {Gold:60,Iron:130,Water:50,Solar:40},
  {Gold:60,Iron:70,Water:50,Solar:120}
];
function unitPrice(unit) {
  const entry = Object.entries(categories).find(([,units])=>units.includes(unit));
  if (!entry) return null;
  const [category,units]=entry;
  const base=emphasis[units.indexOf(unit)%emphasis.length];
  return Object.fromEntries(Object.entries(base).map(([resource,value])=>[resource,Math.ceil(value*tiers[category])]));
}
const unlockBuildings = {
  Ground:"Training Center", Ranged:"Training Center",
  Mobile:"Vehicle Bay", "Heavy Systems":"Drone Factory", Elite:"Drone Factory"
};
const unlockLevels = {
  Ground:[1,2,4,6], Ranged:[3,5,7], Mobile:[1,3,5,7],
  "Heavy Systems":[2,4,6,8], Elite:[10,12,15]
};
function unitRequirement(unit) {
  const entry=Object.entries(categories).find(([,units])=>units.includes(unit));
  if (!entry) return null;
  const [category,units]=entry;
  return {building:unlockBuildings[category],level:unlockLevels[category][units.indexOf(unit)]};
}
function upgradePrice(level) {
  return {Gold:100*(level+1),Iron:100*(level+1)};
}
module.exports={categories,unitPrice,upgradePrice,unitRequirement};
