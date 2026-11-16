const nanoShieldman = {
  name: "Nano Shieldman", category: "infantry",
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
const explorerTrooper={name:"Explorer Trooper",category:"infantry",attack:{infantry:80,ranged:80,mobile:10,artillery:10},health:70,range:1,speed:7,cargo:10,population:1,requirement:{building:"Training Center",level:1},price:{Gold:10,Iron:45,Water:35,Solar:50},trainingSeconds:300,attackUpgrades:[{values:[3.2,0.4,3.2,0,0.4],cost:[120,96,84,60],seconds:8918},{values:[7.2,0.9,7.2,0,0.9],cost:[480,384,336,240],seconds:14158},{values:[12,1.5,12,0,1.5],cost:[1680,1344,1176,840],seconds:17838},{values:[17.6,2.2,17.6,0,2.2],cost:[3780,3024,2646,1890],seconds:22478},{values:[24,3,24,0,3],cost:[6304,5043,4413,3152],seconds:28322},{values:[32,4,32,0,4],cost:[9840,7872,6888,4920],seconds:35684},{values:[41.6,5.2,41.6,0,5.2],cost:[18450,14760,12915,9225],seconds:44964},{values:[52.8,6.6,52.8,0,6.6],cost:[30760,24608,21532,15380],seconds:56652},{values:[65.6,8.2,65.6,0,8.2],cost:[48075,38460,33670,24050],seconds:71384},{values:[80,10,80,0,10],cost:[72090,57672,50484,36060],seconds:89942}],healthUpgrades:[{value:2.8,cost:[150,120,105,75],seconds:7008},{value:6.3,cost:[600,480,420,300],seconds:11124},{value:10.5,cost:[2100,1680,1473,1052],seconds:14016},{value:15.4,cost:[4728,3782,3310,2364],seconds:17662},{value:21,cost:[7872,6298,5510,3936],seconds:22254},{value:28,cost:[12300,9840,8610,6150],seconds:28038},{value:36.4,cost:[23070,18456,16149,11535],seconds:35328},{value:46.2,cost:[38460,30768,26936,19240],seconds:44514},{value:57.4,cost:[60075,48060,42070,30050],seconds:56086},{value:70,cost:[90120,72096,63084,45060],seconds:70668}],skills:["Defender","Warrior"]};
const exoSoldier={name:"Exo-Soldier",category:"infantry",attack:{infantry:40,ranged:40,mobile:40,artillery:40},health:80,range:1,speed:6,cargo:10,population:1,requirement:{building:"Training Center",level:6},price:{Gold:30,Iron:70,Water:30,Solar:20},trainingSeconds:330,attackUpgrades:[{values:[1.6,1.6,1.6,0,1.6],cost:[72,120,144,60],seconds:9556},{values:[3.6,3.6,3.6,0,3.6],cost:[288,480,576,240],seconds:15170},{values:[6,6,6,0,6],cost:[1008,1680,2016,840],seconds:19112},{values:[8.8,8.8,8.8,0,8.8],cost:[2268,3780,4536,1890],seconds:24082},{values:[12,12,12,0,12],cost:[3782,6304,7565,3152],seconds:30344},{values:[16,16,16,0,16],cost:[5904,9840,11808,4920],seconds:38234},{values:[20.8,20.8,20.8,0,20.8],cost:[11070,18450,22140,9225],seconds:48176},{values:[26.4,26.4,26.4,0,26.4],cost:[18456,30760,36912,15380],seconds:60700},{values:[32.8,32.8,32.8,0,32.8],cost:[28860,48075,57690,24050],seconds:76482},{values:[40,40,40,0,40],cost:[43272,72090,86508,36060],seconds:96368}],healthUpgrades:[{value:3.2,cost:[90,150,180,75],seconds:7508},{value:7.2,cost:[360,600,720,300],seconds:11920},{value:12,cost:[1262,2100,2520,1052],seconds:15016},{value:17.6,cost:[2837,4728,5674,2364],seconds:18922},{value:24,cost:[4723,7872,9446,3936],seconds:23842},{value:32,cost:[7380,12300,14760,6150],seconds:30040},{value:41.6,cost:[13842,23070,27684,11535],seconds:37852},{value:52.8,cost:[23088,38460,46152,19240],seconds:47694},{value:65.6,cost:[36060,60075,72090,30050],seconds:60092},{value:80,cost:[54072,90120,108144,45060],seconds:75718}],skills:["Defender","Warrior"]};
const plasmaBladesman={name:"Plasma Bladesman",category:"infantry",attack:{infantry:20,mobile:60,ranged:40,artillery:80},health:60,range:1,speed:6,cargo:10,population:1,requirement:{building:"Training Center",level:11},price:{Gold:60,Iron:20,Water:30,Solar:50},trainingSeconds:360,attackUpgrades:[
{values:[0.6,1.8,1.2,0,2.4],cost:[55,132,110,66],seconds:9682},{values:[1.4,4.2,2.8,0,5.6],cost:[220,528,440,264],seconds:15370},
{values:[2.4,7.2,4.8,0,9.6],cost:[772,1848,1540,926],seconds:19368},{values:[3.6,10.8,7.2,0,14.4],cost:[1734,4162,3468,2081],seconds:24404},
{values:[5,15,10,0,20],cost:[2888,6931,5776,3466],seconds:30748},{values:[6.8,20.4,13.6,0,27.2],cost:[4510,10824,9020,5412],seconds:38744},
{values:[9,27,18,0,36],cost:[8460,20304,16920,10152],seconds:48818},{values:[11.6,34.8,23.2,0,46.4],cost:[14100,33840,28200,16920],seconds:61510},
{values:[14.6,43.8,29.2,0,58.4],cost:[22025,52860,44050,26430],seconds:77502},{values:[20,60,40,0,80],cost:[33060,79308,66090,39672],seconds:97654}
],healthUpgrades:[
{value:1.8,cost:[69,166,138,83],seconds:7608},{value:4.2,cost:[276,660,550,331],seconds:12078},
{value:7.2,cost:[964,2309,1924,1157],seconds:15218},{value:10.8,cost:[2166,5198,4332,2599],seconds:19174},
{value:15,cost:[3608,8659,7216,4330],seconds:24160},{value:20.4,cost:[5640,13536,11280,6768],seconds:30442},
{value:27,cost:[10575,25380,21150,12690],seconds:38356},{value:34.8,cost:[17620,42288,35240,21144],seconds:48330},
{value:43.8,cost:[27550,66090,55075,33060],seconds:60896},{value:60,cost:[41310,99144,82620,49572],seconds:76728}
],skills:["Defender","Warrior"]};
const railgunner = {
 name:"Railgunner",category:"ranged",attack:{infantry:90,mobile:10,ranged:10,artillery:50},wallAttack:10,health:50,range:3,speed:7,cargo:5,population:1,
 requirement:{building:"Drone Factory",level:1},price:{Gold:35,Iron:55,Water:45,Solar:25},trainingSeconds:480,
 attackUpgrades:[{"values":[2.7,0.3,0.3,0.3,1.5],"cost":[100,120,200,240],"seconds":12740},{"values":[5.4,0.6,0.6,0.6,3],"cost":[400,480,800,960],"seconds":20228},{"values":[9,1,1,1,5],"cost":[1408,1690,2800,3360],"seconds":25484},{"values":[12.6,1.4,1.4,1.4,7],"cost":[3168,3802,6312,7574],"seconds":32108},{"values":[17.1,1.9,1.9,1.9,9.5],"cost":[5248,6298,10496,12595],"seconds":40458},{"values":[21.6,2.4,2.4,2.4,12],"cost":[8200,9840,16400,19680],"seconds":50978},{"values":[27,3,3,3,15],"cost":[15420,18504,30780,36936],"seconds":64232},{"values":[32.4,3.6,3.6,3.6,18],"cost":[25680,30816,51280,61536],"seconds":80932},{"values":[38.7,4.3,4.3,4.3,21.5],"cost":[40100,48120,80100,96120],"seconds":101974},{"values":[45,5,5,5,25],"cost":[60120,72144,120120,144144],"seconds":128492},{"values":[54,6,6,6,30],"cost":[160000,160000,160000,160000],"seconds":179888}],healthUpgrades:[{"value":2,"cost":[128,154,252,302],"seconds":10010},{"value":4.5,"cost":[504,605,1000,1200],"seconds":15892},{"value":7.5,"cost":[1760,2112,3504,4205],"seconds":20024},{"value":11,"cost":[3936,4723,7872,9446],"seconds":25228},{"value":15,"cost":[6560,7872,13120,15744],"seconds":31788},{"value":20,"cost":[10280,12336,20520,24624],"seconds":40054},{"value":26,"cost":[19260,23112,38460,46152],"seconds":50468},{"value":33,"cost":[32080,38496,64080,76896],"seconds":63590},{"value":41,"cost":[50100,60120,100100,120120],"seconds":80124},{"value":50,"cost":[75120,90144,150240,180288],"seconds":100956},{"value":60,"cost":[160000,160000,160000,160000],"seconds":141338}],skills:["Defender","Archer"]
};
const droneOperator = {
 name:"Drone Operator",category:"ranged",attack:{infantry:10,mobile:70,ranged:10,artillery:50},wallAttack:10,health:40,range:5,speed:6,cargo:5,population:1,
 requirement:{building:"Drone Factory",level:16},price:{Gold:60,Iron:40,Water:70,Solar:30},trainingSeconds:600,
 attackUpgrades:[{"values":[0.3,2.1,0.3,0.3,1.5],"cost":[260,130,312,156],"seconds":17836},{"values":[0.6,4.2,0.6,0.6,3],"cost":[1040,520,1248,624],"seconds":28316},{"values":[1,7,1,1,5],"cost":[3640,1824,4368,2189],"seconds":35676},{"values":[1.4,9.8,1.4,1.4,7],"cost":[8196,4104,9835,4925],"seconds":44954},{"values":[1.9,13.3,1.9,1.9,9.5],"cost":[13648,6832,16378,8198],"seconds":56642},{"values":[2.4,16.8,2.4,2.4,12],"cost":[21320,10660,25584,12792],"seconds":71370},{"values":[3,21,3,3,15],"cost":[39990,20010,47988,24012],"seconds":89926},{"values":[3.6,25.2,3.6,3.6,18],"cost":[66640,33320,79968,39984],"seconds":113306},{"values":[4.3,30.1,4.3,4.3,21.5],"cost":[104150,52100,124980,62520],"seconds":142768},{"values":[5,35,5,5,25],"cost":[156240,78120,187488,93744],"seconds":179886},{"values":[6,42,6,6,30],"cost":[200000,200000,200000,200000],"seconds":251840}],healthUpgrades:[{"value":1.6,"cost":[326,164,391,197],"seconds":14014},{"value":3.6,"cost":[1300,652,1560,782],"seconds":22248},{"value":6,"cost":[4552,2280,5462,2736],"seconds":28032},{"value":8.8,"cost":[10236,5124,12283,6149],"seconds":35322},{"value":12,"cost":[17056,8528,20467,10234],"seconds":44506},{"value":16,"cost":[26660,13340,31992,16008],"seconds":56078},{"value":20.8,"cost":[49980,24990,59976,29988],"seconds":70656},{"value":26.4,"cost":[83320,41680,99984,50016],"seconds":89028},{"value":32.8,"cost":[130200,65100,156240,78120],"seconds":112174},{"value":40,"cost":[195240,97620,234288,117144],"seconds":141338},{"value":48,"cost":[200000,200000,200000,200000],"seconds":197872}],skills:["Defender","Archer"]
};
const pulseSniper = {
 name:"Pulse Sniper",category:"ranged",attack:{infantry:50,mobile:10,ranged:80,artillery:10},wallAttack:10,health:45,range:4,speed:7,cargo:5,population:1,
 requirement:{building:"Drone Factory",level:8},price:{Gold:50,Iron:40,Water:30,Solar:60},trainingSeconds:540,
 attackUpgrades:[{"values":[1.5,0.3,2.4,0.3,0.3],"cost":[302,252,126,151],"seconds":16308},{"values":[3,0.6,4.8,0.6,0.6],"cost":[1210,1008,504,605],"seconds":25888},{"values":[5,1,8,1,1],"cost":[4234,3528,1764,2117],"seconds":32618},{"values":[7,1.4,11.2,1.4,1.4],"cost":[9526,7938,3974,4769],"seconds":41102},{"values":[9.5,1.9,15.2,1.9,1.9],"cost":[15880,13234,6624,7949],"seconds":51790},{"values":[12,2.4,19.2,2.4,2.4],"cost":[24797,20664,10332,12398],"seconds":65250},{"values":[15,3,24,3,3],"cost":[46526,38772,19386,23263],"seconds":82220},{"values":[18,3.6,28.8,3.6,3.6],"cost":[77501,64584,32292,38750],"seconds":103594},{"values":[21.5,4.3,34.4,4.3,4.3],"cost":[121122,100935,50490,60588],"seconds":130530},{"values":[25,5,40,5,5],"cost":[201888,168240,84120,100944],"seconds":164470},{"values":[30,6,48,6,6],"cost":[200000,200000,200000,200000],"seconds":230258}],healthUpgrades:[{"value":1.8,"cost":[378,315,158,190],"seconds":12812},{"value":4.05,"cost":[1512,1260,630,756],"seconds":20340},{"value":6.75,"cost":[5296,4414,2210,2652],"seconds":25630},{"value":9.9,"cost":[11910,9925,4968,5962],"seconds":32294},{"value":13.5,"cost":[19837,16531,8266,9919],"seconds":40692},{"value":18,"cost":[31018,25848,12924,15509],"seconds":51270},{"value":23.4,"cost":[58126,48438,24219,29063],"seconds":64600},{"value":29.7,"cost":[96898,80748,40392,48470],"seconds":81394},{"value":36.9,"cost":[151416,126180,63090,75708],"seconds":102558},{"value":45,"cost":[227124,189270,94662,113594],"seconds":129224},{"value":54,"cost":[200000,200000,200000,200000],"seconds":180914}],skills:["Defender","Archer"]
};
const rangedProfiles=[railgunner,pulseSniper,droneOperator];
const resources=["Gold","Iron","Water","Solar"];
function profileFor(unit){return unit==="Explorer Trooper"?explorerTrooper:unit==="Nano Shieldman"?nanoShieldman:unit==="Exo-Soldier"?exoSoldier:unit==="Plasma Bladesman"?plasmaBladesman:rangedProfiles.find(profile=>profile.name===unit)||null;}
function explorerUpgrade(unit,stat,currentLevel,discount=0,speed=0){
 const profile=profileFor(unit);if(!profile)return null;
 const rows=stat==="attack"?profile.attackUpgrades:profile.healthUpgrades,row=rows[currentLevel-1];if(!row)return null;
 return {cost:Object.fromEntries(resources.map((key,i)=>[key,Math.ceil(row.cost[i]*(100-discount)/100)])),durationMs:Math.ceil(row.seconds*1000*(100-speed)/100),maxLevel:Math.min(10,rows.length+1)};
}
function unitCombatStats(unit,levels={}){
 const profile=profileFor(unit)||explorerTrooper,attack={...profile.attack};let health=profile.health,wallAttack=Number(profile.wallAttack)||0;
 for(let i=0;i<Math.max(0,Math.min(profile.attackUpgrades.length,(Number(levels.attack)||1)-1));i++){
  const v=profile.attackUpgrades[i].values;attack.infantry+=v[0];attack.mobile+=v[1];attack.ranged+=v[2];wallAttack+=v[3]||0;attack.artillery+=v[4];
 }
 for(let i=0;i<Math.max(0,Math.min(profile.healthUpgrades.length,(Number(levels.defense)||1)-1));i++)health+=profile.healthUpgrades[i].value;
 return {...profile,attack,wallAttack,health};
}
function explorerCombatStats(levels={}){return unitCombatStats("Explorer Trooper",levels);}
module.exports={explorerTrooper,nanoShieldman,exoSoldier,plasmaBladesman,railgunner,pulseSniper,droneOperator,rangedProfiles,profileFor,explorerUpgrade,explorerCombatStats,unitCombatStats,resources};
