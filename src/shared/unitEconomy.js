// Shared server/client troop economy: prices are per single unit.
const categories = {
  Ground: ["Explorer Trooper","Exo-Soldier","Plasma Bladesman","Nano Shieldman"],
  Ranged: ["Railgunner","Pulse Sniper","Drone Operator"],
  Mobile: ["Rover Scout","Hoverbike Rider","Mech Walker","Hover Drone Rider"],
  "Heavy Systems": ["Demolition Bot","Missile Carrier","Particle Blaster","Orbital Strike Beacon"],
  Elite: ["AI General","Gene Warrior"]
};
const tiers = { Ground:1, Ranged:1.5, Mobile:2, "Heavy Systems":3, Elite:5 };
const {explorerTrooper,nanoShieldman,exoSoldier,plasmaBladesman,explorerUpgrade}=require("./unitProfiles");
// Maximum resources a single surviving unit can carry home after a player battle.
const cargoCapacity = {
  "Explorer Trooper":10, "Exo-Soldier":10, "Plasma Bladesman":10, "Nano Shieldman":10,
  "Railgunner":15, "Pulse Sniper":15, "Drone Operator":15,
  "Rover Scout":80, "Hoverbike Rider":60, "Mech Walker":25, "Hover Drone Rider":40,
  "Demolition Bot":20, "Missile Carrier":50, "Particle Blaster":10, "Orbital Strike Beacon":10,
  "AI General":50, "Gene Warrior":30
};
// Each unit has a dominant resource; rotate the emphasis within every class.
const emphasis = [
  {Gold:100,Iron:80,Water:60,Solar:40},
  {Gold:60,Iron:80,Water:120,Solar:40},
  {Gold:60,Iron:130,Water:50,Solar:40},
  {Gold:60,Iron:70,Water:50,Solar:120}
];
function unitPrice(unit) {
  if(unit==="Explorer Trooper")return {...explorerTrooper.price};
  if(unit==="Nano Shieldman")return {...nanoShieldman.price};
  if(unit==="Exo-Soldier")return {...exoSoldier.price};
  if(unit==="Plasma Bladesman")return {...plasmaBladesman.price};
  const entry = Object.entries(categories).find(([,units])=>units.includes(unit));
  if (!entry) return null;
  const [category,units]=entry;
  const base=emphasis[(units.indexOf(unit) + (category === "Elite" ? 1 : 0)) % emphasis.length];
  return Object.fromEntries(Object.entries(base).map(([resource,value])=>[resource,Math.ceil(value*tiers[category])]));
}
const unlockBuildings = {
  Ground:"Training Center", Ranged:"Training Center",
  Mobile:"Vehicle Bay", "Heavy Systems":"Drone Factory", Elite:"Drone Factory"
};
const unlockLevels = {
  Ground:[1,2,4,6], Ranged:[3,5,7], Mobile:[1,3,5,7],
  "Heavy Systems":[2,4,6,8], Elite:[12,15]
};
function unitRequirement(unit) {
  const entry=Object.entries(categories).find(([,units])=>units.includes(unit));
  if (!entry) return null;
  const [category,units]=entry;
  if(unit==="Explorer Trooper")return {...explorerTrooper.requirement};
  if(unit==="Nano Shieldman")return {...nanoShieldman.requirement};
  if(unit==="Exo-Soldier")return {...exoSoldier.requirement};
  if(unit==="Plasma Bladesman")return {...plasmaBladesman.requirement};
  return {building:unlockBuildings[category],level:unlockLevels[category][units.indexOf(unit)]};
}
function allianceUpgradeDuration(duration, speed = 0) {
  return Math.ceil(duration * (100 - speed) / 100);
}
function upgradeDuration(level, speed = 0) {
  return allianceUpgradeDuration(Math.min(24*3600000,Math.ceil(60000*Math.pow(level+1,1.7))), speed);
}
function upgradePrice(level, discount = 0, unit, stat) {
  const specific=explorerUpgrade(unit,stat,level,discount,0);if(specific)return specific.cost;
  const amount=Math.ceil(2 * Math.pow(level+1,2) * (100 - discount));
  return {Gold:amount,Iron:amount};
}

function unitTrainingDuration(unit){return unit==="Explorer Trooper"?explorerTrooper.trainingSeconds:unit==="Nano Shieldman"?nanoShieldman.trainingSeconds:unit==="Exo-Soldier"?exoSoldier.trainingSeconds:unit==="Plasma Bladesman"?plasmaBladesman.trainingSeconds:30;}
function unitUpgradeDetails(unit,stat,level,discount=0,speed=0){return explorerUpgrade(unit,stat,level,discount,speed);}
// Building resource specialization; nextLevel starts at 1.
const buildingBaseCosts = {
  "Gold Synthesizer": {Gold:60,Iron:80,Water:40,Solar:110},
  "Iron Driller": {Gold:90,Iron:50,Water:60,Solar:90},
  "Solar Array": {Gold:80,Iron:100,Water:50,Solar:50},
  "Water Extractor": {Gold:80,Iron:90,Water:120,Solar:30},
  "Cargo Depot": {Gold:130,Iron:110,Water:50,Solar:60},
  "Defense Grid": {Gold:100,Iron:160,Water:50,Solar:90},
  "Upgrade Lab": {Gold:160,Iron:130,Water:100,Solar:110},
  "Bio-Lab": {Gold:120,Iron:90,Water:170,Solar:120},
  "Training Center": {Gold:110,Iron:150,Water:70,Solar:70},
  "Combat Simulator": {Gold:150,Iron:120,Water:90,Solar:140},
  "Vehicle Bay": {Gold:130,Iron:190,Water:70,Solar:110},
  "Drone Factory": {Gold:170,Iron:210,Water:100,Solar:170}
};
function buildingPrice(name,nextLevel,discount = 0) {
  const base=buildingBaseCosts[name];
  if (!base || !Number.isInteger(nextLevel) || nextLevel<1 || nextLevel>20) return null;
  return Object.fromEntries(Object.entries(base).map(([resource,amount])=>[resource,Math.ceil(amount * nextLevel * (100 - discount) / 100)]));
}

module.exports={allianceUpgradeDuration,categories,cargoCapacity,unitPrice,upgradePrice,upgradeDuration,unitRequirement,buildingPrice,unitTrainingDuration,unitUpgradeDetails};
