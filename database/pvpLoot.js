const {cargoCapacity:unitCargoCapacity} = require("../src/shared/unitEconomy");

function calculateCargoCapacity(survivors={}) {
  return Object.entries(survivors).reduce((total,[unit,count]) =>
    total + Math.max(0,Number(count)||0) * Number(unitCargoCapacity[unit]||0),0);
}

const resourceNames = ["Gold","Iron","Water","Solar"];

function unprotectedResources(resources) {
  return Object.fromEntries(resourceNames.map(key => [key, Math.max(0, Math.floor(Number(resources[key]) || 0) - 10000)]));
}

function calculateLoot(resources={},capacity=0) {
  const keys=resourceNames;
  const available=unprotectedResources(resources);
  for (const key of keys) available[key] = Math.floor(available[key] * 0.5);
  const loot=Object.fromEntries(keys.map(key=>[key,0]));
  let remaining=Math.min(Math.max(0,Math.floor(Number(capacity)||0)),Object.values(available).reduce((sum,n)=>sum+n,0));
  while(remaining>0){
    const active=keys.filter(key=>available[key]>0);
    if(!active.length)break;
    const share=Math.floor(remaining/active.length);
    let moved=0;
    if(share===0){
      for(const key of active){
        if(remaining<=0)break;
        available[key]--;loot[key]++;remaining--;moved++;
      }
    }else{
      for(const key of active){
        if(remaining<=0)break;
        const amount=Math.min(available[key],share,remaining);
        available[key]-=amount;loot[key]+=amount;remaining-=amount;moved+=amount;
      }
    }
    if(!moved)break;
  }
  return loot;
}

module.exports = {calculateCargoCapacity,calculateLoot,resourceNames,unprotectedResources};
