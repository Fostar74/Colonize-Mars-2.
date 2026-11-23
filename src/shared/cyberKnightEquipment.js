const {categories}=require("./unitEconomy");
const rarityByStars={1:"Common",2:"Uncommon",3:"Rare",4:"Epic",5:"Legendary"};
const rarityUnlockLevel={Common:1,Uncommon:11,Rare:21,Epic:31,Legendary:41};
function rarityForEquipmentLevel(level){const n=Math.max(0,Math.min(50,Math.floor(Number(level)||0)));return n>=41?"Legendary":n>=31?"Epic":n>=21?"Rare":n>=11?"Uncommon":"Common";}
const rarityBonusPercent={Common:1,Uncommon:10,Rare:20,Epic:30,Legendary:40};
const combatUnits=Object.entries(categories).filter(([category])=>category!=="Elite").flatMap(([,units])=>units);
const alienCombatUnits=["Alien Infantry","Xeno Warrior","Spore Archer","Plasma Stalker","War Drone","Siege Behemoth","Praetorian Guard","Alien Overlord"];
const combatProtocols=["Precision Fire","Mobile Warfare","Reinforced Armor","Advanced Research","Combat Recovery","Battle Command","Evasion Protocol","Heavy Artillery","Infantry Command"];
const protocolLabels={"Precision Fire":["Precision Targeting","Прецизно прицелване"],"Mobile Warfare":["Assault Mobility","Щурмова мобилност"],"Reinforced Armor":["Nano Armor Systems","Системи за наноброня"],"Advanced Research":["Neural Learning Matrix","Невронна матрица за обучение"],"Combat Recovery":["Nano Regeneration","Нанорегенерация"],"Battle Command":["Neural Command","Невронно командване"],"Evasion Protocol":["Probability Matrix","Матрица на вероятностите"],"Heavy Artillery":["Siege Engineering","Обсадно инженерство"],"Infantry Command":["Combat Augmentation","Бойно усилване"]};
const unitRanges={
"Explorer Trooper":[.5,50,.5,50],"Exo-Soldier":[.5,50,.5,50],"Plasma Bladesman":[.5,50,.5,50],"Nano Shieldman":[.5,50,.5,50],
"Rover Scout":[.75,75,.75,75],"Hoverbike Rider":[1.5,150,1.5,150],"Mech Walker":[1.5,150,1.25,125],"Hover Drone Rider":[2,200,2,200],
"Railgunner":[.3,30,.3,30],"Pulse Sniper":[.25,25,.25,25],"Drone Operator":[.2,20,.2,20],
"Demolition Bot":[2.5,250,5,500],"Missile Carrier":[1.25,125,1.25,125],"Particle Blaster":[1.5,150,1.5,150],"Orbital Strike Beacon":[1.75,175,1.75,175]};
const protocolRanges={"Precision Fire":[.1,10],"Mobile Warfare":[.2,20],"Reinforced Armor":[.2,20],"Advanced Research":[.1,10],"Combat Recovery":[.05,5],"Battle Command":[.1,10],"Evasion Protocol":[.05,5],"Heavy Artillery":[.2,20],"Infantry Command":[.1,10]};
const bonusAtLevel=(min,max,level)=>Math.round((min+(max-min)*(Math.max(1,Math.min(50,Number(level)||1))-1)/49)*10000)/10000;
function valueForEffect(slot,target,level){
  if(slot==="BOOTS"||slot==="GLOVES"){const range=protocolRanges[target];return range?bonusAtLevel(...range,level):0;}
  const range=unitRanges[target];if(!range)return 0;
  const offset=slot==="ARMOR"||slot==="SHIELD"?2:0;
  return bonusAtLevel(range[offset],range[offset+1],level);
}
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

function rollEquipmentBonuses(slot,rarity,stars,level=1){
  const pool=slot==="BOOTS"||slot==="GLOVES"?combatProtocols:combatUnits;
  const available=[...pool],effects=[];
  for(let i=0;i<Math.min(stars,available.length);i++){
    const target=available.splice(Math.floor(Math.random()*available.length),1)[0];
    effects.push({kind:effectKindBySlot[slot],target,value:valueForEffect(slot,target,level)});
  }
  return {effects,stats:effects.map(describeEquipmentEffect)};
}
function describeEquipmentEffect(effect,language="en"){
  const value=Math.max(0,Number(effect?.value)||0),target=String(effect?.target||"unknown target");
  const sign=effect?.kind==="enemyUnitAttack"||effect?.kind==="enemyUnitHealth"||effect?.kind==="enemyProtocol"?"−":"+";
  const unit=effect?.kind==="protocolBoost"||effect?.kind==="enemyProtocol"?"%":"";
  const label=protocolLabels[target]?.[language==="bg"?1:0]||target;
  if(effect?.kind==="unitAttack")return `${target} attack +${value}`;
  if(effect?.kind==="unitHealth")return `${target} HP +${value}`;
  if(effect?.kind==="enemyUnitAttack")return `Enemy ${target} attack −${value}`;
  if(effect?.kind==="enemyUnitHealth")return `Enemy ${target} HP −${value}`;
  if(effect?.kind==="protocolBoost")return `${label}: +${value}%`;
  if(effect?.kind==="enemyProtocol")return `${language==="bg"?"Противников протокол":"Opponent protocol"} ${label}: −${value}%`;
  return `${label} ${sign}${value}${unit}`;
}
function normalizeEquipmentItem(item){
  if(!item||typeof item!=="object")return item;
  const slot=String(item.slot||item.type||"").toUpperCase();
  if(!effectKindBySlot[slot])return item;
  // Preserve the original forged level, star count, item identity and valid targets.
  const level=Math.max(1,Math.min(50,Math.floor(Number(item.level??item.levelRequirement??1)||1)));
  // Never demote a historically earned rarity just because an older migration reset its level.
  const rarityFloor={Common:1,Uncommon:11,Rare:21,Epic:31,Legendary:41};
  const recordedRarity=rarityFloor[item.rarity]?item.rarity:"Common";
  const restoredLevel=Math.max(level,rarityFloor[recordedRarity]);
  const rarity=rarityForEquipmentLevel(restoredLevel);
  const stars=Math.max(1,Math.min(5,Number(item.stars)||Number(item.bonusSlots)||1));
  const pool=slot==="BOOTS"||slot==="GLOVES"?combatProtocols:combatUnits;
  const previous=Array.isArray(item.effects)?item.effects:[];
  const effects=[],used=new Set();
  for(const effect of previous){
    if(effects.length>=stars)break;
    if(effect?.kind!==effectKindBySlot[slot]||!pool.includes(effect.target)||used.has(effect.target))continue;
    used.add(effect.target);effects.push({kind:effect.kind,target:effect.target,value:valueForEffect(slot,effect.target,restoredLevel)});
  }
  // Only replace invalid/missing targets, never reroll valid earned bonuses.
  const available=pool.filter(target=>!used.has(target));
  while(effects.length<Math.min(stars,pool.length)&&available.length){
    const target=available.splice(Math.floor(Math.random()*available.length),1)[0];
    effects.push({kind:effectKindBySlot[slot],target,value:valueForEffect(slot,target,level)});
  }
  return {...item,slot,level:restoredLevel,restorationLocked:!!item.restorationLocked||restoredLevel>level,stars,bonusSlots:stars,rarity,rarityBonus:rarityBonusPercent[rarity],effects,stats:effects.map(describeEquipmentEffect)};
}
function equipmentCombatBonuses(equippedItems={}){
  const result={unitEffects:{},enemyDebuffs:{},protocolBoosts:{},enemyProtocolDebuffs:{}};
  const add=(group,target,key,value)=>{group[target]||={};group[target][key]=(Number(group[target][key])||0)+Math.max(0,Number(value)||0);};
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

module.exports={rarityByStars,rarityUnlockLevel,rarityBonusPercent,rarityForEquipmentLevel,starsForAlienMission,combatProtocols,protocolLabels,rollEquipmentBonuses,describeEquipmentEffect,normalizeEquipmentItem,equipmentCombatBonuses,valueForEffect,unitRanges,protocolRanges};
