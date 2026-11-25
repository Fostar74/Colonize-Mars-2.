const catalog = require("./sideQuestCatalog");
const {armyPopulation} = require("../src/shared/unitProfiles");
const {rarityBonusPercent,rollEquipmentBonuses} = require("../src/shared/cyberKnightEquipment");
const {randomInt,randomUUID} = require("crypto");

const slots=["HELMET","SHIELD","BOOTS","WEAPON","ARMOR","GLOVES"];
const resources=["Gold","Iron","Water","Solar"];

class SideQuests {
  constructor(db,game){
    this.db=db;
    this.game=game;
  }

  record(userId,kind,detail=null,amount=1,at=Date.now()){
    if(amount<=0)return;
    const {db}=this;
    if(kind==="train"&&detail===catalog[0].detail){
      db.prepare("INSERT OR IGNORE INTO player_side_quests(user_id) VALUES (?)").run(userId);
    }
    const row=db.prepare("SELECT * FROM player_side_quests WHERE user_id=?").get(userId);
    const quest=row&&catalog[row.mission-1];
    if(!quest||quest.kind!==kind||row.progress>=quest.target||row.unlocked_at>at||
      (kind!=="path"&&quest.detail!==detail))return;
    db.prepare("UPDATE player_side_quests SET progress=MIN(?,progress+?),path=COALESCE(path,?) WHERE user_id=? AND mission=?")
      .run(quest.target,amount,kind==="path"?detail:null,userId,row.mission);
  }

  progress(userId,quest,eventProgress){
    const {db,game}=this;
    switch(quest.kind){
      case "equipment": {
        const gear=game.getUserEquipment(userId)?.equippedItems||{};
        const equipped=Object.values(gear);
        return slots.filter(slot=>equipped.some(item=>item?.slot===slot&&Number(item.level)>=quest.detail)).length;
      }
      case "knight":
        return db.prepare("SELECT knight_level FROM alien_rewards WHERE user_id=?").get(userId)?.knight_level||1;
      case "labyrinthFloor":
        return Math.floor(((db.prepare("SELECT combat_room FROM labyrinth_players WHERE user_id=?").get(userId)?.combat_room||1)-1)/10);
      case "population":
        return armyPopulation(game.syncGame(userId)?.army||{});
      default:
        return eventProgress;
    }
  }

  state(userId){
    const row=this.db.prepare("SELECT * FROM player_side_quests WHERE user_id=?").get(userId)||
      {mission:1,progress:0,path:null};
    return {missions:catalog.map(quest=>{
      if(quest.id>row.mission)return {id:quest.id,status:"locked"};
      if(quest.id<row.mission)return {id:quest.id,title:quest.title,status:"claimed"};
      const progress=Math.min(quest.target,this.progress(userId,quest,row.progress));
      return {...quest,progress,path:row.path,status:progress>=quest.target?"complete":"active"};
    })};
  }

  claim(userId,missionId){
    const {db,game}=this;
    return db.transaction(()=>{
      const row=db.prepare("SELECT * FROM player_side_quests WHERE user_id=?").get(userId);
      const quest=row&&catalog[row.mission-1];
      if(!quest||quest.id!==missionId||this.progress(userId,quest,row.progress)<quest.target){
        return {error:"This side quest reward is unavailable."};
      }
      const rewards=quest.choices?.[row.path]||quest.rewards;
      for(const [kind,name,amount,count] of rewards)this.reward(userId,kind,name,amount,count);
      const now=Date.now();
      db.prepare("UPDATE player_side_quests SET mission=mission+1,progress=0,path=NULL,unlocked_at=? WHERE user_id=? AND mission=?")
        .run(now,userId,missionId);
      if(catalog[missionId]){
        db.prepare("INSERT INTO player_notifications(recipient_id,kind,created_at) VALUES (?,'side_quest_unlocked',?)").run(userId,now);
      }
      return this.state(userId);
    }).immediate();
  }

  reward(userId,kind,name,amount,count){
    const {db,game}=this;
    if(kind==="allResources"){
      for(const resource of resources)game.addInventoryReward(userId,"resources",resource,amount);
    }else if(kind==="items"){
      const inventory=game.getInventory(userId);
      inventory.items[name]=(inventory.items[name]||0)+amount;
      db.prepare("UPDATE inventory_reserves SET items=? WHERE user_id=?").run(JSON.stringify(inventory.items),userId);
    }else if(kind==="missions"){
      db.prepare("INSERT OR IGNORE INTO alien_rewards(user_id) VALUES (?)").run(userId);
      db.prepare("UPDATE alien_rewards SET bonus_missions=bonus_missions+? WHERE user_id=?").run(amount,userId);
    }else if(kind==="forge"||kind==="equipment"){
      const old=game.getUserEquipment(userId);
      const gear=[...(old?.gearInventory||[])], points={...old?.craftingPoints};
      if(kind==="forge")points[name]=(points[name]||0)+amount;
      else for(let i=0;i<count;i++){
        const slot=name||slots[randomInt(slots.length)],rarity="Common";
        gear.push({id:randomUUID(),name:"Plasma "+slot[0]+slot.slice(1).toLowerCase(),slot,rarity,
          stars:amount,level:1,bonusSlots:amount,rarityBonus:rarityBonusPercent[rarity],
          maximumBonus:50,obtainedFrom:"Side Quest",...rollEquipmentBonuses(slot,rarity,amount)});
      }
      game.saveUserEquipment(userId,old?.equippedItems||{},gear,points);
    }else{
      game.addInventoryReward(userId,kind,name,amount);
    }
  }
}

module.exports=SideQuests;
