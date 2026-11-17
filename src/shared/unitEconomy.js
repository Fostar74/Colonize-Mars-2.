// Shared server/client troop economy: prices are per single unit.
const categories = {
  Ground: ["Explorer Trooper","Exo-Soldier","Plasma Bladesman","Nano Shieldman"],
  Ranged: ["Railgunner","Pulse Sniper","Drone Operator"],
  Mobile: ["Rover Scout","Hoverbike Rider","Mech Walker","Hover Drone Rider"],
  "Heavy Systems": ["Demolition Bot","Missile Carrier","Particle Blaster","Orbital Strike Beacon"],
  Elite: ["AI General","Gene Warrior"]
};
const tiers = { Ground:1, Ranged:1.5, Mobile:2, "Heavy Systems":3 };
const {explorerTrooper,nanoShieldman,exoSoldier,plasmaBladesman,explorerUpgrade,profileFor}=require("./unitProfiles");
// Maximum resources a single surviving unit can carry home after a player battle.
const cargoCapacity = {
  "Explorer Trooper":10, "Exo-Soldier":10, "Plasma Bladesman":10, "Nano Shieldman":10,
  "Railgunner":5, "Pulse Sniper":5, "Drone Operator":5,
  ...Object.fromEntries(categories.Mobile.map(unit=>[unit,profileFor(unit).cargo])),
  ...Object.fromEntries(categories["Heavy Systems"].map(unit=>[unit,profileFor(unit).cargo])),
  ...Object.fromEntries(categories.Elite.map(unit=>[unit,profileFor(unit).cargo]))
};
// Resource emphasis for units without a fixed price.
const emphasis = [
  {Gold:100,Iron:80,Water:60,Solar:40},
  {Gold:60,Iron:80,Water:120,Solar:40},
  {Gold:60,Iron:130,Water:50,Solar:40},
  {Gold:60,Iron:70,Water:50,Solar:120}
];
function unitPrice(unit) {
  const profile=profileFor(unit);
  if(profile)return {...profile.price};
  const entry = Object.entries(categories).find(([,units])=>units.includes(unit));
  if (!entry) return null;
  const [category,units]=entry;
  const base=emphasis[units.indexOf(unit) % emphasis.length];
  return Object.fromEntries(Object.entries(base).map(([resource,value])=>[resource,Math.ceil(value*tiers[category])]));
}
const unlockBuildings = {
  Ground:"Training Center", Ranged:"Drone Factory",
  Mobile:"Vehicle Bay", "Heavy Systems":"Drone Factory", Elite:"Order"
};
const unlockLevels = {
  Ground:[1,2,4,6], Ranged:[1,8,16], Mobile:[1,3,5,7],
  "Heavy Systems":[2,4,6,8], Elite:[1,1]
};
function specialUnitCombatBonuses(army) {
  return {
    attack: Math.min(50, Math.max(0, Number(army?.["AI General"]) || 0)) / 10,
    health: Math.min(50, Math.max(0, Number(army?.["Gene Warrior"]) || 0)) / 10
  };
}

function unitRequirement(unit) {
  const entry=Object.entries(categories).find(([,units])=>units.includes(unit));
  if (!entry) return null;
  const [category,units]=entry;
  const profile=profileFor(unit); if(profile)return {...profile.requirement};
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
  const specific=explorerUpgrade(unit,stat,level,discount,0);if(specific?.cost)return specific.cost;
  const amount=Math.ceil(2 * Math.pow(level+1,2) * (100 - discount));
  return {Gold:amount,Iron:amount};
}

function armySpeed(army){
  const speeds=Object.entries(army||{})
    .filter(([,count])=>Number(count)>0)
    .map(([unit])=>Number(profileFor(unit)?.speed))
    .filter(speed=>Number.isFinite(speed)&&speed>0);
  return speeds.length?Math.min(...speeds):1;
}
function armyTravelDuration(baseDuration,army,speedBonus=0){
  const bonus=Math.max(-99,Number(speedBonus)||0);
  return Math.max(1000,Math.ceil(baseDuration/(armySpeed(army)*(1+bonus/100))));
}
function unitTrainingDuration(unit){return profileFor(unit)?.trainingSeconds??30;}
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
const orderLevelCosts = [30000, 50000, 100000];
const defenseGridMaxLevel = 30;
const defenseGridRequirements = {"Gold Synthesizer":1,"Iron Driller":1,"Solar Array":1,"Water Extractor":1};
const defenseGridLevels = {
  1: {
    cost: {Gold:35,Iron:50,Water:100,Solar:20},
    durationMs: 5 * 60 * 1000,
    attack: 2000,
    health: 1000
  }
};

function buildingRequirements(name) {
  return name === "Defense Grid" ? defenseGridRequirements : {};
}

function buildingDuration(name, level, speed = 0) {
  const duration = name === "Defense Grid" ? defenseGridLevels[level]?.durationMs : undefined;
  return allianceUpgradeDuration(duration ?? 15000 * level, speed);
}

function buildingMaxLevel(name) {
  if (name === "Order") return orderLevelCosts.length;
  if (name === "Defense Grid") return defenseGridMaxLevel;
  return Object.prototype.hasOwnProperty.call(buildingBaseCosts, name) ? 20 : 0;
}

function buildingPrice(name,nextLevel,discount = 0) {
  if (!Number.isInteger(nextLevel) || nextLevel < 1 || nextLevel > buildingMaxLevel(name)) return null;
  if (name === "Order") {
    const cost = Math.ceil(orderLevelCosts[nextLevel - 1] * (100 - discount) / 100);
    return {Gold:cost,Iron:cost,Water:cost,Solar:cost};
  }
  const defenseGridCost = name === "Defense Grid" ? defenseGridLevels[nextLevel]?.cost : undefined;
  // Already available Defense Grid levels keep their construction costs until their new data is supplied.
  if (name === "Defense Grid" && nextLevel > 20 && !defenseGridCost) return null;
  const base = defenseGridCost ?? buildingBaseCosts[name];
  const levelMultiplier = defenseGridCost ? 1 : nextLevel;
  return Object.fromEntries(Object.entries(base).map(([resource,amount])=>[resource,Math.ceil(amount * levelMultiplier * (100 - discount) / 100)]));
}

module.exports={specialUnitCombatBonuses,allianceUpgradeDuration,categories,cargoCapacity,unitPrice,upgradePrice,upgradeDuration,unitRequirement,buildingMaxLevel,buildingRequirements,buildingDuration,buildingPrice,defenseGridLevels,unitTrainingDuration,unitUpgradeDetails,armySpeed,armyTravelDuration};
