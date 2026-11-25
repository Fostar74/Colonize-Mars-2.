const unit = (name, amount, reward=[["army",name,amount]]) => ["train",amount,name,reward];
const action = (kind,rewards,detail=null,target=1) => [kind,target,detail,rewards];
const resources = amount => [["allResources",null,amount]];
const forge = amount => [["forge","Universal",amount]];
const item = (slot,stars,count=1) => [["equipment",slot,stars,count]];
const boost = (name,count=1) => ["items",name,count];
const rows = [
  ["Стоманена прецизност","Steel Precision",unit("Railgunner",50)],
  ["Бойци от ново поколение","Next-Generation Soldiers",unit("Exo-Soldier",100)],
  ["Смъртоносна точност","Deadly Accuracy",unit("Pulse Sniper",200)],
  ["Остриетата на Земята","Blades of Earth",unit("Plasma Bladesman",300)],
  ["Очите на експедицията","Eyes of the Expedition",unit("Rover Scout",200)],
  ["Протокол „Разрушение“","Protocol: Demolition",unit("Demolition Bot",150)],
  ["Богатствата на Земята","Earth’s Riches",action("mine",[["resources","Iron",5000]])],
  ["Отвъд периметъра","Beyond the Perimeter",action("alienAttack",[["army","Rover Scout",100]],3)],
  ["Операция „Призрак“","Operation Ghost",action("spy",[boost("protection")])],
  ["Силата на единството","Strength in Unity",action("donate",resources(1000),null,10)],
  ["Лицето на командира","The Commander’s Face",action("avatar",forge(50))],
  ["Скоростта на бъдещето","Speed of the Future",unit("Hoverbike Rider",200)],
  ["Огнен хоризонт","Fiery Horizon",unit("Missile Carrier",200)],
  ["Непробиваемият легион","The Impenetrable Legion",unit("Nano Shieldman",1500)],
  ["Господари на машините","Masters of Machines",unit("Drone Operator",1750)],
  ["Стоманени титани","Titans of Steel",unit("Mech Walker",400)],
  ["Предизвикателство към неизвестното","Challenge the Unknown",action("alienAttack",[boost("attack")],9)],
  ["Битка за небето","Battle for the Sky",action("mothership",[boost("health")])],
  ["Под повърхността","Below the Surface",action("labyrinthStart",resources(25000))],
  ["Изкован в битките","Forged in Battle",action("equipment",forge(100),12,6)],
  ["Енергията на унищожението","Energy of Destruction",unit("Particle Blaster",300)],
  ["Фантомният ескадрон","Phantom Squadron",unit("Hover Drone Rider",450,[["army","Hover Drone Rider",450],["missions",null,10]])],
  ["Съкровищата на извънземните","Alien Treasures",action("alienAttack",item(null,3,3),12)],
  ["Гневът на орбитата","Orbital Fury",unit("Orbital Strike Beacon",150)],
  ["Пътят на командира","The Commander’s Path",action("path",[])],
  ["Възходът на Cyber Knight","Rise of the Cyber Knight",action("knight",resources(100000),null,20)],
  ["Стъпки в мрака","Steps in the Dark",action("labyrinthFloor",item("BOOTS",4),null,20)],
  ["Желязната хватка","Iron Grip",action("alienAttack",item("GLOVES",4),16)],
  ["Изкуството на войната","The Art of War",unit("AI General",50,item("WEAPON",4))],
  ["Отвъд човешките граници","Beyond Human Limits",unit("Gene Warrior",50,item("HELMET",4))],
  ["Щитът на човечеството","Humanity’s Shield",action("alienVictory",item("SHIELD",4),18)],
  ["Бронята на легендата","Armor of Legend",action("alienVictory",item("ARMOR",4),19)],
  ["Последната надежда на Земята","Earth’s Last Hope",action("population",forge(500),null,100000)],
  ["Живот след битката","Life After Battle",action("heal",[...resources(100000),...forge(100)],null,10000)],
];
const defender=[boost("attack",5),boost("health",5)];
const conqueror=[boost("protection")];
const catalog=rows.map(([bg,en,[kind,target,detail,rewards]],index)=>({id:index+1,title:{bg,en},kind,target,detail,rewards,...(kind==="path"?{choices:{defender,conqueror}}:{})}));
module.exports=catalog;
