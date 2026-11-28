const {combatEnabled, eligibleHumanTarget, validAttackArmy} = require("./orangeEmpire");
const tactics = require("./orangeEmpireTactics");
const {calculateCargoCapacity,calculateLoot} = require("./pvpLoot");
const {xpForKills,awardHuman} = require("./combatXp");
const {maxPlayerLevel} = require("../src/shared/playerTargeting");
const {defaultFormation} = require("../src/shared/formations");
const {armyPopulation} = require("../src/shared/unitProfiles");
const {armyTravelDuration} = require("../src/shared/unitEconomy");
const {equipmentCombatBonuses} = require("../src/shared/cyberKnightEquipment");
const stations = require("../src/shared/spaceStations");
const {fight, playerTypes} = require("../shared/combatEngine");
const {createHash} = require("node:crypto");

const day = 86400000;
const maxSupport = 3;
const travelPerTile = 5 * 60000;

function protectionUntil(db, game, userId, now) {
  const shield = db.prepare("SELECT MAX(expires_at) AS expires FROM alliance_market_buffs WHERE user_id=? AND kind='protection'").get(userId);
  return Math.max(game.beginnerProtectionUntil(userId, now), shield.expires || 0);
}

function stationForLeader(db, userId) {
  return db.prepare(`SELECT s.* FROM alliance_space_stations s JOIN alliances a ON a.id=s.alliance_id
    JOIN alliance_members m ON m.alliance_id=a.id AND m.user_id=a.leader_id WHERE a.leader_id=?`).get(userId);
}

function schedule(db, game, now) {
  if (!combatEnabled()) return;
  db.transaction(() => {
    const date = new Date(now);
    const weekStart = Math.floor(now / day) * day - ((date.getUTCDay() + 6) % 7) * day;
    const availableSlots = now >= weekStart + 3 * day ? 2 : 1;
    const eligible = db.prepare(`SELECT u.id,b.x,b.y,t.xp FROM users u JOIN base_positions b ON b.user_id=u.id
      JOIN player_talents t ON t.user_id=u.id WHERE t.xp>=? AND NOT EXISTS
        (SELECT 1 FROM orange_empire_attacks a WHERE a.player_id=u.id AND a.result IS NULL)
      ORDER BY u.id`).all((maxPlayerLevel - 1) * 1000);
    const commanders = db.prepare("SELECT id,x,y,state FROM orange_empire_commanders ORDER BY id").all();
    if (commanders.length !== 10) return;
    const plans = [];
    for (const player of eligible) {
      if (!eligibleHumanTarget({isHuman:true, xp:player.xp, protectedUntil:protectionUntil(db, game, player.id, now)}, now)) continue;
      const history = db.prepare(`SELECT COUNT(*) AS total, COALESCE(MAX(CASE WHEN week_start=? THEN slot END),0) AS used
        FROM orange_empire_attacks WHERE player_id=?`).get(weekStart, player.id);
      if (history.used >= availableSlots) continue;
      const membership = db.prepare("SELECT alliance_id FROM alliance_members WHERE user_id=?").get(player.id);
      const allianceBase = membership && db.prepare("SELECT station_id FROM alliance_space_stations WHERE alliance_id=?").get(membership.alliance_id);
      // Commander IDs follow the approved weakest-to-strongest seed order.
      const commander = commanders[Math.min(history.total, allianceBase ? 9 : 8)];
      const station = stationForLeader(db, player.id);
      const stationTarget = station && station.protection_until <= now &&
        ["building","built"].includes(station.spaceport_status) ? station : null;
      const target = stationTarget ? stations.find(s => s.id === stationTarget.station_id) : player;
      plans.push({player,commander,slot:history.used+1,stationTarget,target});
    }
    const quotas = new Map();
    for (const {commander} of plans) quotas.set(commander.id,(quotas.get(commander.id)||0)+1);
    for (const {player,commander,slot,stationTarget,target} of plans) {
      const state = JSON.parse(commander.state);
      const outstanding = quotas.get(commander.id);
      quotas.set(commander.id,outstanding-1);
      const army = tactics.balancedArmy(state.army,Math.max(1,Math.floor(armyPopulation(state.army)/outstanding)));
      if (!validAttackArmy(army)) continue;
      const distance = Math.max(1, Math.abs(commander.x - target.x), Math.abs(commander.y - target.y));
      const plan = db.prepare("SELECT plan FROM orange_empire_practice WHERE commander_id=?").get(commander.id)?.plan || "balanced";
      const combat = {upgrades:state.upgrades, knight:state.knight, protocols:state.protocols, plan, formation:tactics.formation(army,plan)};
      db.prepare(`INSERT INTO orange_empire_attacks
        (commander_id,player_id,week_start,slot,station_id,station_alliance_id,origin_x,origin_y,x,y,launched_at,arrives_at,army,combat)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(commander.id,player.id,weekStart,slot,
        stationTarget?.station_id ?? null,stationTarget?.alliance_id ?? null,commander.x,commander.y,target.x,target.y,now,
        now + distance * travelPerTile,JSON.stringify(army),JSON.stringify(combat));
      for (const [unit, count] of Object.entries(army)) state.army[unit] -= count;
      commander.state = JSON.stringify(state);
      db.prepare("UPDATE orange_empire_commanders SET state=? WHERE id=?").run(commander.state, commander.id);
    }
  }).immediate();
}

function sameAlliance(db, first, second) {
  return !!db.prepare(`SELECT 1 FROM alliance_members a JOIN alliance_members b ON a.alliance_id=b.alliance_id
    WHERE a.user_id=? AND b.user_id=?`).get(first, second);
}

function sendSupport(db, game, userId, attackId, units, now) {
  if (!combatEnabled()) return {error:"Orange Empire combat is disabled."};
  return db.transaction(() => {
    const attack = db.prepare("SELECT * FROM orange_empire_attacks WHERE id=? AND result IS NULL AND station_id IS NULL AND arrives_at>?").get(attackId, now);
    if (!attack || attack.player_id === userId || !sameAlliance(db, userId, attack.player_id)) {
      return {error:"Choose an incoming attack against an ally."};
    }
    const existing = db.prepare("SELECT sender_id FROM orange_empire_support WHERE attack_id=?").all(attackId);
    if (existing.length >= maxSupport || existing.some(row => row.sender_id === userId)) return {error:"No reinforcement slot available."};
    const current = game.syncGame(userId, now);
    if (!current || !validAttackArmy(units) || Object.entries(units).some(([unit,count])=>count > (current.army[unit] || 0))) {
      return {error:"Choose available troops within the march population limit."};
    }
    const travel = armyTravelDuration(60000, units, game.protocolBonus(userId,"Rapid Deployment"));
    if (now + travel > attack.arrives_at) return {error:"Reinforcements would arrive too late."};
    for (const [unit,count] of Object.entries(units)) current.army[unit] -= count;
    writeArmy(db,userId,current.army);
    const {lastInsertRowid} = db.prepare(`INSERT INTO orange_empire_support(attack_id,sender_id,army,arrives_at,travel_ms)
      VALUES (?,?,?,?,?)`).run(attackId,userId,JSON.stringify(units),now+travel,travel);
    return {missionId:Number(lastInsertRowid), arrivesAt:now+travel};
  }).immediate();
}

function writeArmy(db,id,army) {
  db.prepare("UPDATE game_runtime SET army=? WHERE user_id=?").run(JSON.stringify(army),id);
}

function formation(army, rows) {
  return Object.entries(army).filter(([,count])=>count>0).map(([unit,count])=>({unit,count,row:rows[unit] || 1,column:rows.columns?.[unit]}));
}

function humanDefense(game, id, army, now, npcGear) {
  const current = game.syncGame(id, now);
  const equipped = game.getUserEquipment(id)?.equippedItems || {};
  const gear = equipmentCombatBonuses(equipped);
  const alliance = current.allianceBonuses || {};
  const protocols = game.protocolCombatBonuses(id,gear,npcGear);
  const presets = game.getFormations(id);
  const rows = {...defaultFormation(true),...presets.defensePresets[presets.defenseSlot]};
  return {army, formation:formation(army,rows), gear, equipped, bonuses:{
    ...protocols, protocolTrace:protocols, unitUpgrades:current.unitUpgrades, unitResearch:alliance.units,
    allAttack:Number(alliance.attack)||0, allHealth:protocols.allHealth+(Number(alliance.health)||0),
    unitEffects:gear.unitEffects, enemyDebuffs:gear.enemyDebuffs
  }};
}

function settleAttack(db, game, attack, now) {
  const attackerArmy = JSON.parse(attack.army);
  const support = db.prepare("SELECT * FROM orange_empire_support WHERE attack_id=? ORDER BY id").all(attack.id);
  const targetXp = db.prepare("SELECT xp FROM player_talents WHERE user_id=?").get(attack.player_id)?.xp;
  const station = attack.station_id && stationForLeader(db, attack.player_id);
  const empireGate = attack.commander_id !== 10 || db.prepare(`SELECT 1 FROM alliance_space_stations s
    JOIN alliance_members m ON m.alliance_id=s.alliance_id WHERE m.user_id=?`).get(attack.player_id);
  const stationGate = !attack.station_id || (station?.station_id === attack.station_id &&
    station.alliance_id === attack.station_alliance_id && station.protection_until <= now &&
    ["building","built"].includes(station.spaceport_status));
  let result = {cancelled:true};
  if (combatEnabled() && empireGate && stationGate && eligibleHumanTarget({
    isHuman:true,xp:targetXp,protectedUntil:protectionUntil(db,game,attack.player_id,now)
  },now)) {
    const stationTroops = attack.station_id ? db.prepare(`SELECT d.* FROM alliance_station_defenders d
      JOIN alliance_members m ON m.user_id=d.user_id AND m.alliance_id=d.alliance_id
      WHERE d.station_id=? AND d.alliance_id=? AND d.arrives_at<=? AND EXISTS(SELECT 1 FROM json_each(d.army) WHERE value>0) ORDER BY d.arrives_at,d.user_id`).all(attack.station_id,station.alliance_id,now) : [];
    const owner = stationTroops.find(row=>row.user_id===attack.player_id);
    const current = game.syncGame(attack.player_id,now);
    const homeArmy = attack.station_id ? JSON.parse(owner?.army || "{}") : current.army;
    const deployed = Object.fromEntries(Object.entries(homeArmy).filter(([unit,count])=>Object.hasOwn(playerTypes,unit)&&count>0));
    const snapshot = JSON.parse(attack.combat);
    const npcGear = equipmentCombatBonuses(snapshot.knight?.equippedItems||{});
    const defender = humanDefense(game,attack.player_id,deployed,now,npcGear);
    const eligibleSupport = attack.station_id ? stationTroops.filter(row=>row!==owner).slice(0,maxSupport) :
      support.filter(row=>row.arrives_at<=now && sameAlliance(db,row.sender_id,attack.player_id));
    const contingents = eligibleSupport.map(row=>({
      id:row.id ?? row.user_id,
      ...humanDefense(game,row.sender_id ?? row.user_id,JSON.parse(row.army),now,npcGear)
    }));
    const catalog = game.talentCatalog();
    const value = name => Math.max(0,(catalog.find(item=>item.name===name)?.values[(snapshot.protocols?.[name]||0)-1]||0)
      +(Number(npcGear.protocolBoosts?.[name]?.value)||0)-(Number(defender.gear.enemyProtocolDebuffs?.[name]?.value)||0));
    const seed = createHash("sha256").update("orange-empire:"+attack.id).digest().readUInt32LE(0);
    let rng = seed;
    result = fight(attackerArmy,deployed,snapshot.formation||formation(attackerArmy,defaultFormation()),{
      unitUpgrades:snapshot.upgrades, unitEffects:npcGear.unitEffects, enemyDebuffs:npcGear.enemyDebuffs,
      desertion:value("Battle Command"), allHealth:value("Reinforced Armor"), rangedAttack:value("Precision Fire"),
      infantryAttack:value("Infantry Command"), infantryHealth:value("Infantry Command"), mobileAttack:value("Mobile Warfare"),
      artilleryAttack:value("Heavy Artillery"), dodge:value("Evasion Protocol"), revive:value("Combat Recovery")
    },{
      playerDefense:true, trackCasualties:true, trace:true,
      defenseGridLevel:attack.station_id?0:current.structures["Defense Grid"], hospitalSides:[1], defenderFormation:defender.formation, defenderBonuses:defender.bonuses,
      defenderContingents:contingents, random:()=>{rng=(Math.imul(rng,1664525)+1013904223)>>>0;return rng/4294967296;}
    });
    const wounds = (id, initial, survivors) => game.recordHospitalWounds(id,"orange-empire-defense",attack.id,
      Object.fromEntries(Object.entries(initial).map(([unit,count])=>[unit,Math.floor((count-(survivors[unit]||0))*0.3)])),
      "waiting",null,now);
    result.combatXp = Object.fromEntries(Object.entries(result.creditedKills)
      .map(([owner,kills])=>[owner,xpForKills(kills)]));
    result.combatXp.defender=awardHuman(db,attack.player_id,result.combatXp.defender);
    const commander = db.prepare("SELECT state FROM orange_empire_commanders WHERE id=?").get(attack.commander_id);
    const state = JSON.parse(commander.state);
    const beforeXp=state.xp;
    state.xp = Math.min(Number.MAX_SAFE_INTEGER,state.xp+(result.combatXp.attacker||0));
    result.combatXp.attacker=state.xp-beforeXp;
    db.prepare("UPDATE orange_empire_commanders SET state=? WHERE id=?").run(JSON.stringify(state),attack.commander_id);
    tactics.recordBattle(db,snapshot.plan||"balanced",result,attackerArmy);
    wounds(attack.player_id,deployed,result.defenderSurvivors);
    if (!attack.station_id) {
      writeArmy(db,attack.player_id,{...homeArmy,...result.defenderSurvivors});
      if (result.victory) {
        result.cargoCapacity = calculateCargoCapacity(result.activeSurvivors);
        result.loot = calculateLoot(current.resources,result.cargoCapacity);
        result.totalLoot = Object.values(result.loot).reduce((sum,amount)=>sum+amount,0);
        if (result.totalLoot) {
          for (const [resource,amount] of Object.entries(result.loot)) {
            current.resources[resource]=(Number(current.resources[resource])||0)-amount;
          }
          db.prepare("UPDATE game_progress SET resources=?,last_saved=CURRENT_TIMESTAMP WHERE user_id=?")
            .run(JSON.stringify(current.resources),attack.player_id);
        }
      }
    }
    const setStationArmy = db.prepare("UPDATE alliance_station_defenders SET army=? WHERE station_id=? AND user_id=?");
    const settleStationArmy = (id, contingentId, survivors) => {
      const stationed = {...survivors};
      const home = JSON.parse(game.runtime(id).army);
      let returned = false;
      for (const round of result.report) for (const event of round.events) {
        if (!event.deserted || event.side !== "defender" || event.contingentId !== contingentId) continue;
        stationed[event.unit] -= event.deserted;
        home[event.unit] = (home[event.unit] || 0) + event.deserted;
        returned = true;
      }
      if (returned) writeArmy(db,id,home);
      setStationArmy.run(JSON.stringify(stationed),attack.station_id,id);
    };
    if (owner) settleStationArmy(owner.user_id,undefined,result.defenderSurvivors);
    for (const row of eligibleSupport) {
      const id = row.sender_id ?? row.user_id;
      const survivors = result.contingentSurvivors[row.id ?? row.user_id];
      const ownerKey="support:"+(row.id ?? row.user_id);
      result.combatXp[ownerKey]=awardHuman(db,id,result.combatXp[ownerKey]);
      wounds(id,JSON.parse(row.army),survivors);
      if (attack.station_id) settleStationArmy(id,row.id ?? row.user_id,survivors);
      else db.prepare("UPDATE orange_empire_support SET army=? WHERE id=?").run(JSON.stringify(survivors),row.id);
    }
    result.commanderKnightLevel = snapshot.knight?.level || 1;
    result.participants = {
      attacker:{kind:"orange",commanderId:attack.commander_id,level:maxPlayerLevel+5,protocolTiers:snapshot.protocols||{},
        coordinates:{x:attack.origin_x,y:attack.origin_y}},
      defender:game.battleParticipant(attack.player_id,{x:attack.x,y:attack.y}),
    };
    result.knights = {
      attacker:{kind:attack.commander_id===10?"emperor":"inferno",commanderId:attack.commander_id,level:result.commanderKnightLevel,equipped:snapshot.knight?.equippedItems||{}},
      defender:{kind:"cyber",level:game.knightLevelForReport(attack.player_id),equipped:defender.equipped}
    };
  }
  const travel = attack.arrives_at - attack.launched_at;
  db.prepare("UPDATE orange_empire_attacks SET result=?,returns_at=? WHERE id=?").run(JSON.stringify(result),now+travel,attack.id);
  db.prepare("UPDATE orange_empire_support SET returns_at=?+travel_ms WHERE attack_id=?").run(now,attack.id);
}

function settle(db, game, now) {
  for (const attack of db.prepare("SELECT * FROM orange_empire_attacks WHERE returned_at IS NULL AND returns_at<=? ORDER BY returns_at,id").all(now)) {
    const {state:raw} = db.prepare("SELECT state FROM orange_empire_commanders WHERE id=?").get(attack.commander_id);
    const state = JSON.parse(raw);
    const result = JSON.parse(attack.result);
    for (const [unit,count] of Object.entries(result.cancelled ? JSON.parse(attack.army) : result.survivors)) {
      state.army[unit] = (state.army[unit] || 0) + count;
    }
    if (result.victory && !attack.station_id) {
      for (const [resource,amount] of Object.entries(result.loot||{})) {
        if (amount>0) state.resources[resource]=(state.resources[resource]||0)+amount;
      }
    }
    db.prepare("UPDATE orange_empire_commanders SET state=? WHERE id=?").run(JSON.stringify(state),attack.commander_id);
    db.prepare("UPDATE orange_empire_attacks SET returned_at=returns_at WHERE id=?").run(attack.id);
  }
  for (const row of db.prepare("SELECT * FROM orange_empire_support WHERE returned_at IS NULL AND returns_at<=? ORDER BY returns_at,id").all(now)) {
    const current = game.syncGame(row.sender_id,row.returns_at);
    for (const [unit,count] of Object.entries(JSON.parse(row.army))) current.army[unit] = (current.army[unit] || 0) + count;
    writeArmy(db,row.sender_id,current.army);
    db.prepare("UPDATE orange_empire_support SET returned_at=returns_at WHERE id=?").run(row.id);
  }
  for (const attack of db.prepare("SELECT * FROM orange_empire_attacks WHERE result IS NULL AND arrives_at<=? ORDER BY arrives_at,id").all(now)) {
    settleAttack(db,game,attack,attack.arrives_at);
  }
}

function mapAttacks(db, userId) {
  if (!combatEnabled()) return [];
  return db.prepare(`SELECT a.id,a.commander_id,a.player_id,a.station_id,a.origin_x,a.origin_y,a.x,a.y,a.launched_at,a.arrives_at,u.username,
      (SELECT COUNT(*) FROM orange_empire_support s WHERE s.attack_id=a.id) AS support_count,
      EXISTS(SELECT 1 FROM orange_empire_support s WHERE s.attack_id=a.id AND s.sender_id=?) AS joined
    FROM orange_empire_attacks a JOIN users u ON u.id=a.player_id
    WHERE a.result IS NULL AND (a.player_id=? OR a.player_id IN (
      SELECT ally.user_id FROM alliance_members me JOIN alliance_members ally ON ally.alliance_id=me.alliance_id WHERE me.user_id=?))
    ORDER BY a.arrives_at,a.id`).all(userId,userId,userId);
}

function reports(db,userId,limit=20,includeReplay=false) {
  return db.prepare(`SELECT a.id,a.commander_id,a.player_id,a.station_id,a.arrives_at,
      a.x,a.y,json_extract(a.result,'$.cancelled') AS cancelled, json_extract(a.result,'$.victory') AS victory,
      json_extract(a.result,'$.loot') AS loot,json_extract(a.result,'$.totalLoot') AS totalLoot,
      json_extract(a.result,'$.cargoCapacity') AS cargoCapacity, json_extract(a.result,'$.report') AS report, json_extract(a.result,'$.knights') AS knights, json_extract(a.result,'$.traceVersion') AS traceVersion,
      json_extract(a.result,'$.participants') AS participants,json_extract(a.result,'$.combatXp') AS combatXp
    FROM orange_empire_attacks a WHERE a.result IS NOT NULL AND (a.player_id=? OR EXISTS
      (SELECT 1 FROM orange_empire_support s WHERE s.attack_id=a.id AND s.sender_id=?) OR
      (a.station_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM json_each(a.result,'$.contingentSurvivors') WHERE CAST(key AS INTEGER)=?
      )))
    ORDER BY a.arrives_at DESC,a.id DESC LIMIT ?`).all(userId,userId,userId,limit)
    .map(({cancelled,victory,loot,totalLoot,cargoCapacity,report,knights,traceVersion,participants,combatXp,...row})=>{
      const rounds=JSON.parse(report||"[]");
      return {...row,result:{
        cancelled:!!cancelled,victory:!!victory,...(loot?{loot:JSON.parse(loot),totalLoot,cargoCapacity}:{}),
        report:rounds.map(round=>({
          round:round.round,events:(round.events||[]).filter(event=>event.deserted>0)
        })).filter(round=>round.events.length),
        ...(includeReplay?{participants:participants?JSON.parse(participants):null,combatXp:combatXp?JSON.parse(combatXp):null,knights:knights?JSON.parse(knights):null,replay:traceVersion?{traceVersion,report:rounds}:null}:{})
      }};
    });
}

module.exports = {schedule, sendSupport, settle, mapAttacks, reports};
