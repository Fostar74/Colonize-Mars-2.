// Provisional combat values until unit-specific statistics and equipment bonuses are finalized.
// Every volley targets one randomly selected eligible group, independent of group size.
const {categories}=require("../src/shared/unitEconomy");
const {unitCombatStats}=require("../src/shared/unitProfiles");
const playerTypes=Object.fromEntries(Object.entries(categories).flatMap(([category,names])=>names.map((name,index)=>[name,{category:category==="Ground"||category==="Elite"?"infantry":category==="Ranged"?"ranged":category==="Mobile"?"mobile":"artillery",hp:category==="Ground"?90+index*30:category==="Ranged"?65+index*10:category==="Mobile"?180+index*80:category==="Elite"?350+index*100:120+index*50,attack:category==="Ground"?20+index*7:category==="Ranged"?35+index*12:category==="Mobile"?50+index*18:category==="Elite"?90+index*25:55+index*20,range:category==="Ground"?1:category==="Elite"?2:category==="Mobile"?1:category==="Ranged"?4:5}])));
for(const name of ["Explorer Trooper","Exo-Soldier"]){const stats=unitCombatStats(name,{});playerTypes[name]={...playerTypes[name],...stats,attackVs:stats.attack};}
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
      groups.push({unit:entry.unit,count:entry.count,row:entry.row,original:entry.count,...types[entry.unit]});
    }
    for(const [unit,count] of Object.entries(army))if(groups.filter(g=>g.unit===unit).reduce((a,g)=>a+g.count,0)!==count)throw Error("Formation does not match selected troops.");
  } else {
    for(const [unit,count] of Object.entries(army))if(count>0&&types[unit])groups.push({unit,count,row:types[unit].category==="ranged"||types[unit].category==="artillery"?4:1,original:count,...types[unit]});
  }
  return groups;
}
function fight(attackerArmy,defenderArmy,formation,bonuses={},options={}){
  const defenderIsPlayer=options.playerDefense===true;
  const attackerIsAlien=options.attackerIsAlien===true;
  const playerSide=attackerIsAlien?1:0;
  const sides=[
    createGroups(attackerArmy,attackerIsAlien?alienTypes:playerTypes,formation),
    createGroups(defenderArmy,defenderIsPlayer?playerTypes:alienTypes,defenderIsPlayer?options.defenderFormation:null)
  ];
  // Apply unit-specific upgrades to player units on both sides, and commander bonuses to the active player side.
  for(let side=0;side<2;side++)for(const group of sides[side]){
    if(side!==playerSide&&!defenderIsPlayer)continue;
    const upgrades=side===0?bonuses.unitUpgrades?.[group.unit]:options.defenderUnitUpgrades?.[group.unit];
    if(group.unit==="Explorer Trooper"){const stats=explorerCombatStats(upgrades||{});group.hp=stats.health;group.attackVs=stats.attack;}
    const categoryBonus=side!==playerSide?0:group.category==="ranged"?bonuses.rangedAttack:group.category==="infantry"?bonuses.infantryAttack:group.category==="mobile"?bonuses.mobileAttack:group.category==="artillery"?bonuses.artilleryAttack:0;
    const research=bonuses.unitResearch?.[group.unit];
    const attackMultiplier=1+((Number(categoryBonus)||0)+(side!==playerSide?0:Number(bonuses.leadership)||0)+(side!==playerSide?0:Number(bonuses.allAttack)||0)+(research?.attack||0))/100;
    group.attack*=attackMultiplier;
    if(group.attackVs)for(const key of Object.keys(group.attackVs))group.attackVs[key]*=attackMultiplier;
    group.hp*=1+((side!==playerSide?0:Number(bonuses.allHealth)||0)+(research?.health||0)+(side===playerSide&&group.category==="infantry"?(Number(bonuses.infantryHealth)||0):0))/100;
  }
  const dodgeChance=Math.max(0,Math.min(0.15,(Number(bonuses.dodge)||0)/100));
  const reviveRate=Math.max(0,Math.min(0.15,(Number(bonuses.revive)||0)/100));
  const report=[];let rounds=0;
  const alive=side=>side.some(g=>g.count>0);
  while(alive(sides[0])&&alive(sides[1])&&rounds<80){
    rounds++;
    for(const group of sides[0])group.roundStartCount=group.count;
    const round={round:rounds,events:[]};
    for(let step=0;step<4;step++){
      // All groups in the same phase fire using their numbers at phase start.
      const shots=[];
      for(let side=0;side<2;side++)for(const group of sides[side]){
        if(group.count<=0||phase[group.category]!==step)continue;
        const enemies=sides[1-side].filter(g=>g.count>0&&group.range>=group.row+g.row-1);
        if(!enemies.length)continue;
        const target=enemies[Math.floor(Math.random()*enemies.length)];
        const damage=group.count*(group.attackVs?.[target.category]??group.attack*effectiveness[group.category][target.category]);
        shots.push({side,group,target,damage,count:group.count});
      }
      const hits=new Map();
      for(const shot of shots){
        // Evasion applies to incoming alien volleys only. The target group
        // dodges the volley, not an arbitrary percentage of its casualties.
        shot.dodged=shot.side!==playerSide&&Math.random()<dodgeChance;
        if(!shot.dodged)hits.set(shot.target,(hits.get(shot.target)||0)+shot.damage);
      }
      const casualties=new Map();
      for(const [target,damage] of hits){
        const killed=Math.min(target.count,Math.floor(damage/target.hp));
        target.count-=killed;
        casualties.set(target,killed);
      }
      // Distribute actual casualties among contributing volleys. The sum of
      // per-shot kills equals the casualties applied to each target group.
      const assigned=new Map();
      for(const shot of shots){
        const total=hits.get(shot.target)||0;
        const killed=casualties.get(shot.target)||0;
        const previous=assigned.get(shot.target)||0;
        const allocation=shot.dodged||!total?0:Math.min(killed-previous,Math.floor(killed*shot.damage/total));
        shot.kills=allocation;
        assigned.set(shot.target,previous+allocation);
      }
      for(const [target,killed] of casualties){
        let remainder=killed-(assigned.get(target)||0);
        for(const shot of shots){
          if(!remainder)break;
          if(shot.target!==target||shot.dodged)continue;
          shot.kills++;remainder--;
        }
      }
      for(const shot of shots)round.events.push({phase:step,attacker:shot.side===0?(attackerIsAlien?"Alien Base":"Player"):(defenderIsPlayer?"Player Defense":"Alien Base"),unit:shot.group.unit,units:shot.count,target:shot.target.unit,damage:shot.dodged?0:Math.round(shot.damage),dodged:!!shot.dodged,kills:shot.kills});
    }
    // Restore a percentage of casualties at the end of each round, capped
    // at the original deployed group size. Fractions accumulate per group.
    if(reviveRate>0){
      for(const group of sides[playerSide]){
        const missing=group.original-group.count;
        if(missing<=0)continue;
        // Only casualties suffered during this round are eligible for
        // regeneration; repeatedly healing the entire historical deficit
        // would make the effective recovery exceed the selected tier.
        const lostThisRound=Math.max(0,(group.roundStartCount??group.original)-group.count);
        group.reviveCarry=(group.reviveCarry||0)+lostThisRound*reviveRate;
        const restored=Math.min(missing,Math.floor(group.reviveCarry+1e-9));
        if(restored>0){group.count+=restored;group.reviveCarry-=restored;round.events.push({phase:4,attacker:"Nano Regeneration",unit:group.unit,restored});}
      }
    }
    // Shift only when the frontmost occupied row is eliminated.
    for(const side of sides){
      if(!side.some(g=>g.count>0&&g.row===1)){
        for(const g of side)if(g.count>0)g.row=Math.max(1,g.row-1);
      }
    }
    report.push(round);
  }
  return {victory:alive(sides[0])&&!alive(sides[1]),rounds,report,survivors:Object.fromEntries(Object.keys(attackerArmy).map(unit=>[unit,sides[0].filter(g=>g.unit===unit).reduce((a,g)=>a+g.count,0)])),defenderSurvivors:Object.fromEntries(Object.keys(defenderArmy).map(unit=>[unit,sides[1].filter(g=>g.unit===unit).reduce((a,g)=>a+g.count,0)])),defendersRemaining:sides[1].reduce((a,g)=>a+g.count,0),provisional:true};
}
module.exports={fight,playerTypes,alienTypes};
