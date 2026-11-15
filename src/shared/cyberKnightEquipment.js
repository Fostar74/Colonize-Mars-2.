const {categories}=require("./unitEconomy");
const rarityByStars={1:"Common",2:"Uncommon",3:"Rare",4:"Epic",5:"Legendary"};
const rarityUnlockLevel={Common:1,Uncommon:10,Rare:20,Epic:30,Legendary:40};
const rarityBonusPercent={Common:1,Uncommon:10,Rare:20,Epic:30,Legendary:40};
const combatUnits=Object.values(categories).flat();
const alienCombatUnits=["Alien Infantry","Xeno Warrior","Spore Archer","Plasma Stalker","War Drone","Siege Behemoth","Praetorian Guard","Alien Overlord"];
const combatProtocols=["Precision Fire","Reinforced Armor","Infantry Command","Battle Command","Evasion Protocol","Combat Recovery","Mobile Warfare","Heavy Artillery"];
const effectKindBySlot={HELMET:"unitAttack",ARMOR:"unitHealth",WEAPON:"enemyUnitAttack",SHIELD:"enemyUnitHealth",BOOTS:"protocolBoost",GLOVES:"enemyProtocol"};
const rarityStars={Common:1,Uncommon:2,Rare:3,Epic:4,Legendary:5};

function starsForAlienMission(level){
  const missionLevel=Number(level)||0;
  if(missionLevel>=20)return 5;
  if(missionLevel>=16)return 4;
  if(missionLevel>=9)return 3;
  if(missionLevel>=3)return 2;
  return 1;
}

function rollEquipmentBonuses(slot,rarity,stars){
  const pool=slot==="BOOTS"||slot==="GLOVES"?combatProtocols:slot==="WEAPON"||slot==="SHIELD"?[...combatUnits,...alienCombatUnits]:combatUnits;
  const available=[...pool],value=rarityBonusPercent[rarity]||1,effects=[];
  for(let i=0;i<Math.min(stars,available.length);i++){
    const targetIndex=Math.floor(Math.random()*available.length),target=available.splice(targetIndex,1)[0],kind=effectKindBySlot[slot];
    effects.push({kind,target,value});
  }
  return {effects,stats:effects.map(describeEquipmentEffect)};
}

function describeEquipmentEffect(effect){
  const value=Math.max(0,Number(effect?.value)||0),target=String(effect?.target||"unknown target");
  if(effect?.kind==="unitAttack")return `${target} attack +${value}%`;
  if(effect?.kind==="unitHealth")return `${target} HP +${value}%`;
  if(effect?.kind==="enemyUnitAttack")return `Enemy ${target} attack −${value}%`;
  if(effect?.kind==="enemyUnitHealth")return `Enemy ${target} HP −${value}%`;
  if(effect?.kind==="protocolBoost")return `${target} protocol +${value}%`;
  if(effect?.kind==="enemyProtocol")return `Opponent ${target} protocol −${value}%`;
  return `${target} · ${value}%`;
}

function normalizeEquipmentItem(item){
  if(!item||typeof item!=="object")return item;
  const slot=String(item.slot||item.type||"").toUpperCase();
  if(!effectKindBySlot[slot])return item;
  const rarity=rarityStars[item.rarity]?item.rarity:rarityByStars[Number(item.stars)||Number(item.bonusSlots)]||"Common";
  const stars=Math.max(1,Math.min(5,Number(item.stars)||Number(item.bonusSlots)||rarityStars[rarity]||1));
  const pool=slot==="BOOTS"||slot==="GLOVES"?combatProtocols:slot==="WEAPON"||slot==="SHIELD"?[...combatUnits,...alienCombatUnits]:combatUnits;
  const effects=Array.isArray(item.effects)?item.effects:[];
  const valid=!!effectKindBySlot[slot]&&effects.length===Math.min(stars,pool.length)&&effects.every(effect=>effect?.kind===effectKindBySlot[slot]&&pool.includes(effect.target)&&Number.isFinite(Number(effect.value))&&Number(effect.value)>=0)&&new Set(effects.map(effect=>effect.target)).size===effects.length;
  const normalizedEffects=valid?effects:rollEquipmentBonuses(slot,rarity,stars).effects;
  const normalizedName=/^Alien\s/i.test(String(item.name||""))?"Plasma "+slot[0]+slot.slice(1).toLowerCase():item.name;
  return {...item,name:normalizedName||"Plasma "+slot[0]+slot.slice(1).toLowerCase(),slot,stars,bonusSlots:stars,rarity,rarityBonus:rarityBonusPercent[rarity],maximumBonus:50,effects:normalizedEffects,stats:normalizedEffects.map(describeEquipmentEffect)};
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

module.exports={rarityByStars,rarityUnlockLevel,rarityBonusPercent,starsForAlienMission,combatProtocols,rollEquipmentBonuses,describeEquipmentEffect,normalizeEquipmentItem,equipmentCombatBonuses};
