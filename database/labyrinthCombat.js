// Each entry applies only when creating a new battle. Active battles retain their snapshot.
const attackMultipliers = [
  1,1,1,1,1.5,1.6,1.7,1.8,1.9,2,
  1.96,1.92,1.88,1.84,1.80,1.76,1.72,1.68,1.64,1.60,
  1.56,1.52,1.48,1.44,1.40,1.36,1.32,1.28,1.24,1.20,
];
const roundLimit=150;

function labyrinthMonster(room) {
  const stage=Math.max(1,Math.min(30,Math.ceil(room/10)));
  const chamber=((room-1)%10)+1;
  const boss=chamber===10;
  const hp=1000+(chamber-1)*500+(boss?4500:0)+(stage-1)*10000;
  const baseDamage=Math.round((65+chamber*17)*(stage===1?1:8*Math.pow(1.22,stage-2)));
  const damage=Math.round(baseDamage*attackMultipliers[stage-1]);
  const heal=stage<4?0:Math.min(15,2+Math.floor((stage-4)/3)*2+(boss?1:0));
  const names=["Spore Mutant","Xeno Stalker","Plasma Beast","Cave Reaper","Void Sentinel","Alien Warden","Abyss Predator","Crystal Devourer","Nightmare Guardian","Alien Overlord"];
  // Avoid a regeneration equilibrium that even level-50 equipment cannot overcome.
  // The reference kit deals 1,500 damage and halves both enemy HP and healing.
  const healingCap=stage>=10 ? 2*Math.floor(1500-Math.ceil(hp/2)/135) : undefined;
  return {room,stage,chamber,boss,name:names[chamber-1],hp,damage,heal,healingCap};
}

function createBattle(monster,knight,startedAt) {
  const monsterMaxHp=Math.max(1,Math.round(monster.hp*(1-knight.enemyHpReduction/100)));
  return {room:monster.room,monster,knight,knightHp:knight.maxHp,monsterHp:monsterMaxHp,monsterMaxHp,round:0,log:[],startedAt};
}

function strike(active) {
  const {knight,monster}=active;
  if(active.round>=roundLimit)active.knightHp=0;
  active.round++;
  const damage=knight.attack;
  active.monsterHp=Math.max(0,active.monsterHp-damage);
  active.log.push({round:active.round,actor:"knight",damage,knightHp:active.knightHp,monsterHp:active.monsterHp});
  if(active.monsterHp>0){
    const monsterDamage=Math.max(1,Math.round(monster.damage*(1-knight.enemyAttackReduction/100)));
    active.knightHp=Math.max(0,active.knightHp-monsterDamage);
    if(active.knightHp>0&&knight.healing>0)
      active.knightHp=Math.min(knight.maxHp,active.knightHp+Math.floor((knight.maxHp-active.knightHp)*knight.healing/100));
    active.log.push({round:active.round,actor:"monster",damage:monsterDamage,knightHp:active.knightHp,monsterHp:active.monsterHp});
    if(active.knightHp>0&&monster.heal>0){
      const missing=active.monsterMaxHp-active.monsterHp;
      const mitigation=1-knight.enemyHealingReduction/100;
      const healing=monster.healingCap==null
        ? Math.floor(missing*Math.max(0,monster.heal*mitigation)/100)
        : Math.floor(Math.min(missing*monster.heal/100,monster.healingCap)*mitigation);
      active.monsterHp=Math.min(active.monsterMaxHp,active.monsterHp+Math.max(0,healing));
    }
  }
  return {victory:active.monsterHp<=0,defeat:active.knightHp<=0};
}

module.exports={attackMultipliers,roundLimit,labyrinthMonster,createBattle,strike};
