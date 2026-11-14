const explorerTrooper = {
  name: "Explorer Trooper", category: "infantry",
  attack: { infantry: 10, ranged: 10, mobile: 70, artillery: 70 }, health: 60, range: 2, speed: 5, cargo: 10, population: 1,
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
const exoSoldier={name:"Exo-Soldier",category:"infantry",attack:{infantry:40,ranged:40,mobile:40,artillery:40},health:80,range:1,speed:6,cargo:10,population:1,requirement:{building:"Training Center",level:6},price:{Gold:30,Iron:70,Water:30,Solar:20},trainingSeconds:330,attackUpgrades:[{values:[1.6,1.6,1.6,0,1.6],cost:[72,120,144,60],seconds:9556},{values:[3.6,3.6,3.6,0,3.6],cost:[288,480,576,240],seconds:15170},{values:[6,6,6,0,6],cost:[1008,1680,2016,840],seconds:19112},{values:[8.8,8.8,8.8,0,8.8],cost:[2268,3780,4536,1890],seconds:24082},{values:[12,12,12,0,12],cost:[3782,6304,7565,3152],seconds:30344},{values:[16,16,16,0,16],cost:[5904,9840,11808,4920],seconds:38234},{values:[20.8,20.8,20.8,0,20.8],cost:[11070,18450,22140,9225],seconds:48176},{values:[26.4,26.4,26.4,0,26.4],cost:[18456,30760,36912,15380],seconds:60700},{values:[32.8,32.8,32.8,0,32.8],cost:[28860,48075,57690,24050],seconds:76482},{values:[40,40,40,0,40],cost:[43272,72090,86508,36060],seconds:96368}],healthUpgrades:[{value:3.2,cost:[90,150,180,75],seconds:7508},{value:7.2,cost:[360,600,720,300],seconds:11920},{value:12,cost:[1262,2100,2520,1052],seconds:15016},{value:17.6,cost:[2837,4728,5674,2364],seconds:18922},{value:24,cost:[4723,7872,9446,3936],seconds:23842},{value:32,cost:[7380,12300,14760,6150],seconds:30040},{value:41.6,cost:[13842,23070,27684,11535],seconds:37852},{value:52.8,cost:[23088,38460,46152,19240],seconds:47694},{value:65.6,cost:[36060,60075,72090,30050],seconds:60092},{value:80,cost:[54072,90120,108144,45060],seconds:75718}],skills:["Defender","Warrior"]};
const resources=["Gold","Iron","Water","Solar"];
function explorerUpgrade(unit,stat,currentLevel,discount=0,speed=0){
 const profile=unit==="Explorer Trooper"?explorerTrooper:unit==="Exo-Soldier"?exoSoldier:null;
 if(!profile)return null;
 const rows=stat==="attack"?profile.attackUpgrades:profile.healthUpgrades,row=rows[currentLevel-1];
 if(!row)return null;
 return {cost:Object.fromEntries(resources.map((key,i)=>[key,Math.ceil(row.cost[i]*(100-discount)/100)])),durationMs:Math.ceil(row.seconds*1000*(100-speed)/100),maxLevel:rows.length+1};
}
function unitCombatStats(unit,levels={}){
 const profile=unit==="Exo-Soldier"?exoSoldier:explorerTrooper,attack={...profile.attack};let health=profile.health;
 for(let i=0;i<Math.max(0,Math.min(10,(Number(levels.attack)||1)-1));i++){
  const v=profile.attackUpgrades[i].values;
  attack.infantry+=v[0];attack.mobile+=v[1];attack.ranged+=v[2];attack.artillery+=v[4];
 }
 for(let i=0;i<Math.max(0,Math.min(10,(Number(levels.defense)||1)-1));i++)health+=profile.healthUpgrades[i].value;
 return {...profile,attack,health};
}
function explorerCombatStats(levels={}){return unitCombatStats("Explorer Trooper",levels);}
module.exports={explorerTrooper,exoSoldier,explorerUpgrade,explorerCombatStats,unitCombatStats,resources};
