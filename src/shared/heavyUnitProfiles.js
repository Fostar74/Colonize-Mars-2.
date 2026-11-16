const artilleryDamage={infantry:0.9,mobile:1.1,ranged:1.3,artillery:1.5};
function upgradesFor(attack,health){
 const attackUpgrades=[];
 const healthUpgrades=[];
 for(let level=1;level<=9;level++){
  const amount=Math.ceil(2*Math.pow(level+1,2)*100);
  const seconds=Math.ceil(60000*Math.pow(level+1,1.7))/1000;
  attackUpgrades.push({
   values:[attack.infantry*.1,attack.mobile*.1,attack.ranged*.1,0,attack.artillery*.1],
   cost:[amount,amount,0,0],
   seconds
  });
  healthUpgrades.push({value:health*.1,cost:[amount,amount,0,0],seconds});
 }
 return {attackUpgrades,healthUpgrades};
}

function createHeavyUnit(name,baseAttack,health,cargo,price,level){
 const attack=Object.fromEntries(Object.entries(artilleryDamage).map(([target,multiplier])=>[target,baseAttack*multiplier]));
 const {attackUpgrades,healthUpgrades}=upgradesFor(attack,health);
 return {
  name,
  category:"artillery",
  attack,
  wallAttack:0,
  health,
  range:5,
  speed:1,
  cargo,
  requirement:{building:"Drone Factory",level},
  price,
  trainingSeconds:30,
  attackUpgrades,
  healthUpgrades,
  skills:["Defender","Siege"]
 };
}

const demolitionBot=createHeavyUnit("Demolition Bot",55,120,20,{Gold:300,Iron:240,Water:180,Solar:120},2);
const missileCarrier=createHeavyUnit("Missile Carrier",75,170,50,{Gold:180,Iron:240,Water:360,Solar:120},4);
const particleBlaster=createHeavyUnit("Particle Blaster",95,220,10,{Gold:180,Iron:390,Water:150,Solar:120},6);
const orbitalStrikeBeacon=createHeavyUnit("Orbital Strike Beacon",115,270,10,{Gold:180,Iron:210,Water:150,Solar:360},8);

const heavyUnitProfiles=[demolitionBot,missileCarrier,particleBlaster,orbitalStrikeBeacon];
module.exports={demolitionBot,missileCarrier,particleBlaster,orbitalStrikeBeacon,heavyUnitProfiles};
