const explorerTrooper = {
  name: "Explorer Trooper", category: "infantry",
  attack: { infantry: 10, ranged: 10, mobile: 70, artillery: 70 }, health: 60, range: 2, population: 1,
  requirement: { building: "Training Center", level: 16 }, price: { Gold: 45, Iron: 30, Water: 60, Solar: 35 }, trainingSeconds: 390,
  attackUpgrades: [
    { values:[0.4,2.8,0.4,0,2.8], cost:[100,60,50,120], seconds:9172 },
    { values:[0.9,6.3,0.9,0,6.3], cost:[400,240,200,480], seconds:14562 },
    { values:[1.5,10.5,1.5,0,10.5], cost:[1400,840,700,1680], seconds:18348 },
    { values:[2.2,15.4,2.2,0,15.4], cost:[3150,1894,1578,3780], seconds:23120 },
    { values:[3,21,3,0,21], cost:[5248,3149,2624,6298], seconds:29130 },
    { values:[4,28,4,0,28], cost:[8200,4920,4100,9840], seconds:36704 },
    { values:[5.2,36.4,5.2,0,36.4], cost:[15375,9234,7695,18450], seconds:46248 },
    { values:[6.6,46.2,6.6,0,46.2], cost:[25640,15384,12820,30768], seconds:58272 },
    { values:[8.2,57.4,8.2,0,57.4], cost:[40050,24030,20025,48060], seconds:73422 },
    { values:[10,70,10,0,70], cost:[60090,36072,30060,72108], seconds:92512 }
  ],
  healthUpgrades: [
    {value:2.4,cost:[125,76,63,150],seconds:7208},{value:5.4,cost:[500,300,250,600],seconds:11442},
    {value:9,cost:[1752,1051,876,2102],seconds:14416},{value:13.2,cost:[3936,2362,1968,4723],seconds:18166},
    {value:18,cost:[6560,3936,3280,7872],seconds:22888},{value:24,cost:[10250,6156,5130,12300],seconds:28840},
    {value:31.2,cost:[19230,11538,9615,23076],seconds:36338},{value:39.6,cost:[32040,19224,16020,38448],seconds:45786},
    {value:49.2,cost:[50075,30060,25050,60090],seconds:57690},{value:60,cost:[75090,45072,37560,90108],seconds:101764}
  ],
  skills:["Defender","Warrior"]
};
const resources=["Gold","Iron","Water","Solar"];
function explorerUpgrade(unit,stat,currentLevel,discount=0,speed=0){
  if(unit!=="Explorer Trooper")return null;
  const rows=stat==="attack"?explorerTrooper.attackUpgrades:explorerTrooper.healthUpgrades;
  const row=rows[currentLevel-1];if(!row)return null;
  const cost=Object.fromEntries(resources.map((key,i)=>[key,Math.ceil(row.cost[i]*(100-discount)/100)]));
  return {cost,durationMs:Math.ceil(row.seconds*1000*(100-speed)/100),maxLevel:rows.length+1};
}
function explorerCombatStats(levels={}){
  const attack={...explorerTrooper.attack};let health=explorerTrooper.health;
  for(let i=0;i<Math.max(0,Math.min(10,(Number(levels.attack)||1)-1));i++)
    ["infantry","mobile","ranged","artillery","mobile"].forEach((key,index)=>{attack[key]=(attack[key]||0)+explorerTrooper.attackUpgrades[i].values[index];});
  for(let i=0;i<Math.max(0,Math.min(10,(Number(levels.defense)||1)-1));i++)health+=explorerTrooper.healthUpgrades[i].value;
  return {...explorerTrooper,attack,health};
}
module.exports={explorerTrooper,explorerUpgrade,explorerCombatStats,resources};
