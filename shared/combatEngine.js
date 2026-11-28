// Profiled units use their own combat values.
// Each phase snapshots firing counts. Targets and damage are resolved in action order.
const {applyDesertion}=require("./neuralCommand");
const {trackVolleys,creditedKills}=require("./combatCasualties");
const {categories,specialUnitCombatBonuses,defenseGridLevels}=require("../src/shared/unitEconomy");
const {profileFor,unitCombatStats}=require("../src/shared/unitProfiles");
const playerTypes=Object.fromEntries(Object.entries(categories).flatMap(([category,names])=>names.map((name,index)=>[name,{category:category==="Ground"||category==="Elite"?"infantry":category==="Ranged"?"ranged":category==="Mobile"?"mobile":"artillery",hp:category==="Ground"?90+index*30:category==="Ranged"?65+index*10:category==="Mobile"?180+index*80:category==="Elite"?350+index*100:120+index*50,attack:category==="Ground"?20+index*7:category==="Ranged"?35+index*12:category==="Mobile"?50+index*18:category==="Elite"?90+index*25:55+index*20,range:category==="Ground"?1:category==="Elite"?2:category==="Mobile"?1:category==="Ranged"?4:5}])));
for(const name of Object.keys(playerTypes)){
  if(!profileFor(name))continue;
  const stats=unitCombatStats(name);
  playerTypes[name]={...playerTypes[name],...stats,hp:stats.health,attackVs:stats.attack};
}
// Alien defenders are persistent templates; their casualties never modify the map.
const alienTypes={
"Alien Infantry":{category:"infantry",hp:75,attack:17,range:1},
"Xeno Warrior":{category:"infantry",hp:160,attack:35,range:1},
"Spore Archer":{category:"ranged",hp:65,attack:38,range:4},
"Plasma Stalker":{category:"infantry",hp:200,attack:50,range:2},
"War Drone":{category:"mobile",hp:240,attack:65,range:2},
"Siege Behemoth":{category:"artillery",hp:260,attack:95,range:5},
"Praetorian Guard":{category:"infantry",hp:420,attack:105,range:1},
"Alien Overlord":{category:"infantry",hp:2500,attack:400,range:2}
};
const phase={artillery:0,ranged:1,mobile:2,infantry:3};
const phaseOf = group => group.unit==="Mech Walker" ? phase.ranged : phase[group.category];

function splitStack(count) {
  const segments=count>=1000?5:count>=500?3:count>=100?2:1;
  const base=Math.floor(count/segments), remainder=count%segments;
  return Array.from({length:segments},(_,index)=>base+(index<remainder?1:0));
}

const effectiveness={
 infantry:{infantry:1,ranged:1.25,mobile:.65,artillery:1.3},
 ranged:{infantry:1.5,ranged:1,mobile:.65,artillery:.85},
 mobile:{infantry:1.15,ranged:1.7,mobile:1,artillery:1.25},
 artillery:{infantry:.9,ranged:1.3,mobile:1.1,artillery:1.5}
};
function createGroups(army,types,formation){
  const groups=[];
  if(Array.isArray(formation)&&formation.length){
    for(const entry of formation){
      if(!entry||!types[entry.unit]||!Number.isSafeInteger(entry.count)||entry.count<=0||!Number.isInteger(entry.row)||entry.row<1||entry.row>4)throw Error("Invalid formation.");
      groups.push({unit:entry.unit,count:entry.count,row:entry.row,column:Number.isInteger(entry.column)&&entry.column>=0&&entry.column<7?entry.column:null,original:entry.count,...types[entry.unit]});
    }
    for(const [unit,count] of Object.entries(army))if(groups.filter(g=>g.unit===unit).reduce((a,g)=>a+g.count,0)!==count)throw Error("Formation does not match selected troops.");
  } else {
    for(const [unit,count] of Object.entries(army))if(count>0&&types[unit])groups.push({unit,count,row:types[unit].category==="ranged"||types[unit].category==="artillery"?4:1,original:count,...types[unit]});
  }
  return groups;
}
function fight(attackerArmy,defenderArmy,formation,bonuses={},options={}){
  const random=options.random || Math.random;
  const defenderIsPlayer=options.playerDefense===true;
  const attackerIsAlien=options.attackerIsAlien===true;
  const playerSide=attackerIsAlien?1:0;
  const sides=[
    createGroups(attackerArmy,attackerIsAlien?alienTypes:playerTypes,formation),
    createGroups(defenderArmy,defenderIsPlayer?playerTypes:alienTypes,defenderIsPlayer?options.defenderFormation:null)
  ];
  for(const contingent of options.defenderContingents||[]){
    sides[1].push(...createGroups(contingent.army,playerTypes,contingent.formation)
      .map(group=>({...group,contingent:{...contingent,special:specialUnitCombatBonuses(contingent.army)}})));
  }
  // Columns are presentation positions. Keep every group's actual combat row.
  for(const army of sides){
    const allocated=Array.from({length:4},()=>new Set());
    for(const group of army){
      const row=allocated[group.row-1];
      if(group.column==null||row.has(group.column))group.column=null;
      else row.add(group.column);
    }
    for(const group of army){
      if(group.column!=null)continue;
      const row=allocated[group.row-1];
      const column=[0,1,2,3,4,5,6].find(candidate=>!row.has(candidate));
      if(column==null)continue;
      group.column=column;
      row.add(column);
    }
  }
  const playerBonusesForSide=side=>side===playerSide?bonuses:(defenderIsPlayer&&side===1?options.defenderBonuses||null:null);
  const bonusesForGroup=(side,group)=>group.contingent?.bonuses||playerBonusesForSide(side);
  // Each side's deployed special units provide their bonuses for the entire battle.
  const specialBonuses = [
    specialUnitCombatBonuses(attackerIsAlien ? null : attackerArmy),
    specialUnitCombatBonuses(defenderIsPlayer ? defenderArmy : null)
  ];
  // Apply unit-specific upgrades and equipment to player units, and enemy debuffs to the opposing side.
  for(let side=0;side<2;side++)for(const group of sides[side]){
    const ownerBonuses=bonusesForGroup(side,group)||{};
    const enemyBonuses=side===playerSide?(options.defenderBonuses||{}):bonuses;
    const upgrades=group.contingent?ownerBonuses.unitUpgrades?.[group.unit]:side===playerSide?bonuses.unitUpgrades?.[group.unit]:(options.defenderUnitUpgrades||options.defenderBonuses?.unitUpgrades||bonuses.unitUpgrades)?.[group.unit];
    if(profileFor(group.unit)){const stats=unitCombatStats(group.unit,upgrades||{});group.hp=stats.health;group.attackVs=stats.attack;group.wallAttack=stats.wallAttack;}
    const categoryBonus=group.category==="ranged"?ownerBonuses.rangedAttack:group.category==="infantry"?ownerBonuses.infantryAttack:group.category==="mobile"?ownerBonuses.mobileAttack:group.category==="artillery"?ownerBonuses.artilleryAttack:0;
    const research=ownerBonuses.unitResearch?.[group.unit]||options.defenderUnitResearch?.[group.unit];
    const unitEffect=ownerBonuses.unitEffects?.[group.unit]||{},enemyDebuff=enemyBonuses.enemyDebuffs?.[group.unit]||{};
    // Helmet/weapon and armor/shield are FLAT per-soldier modifiers, not percentages.
    const flatAttack=(Number(unitEffect.attack)||0)-(Number(enemyDebuff.attack)||0);
    const flatHealth=(Number(unitEffect.health)||0)-(Number(enemyDebuff.health)||0);
    const attackMultiplier=Math.max(0,1+((Number(categoryBonus)||0)+(Number(ownerBonuses.allAttack)||0)+(group.contingent?.special.attack??specialBonuses[side].attack)+(research?.attack||0))/100);
    group.wallAttack=Math.max(0,group.wallAttack>0?group.wallAttack+flatAttack:0)*attackMultiplier;
    group.attack=Math.max(0,group.attack>0?group.attack+flatAttack:0)*attackMultiplier;
    if(group.attackVs)for(const key of Object.keys(group.attackVs)){
      const base=Number(group.attackVs[key])||0;
      group.attackVs[key]=Math.max(0,base>0?base+flatAttack:0)*attackMultiplier;
    }
    const healthMultiplier=Math.max(.01,1+((Number(ownerBonuses.allHealth)||0)+(group.contingent?.special.health??specialBonuses[side].health)+(research?.health||0)+(group.category==="infantry"?(Number(ownerBonuses.infantryHealth)||0):0))/100);
    group.hp=Math.max(1,group.hp+flatHealth)*healthMultiplier;
  }
  const traceGroup = (group,index) => ({
    id:index,unit:group.unit,row:group.row,column:group.column??null,
    count:group.count,contingentId:group.contingent?.id??null,
  });
  const protocolFields=["rangedAttack","allHealth","infantryAttack","infantryHealth","desertion","dodge","revive","mobileAttack","artilleryAttack"];
  const traceEffects = () => sides.map((groups,side) => {
    const bonuses=new Map();
    for(const group of groups){
      if(group.count<=0)continue;
      const id=group.contingent?.id??null;
      if(bonuses.has(id))continue;
      const owner=bonusesForGroup(side,group)||{};
      const source=owner.protocolTrace||owner;
      bonuses.set(id,{contingentId:id,values:Object.fromEntries(protocolFields.filter(key=>Number(source[key])>0).map(key=>[key,source[key]]))});
    }
    return [...bonuses.values()];
  });
  const gridStats=defenseGridLevels[options.defenseGridLevel];
  let gridHealth=gridStats?.health||0;
  const report=[];let rounds=0;
  const alive=side=>side.some(g=>g.count>0);
  while(alive(sides[0])&&(alive(sides[1])||gridHealth>0)&&rounds<(options.maxRounds??80)){
    rounds++;
    const round={round:rounds,events:[]};
    if(gridStats)round.grid={level:Number(options.defenseGridLevel),startHealth:gridHealth};
    if(options.trace){
      round.start=sides.map(groups=>groups.map(traceGroup));
      round.protocols=traceEffects();
      round.losses=[{},{}];
    }
    applyDesertion(sides,(side,group)=>group.contingent ? group.contingent.bonuses : playerBonusesForSide(side),round.events);
    for(const group of sides[0])group.roundStartCount=group.count;
    for(const group of sides[1])if(group.contingent)group.roundStartCount=group.count;
    const pick = targets => {
      if(!targets.length)return null;
      const targetIndex=Math.floor(random()*targets.length);
      return {target:targets[targetIndex],targetIndex,eligibleTargets:targets.length};
    };
    for(let step=0;step<4;step++){
      const groups=sides.flatMap((army,side)=>army.filter(group=>group.count>0&&phaseOf(group)===step)
        .map(group=>({side,group,count:group.count})));
      const shots=[], hits=new Map(), casualties=new Map();
      const fireAtTroops = (side,group,count,choice,turret=false) => {
        const {target,targetIndex,eligibleTargets}=choice;
        const damage=turret?gridStats.attack:count*(group.attackVs?.[target.category]??group.attack*effectiveness[group.category][target.category]);
        const dodgeMax=Math.max(0,Math.min(15,Number(bonusesForGroup(1-side,target)?.dodge)||0));
        const minimum=Math.max(0,dodgeMax-5);
        const evadedPercent=dodgeMax>0?minimum+Math.floor(random()*(dodgeMax-minimum+1)):0;
        const appliedDamage=damage*(1-evadedPercent/100);
        const previous=hits.get(target)||0;
        hits.set(target,previous+appliedDamage);
        // Combine fractional damage within a phase, recording each action's actual losses.
        const killed=Math.min(target.count,Math.floor((previous+appliedDamage)/target.hp)-Math.floor(previous/target.hp));
        target.count-=killed;
        casualties.set(target,(casualties.get(target)||0)+killed);
        shots.push({side,group,target,appliedDamage});
        const attacker=turret?"Defense Grid":side===0?(attackerIsAlien?"Alien Base":"Player"):(defenderIsPlayer?"Player Defense":"Alien Base");
        round.events.push({
          phase:step,attacker,unit:group?.unit||"Defense Grid",units:count,target:target.unit,
          damage:Math.round(appliedDamage),dodged:evadedPercent>0,evadedPercent,kills:killed,
          ...(turret?{kind:"grid-shot",baseDamage:damage}:{}),
          ...(options.trace?{
            sourceSide:side,sourceGroup:group?sides[side].indexOf(group):null,
            targetSide:1-side,targetGroup:sides[1-side].indexOf(target),
            appliedDamage,baseDamage:damage,targetLoss:killed,targetIndex,eligibleTargets,
          }:{})
        });
      };
      const enemiesFor = (side,group) => sides[1-side].filter(target=>target.count>0&&
        group.range>=group.row+target.row-1+(gridHealth>0?1:0)&&
        (group.attackVs?.[target.category]??group.attack)>0);
      for(const {side,group,count} of groups){
        if(side===0&&gridHealth>0){
          if(group.wallAttack>0&&group.range>=group.row){
            const damage=count*group.wallAttack;
            const appliedDamage=Math.min(gridHealth,damage);
            gridHealth-=appliedDamage;
            round.events.push({
              phase:step,kind:"grid-attack",attacker:attackerIsAlien?"Alien Base":"Player",unit:group.unit,units:count,
              target:"Defense Grid",damage:Math.round(appliedDamage),appliedDamage,baseDamage:damage,gridHealth,
              destroyed:gridHealth===0,kills:0,sourceSide:0,sourceGroup:sides[0].indexOf(group),
            });
          }
          if(options.trace&&(!group.wallAttack||group.range<group.row)){
            round.events.push({phase:step,kind:"no-target",sourceSide:side,sourceGroup:sides[side].indexOf(group),
              unit:group.unit,units:count,segment:1,segments:1});
          }
          continue;
        }
        const segments=splitStack(count);
        for(const [index,segment] of segments.entries()){
          const choice=pick(enemiesFor(side,group));
          if(choice){
            fireAtTroops(side,group,segment,choice);
            if(options.trace)Object.assign(round.events.at(-1),{segment:index+1,segments:segments.length});
          }else if(options.trace){
            round.events.push({phase:step,kind:"no-target",sourceSide:side,sourceGroup:sides[side].indexOf(group),
              unit:group.unit,units:segment,segment:index+1,segments:segments.length});
          }
        }
      }
      if(step===0&&gridHealth>0){
        for(let turret=1;turret<=2;turret++){
          const choice=pick(sides[0].filter(group=>group.count>0&&group.row<=3));
          if(choice){
            fireAtTroops(1,null,1,choice,true);
            round.events.at(-1).turret=turret;
          }else round.events.push({phase:0,kind:"grid-no-target",turret});
        }
      }
      if(options.trace)for(const [target,killed] of casualties){
        if(!killed)continue;
        const side=sides[0].includes(target)?0:1;
        const index=sides[side].indexOf(target);
        round.losses[side][index]=(round.losses[side][index]||0)+killed;
      }
      if(options.trackCasualties)trackVolleys(shots,hits,casualties);
    }
    // Restore a percentage of casualties at the end of each round, capped
    // at the original deployed group size. Fractions accumulate per group.
    for(let side=0;side<2;side++){
      for(const group of sides[side]){
        const reviveRate=Math.max(0,Math.min(0.15,(Number(bonusesForGroup(side,group)?.revive)||0)/100));
        if(!reviveRate)continue;
        const eligible=group.original-(group.deserted||0);
        const missing=eligible-group.count;
        if(missing<=0)continue;
        // Only casualties suffered during this round are eligible for regeneration.
        const lostThisRound=Math.max(0,(group.roundStartCount??eligible)-group.count);
        group.reviveCarry=(group.reviveCarry||0)+lostThisRound*reviveRate;
        const restored=Math.min(missing,Math.floor(group.reviveCarry+1e-9));
        if(restored>0){group.count+=restored;group.reviveCarry-=restored;round.events.push({phase:4,attacker:"Nano Regeneration",unit:group.unit,restored,...(options.trace?{sourceSide:side,sourceGroup:sides[side].indexOf(group),rate:reviveRate*100}:{})});}
      }
    }
    // Shift only when the frontmost occupied row is eliminated.
    for(const side of sides){
      if(!side.some(g=>g.count>0&&g.row===1)){
        for(const g of side)if(g.count>0)g.row=Math.max(1,g.row-1);
      }
    }
    if(round.grid)round.grid.endHealth=gridHealth;
    if(options.trace)round.end=sides.map(groups=>groups.map(group=>group.count));
    report.push(round);
  }
  // A dispatched battle counts as at least one round, even against an empty defense.
  if(rounds===0){rounds=1;report.push({round:1,events:[]});}
  const countArmy = (army, groups, count) => Object.fromEntries(Object.keys(army).map(unit =>
    [unit, groups.filter(group=>group.unit===unit).reduce((total,group)=>total+count(group),0)]));
  const returned = group => group.count+(group.deserted||0);
  const contingentSurvivors=Object.fromEntries((options.defenderContingents||[]).map(({id,army})=>
    [id,countArmy(army,sides[1].filter(group=>group.contingent?.id===id),returned)]));
  return {
    victory:alive(sides[0])&&!alive(sides[1])&&gridHealth<=0,rounds,report,
    survivors:countArmy(attackerArmy,sides[0],returned),
    activeSurvivors:countArmy(attackerArmy,sides[0],group=>group.count),
    defenderSurvivors:countArmy(defenderArmy,sides[1].filter(group=>!group.contingent),returned),
    ...(options.trace&&report[0]?.start?{traceVersion:1}:{}),
    defendersRemaining:sides[1].reduce((sum,group)=>sum+group.count,0),provisional:true,
    ...(options.trackCasualties?{creditedKills:creditedKills(sides,options.hospitalSides||[])}:{}),
    ...(options.defenderContingents?{contingentSurvivors}:{}),
  };
}
module.exports={fight,playerTypes,alienTypes};
