const {armyPopulation} = require("../src/shared/unitProfiles");
const {marchLimit} = require("../src/shared/formations");
const {playerTypes} = require("../shared/combatEngine");
const {xpForKills,awardHuman} = require("./combatXp");

function migrate(db) {
  db.exec(`CREATE TABLE IF NOT EXISTS player_battle_support (
    id INTEGER PRIMARY KEY, mission_id INTEGER NOT NULL REFERENCES player_missions(id) ON DELETE CASCADE,
    owner_id INTEGER NOT NULL REFERENCES users(id), army TEXT NOT NULL,
    launched_at INTEGER NOT NULL, arrives_at INTEGER NOT NULL, travel_ms INTEGER NOT NULL,
    returns_at INTEGER, returned_at INTEGER, UNIQUE(mission_id,owner_id)
  );
  CREATE INDEX IF NOT EXISTS player_battle_support_due ON player_battle_support(returns_at) WHERE returned_at IS NULL`);
}

function inbound(db,userId,now) {
  return db.prepare(`SELECT m.id,m.attacker_id,m.defender_id AS player_id,m.launched_at,m.arrives_at,
    a.username AS attacker,d.username, json_extract(m.army,'$.origin.x') AS origin_x,
    json_extract(m.army,'$.origin.y') AS origin_y,json_extract(m.army,'$.target.x') AS x,
    json_extract(m.army,'$.target.y') AS y,
    (SELECT COUNT(*) FROM player_battle_support r WHERE r.mission_id=m.id) AS support_count,
    EXISTS(SELECT 1 FROM player_battle_support r WHERE r.mission_id=m.id AND r.owner_id=@viewer) AS joined
    FROM player_missions m JOIN users a ON a.id=m.attacker_id JOIN users d ON d.id=m.defender_id
    WHERE m.resolved_at IS NULL AND m.arrives_at>@now AND (m.defender_id=@viewer OR EXISTS
      (SELECT 1 FROM alliance_members ally JOIN alliance_members me ON me.alliance_id=ally.alliance_id
       WHERE me.user_id=@viewer AND ally.user_id=m.defender_id))
    ORDER BY m.arrives_at,m.id`).all({viewer:userId,now});
}

function send(db,game,owner,missionId,army,now) {
  return db.transaction(()=>{
    const attack=inbound(db,owner,now).find(row=>row.id===missionId);
    if(!attack||attack.player_id===owner||attack.attacker_id===owner)return {error:"Choose an incoming attack against an ally."};
    if(attack.joined||attack.support_count>=3)return {error:"No reinforcement slot available."};
    const current=game.syncGame(owner,now);
    if(!current||!army||typeof army!=="object"||Array.isArray(army)||
      !Object.keys(army).length||Object.entries(army).some(([unit,count])=>
        !Object.hasOwn(playerTypes,unit)||!Number.isSafeInteger(count)||count<1||count>(current.army[unit]||0))||
      armyPopulation(army)>marchLimit)return {error:"Choose available troops within the march population limit."};
    const distance=Math.max(Math.abs(current.castle.x-attack.x),Math.abs(current.castle.y-attack.y));
    const travel=Math.min(3600000,Math.max(1,distance)*60000);
    if(now+travel>attack.arrives_at)return {error:"Reinforcements would arrive too late."};
    for(const [unit,count] of Object.entries(army)) current.army[unit]-=count;
    db.prepare("UPDATE game_runtime SET army=? WHERE user_id=?").run(JSON.stringify(current.army),owner);
    const insert=db.prepare(`INSERT INTO player_battle_support(mission_id,owner_id,army,launched_at,arrives_at,travel_ms)
      VALUES (?,?,?,?,?,?)`).run(missionId,owner,JSON.stringify(army),now,now+travel,travel);
    return {missionId:Number(insert.lastInsertRowid),arrivesAt:now+travel};
  }).immediate();
}

function contingents(db,game,mission,at,attackerGear) {
  return db.prepare(`SELECT r.* FROM player_battle_support r JOIN alliance_members a ON a.user_id=r.owner_id
    JOIN alliance_members d ON d.user_id=? AND d.alliance_id=a.alliance_id
    WHERE r.mission_id=? AND r.arrives_at<=? ORDER BY r.arrives_at,r.id LIMIT 3`).all(mission.defender_id,mission.id,at)
    .map(row=>{
      const owner=game.syncGame(row.owner_id,at);
      const gear=game.equipmentBonuses(row.owner_id);
      const protocols=game.protocolCombatBonuses(row.owner_id,gear,attackerGear);
      const alliance=owner.allianceBonuses||{};
      return {id:row.id,ownerId:row.owner_id,army:JSON.parse(row.army),bonuses:{
        ...protocols,protocolTrace:protocols,unitUpgrades:owner.unitUpgrades,unitResearch:alliance.units,
        allAttack:alliance.attack||0,allHealth:protocols.allHealth+(alliance.health||0),
        unitEffects:gear.unitEffects,enemyDebuffs:gear.enemyDebuffs,
      }};
    });
}

function finish(db,game,missionId,at,forces,result) {
  db.prepare("UPDATE player_battle_support SET returns_at=?+travel_ms WHERE mission_id=? AND returns_at IS NULL").run(at,missionId);
  for(const force of forces||[]){
    const survivors=result.contingentSurvivors[force.id], key="support:"+force.id;
    result.combatXp[key]=awardHuman(db,force.ownerId,xpForKills(result.creditedKills[key]));
    const wounds=Object.fromEntries(Object.entries(force.army).map(([unit,count])=>
      [unit,Math.floor((count-(survivors[unit]||0))*0.3)]).filter(([,count])=>count>0));
    if(Object.keys(wounds).length)game.recordHospitalWounds(force.ownerId,"player-support",force.id,wounds,"waiting",null,at);
    db.prepare("UPDATE player_battle_support SET army=? WHERE id=?").run(JSON.stringify(survivors),force.id);
  }
}

function returnDue(db,game,now){
  const rows=db.prepare("SELECT * FROM player_battle_support WHERE returned_at IS NULL AND returns_at<=? ORDER BY returns_at,id").all(now);
  for(const row of rows){
    const owner=game.syncGame(row.owner_id,row.returns_at);
    if(!owner)throw new Error("Support march has no owner progress");
    for(const [unit,count] of Object.entries(JSON.parse(row.army)))owner.army[unit]=(owner.army[unit]||0)+count;
    db.prepare("UPDATE game_runtime SET army=? WHERE user_id=?").run(JSON.stringify(owner.army),row.owner_id);
    db.prepare("UPDATE player_battle_support SET returned_at=? WHERE id=?").run(row.returns_at,row.id);
  }
}

module.exports={migrate,inbound,send,contingents,finish,returnDue};
