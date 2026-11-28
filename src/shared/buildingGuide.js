const {buildingNames,buildingMaxLevel,buildingPrice,buildingDuration,buildingRequirements,unitRequirement,categories,cargoDepotLimits}=require("./unitEconomy");

const art={
  "Gold Synthesizer":"gold","Iron Driller":"iron","Solar Array":"solar","Water Extractor":"water",
  "Cargo Depot":"cargo","Upgrade Lab":"upgrade","Bio-Lab":"bio","Training Center":"training",
  "Combat Simulator":"combat","Vehicle Bay":"vehicle","Drone Factory":"drone","Order":"order","Defense Grid":"defense",
};
const production={
  "Gold Synthesizer":"Gold","Iron Driller":"Iron","Solar Array":"Solar","Water Extractor":"Water",
};
const purposes={
  "Cargo Depot":["Stores and transfers resources. The marketplace unlocks at level 3.","Служи за прехвърляне на ресурси. Пазарът се отключва на ниво 3."],
  "Upgrade Lab":["Shortens unit upgrade times.","Съкращава времето за подобрение на войските."],
  "Bio-Lab":["No gameplay effect per level is currently implemented.","В момента нивата нямат реализиран игрови ефект."],
  "Training Center":["Unlocks military tutorials and training for eligible ground units.","Отключва военни уроци и обучение на допустимите сухопътни единици."],
  "Combat Simulator":["Unlocks battle simulations at level 1 and selected mobile units at later levels.","Отключва симулации на ниво 1 и определени мобилни единици на следващите нива."],
  "Vehicle Bay":["Unlocks units that require this building.","Отключва единиците, които изискват тази сграда."],
  "Drone Factory":["Unlocks ranged troops and heavy systems that require this building.","Отключва стрелковите войски и тежките системи, които изискват тази сграда."],
  Order:["Unlocks elite units.","Отключва елитни единици."],
};
const availableUnits=Object.values(categories).flat();

function buildingGuide(name,level) {
  return {
    art:art[name],maxLevel:buildingMaxLevel(name),purpose:purposes[name],resource:production[name],
    cost:buildingPrice(name,level),durationMs:buildingDuration(name,level),requirements:buildingRequirements(name,level),
    units:availableUnits.filter(unit=>{const req=unitRequirement(unit);return req?.building===name&&req.level===level;}),
    cargo:name==="Cargo Depot"?cargoDepotLimits(level):null,
  };
}

module.exports={buildingNames,buildingGuide};
