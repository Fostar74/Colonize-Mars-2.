const assert=require("node:assert/strict");
const {test}=require("node:test");
const {mkdtempSync,rmSync}=require("node:fs");
const {tmpdir}=require("node:os");
const {join}=require("node:path");
const {randomUUID}=require("node:crypto");
const SQLite=require("better-sqlite3");
const {unitUpgradeMaxLevel}=require("../src/shared/unitProfiles");
const directory=mkdtempSync(join(tmpdir(),"cm108-catalog-"));
process.env.DATABASE_PATH=join(directory,"game.sqlite");
const Game=require("../database/database");
const catalog=require("../database/sideQuestCatalog");

const army=(unit,count)=>[["army",unit,count]];
const gear=(slot,stars,count=1)=>[["equipment",slot,stars,count]];
const all=count=>[["allResources",null,count]];
const forge=count=>[["forge","Universal",count]];
const boost=(item,count=1)=>["items",item,count];
// Issue #107's approved order and reward quantities, independent of the game catalog.
const expected=[
  ["Стоманена прецизност","train",50,"Railgunner",army("Railgunner",50)],
  ["Бойци от ново поколение","train",100,"Exo-Soldier",army("Exo-Soldier",100)],
  ["Смъртоносна точност","train",200,"Pulse Sniper",army("Pulse Sniper",200)],
  ["Остриетата на Земята","train",300,"Plasma Bladesman",army("Plasma Bladesman",300)],
  ["Очите на експедицията","train",200,"Rover Scout",army("Rover Scout",200)],
  ["Протокол „Разрушение“","train",150,"Demolition Bot",army("Demolition Bot",150)],
  ["Богатствата на Земята","mine",1,null,[["resources","Iron",5000]]],
  ["Отвъд периметъра","alienAttack",1,3,army("Rover Scout",100)],
  ["Операция „Призрак“","spy",1,null,[boost("protection")]],
  ["Силата на единството","donate",10,null,all(1000)],
  ["Лицето на командира","avatar",1,null,forge(50)],
  ["Скоростта на бъдещето","train",200,"Hoverbike Rider",army("Hoverbike Rider",200)],
  ["Огнен хоризонт","train",200,"Missile Carrier",army("Missile Carrier",200)],
  ["Непробиваемият легион","train",1500,"Nano Shieldman",army("Nano Shieldman",1500)],
  ["Господари на машините","train",1750,"Drone Operator",army("Drone Operator",1750)],
  ["Стоманени титани","train",400,"Mech Walker",army("Mech Walker",400)],
  ["Предизвикателство към неизвестното","alienAttack",1,9,[boost("attack")]],
  ["Битка за небето","mothership",1,null,[boost("health")]],
  ["Под повърхността","labyrinthStart",1,null,all(25000)],
  ["Изкован в битките","equipment",6,12,forge(100)],
  ["Енергията на унищожението","train",300,"Particle Blaster",army("Particle Blaster",300)],
  ["Фантомният ескадрон","train",450,"Hover Drone Rider",[...army("Hover Drone Rider",450),["missions",null,10]]],
  ["Съкровищата на извънземните","alienAttack",1,12,gear(null,3,3)],
  ["Гневът на орбитата","train",150,"Orbital Strike Beacon",army("Orbital Strike Beacon",150)],
  ["Пътят на командира","path",1,null,[]],
  ["Възходът на Cyber Knight","knight",20,null,all(100000)],
  ["Стъпки в мрака","labyrinthFloor",20,null,gear("BOOTS",4)],
  ["Желязната хватка","alienAttack",1,16,gear("GLOVES",4)],
  ["Изкуството на войната","train",50,"AI General",gear("WEAPON",4)],
  ["Отвъд човешките граници","train",50,"Gene Warrior",gear("HELMET",4)],
  ["Щитът на човечеството","alienVictory",1,18,gear("SHIELD",4)],
  ["Бронята на легендата","alienVictory",1,19,gear("ARMOR",4)],
  ["Последната надежда на Земята","population",100000,null,forge(500)],
  ["Живот след битката","heal",10000,null,[...all(100000),...forge(100)]],
];
const choices={defender:[boost("attack",5),boost("health",5)],conqueror:[boost("protection")]};

test("all 34 quests unlock and pay their exact rewards only once",()=>{
  assert.deepEqual(catalog.map(({title,kind,target,detail,rewards})=>[title.bg,kind,target,detail,rewards]),expected);
  assert.deepEqual(catalog[24].choices,choices);
  const game=new Game(),db=new SQLite(process.env.DATABASE_PATH);
  const clock=Date.now;
  let now=game.motherWeekStart(clock())+60000;
  Date.now=()=>now;
  try{
    const create=name=>game.createUser(name+"@example.test",name,"fixture");
    const user=create("Expedition"),ally=create("Ally"),rival=create("Rival");
    const id=user.userId,other=rival.userId,explorer="Explorer Trooper";
    assert.equal(game.createAlliance(id,"Earth Expedition").error,undefined);
    const alliance=game.allianceState(id).alliance.id;
    db.prepare("INSERT INTO alliance_members(user_id,alliance_id) VALUES (?,?)").run(ally.userId,alliance);
    game.runtime(id);
    game.runtime(other);
    const setArmy=army=>db.prepare("UPDATE game_runtime SET army=? WHERE user_id=?").run(JSON.stringify(army),id);
    const active=()=>game.sideQuests.state(id).missions.find(m=>m.status==="active"||m.status==="complete");
    const knightLevel=level=>db.prepare("INSERT INTO alien_rewards(user_id,knight_level,prestige) VALUES (?,?,?) ON CONFLICT(user_id) DO UPDATE SET knight_level=excluded.knight_level,prestige=excluded.prestige").run(id,level,(level-1)*20);
    const equipped=game.getUserEquipment(id);
    const slots=["ARMOR","BOOTS","GLOVES","HELMET","SHIELD","WEAPON"];
    const battle=(level,victory)=>{
      db.prepare("INSERT INTO alien_campaign(user_id,highest_defeated) VALUES (?,?) ON CONFLICT(user_id) DO UPDATE SET highest_defeated=excluded.highest_defeated").run(id,level-1);
      const force=victory?50000:1;
      setArmy({[explorer]:force});
      if(victory)db.prepare("UPDATE game_runtime SET unit_upgrades=? WHERE user_id=?").run(JSON.stringify({
        [explorer]:{attack:unitUpgradeMaxLevel(explorer,"attack"),defense:unitUpgradeMaxLevel(explorer,"defense")}
      }),id);
      const result=game.attackAlienBase(id,level,{[explorer]:force},[{unit:explorer,row:1,count:force}],true);
      assert.ok(result.missionId,result.error);
      assert.equal(JSON.parse(db.prepare("SELECT result FROM alien_missions WHERE id=?").get(result.missionId).result).victory,victory);
    };
    const snapshot=()=>({
      ...game.getInventory(id), equipment:game.getUserEquipment(id)||{gearInventory:[],craftingPoints:{}},
      missions:db.prepare("SELECT bonus_missions FROM alien_rewards WHERE user_id=?").get(id)?.bonus_missions||0
    });
    for(const [index,entry] of expected.entries()){
      const mission=index+1;
      const [title,kind,target,detail,rewards]=entry;
      const state=game.sideQuests.state(id).missions;
      assert.deepEqual(state.slice(mission),expected.slice(mission).map((_,i)=>({id:mission+i+1,status:"locked"})));
      assert.equal(active().id,mission);
      assert.equal(active().title.bg,title);
      assert.ok(active().title.en);
      if(!["knight","population"].includes(kind))assert.equal(active().progress,0,"Quest "+mission+" starts without event credit in this fixture");
      assert.match(game.sideQuests.claim(id,mission).error,/unavailable/);
      if(kind==="train"){
        db.prepare("UPDATE game_runtime SET barracks_reserve=? WHERE user_id=?").run(JSON.stringify({[detail]:target}),id);
        assert.equal(game.mobilizeBarracks(id,detail,target,randomUUID()).error,undefined);
      }else if(kind==="mine"){
        setArmy({[explorer]:20});
        const mine=db.prepare("SELECT id FROM resource_mines WHERE resource='gold' ORDER BY id LIMIT 1").get();
        db.prepare("UPDATE resource_mines SET amount=5 WHERE id=?").run(mine.id);
        db.prepare("INSERT INTO market_boost_windows(user_id,effect,percent,starts_at,expires_at) VALUES (?,'external',25,?,?)").run(id,now,now+28800000);
        const march=game.startGathering(id,mine.id,{[explorer]:1});
        assert.ok(march.arrivesAt,march.error);
        now=march.arrivesAt+14400;
        game.settleResourceMines();
        assert.equal(game.getResourceGatheringReports(id)[0].returnedAt,now);
      }else if(kind==="alienAttack"||kind==="alienVictory"){
        battle(detail,false);
        if(kind==="alienVictory"){
          assert.equal(active().progress,0);
          battle(detail,true);
        }
      }else if(kind==="spy"){
        db.prepare("UPDATE users SET created_at=datetime(?,'unixepoch') WHERE id=?").run(Math.floor(now/1000)-8*86400,other);
        setArmy({"Rover Scout":2});
        const mission=game.launchPlayerScout(id,{...rival.position,username:"Rival"},1);
        assert.ok(mission.arrivesAt,mission.error);
        assert.equal(active().progress,0);
        now=mission.arrivesAt;
        game.syncGame(id);
      }else if(kind==="donate"){
        for(let i=0;i<10;i++)assert.equal(game.donateAlliance(id,"Gold").error,undefined);
      }else if(kind==="avatar"){
        assert.equal(game.setPlayerAvatar(id,"pilot-m").avatarId,"pilot-m");
        assert.equal(active().progress,0);
        assert.equal(game.setPlayerAvatar(id,"engineer-f").avatarId,"engineer-f");
      }else if(kind==="mothership"){
        setArmy({[explorer]:10});
        assert.equal(game.getMothershipEvent(id).active,true);
        const attack=game.launchMothershipAttack(id,{[explorer]:10},null,true);
        assert.ok(attack.arrivesAt,attack.error);
        now=attack.arrivesAt;
        game.getMothershipEvent(id);
      }else if(kind==="labyrinthStart"){
        knightLevel(7);
        assert.ok(game.labyrinthBattle(id,"start").battle);
        game.labyrinthBattle(id,"retreat");
      }else if(kind==="equipment"){
        knightLevel(12);
        const old=game.getUserEquipment(id)||equipped;
        const setup=level=>Object.fromEntries(slots.map(slot=>[slot,{id:slot,slot,level,stars:1,rarity:"Common"}]));
        game.saveUserEquipment(id,setup(11),old?.gearInventory||[],old?.craftingPoints||{});
        assert.equal(active().progress,0);
        game.saveUserEquipment(id,setup(12),old?.gearInventory||[],old?.craftingPoints||{});
      }else if(kind==="path"){
        setArmy({[explorer]:10});
        assert.ok(game.sendAllianceReinforcement(id,ally.userId,{[explorer]:1}).missionId);
        assert.equal(active().path,"defender");
      }else if(kind==="knight"){
        knightLevel(19);
        assert.equal(active().progress,19);
        knightLevel(20);
      }else if(kind==="labyrinthFloor"){
        const room=room=>db.prepare("UPDATE labyrinth_players SET combat_room=? WHERE user_id=?").run(room,id);
        room(200);assert.equal(active().progress,19);room(201);
      }else if(kind==="population"){
        setArmy({[explorer]:99999});assert.equal(active().progress,99999);
        setArmy({[explorer]:100000});
      }else if(kind==="heal"){
        const wound=game.recordHospitalWounds(id,"player-defense",753,{"Rover Scout":10000});
        db.prepare("UPDATE hospital_entries SET status='healing',heals_at=? WHERE id=?").run(now,wound);
        assert.equal(game.getHospital(id).ready["Rover Scout"],10000);
        assert.equal(active().progress,0);
        assert.equal(game.mobilizeHealedTroops(id,"Rover Scout",10000,randomUUID()).error,undefined);
      }
      assert.equal(active().status,"complete","Quest "+mission);
      assert.equal(active().progress,target);
      const pre=snapshot();
      assert.equal(game.sideQuests.claim(id,mission).missions[index].status,"claimed");
      const post=snapshot();
      const expectedRewards=kind==="path"?choices.defender:rewards;
      const number=(obj,key)=>Number(obj?.[key]||0);
      for(const [bucket,name,amount,count] of expectedRewards){
        if(bucket==="allResources")for(const resource of ["Gold","Iron","Water","Solar"])
          assert.equal(number(post.resources,resource)-number(pre.resources,resource),amount);
        else if(bucket==="equipment"){
          const prior=new Set(pre.equipment.gearInventory.map(item=>item.id));
          const awarded=post.equipment.gearInventory.filter(item=>!prior.has(item.id));
          assert.equal(awarded.length,count);
          assert.ok(awarded.every(item=>item.stars===amount&&item.effects.length===amount&&(!name||item.slot===name)));
        }else if(bucket==="forge")assert.equal(number(post.equipment.craftingPoints,name)-number(pre.equipment.craftingPoints,name),amount);
        else if(bucket==="missions")assert.equal(post.missions-pre.missions,amount);
        else assert.equal(number(post[bucket],name)-number(pre[bucket],name),amount);
      }
      assert.match(game.sideQuests.claim(id,mission).error,/unavailable/);
      assert.deepEqual(snapshot(),post);
      now+=1000;
    }
    assert.equal(active(),undefined);
    assert.equal(game.sideQuests.state(id).missions.filter(q=>q.status==="claimed").length,34);
    assert.equal(db.prepare("SELECT COUNT(*) AS n FROM player_notifications WHERE recipient_id=? AND kind='side_quest_unlocked'").get(id).n,33);
    assert.equal(game.sideQuests.state(other).missions[0].progress,0);

    db.prepare("UPDATE player_side_quests SET mission=25,progress=0 WHERE user_id=?").run(id);
    db.prepare("INSERT INTO beginner_protection_forfeits(user_id,forfeited_at) VALUES (?,?)").run(other,now);
    game.playerTalents(other);
    db.prepare("UPDATE player_talents SET xp=(SELECT xp FROM player_talents WHERE user_id=?) WHERE user_id=?").run(id,other);
    setArmy({[explorer]:1});
    const pvp=game.launchPlayerAttack(id,{[explorer]:1},null,{...rival.position,username:"Rival"},false,true);
    assert.ok(pvp.missionId,pvp.error);
    assert.equal(active().path,"conqueror");
    const pre=snapshot();
    assert.equal(game.sideQuests.claim(id,25).missions[24].status,"claimed");
    const post=snapshot();
    assert.equal((post.items.protection||0)-(pre.items.protection||0),1);
    assert.equal(post.items.attack,pre.items.attack);
    assert.equal(post.items.health,pre.items.health);

    // Market packs and legacy items have different IDs and preserve the landing limits.
    db.prepare("UPDATE alliance_wallets SET points=100 WHERE user_id=?").run(id);
    const inv=game.getInventory(id);inv.items.landing=2;
    db.prepare("UPDATE inventory_reserves SET items=? WHERE user_id=?").run(JSON.stringify(inv.items),id);
    game.creditTokens(id,37);
    const oldBalance=game.getTokens(id).balance,oldWheel=game.getWheel(id,now);
    assert.match(game.buyAllianceMarket(id,"landing").error,/Unknown/);
    const purchase=game.buyAllianceMarket(id,"landing_pack");
    assert.equal(purchase.economy.points,0);
    assert.equal(purchase.inventory.items.landing,2);
    assert.equal(purchase.inventory.items.landing_pack,1);
    assert.equal(game.getTokens(id).balance,oldBalance);
    assert.equal(game.useInventoryItem(id,"landing",1).inventory.items.landing,1);
    assert.equal(game.getTokens(id).balance,oldBalance+1);
    assert.equal(game.useInventoryItem(id,"landing_pack",1).inventory.items.landing_pack,undefined);
    const newWheel=game.getWheel(id,now);
    assert.equal(newWheel.tokens,oldBalance+51);
    assert.equal(newWheel.spinCost,50);
    assert.equal(newWheel.remaining,oldWheel.remaining);
    assert.equal(newWheel.paidAvailable,oldWheel.paidAvailable);
    const recorded=db.prepare("INSERT INTO wheel_spins(user_id,spun_at,reward_id,free) VALUES (?,?,?,?)");
    for(let crater=0;crater<12;crater++)recorded.run(id,now,crater,crater===0?1:0);
    assert.equal(game.getWheel(id,now).remaining,0);
    assert.match(game.spinWheel(id,true).error,/12 craters/);
    const midnight=Math.floor(now/86400000)*86400000+86400000;
    assert.equal(game.getWheel(id,midnight).remaining,12);
    assert.equal(game.getWheel(id,midnight).paidAvailable,0);
    assert.equal(db.pragma("integrity_check",{simple:true}),"ok");
  }finally{
    Date.now=clock;
    db.close();game.close();
    rmSync(directory,{recursive:true,force:true});
  }
});
