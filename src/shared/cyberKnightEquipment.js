const {categories}=require("./unitEconomy");
const rarityByStars={1:"Common",2:"Uncommon",3:"Rare",4:"Epic",5:"Legendary"};
const rarityUnlockLevel={Common:1,Uncommon:10,Rare:20,Epic:30,Legendary:40};
const rarityBonusPercent={Common:1,Uncommon:10,Rare:20,Epic:30,Legendary:40};
const combatUnits=Object.values(categories).flat();
const combatProtocols=["Precision Fire","Reinforced Armor","Infantry Command","Battle Command","Evasion Protocol","Combat Recovery","Mobile Warfare","Heavy Artillery"];

function starsForAlienMission(level){
  const missionLevel=Number(level)||0;
  if(missionLevel>=20)return 5;
  if(missionLevel>=16)return 4;
  if(missionLevel>=9)return 3;
  if(missionLevel>=3)return 2;
  return 1;
}

function rollEquipmentBonuses(slot,rarity,stars){
  const pool=slot==="BOOTS"||slot==="GLOVES"?combatProtocols:combatUnits;
  const available=[...pool],value=rarityBonusPercent[rarity]||1,effects=[];
  const kinds={HELMET:"unitAttack",ARMOR:"unitHealth",WEAPON:"enemyUnitAttack",SHIELD:"enemyUnitHealth",BOOTS:"protocolBoost",GLOVES:"enemyProtocol"};
  for(let i=0;i<Math.min(stars,available.length);i++){
    const targetIndex=Math.floor(Math.random()*available.length),target=available.splice(targetIndex,1)[0],kind=kinds[slot];
    effects.push({kind,target,value});
  }
  const labels={unitAttack:"attack",unitHealth:"HP",enemyUnitAttack:"enemy attack",enemyUnitHealth:"enemy HP",protocolBoost:"protocol bonus",enemyProtocol:"enemy protocol"};
  return {effects,stats:effects.map(effect=>`${effect.kind.startsWith("enemy")?"−":"+"}${value}% ${effect.target} ${labels[effect.kind]}`)};
}

function equipmentCombatBonuses(equippedItems={}){
  const result={unitEffects:{},enemyDebuffs:{},protocolBoosts:{},enemyProtocolDebuffs:{}};
  const add=(group,target,key,value)=>{group[target]||={};group[target][key]=Math.min(50,(Number(group[target][key])||0)+Math.max(0,Number(value)||0));};
  for(const item of Object.values(equippedItems||{}))for(const effect of item?.effects||[]){
    if(effect.kind==="unitAttack")add(result.unitEffects,effect.target,"attack",effect.value);
    else if(effect.kind==="unitHealth")add(result.unitEffects,effect.target,"health",effect.value);
    else if(effect.kind==="enemyUnitAttack")add(result.enemyDebuffs,effect.target,"attack",effect.value);
    else if(effect.kind==="enemyUnitHealth")add(result.enemyDebuffs,effect.target,"health",effect.value);
    else if(effect.kind==="protocolBoost")add(result.protocolBoosts,effect.target,"value",effect.value);
    else if(effect.kind==="enemyProtocol")add(result.enemyProtocolDebuffs,effect.target,"value",effect.value);
  }
  return result;
}

module.exports={rarityByStars,rarityUnlockLevel,rarityBonusPercent,starsForAlienMission,combatProtocols,rollEquipmentBonuses,equipmentCombatBonuses};
