const {unitPrice,upgradePrice,unitRequirement,buildingPrice} = require("../src/shared/unitEconomy");
const tutorialMissions = require("../shared/tutorialMissions");
const Database = require("better-sqlite3");
const path = require("path");
const fs = require("fs");

const dbDir = path.join(__dirname);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const dbPath = process.env.DATABASE_PATH || path.join(dbDir, "colonize_mars.db");
fs.mkdirSync(path.dirname(dbPath), { recursive: true });
const db = new Database(dbPath);
db.pragma("busy_timeout = 5000");
db.pragma("foreign_keys = ON");
db.pragma("journal_mode = WAL");

function initializeDatabase() {
  try {
    console.log("Initializing database...");

    db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT UNIQUE NOT NULL,
        username TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log("Users table created/verified");

    db.exec(`
      CREATE TABLE IF NOT EXISTS game_stats (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        total_play_time INTEGER DEFAULT 0,
        total_resources_mined INTEGER DEFAULT 0,
        structures_built INTEGER DEFAULT 0,
        last_updated DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log("Game stats table created/verified");

    db.exec(`
      CREATE TABLE IF NOT EXISTS game_progress (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        castle_data TEXT NOT NULL,
        resources TEXT NOT NULL,
        structures TEXT NOT NULL,
        last_saved DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users (id)
      )
    `);
    console.log("Game progress table created/verified");

    db.exec(`
      CREATE TABLE IF NOT EXISTS user_equipment (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        equipped_items TEXT NOT NULL,
        gear_inventory TEXT NOT NULL,
        crafting_points TEXT NOT NULL,
        last_updated DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users (id)
      )
    `);
    console.log("User equipment table created/verified");

    db.exec(`
      CREATE TABLE IF NOT EXISTS base_positions (
        user_id INTEGER PRIMARY KEY REFERENCES users(id),
        x INTEGER NOT NULL CHECK(x BETWEEN 1 AND 200),
        y INTEGER NOT NULL CHECK(y BETWEEN 1 AND 200),
        UNIQUE(x, y)
      )
    `);
    db.exec(`
      CREATE TABLE IF NOT EXISTS game_runtime (
        user_id INTEGER PRIMARY KEY REFERENCES users(id),
        production_at INTEGER NOT NULL,
        building_job TEXT,
        training_job TEXT,
        army TEXT NOT NULL DEFAULT '{}',
        unit_upgrades TEXT NOT NULL DEFAULT '{}',
        quest_claimed INTEGER NOT NULL DEFAULT 0,
        quest2_claimed INTEGER NOT NULL DEFAULT 0
      )
    `);
    if (!db.prepare("PRAGMA table_info(game_runtime)").all().some(c => c.name === "quest2_claimed")) {
      db.exec("ALTER TABLE game_runtime ADD COLUMN quest2_claimed INTEGER NOT NULL DEFAULT 0");
    }
    if (!db.prepare("PRAGMA table_info(game_runtime)").all().some(c => c.name === "queued_building_job")) {
      db.exec("ALTER TABLE game_runtime ADD COLUMN queued_building_job TEXT");
    }
    db.exec("CREATE TABLE IF NOT EXISTS tutorial_claims (user_id INTEGER NOT NULL REFERENCES users(id), mission_id INTEGER NOT NULL, claimed_at DATETIME DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY(user_id, mission_id))");
    db.exec("CREATE TABLE IF NOT EXISTS alien_campaign (user_id INTEGER PRIMARY KEY REFERENCES users(id), highest_defeated INTEGER NOT NULL DEFAULT 0)");
    db.exec("CREATE TABLE IF NOT EXISTS daily_login_claims (user_id INTEGER NOT NULL REFERENCES users(id), day INTEGER NOT NULL CHECK(day BETWEEN 1 AND 30), claimed_date TEXT NOT NULL, claimed_at DATETIME DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY(user_id, day), UNIQUE(user_id, claimed_date))");
    db.exec("CREATE TABLE IF NOT EXISTS inventory_reserves (user_id INTEGER PRIMARY KEY REFERENCES users(id), resources TEXT NOT NULL, army TEXT NOT NULL)");
    db.exec("CREATE TABLE IF NOT EXISTS alien_missions (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL REFERENCES users(id), level INTEGER NOT NULL, army TEXT NOT NULL, launched_at INTEGER NOT NULL, arrives_at INTEGER NOT NULL, resolved_at INTEGER, result TEXT)");
    if(!db.prepare("PRAGMA table_info(alien_missions)").all().some(c=>c.name==="returns_at")) db.exec("ALTER TABLE alien_missions ADD COLUMN returns_at INTEGER");
    if(!db.prepare("PRAGMA table_info(alien_missions)").all().some(c=>c.name==="returned_at")) db.exec("ALTER TABLE alien_missions ADD COLUMN returned_at INTEGER");
    db.exec("CREATE TABLE IF NOT EXISTS alien_rewards (user_id INTEGER PRIMARY KEY REFERENCES users(id), victories INTEGER NOT NULL DEFAULT 0, knight_level INTEGER NOT NULL DEFAULT 1)");
    db.exec("CREATE TABLE IF NOT EXISTS alien_side_quests (user_id INTEGER NOT NULL REFERENCES users(id), milestone INTEGER NOT NULL, PRIMARY KEY(user_id,milestone))");
    db.exec("CREATE TABLE IF NOT EXISTS player_talents (user_id INTEGER PRIMARY KEY REFERENCES users(id), xp INTEGER NOT NULL DEFAULT 0, talents TEXT NOT NULL DEFAULT '{}')");
    db.exec("CREATE TABLE IF NOT EXISTS player_tokens (user_id INTEGER PRIMARY KEY REFERENCES users(id), balance INTEGER NOT NULL DEFAULT 0, last_free_spin INTEGER NOT NULL DEFAULT 0)");
    db.exec("CREATE TABLE IF NOT EXISTS wheel_spins (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL REFERENCES users(id), spun_at INTEGER NOT NULL, reward_id INTEGER NOT NULL, free INTEGER NOT NULL)");
    db.exec("CREATE TABLE IF NOT EXISTS alliances (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL UNIQUE, leader_id INTEGER NOT NULL REFERENCES users(id))");
    db.exec("CREATE TABLE IF NOT EXISTS alliance_members (user_id INTEGER PRIMARY KEY REFERENCES users(id), alliance_id INTEGER NOT NULL REFERENCES alliances(id))");
    db.exec("CREATE TABLE IF NOT EXISTS alliance_help (id INTEGER PRIMARY KEY AUTOINCREMENT, requester_id INTEGER NOT NULL REFERENCES users(id), alliance_id INTEGER NOT NULL REFERENCES alliances(id), building_name TEXT NOT NULL, building_level INTEGER NOT NULL, requested_at INTEGER NOT NULL, job_ends_at INTEGER NOT NULL)");
    db.exec("CREATE TABLE IF NOT EXISTS alliance_help_clicks (request_id INTEGER NOT NULL REFERENCES alliance_help(id), helper_id INTEGER NOT NULL REFERENCES users(id), PRIMARY KEY(request_id,helper_id))");
    console.log("Database initialized successfully");
  } catch (error) {
    console.error("Error initializing database:", error);
    throw error;
  }
}

class DatabaseManager {
  constructor() {
    initializeDatabase();
    this.initializeQueries();
  }

  initializeQueries() {
    this.userQueries = {
      createUser: db.prepare(`
        INSERT INTO users (email, username, password) 
        VALUES (?, ?, ?)
      `),

      findByEmail: db.prepare(`
        SELECT * FROM users WHERE email = ?
      `),

      findByUsername: db.prepare(`
        SELECT * FROM users WHERE username = ?
      `),

      findById: db.prepare(`
        SELECT * FROM users WHERE id = ?
      `),
    };

    this.progressQueries = {
      saveProgress: db.prepare(`
        INSERT INTO game_progress 
        (user_id, castle_data, resources, structures) 
        VALUES (?, ?, ?, ?)
      `),

      getProgress: db.prepare(`
        SELECT * FROM game_progress WHERE user_id = ? ORDER BY last_saved DESC, id DESC LIMIT 1
      `),

      updateProgress: db.prepare(`
        UPDATE game_progress 
        SET castle_data = ?, resources = ?, structures = ?, last_saved = CURRENT_TIMESTAMP
        WHERE user_id = ?
      `),
    };

    this.statsQueries = {
      createStats: db.prepare(`
        INSERT INTO game_stats (user_id) VALUES (?)
      `),

      updateStats: db.prepare(`
        UPDATE game_stats 
        SET total_play_time = ?, total_resources_mined = ?, structures_built = ?, last_updated = CURRENT_TIMESTAMP
        WHERE user_id = ?
      `),

      getStats: db.prepare(`
        SELECT * FROM game_stats WHERE user_id = ?
      `),
    };

    this.equipmentQueries = {
      saveEquipment: db.prepare(`
        INSERT INTO user_equipment 
        (user_id, equipped_items, gear_inventory, crafting_points) 
        VALUES (?, ?, ?, ?)
      `),

      getEquipment: db.prepare(`
        SELECT * FROM user_equipment WHERE user_id = ? ORDER BY id DESC LIMIT 1
      `),

      updateEquipment: db.prepare(`
        UPDATE user_equipment 
        SET equipped_items = ?, gear_inventory = ?, crafting_points = ?, last_updated = CURRENT_TIMESTAMP
        WHERE user_id = ?
      `),
    };
  }

  chooseSpawn(occupied) {
    // Randomized peripheral spawn: bases start in the outer 15 tiles of
    // the 100x100 map, leaving the central region for exploration.
    // Shuffle all eligible coordinates so a fresh database never
    // deterministically assigns the same first position.
    const crypto = require("crypto");
    const candidates = [];
    for (let x = 1; x <= 100; x++) {
      for (let y = 1; y <= 100; y++) {
        if (x > 15 && x < 86 && y > 15 && y < 86) continue;
        if (!occupied.has(x + ":" + y)) candidates.push({ x, y });
      }
    }
    if (!candidates.length) throw new Error("No available peripheral spawn position");
    return candidates[crypto.randomInt(candidates.length)];
  }

  // Allocates a unique base tile within a transaction; existing saved bases are respected.
  ensureBase(userId, username) {
    return db.transaction(() => {
      const existing = db.prepare("SELECT x, y FROM base_positions WHERE user_id = ?").get(userId);
      if (existing && existing.x <= 100 && existing.y <= 100) return { username, ...existing };
      if (existing) {
        const occupied = new Set(db.prepare("SELECT x, y FROM base_positions WHERE user_id != ?").all(userId).map(p => p.x + ":" + p.y));
        const moved = this.chooseSpawn(occupied);
        db.prepare("UPDATE base_positions SET x = ?, y = ? WHERE user_id = ?").run(moved.x,moved.y,userId);
        return {username,...moved};
      }
      const progress = this.getGameProgress(userId);
      const old = progress && progress.castle;
      const occupied = new Set(db.prepare("SELECT x, y FROM base_positions").all().map(p => p.x + ":" + p.y));
      // Preserve coordinates already saved by legacy users, even before migration.
      for (const row of db.prepare("SELECT castle_data FROM game_progress ORDER BY id DESC").all()) {
        try {
          const castle = JSON.parse(row.castle_data);
          if (Number.isInteger(castle.x) && Number.isInteger(castle.y)) occupied.add(castle.x + ":" + castle.y);
        } catch (_) {}
      }
      const preferred = old && Number.isInteger(old.x) && Number.isInteger(old.y) ? old : null;
      let selected = null;
      if (preferred && preferred.x >= 1 && preferred.x <= 100 && preferred.y >= 1 && preferred.y <= 100 &&
          !db.prepare("SELECT 1 FROM base_positions WHERE x = ? AND y = ?").get(preferred.x, preferred.y)) {
        selected = { x: preferred.x, y: preferred.y };
      } else {
        selected = this.chooseSpawn(occupied);
      }
      if (!selected) throw new Error("Map is full");
      db.prepare("INSERT INTO base_positions(user_id, x, y) VALUES (?, ?, ?)").run(userId, selected.x, selected.y);
      const castle = { username, ...selected };
      if (!progress) this.progressQueries.saveProgress.run(userId, JSON.stringify(castle), JSON.stringify({ Gold: 10000, Iron: 10000, Water: 10000, Solar: 10000 }), JSON.stringify({}));
      return castle;
    })();
  }

  createUser(email, username, hashedPassword) {
    return db.transaction(() => {
      const result = this.userQueries.createUser.run(email, username, hashedPassword);
      const userId = Number(result.lastInsertRowid);
      this.statsQueries.createStats.run(userId);
      const occupied = new Set(db.prepare("SELECT x, y FROM base_positions").all().map(p => `${p.x}:${p.y}`));
      for (const row of db.prepare("SELECT castle_data FROM game_progress").all()) {
        try { const c = JSON.parse(row.castle_data); if (Number.isInteger(c.x) && Number.isInteger(c.y)) occupied.add(`${c.x}:${c.y}`); } catch (_) {}
      }
      const reserve = db.prepare("INSERT INTO base_positions (user_id, x, y) VALUES (?, ?, ?)");
      let position = null;
      position = this.chooseSpawn(occupied);
      reserve.run(userId, position.x, position.y);
      if (!position) throw new Error("Mars map is full");
      db.prepare(`INSERT INTO game_progress
        (user_id, castle_data, resources, structures) VALUES (?, ?, ?, ?)`)
        .run(userId, JSON.stringify({ username, ...position }),
          JSON.stringify({ Gold: 10000, Iron: 10000, Water: 10000, Solar: 10000 }), JSON.stringify({}));
      return { success: true, userId, position };
    })();
  }

  findUserByEmail(email) {
    return this.userQueries.findByEmail.get(email);
  }

  findUserByUsername(username) {
    return this.userQueries.findByUsername.get(username);
  }

  findUserById(id) {
    return this.userQueries.findById.get(id);
  }

  saveGameProgress(userId, castleData, resources, structures) {
    return db.transaction(() => {
      const existing = this.progressQueries.getProgress.get(userId);
      if (!existing) throw new Error("Progress not initialized");
      const originalCastle = JSON.parse(existing.castle_data);
      const safeCastle = { ...castleData, x: originalCastle.x, y: originalCastle.y };
      db.prepare(`
        UPDATE game_progress SET castle_data = ?, resources = ?, structures = ?,
          last_saved = CURRENT_TIMESTAMP WHERE id = ?
      `).run(JSON.stringify(safeCastle), JSON.stringify(resources),
        JSON.stringify(structures), existing.id);
      return { success: true };
    })();
  }

  // All economy changes are server-authoritative and performed in SQLite transactions.
  runtime(userId) {
    db.prepare("INSERT OR IGNORE INTO game_runtime(user_id, production_at) VALUES (?, ?)").run(userId, Date.now());
    return db.prepare("SELECT * FROM game_runtime WHERE user_id = ?").get(userId);
  }

  syncGame(userId) {
    return db.transaction(() => {
      const row = this.progressQueries.getProgress.get(userId);
      if (!row) return null;
      const state = this.runtime(userId);
      const now = Date.now();
      const resources = JSON.parse(row.resources);
      const structures = JSON.parse(row.structures);
      const army = JSON.parse(state.army);
      let buildingJob = state.building_job ? JSON.parse(state.building_job) : null;
      let trainingJob = state.training_job ? JSON.parse(state.training_job) : null;
      let queuedBuildingJob = state.queued_building_job ? JSON.parse(state.queued_building_job) : null;
      let changed = false;
      // Resource production is calculated from server time, including while logged out.
      const elapsedTicks = Math.floor(Math.max(0, now - state.production_at) / 10000);
      const rates = { Gold: "Gold Synthesizer", Iron: "Iron Driller", Water: "Water Extractor", Solar: "Solar Array" };
      for (const [resource, name] of Object.entries(rates)) {
        const level = Number(structures[name] || 0);
        if (level > 0 && elapsedTicks > 0) {
          resources[resource] = Math.floor((Number(resources[resource]) || 0) + level * elapsedTicks);
          changed = true;
        }
      }
      while (buildingJob && buildingJob.endsAt <= now) {
        structures[buildingJob.name] = buildingJob.level;
        const finishedAt = buildingJob.endsAt;
        buildingJob = queuedBuildingJob
          ? {...queuedBuildingJob, endsAt: finishedAt + queuedBuildingJob.duration}
          : null;
        queuedBuildingJob = null;
        changed = true;
      }
      if (trainingJob && trainingJob.endsAt <= now) {
        army[trainingJob.unit] = (Number(army[trainingJob.unit]) || 0) + trainingJob.quantity;
        trainingJob = null;
        changed = true;
      }
      db.prepare("UPDATE game_runtime SET production_at=?, building_job=?, queued_building_job=?, training_job=?, army=? WHERE user_id=?")
        .run(state.production_at + elapsedTicks * 10000, buildingJob ? JSON.stringify(buildingJob) : null, queuedBuildingJob ? JSON.stringify(queuedBuildingJob) : null, trainingJob ? JSON.stringify(trainingJob) : null, JSON.stringify(army), userId);
      if (changed) db.prepare("UPDATE game_progress SET resources=?, structures=?, last_saved=CURRENT_TIMESTAMP WHERE id=?")
        .run(JSON.stringify(resources), JSON.stringify(structures), row.id);
      return {
        castle: JSON.parse(row.castle_data), resources, structures, army,
        buildingJob, queuedBuildingJob, trainingJob, unitUpgrades: JSON.parse(state.unit_upgrades),
        questClaimed: !!state.quest_claimed, quest2Claimed: !!state.quest2_claimed,
        productionRates: Object.fromEntries(Object.entries(rates).map(([key,name]) => [key, Number(structures[name] || 0) * 0.1])),
        serverTime: now
      };
    })();
  }

  upgradeBuilding(userId, name) {
    const allowed = ["Gold Synthesizer", "Iron Driller", "Solar Array", "Water Extractor", "Cargo Depot", "Defense Grid", "Upgrade Lab", "Bio-Lab", "Training Center", "Combat Simulator", "Vehicle Bay", "Drone Factory"];
    if (!allowed.includes(name)) return { error: "Unknown building." };
    return db.transaction(() => {
      const current = this.syncGame(userId);
      if (!current) return { error: "Player progress not found." };
      if (current.queuedBuildingJob) return { error: "Construction queue is full (2 slots)." };
      const level = Number(current.structures[name] || 0) + (current.buildingJob?.name === name ? 1 : 0);
      if (level >= 20) return { error: "Maximum building level reached." };
      const cost = buildingPrice(name, level + 1);
      if (Object.keys(cost).some(key => current.resources[key] < cost[key])) return { error: "Not enough resources." };
      for (const key of Object.keys(cost)) current.resources[key] -= cost[key];
      const duration = 15 * (level + 1) * 1000;
      const job = { name, level: level + 1, duration, endsAt: Date.now() + duration };
      if (current.buildingJob) {
        db.prepare("UPDATE game_runtime SET queued_building_job=? WHERE user_id=?").run(JSON.stringify({name,level:level+1,duration}),userId);
      } else {
        db.prepare("UPDATE game_runtime SET building_job=? WHERE user_id=?").run(JSON.stringify(job),userId);
      }
      db.prepare("UPDATE game_progress SET resources=?, last_saved=CURRENT_TIMESTAMP WHERE user_id=?")
        .run(JSON.stringify(current.resources), userId);
      this.awardPlayerXp(userId,50*(level+1));
      return { ...current, resources: current.resources, buildingJob: current.buildingJob || job, queuedBuildingJob: current.buildingJob ? {name,level:level+1,duration} : null };
    })();
  }

  trainUnits(userId, unit, quantity) {
    if (!unitPrice(unit) || !Number.isInteger(quantity) || quantity < 1 || quantity > 10000)
      return { error: "Invalid unit or quantity." };
    return db.transaction(() => {
      const current = this.syncGame(userId);
      if (!current) return { error: "Player progress not found." };
      if (current.trainingJob) return { error: "Training already in progress." };
      const requirement = unitRequirement(unit);
      if (Number(current.structures[requirement.building] || 0) < requirement.level) return {error: `Requires ${requirement.building} level ${requirement.level}.`};
      const cost = Object.fromEntries(Object.entries(unitPrice(unit)).map(([resource,value])=>[resource,value*quantity]));
      if (Object.keys(cost).some(key => current.resources[key] < cost[key])) return { error: "Not enough resources." };
      for (const key of Object.keys(cost)) current.resources[key] -= cost[key];
      this.awardPlayerXp(userId,Math.min(1000,quantity*2));
      const job = { unit, quantity, endsAt: Date.now() + quantity * 30000 };
      db.prepare("UPDATE game_runtime SET training_job=? WHERE user_id=?").run(JSON.stringify(job), userId);
      db.prepare("UPDATE game_progress SET resources=?, last_saved=CURRENT_TIMESTAMP WHERE user_id=?")
        .run(JSON.stringify(current.resources), userId);
      return { ...current, trainingJob: job };
    })();
  }

  upgradeUnit(userId, unit, stat) {
    const units = ["Explorer Trooper", "Exo-Soldier", "Plasma Bladesman", "Nano Shieldman", "Railgunner", "Pulse Sniper", "Drone Operator", "Rover Scout", "Hoverbike Rider", "Mech Walker", "Hover Drone Rider", "Demolition Bot", "Missile Carrier", "Particle Blaster", "Orbital Strike Beacon", "Martian Noble", "AI General", "Gene Warrior"];
    if (!units.includes(unit) || !["attack", "defense"].includes(stat)) return { error: "Invalid upgrade." };
    return db.transaction(() => {
      const current = this.syncGame(userId);
      const upgrades = current.unitUpgrades;
      const values = upgrades[unit] || { attack: 1, defense: 1 };
      if (values[stat] >= 20) return { error: "Maximum upgrade level." };
      const price = upgradePrice(values[stat]);
      if (Object.keys(price).some(resource => current.resources[resource] < price[resource])) return { error: "Not enough resources." };
      for (const resource of Object.keys(price)) current.resources[resource] -= price[resource];
      values[stat]++;
      upgrades[unit] = values;
      db.prepare("UPDATE game_runtime SET unit_upgrades=? WHERE user_id=?").run(JSON.stringify(upgrades), userId);
      db.prepare("UPDATE game_progress SET resources=?, last_saved=CURRENT_TIMESTAMP WHERE user_id=?").run(JSON.stringify(current.resources), userId);
      return { ...current, unitUpgrades: upgrades };
    })();
  }

  claimFirstQuest(userId) {
    return db.transaction(() => {
      const current = this.syncGame(userId);
      if (!current) return { error: "Player progress not found." };
      if (current.questClaimed) return { error: "Reward already claimed." };
      if (!["Gold Synthesizer", "Iron Driller", "Water Extractor", "Solar Array"].every(name => Number(current.structures[name] || 0) >= 3))
        return { error: "Quest is not complete." };
      for (const key of ["Gold", "Iron", "Water", "Solar"]) current.resources[key] += 3000;
      db.prepare("UPDATE game_runtime SET quest_claimed=1 WHERE user_id=?").run(userId);
      this.creditTokens(userId,100);
      db.prepare("UPDATE game_progress SET resources=?, last_saved=CURRENT_TIMESTAMP WHERE user_id=?").run(JSON.stringify(current.resources), userId);
      return { ...current, questClaimed: true };
    })();
  }

  claimSecondQuest(userId) {
    return db.transaction(() => {
      const current = this.syncGame(userId);
      if (!current) return { error: "Player progress not found." };
      if (current.quest2Claimed) return { error: "Reward already claimed." };
      if (!current.questClaimed) return { error: "Complete mission 1 first." };
      if (Number(current.structures["Training Center"] || 0) < 1 ||
          Object.values(current.army).reduce((sum, count) => sum + Number(count || 0), 0) < 10)
        return { error: "Build a Training Center and train 10 soldiers." };
      for (const key of ["Gold", "Iron", "Water", "Solar"]) current.resources[key] += 5000;
      db.prepare("UPDATE game_runtime SET quest2_claimed=1 WHERE user_id=?").run(userId);
      this.creditTokens(userId,100);
      db.prepare("UPDATE game_progress SET resources=?, last_saved=CURRENT_TIMESTAMP WHERE user_id=?")
        .run(JSON.stringify(current.resources), userId);
      return { ...current, quest2Claimed: true };
    })();
  }

  talentCatalog(){
    return [
      ["Rapid Deployment",[15,35,60],"% army speed"],["Resource Management",[10,25,45],"% economy"],
      ["Mining Operations",[1,3,6],"extra mines"],["Precision Fire",[15,35,60],"% ranged attack"],
      ["Reinforced Armor",[10,25,45],"% unit HP"],["Infantry Command",[10,25,45],"% infantry attack and HP"],
      ["Battle Command",[6,16,30],"% leadership"],["Advanced Recon",[10,30,50],"% spy discount"],
      ["Evasion Protocol",[3,8,15],"% evade"],["Combat Recovery",[3,8,15],"% revive"],
      ["Mobile Warfare",[10,25,45],"% mobile attack"],["Heavy Artillery",[10,25,45],"% siege attack"],
      ["Advanced Research",[10,25,45],"% XP"],["Accelerated Training",[10,25,45],"% training speed"],
      ["Forward Operations",[1,3,6],"extra camps"]
    ].map(([name,values,description])=>({name,values,description}));
  }
  playerLevel(xp){return Math.min(40,1+Math.floor(Math.max(0,xp)/1000));}
  playerTalents(userId){
    db.prepare("INSERT OR IGNORE INTO player_talents(user_id) VALUES (?)").run(userId);
    const row=db.prepare("SELECT xp,talents FROM player_talents WHERE user_id=?").get(userId);
    const level=this.playerLevel(row.xp),talents=JSON.parse(row.talents);
    const earned=Array.from({length:level},(_,i)=>i+1).reduce((sum,n)=>sum+(n%5===0?2:1),0);
    const spent=Object.values(talents).reduce((sum,t)=>sum+[0,1,3,6][t]||sum,0);
    return {level,xp:row.xp,nextLevelXp:level>=40?null:level*1000,skillPoints:Math.max(0,earned-spent),talents,catalog:this.talentCatalog()};
  }
  awardPlayerXp(userId,amount){
    if(!Number.isSafeInteger(amount)||amount<1)return;
    db.prepare("INSERT OR IGNORE INTO player_talents(user_id) VALUES (?)").run(userId);
    db.prepare("UPDATE player_talents SET xp=xp+? WHERE user_id=?").run(amount,userId);
  }
  upgradePlayerTalent(userId,name){
    if(!this.talentCatalog().some(t=>t.name===name))return {error:"Unknown player talent."};
    return db.transaction(()=>{
      const state=this.playerTalents(userId),tier=state.talents[name]||0;
      if(tier>=3)return {error:"Talent already at Master."};
      if(state.skillPoints<tier+1)return {error:"Not enough skill points."};
      const talents={...state.talents,[name]:tier+1};
      db.prepare("UPDATE player_talents SET talents=? WHERE user_id=?").run(JSON.stringify(talents),userId);
      return this.playerTalents(userId);
    })();
  }

  getTokens(userId){
    db.prepare("INSERT OR IGNORE INTO player_tokens(user_id) VALUES (?)").run(userId);
    return db.prepare("SELECT balance,last_free_spin FROM player_tokens WHERE user_id=?").get(userId);
  }
  creditTokens(userId,amount){
    if(!Number.isSafeInteger(amount)||amount<=0)throw Error("Invalid token reward");
    this.getTokens(userId);
    db.prepare("UPDATE player_tokens SET balance=balance+? WHERE user_id=?").run(amount,userId);
  }
  wheelPrizes(){
    return [
      {label:"Gold × 3,000",kind:"resources",name:"Gold",amount:3000},
      {label:"Iron × 3,000",kind:"resources",name:"Iron",amount:3000},
      {label:"Water × 3,000",kind:"resources",name:"Water",amount:3000},
      {label:"Solar × 3,000",kind:"resources",name:"Solar",amount:3000},
      {label:"Gold × 7,500",kind:"resources",name:"Gold",amount:7500},
      {label:"Iron × 7,500",kind:"resources",name:"Iron",amount:7500},
      {label:"Explorer Trooper × 25",kind:"army",name:"Explorer Trooper",amount:25},
      {label:"Railgunner × 15",kind:"army",name:"Railgunner",amount:15},
      {label:"Rover Scout × 10",kind:"army",name:"Rover Scout",amount:10},
      {label:"Universal Forge × 20",kind:"crafting",amount:20},
      {label:"Water × 15,000",kind:"resources",name:"Water",amount:15000},
      {label:"Gold × 15,000",kind:"resources",name:"Gold",amount:15000}
    ];
  }
  getWheel(userId){
    const state=this.getTokens(userId),now=Date.now();
    return {tokens:state.balance,freeAvailableAt:state.last_free_spin+3600000,freeReady:now>=state.last_free_spin+3600000,serverTime:now,spinCost:50,prizes:this.wheelPrizes(),recent:db.prepare("SELECT spun_at,reward_id,free FROM wheel_spins WHERE user_id=? ORDER BY id DESC LIMIT 8").all(userId)};
  }
  spinWheel(userId,paid){
    return db.transaction(()=>{
      const state=this.getTokens(userId),now=Date.now();
      if(paid){
        if(state.balance<50)return {error:"Not enough tokens (50 required)."};
        db.prepare("UPDATE player_tokens SET balance=balance-50 WHERE user_id=?").run(userId);
      }else{
        if(now-state.last_free_spin<3600000)return {error:"Free spin is not ready yet."};
        db.prepare("UPDATE player_tokens SET last_free_spin=? WHERE user_id=?").run(now,userId);
      }
      const index=require("crypto").randomInt(12),prize=this.wheelPrizes()[index];
      db.prepare("INSERT INTO wheel_spins(user_id,spun_at,reward_id,free) VALUES (?,?,?,?)").run(userId,now,index,paid?0:1);
      if(prize.kind==="resources"||prize.kind==="army")this.addInventoryReward(userId,prize.kind,prize.name,prize.amount);
      if(prize.kind==="crafting"){
        const gear=this.getUserEquipment(userId);
        const points={...(gear?.craftingPoints||{})};
        points.Universal=(Number(points.Universal)||0)+prize.amount;
        this.saveUserEquipment(userId,gear?.equippedItems||{},gear?.gearInventory||[],points);
      }
      if(prize.kind==="equipment"){
        const gear=this.getUserEquipment(userId),slots=["HELMET","SHIELD","BOOTS","WEAPON","ARMOR","GLOVES"],slot=slots[require("crypto").randomInt(slots.length)];
        const item={id:"wheel-"+now+"-"+userId,name:"Wheel "+slot,slot,rarity:"Common",level:0,stats:[],obtainedFrom:"Activity Wheel"};
        this.saveUserEquipment(userId,gear?.equippedItems||{},[...(gear?.gearInventory||[]),item],gear?.craftingPoints||{});
      }
      return {index,prize,wheel:this.getWheel(userId)};
    })();
  }

  allianceState(userId){
    const membership=db.prepare("SELECT a.id,a.name,a.leader_id FROM alliance_members m JOIN alliances a ON a.id=m.alliance_id WHERE m.user_id=?").get(userId);
    if(!membership)return {alliance:null,requests:[]};
    const members=db.prepare("SELECT u.id,u.username FROM alliance_members m JOIN users u ON u.id=m.user_id WHERE m.alliance_id=?").all(membership.id);
    const requests=db.prepare("SELECT h.id,h.requester_id,h.building_name,h.building_level,h.requested_at,u.username FROM alliance_help h JOIN users u ON u.id=h.requester_id WHERE h.alliance_id=? ORDER BY h.id DESC LIMIT 30").all(membership.id).filter(h=>{
      const job=this.syncGame(h.requester_id)?.buildingJob;
      return job&&job.name===h.building_name&&job.level===h.building_level&&job.endsAt> Date.now();
    }).map(h=>({...h,helped:!!db.prepare("SELECT 1 FROM alliance_help_clicks WHERE request_id=? AND helper_id=?").get(h.id,userId)}));
    return {alliance:membership,members,requests};
  }
  createAlliance(userId,name){
    if(typeof name!=="string"||name.trim().length<3||name.trim().length>32)return {error:"Alliance name must be 3–32 characters."};
    return db.transaction(()=>{
      if(db.prepare("SELECT 1 FROM alliance_members WHERE user_id=?").get(userId))return {error:"Leave your current alliance first."};
      if(db.prepare("SELECT 1 FROM alliances WHERE name=? COLLATE NOCASE").get(name.trim()))return {error:"Alliance name already exists."};
      const id=db.prepare("INSERT INTO alliances(name,leader_id) VALUES (?,?)").run(name.trim(),userId).lastInsertRowid;
      db.prepare("INSERT INTO alliance_members(user_id,alliance_id) VALUES (?,?)").run(userId,id);
      return this.allianceState(userId);
    })();
  }
  joinAlliance(userId,name){
    if(typeof name!=="string")return {error:"Enter an alliance name."};
    return db.transaction(()=>{
      if(db.prepare("SELECT 1 FROM alliance_members WHERE user_id=?").get(userId))return {error:"Already in an alliance."};
      const a=db.prepare("SELECT id FROM alliances WHERE name=? COLLATE NOCASE").get(name.trim());
      if(!a)return {error:"Alliance not found."};
      db.prepare("INSERT INTO alliance_members(user_id,alliance_id) VALUES (?,?)").run(userId,a.id);
      return this.allianceState(userId);
    })();
  }
  requestAllianceHelp(userId){
    return db.transaction(()=>{
      const a=db.prepare("SELECT alliance_id FROM alliance_members WHERE user_id=?").get(userId);
      if(!a)return {error:"Join an alliance first."};
      const job=this.syncGame(userId)?.buildingJob;
      if(!job||job.endsAt<=Date.now())return {error:"No active construction to request help for."};
      const old=db.prepare("SELECT id FROM alliance_help WHERE requester_id=? AND building_name=? AND building_level=? AND requested_at>=?").get(userId,job.name,job.level,Date.now()-Math.max(86400000,job.duration||0));
      if(old)return {error:"Help already requested for this construction."};
      const id=db.prepare("INSERT INTO alliance_help(requester_id,alliance_id,building_name,building_level,requested_at,job_ends_at) VALUES (?,?,?,?,?,?)").run(userId,a.alliance_id,job.name,job.level,Date.now(),job.endsAt).lastInsertRowid;
      return {requestId:Number(id)};
    })();
  }
  helpAlliance(userId,requestId){
    if(!Number.isSafeInteger(requestId)||requestId<1)return {error:"Invalid help request."};
    return db.transaction(()=>{
      const h=db.prepare("SELECT * FROM alliance_help WHERE id=?").get(requestId);
      const m=db.prepare("SELECT alliance_id FROM alliance_members WHERE user_id=?").get(userId);
      if(!h||!m||m.alliance_id!==h.alliance_id)return {error:"Help request unavailable."};
      if(h.requester_id===userId)return {error:"Cannot help your own construction."};
      if(db.prepare("SELECT 1 FROM alliance_help_clicks WHERE request_id=? AND helper_id=?").get(requestId,userId))return {error:"Already helped this construction."};
      const job=this.syncGame(h.requester_id)?.buildingJob;
      if(!job||job.name!==h.building_name||job.level!==h.building_level||job.endsAt<=Date.now())return {error:"Construction already finished."};
      const reduction=Math.max(60000,Math.ceil((job.endsAt-Date.now())*.01));
      job.endsAt=Math.max(Date.now(),job.endsAt-reduction);
      db.prepare("UPDATE game_runtime SET building_job=? WHERE user_id=?").run(JSON.stringify(job),h.requester_id);
      db.prepare("INSERT INTO alliance_help_clicks(request_id,helper_id) VALUES (?,?)").run(requestId,userId);
      this.creditTokens(userId,1);
      return {reductionMs:reduction,tokens:this.getTokens(userId).balance};
    })();
  }

  getInventory(userId) {
    db.prepare("INSERT OR IGNORE INTO inventory_reserves(user_id,resources,army) VALUES (?,?,?)").run(userId,JSON.stringify({Gold:10000,Iron:10000,Water:10000,Solar:10000}),"{}");
    const row=db.prepare("SELECT resources,army FROM inventory_reserves WHERE user_id=?").get(userId);
    return {resources:JSON.parse(row.resources),army:JSON.parse(row.army)};
  }

  withdrawInventory(userId,kind,name,amount) {
    if(!["resources","army"].includes(kind)||!Number.isSafeInteger(amount)||amount<=0) return {error:"Invalid withdrawal."};
    if(kind==="resources"&&!["Gold","Iron","Water","Solar"].includes(name)) return {error:"Invalid resource."};
    if(kind==="army"&&!unitPrice(name)) return {error:"Invalid unit."};
    return db.transaction(()=>{
      const reserve=this.getInventory(userId),progress=this.syncGame(userId);
      if(!progress) return {error:"Player not found."};
      if((reserve[kind][name]||0)<amount) return {error:"Insufficient inventory reserve."};
      reserve[kind][name]-=amount;
      if(kind==="resources"){
        progress.resources[name]=(progress.resources[name]||0)+amount;
        db.prepare("UPDATE game_progress SET resources=? WHERE user_id=?").run(JSON.stringify(progress.resources),userId);
      } else {
        progress.army[name]=(progress.army[name]||0)+amount;
        db.prepare("UPDATE game_runtime SET army=? WHERE user_id=?").run(JSON.stringify(progress.army),userId);
      }
      db.prepare("UPDATE inventory_reserves SET resources=?,army=? WHERE user_id=?").run(JSON.stringify(reserve.resources),JSON.stringify(reserve.army),userId);
      return {inventory:reserve,resources:progress.resources,army:progress.army};
    })();
  }

  addInventoryReward(userId,kind,name,amount) {
    const reserve=this.getInventory(userId);
    reserve[kind][name]=(reserve[kind][name]||0)+amount;
    db.prepare("UPDATE inventory_reserves SET resources=?,army=? WHERE user_id=?").run(JSON.stringify(reserve.resources),JSON.stringify(reserve.army),userId);
  }

  getAlienArmy(level) {
    if (!Number.isInteger(level) || level < 1 || level > 20) return null;
    // Fixed garrisons adapted from the level 1–20 bandit-camp progression.
    // Columns: scout infantry, heavy infantry, ranged, elite infantry,
    // mobile cavalry equivalents, artillery, elite guard.
    const garrisons = [[50,0,0,0,0,0,0],[75,0,0,0,0,0,0],[125,0,75,0,0,0,0],[350,175,150,0,0,0,0],[450,225,500,0,0,0,0],[550,275,800,275,0,0,0],[650,325,1200,325,25,0,0],[750,375,1700,375,75,25,0],[850,425,2300,425,200,85,0],[950,475,2900,475,325,145,0],[1050,525,3500,525,550,180,0],[1150,575,6300,575,850,240,0],[1250,625,7500,625,1250,290,0],[1350,675,8700,675,1700,405,0],[1450,725,9900,725,2250,545,200],[1550,775,10950,775,2800,615,400],[1650,825,11850,825,3350,690,550],[1750,875,12750,875,4050,765,700],[1850,925,13650,925,4700,840,850],[2200,1100,15300,1100,6500,920,1100]];
    const names = ["Alien Scout","Xeno Warrior","Spore Archer","Plasma Stalker","War Drone","Siege Behemoth","Praetorian Guard"];
    const army = {};
    garrisons[level - 1].forEach((count, index) => { if (count > 0) army[names[index]] = count; });
    if (level === 20) army["Alien Overlord"] = 1;
    return army;
  }

  getAlienCampaign(userId) {
    this.resolveAlienMissions(userId);
    const row=db.prepare("SELECT highest_defeated FROM alien_campaign WHERE user_id=?").get(userId);
    const highestDefeated=row?.highest_defeated||0;
    const nextLevel=Math.min(20,highestDefeated+1);
    const today=new Date().toISOString().slice(0,10);
    const used=db.prepare("SELECT COUNT(*) AS n FROM alien_missions WHERE user_id=? AND launched_at>=? AND launched_at<?").get(userId,Date.parse(today+"T00:00:00Z"),Date.parse(today+"T00:00:00Z")+86400000).n;
    const missions=db.prepare("SELECT id,level,launched_at,arrives_at,resolved_at,returns_at,returned_at,result FROM alien_missions WHERE user_id=? ORDER BY id DESC LIMIT 15").all(userId).map(m=>({...m,result:m.result?JSON.parse(m.result):null}));
    const knight=db.prepare("SELECT victories,knight_level FROM alien_rewards WHERE user_id=?").get(userId)||{victories:0,knight_level:1};
    const sideQuests=[1,5,10,15,20].map(level=>({level,completed:highestDefeated>=level,claimed:!!db.prepare("SELECT 1 FROM alien_side_quests WHERE user_id=? AND milestone=?").get(userId,level)}));
    return {highestDefeated,nextLevel,defenders:this.getAlienArmy(nextLevel),garrisons:Object.fromEntries(Array.from({length:20},(_,i)=>[i+1,this.getAlienArmy(i+1)])),remaining:Math.max(0,20-used),used,missions,knightLevel:knight.knight_level,victories:knight.victories,sideQuests};
  }

  attackAlienBase(userId,level,selectedArmy,formation) {
    if(!Number.isInteger(level)||level<1||level>20)return {error:"Invalid alien base level."};
    return db.transaction(()=>{
      const campaign=this.getAlienCampaign(userId);
      if(level>campaign.nextLevel)return {error:"Defeat the previous alien base level first."};
      if(campaign.remaining<=0)return {error:"All 20 daily attacks have been used. Reset is at 00:00 UTC."};
      if(campaign.missions.some(m=>!m.resolved_at))return {error:"Wait for your current alien mission to arrive."};
      if(!selectedArmy||typeof selectedArmy!=="object"||Array.isArray(selectedArmy))return {error:"Choose an army."};
      const current=this.syncGame(userId);
      if(!current)return {error:"Player not found."};
      const {playerTypes}=require("../shared/combatEngine");
      let total=0;
      for(const [unit,n] of Object.entries(selectedArmy)){
        if(!playerTypes[unit]||!Number.isSafeInteger(n)||n<0||n>Number(current.army[unit]||0))return {error:"Invalid troop selection."};
        total+=n;
      }
      if(!total)return {error:"Select at least one unit."};
      const {fight}=require("../shared/combatEngine");
      // Validate formation before reserving any troops.
      // Battle is computed at arrival, using the chosen formation and static garrison.
      const selected=Object.fromEntries(Object.entries(selectedArmy).filter(([,n])=>n>0));
      if(formation){
        if(!Array.isArray(formation)||formation.length>100)return {error:"Invalid formation."};
        const tally={};
        for(const g of formation){
          if(!g||!playerTypes[g.unit]||!Number.isSafeInteger(g.count)||g.count<=0||!Number.isInteger(g.row)||g.row<1||g.row>4)return {error:"Invalid formation."};
          tally[g.unit]=(tally[g.unit]||0)+g.count;
        }
        if(Object.keys({...selected,...tally}).some(u=>(selected[u]||0)!==(tally[u]||0)))return {error:"Formation does not match selected troops."};
      }
      for(const [unit,n] of Object.entries(selected))current.army[unit]-=n;
      db.prepare("UPDATE game_runtime SET army=? WHERE user_id=?").run(JSON.stringify(current.army),userId);
      const now=Date.now(),arrivesAt=now+60000;
      const mission=db.prepare("INSERT INTO alien_missions(user_id,level,army,launched_at,arrives_at) VALUES (?,?,?,?,?)").run(userId,level,JSON.stringify({units:selected,formation:formation||null}),now,arrivesAt);
      return {missionId:Number(mission.lastInsertRowid),level,launchedAt:now,arrivesAt,remaining:campaign.remaining-1};
    })();
  }

  resolveAlienMissions(userId) {
    return db.transaction(()=>{
      const returning=db.prepare("SELECT * FROM alien_missions WHERE user_id=? AND resolved_at IS NOT NULL AND returned_at IS NULL AND returns_at<=?").all(userId,Date.now());
      for(const mission of returning){
        const result=JSON.parse(mission.result);
        const current=this.syncGame(userId);
        for(const [unit,n] of Object.entries(result.survivors||{}))current.army[unit]=(current.army[unit]||0)+n;
        db.prepare("UPDATE game_runtime SET army=? WHERE user_id=?").run(JSON.stringify(current.army),userId);
        db.prepare("UPDATE alien_missions SET returned_at=? WHERE id=?").run(Date.now(),mission.id);
      }
      const due=db.prepare("SELECT * FROM alien_missions WHERE user_id=? AND resolved_at IS NULL AND arrives_at<=? ORDER BY id").all(userId,Date.now());
      for(const mission of due){
        const armyData=JSON.parse(mission.army);
        const {fight}=require("../shared/combatEngine");
        const result=fight(armyData.units,this.getAlienArmy(mission.level),armyData.formation);
        if(result.victory){
          this.awardPlayerXp(userId,mission.level*100);
          db.prepare("INSERT INTO alien_campaign(user_id,highest_defeated) VALUES (?,?) ON CONFLICT(user_id) DO UPDATE SET highest_defeated=MAX(highest_defeated,excluded.highest_defeated)").run(userId,mission.level);
          db.prepare("INSERT OR IGNORE INTO alien_rewards(user_id) VALUES (?)").run(userId);
          db.prepare("UPDATE alien_rewards SET victories=victories+1,knight_level=1+CAST((victories+1)/20 AS INTEGER) WHERE user_id=?").run(userId);
          const rewardType=["equipment","crafting","resources","army"][(mission.id-1)%4];
          if(rewardType==="equipment"){
            const slots=["HELMET","SHIELD","BOOTS","WEAPON","ARMOR","GLOVES"];
            const slot=slots[(mission.id-1)%slots.length];
            const bonusCount=mission.level===20?5:Math.min(4,1+Math.floor(mission.level/5));
            const item={id:"alien-"+mission.id,name:"Alien "+slot,slot,rarity:mission.level===20?"Legendary":mission.level>=10?"Rare":"Common",level:0,stats:[],bonusSlots:bonusCount,obtainedFrom:"Alien Base "+mission.level};
            const old=this.getUserEquipment(userId);
            this.saveUserEquipment(userId,old?.equippedItems||{},[...(old?.gearInventory||[]),item],old?.craftingPoints||{});
            result.reward={type:"equipment",item};
          }else if(rewardType==="crafting"){
            const old=this.getUserEquipment(userId);
            const points={...(old?.craftingPoints||{})};
            points.Universal=(Number(points.Universal)||0)+20;
            this.saveUserEquipment(userId,old?.equippedItems||{},old?.gearInventory||[],points);
            result.reward={type:"crafting",amount:20};
          }else if(rewardType==="resources"){
            const amount=mission.level*750;
            for(const key of ["Gold","Iron","Water","Solar"])this.addInventoryReward(userId,"resources",key,amount);
            result.reward={type:"resources",amount};
          }else{
            const amount=10*mission.level;
            this.addInventoryReward(userId,"army","Explorer Trooper",amount);
            result.reward={type:"army",unit:"Explorer Trooper",amount};
          }
        }
        db.prepare("UPDATE alien_missions SET resolved_at=?,returns_at=?,result=? WHERE id=?").run(Date.now(),Date.now()+60000,JSON.stringify(result),mission.id);
      }
      return due.length;
    })();
  }

  claimAlienSideQuest(userId,milestone){
    if(![1,5,10,15,20].includes(milestone))return {error:"Invalid side quest."};
    return db.transaction(()=>{
      const highest=db.prepare("SELECT highest_defeated FROM alien_campaign WHERE user_id=?").get(userId)?.highest_defeated||0;
      if(highest<milestone)return {error:"Defeat the required alien base first."};
      const insert=db.prepare("INSERT OR IGNORE INTO alien_side_quests(user_id,milestone) VALUES (?,?)").run(userId,milestone);
      if(!insert.changes)return {error:"Side quest already claimed."};
      this.creditTokens(userId,100);
      const amount=milestone*1000;
      for(const name of ["Gold","Iron","Water","Solar"])this.addInventoryReward(userId,"resources",name,amount);
      return {milestone,amount};
    })();
  }

  getTutorial(userId) {
    const current = this.syncGame(userId);
    if (!current) return null;
    const claimed = new Set(db.prepare("SELECT mission_id FROM tutorial_claims WHERE user_id=?").all(userId).map(r => r.mission_id));
    if (current.questClaimed) claimed.add(1);
    if (current.quest2Claimed) claimed.add(2);
    const mineNames = ["Gold Synthesizer", "Iron Driller", "Water Extractor", "Solar Array"];
    const level = name => Number(current.structures[name] || 0);
    const missions = tutorialMissions.map(m => {
      let progress = 0, target = 1;
      if (m.kind === "mines") { progress = mineNames.filter(n => level(n) >= m.target).length; target = 4; }
      else if (m.kind === "building") { progress = Math.min(level(m.target),m.level); target = m.level; }
      else if (m.kind === "army") { progress = level("Training Center") >= 1 ? Math.min(10,Object.values(current.army).reduce((a,b)=>a+Number(b||0),0)) : 0; target=10; }
      else if (m.kind === "units") { progress = Math.min(25,Number(current.army["Explorer Trooper"]||0)) + Math.min(25,Number(current.army["Plasma Bladesman"]||0)) + Math.min(25,Number(current.army["Railgunner"]||0)); target=75; }
      else if (m.kind === "final") { progress = [...Array(22)].filter((_,i)=>claimed.has(i+1)).length; target=22; }
      const completed = progress >= target && m.kind !== "future";
      const unlocked = m.id === 1 || claimed.has(m.id-1);
      return {...m,progress,target,completed,claimed:claimed.has(m.id),unlocked,available:m.kind!=="future"};
    });
    return { missions, resources:current.resources };
  }

  claimTutorialMission(userId, missionId) {
    return db.transaction(() => {
      const tutorial = this.getTutorial(userId);
      if (!tutorial) return {error:"Player progress not found."};
      const mission = tutorial.missions.find(m=>m.id===missionId);
      if (!mission) return {error:"Unknown mission."};
      if (mission.claimed) return {error:"Reward already claimed."};
      if (!mission.unlocked || !mission.completed) return {error:"Mission requirements not completed."};
      const result = db.prepare("INSERT OR IGNORE INTO tutorial_claims(user_id,mission_id) VALUES (?,?)").run(userId,missionId);
      if (!result.changes) return {error:"Reward already claimed."};
      this.creditTokens(userId,100);
      const resources = {...tutorial.resources};
      for (const key of ["Gold","Iron","Water","Solar"]) resources[key] += mission.reward;
      db.prepare("UPDATE game_progress SET resources=?,last_saved=CURRENT_TIMESTAMP WHERE user_id=?").run(JSON.stringify(resources),userId);
      if (missionId===1) db.prepare("UPDATE game_runtime SET quest_claimed=1 WHERE user_id=?").run(userId);
      if (missionId===2) db.prepare("UPDATE game_runtime SET quest2_claimed=1 WHERE user_id=?").run(userId);
      return {resources,missionId};
    })();
  }

  dailyLoginReward(day) {
    if (day % 7 === 0) return {type:"equipment",label:"Cyber Knight Armor",item:{id:"login-armor-"+day,name:"Cyber Knight Armor",slot:"ARMOR",rarity:"Rare",level:1,stats:["+5 Defense"]}};
    if (day % 5 === 0) return {type:"army",label:"Explorer Trooper",amount:5+day};
    return {type:"resources",label:"Gold, Iron, Water, Solar",amount:250+day*100};
  }

  getDailyLogin(userId) {
    if (!this.findUserById(userId)) return null;
    const rows=db.prepare("SELECT day,claimed_date FROM daily_login_claims WHERE user_id=? ORDER BY day").all(userId);
    const today=new Date().toISOString().slice(0,10);
    const nextDay=rows.length+1;
    return {today,nextDay,claimedToday:rows.some(row=>row.claimed_date===today),
      days:Array.from({length:30},(_,i)=>({day:i+1,reward:this.dailyLoginReward(i+1),claimed:rows.some(row=>row.day===i+1)}))};
  }

  claimDailyLogin(userId) {
    return db.transaction(()=>{
      const state=this.getDailyLogin(userId);
      if (!state) return {error:"Player not found."};
      if (state.claimedToday) return {error:"Today's login reward has already been claimed."};
      if (state.nextDay>30) return {error:"All 30 login rewards have been claimed."};
      const progress=this.syncGame(userId);
      if (!progress) return {error:"Player progress not found."};
      const day=state.nextDay, reward=this.dailyLoginReward(day);
      const today=new Date().toISOString().slice(0,10);
      db.prepare("INSERT INTO daily_login_claims(user_id,day,claimed_date) VALUES (?,?,?)").run(userId,day,today);
      if (reward.type==="resources") {
        for(const key of ["Gold","Iron","Water","Solar"]) this.addInventoryReward(userId,"resources",key,reward.amount);
      } else if(reward.type==="army") {
        this.addInventoryReward(userId,"army",reward.label,reward.amount);
      } else {
        const existing=this.getUserEquipment(userId);
        const inventory=existing?.gearInventory||[];
        inventory.push({...reward.item,obtainedFrom:"Daily login day "+day});
        this.saveUserEquipment(userId,existing?.equippedItems||{},inventory,existing?.craftingPoints||{});
      }
      return {day,reward,success:true};
    })();
  }

  getGameProgress(userId) {
    const current = this.syncGame(userId);
    if (!current) return null;
    return { ...current, lastSaved: new Date(current.serverTime).toISOString() };
  }

  updateGameStats(userId, playTime, resourcesMined, structuresBuilt) {
    try {
      this.statsQueries.updateStats.run(playTime, resourcesMined, structuresBuilt, userId);
      return { success: true };
    } catch (error) {
      throw error;
    }
  }

  getGameStats(userId) {
    try {
      return this.statsQueries.getStats.get(userId);
    } catch (error) {
      throw error;
    }
  }

  saveUserEquipment(userId, equippedItems, gearInventory, craftingPoints) {
    try {
      const equippedItemsJson = JSON.stringify(equippedItems);
      const gearInventoryJson = JSON.stringify(gearInventory);
      const craftingPointsJson = JSON.stringify(craftingPoints);

      const existing = this.equipmentQueries.getEquipment.get(userId);
      if (existing) {
        this.equipmentQueries.updateEquipment.run(equippedItemsJson, gearInventoryJson, craftingPointsJson, userId);
      } else {
        this.equipmentQueries.saveEquipment.run(userId, equippedItemsJson, gearInventoryJson, craftingPointsJson);
      }
      return { success: true };
    } catch (error) {
      throw error;
    }
  }

  getUserEquipment(userId) {
    try {
      const equipment = this.equipmentQueries.getEquipment.get(userId);
      if (!equipment) return null;

      return {
        equippedItems: JSON.parse(equipment.equipped_items),
        gearInventory: JSON.parse(equipment.gear_inventory),
        craftingPoints: JSON.parse(equipment.crafting_points),
        lastUpdated: equipment.last_updated,
      };
    } catch (error) {
      throw error;
    }
  }

  updateUserEquipment(userId, equippedItems, gearInventory, craftingPoints) {
    try {
      const equippedItemsJson = JSON.stringify(equippedItems);
      const gearInventoryJson = JSON.stringify(gearInventory);
      const craftingPointsJson = JSON.stringify(craftingPoints);

      this.equipmentQueries.updateEquipment.run(equippedItemsJson, gearInventoryJson, craftingPointsJson, userId);
      return { success: true };
    } catch (error) {
      throw error;
    }
  }


  getPublicBases() {
    return db.prepare(`
      SELECT u.username, b.x, b.y
      FROM base_positions b JOIN users u ON u.id = b.user_id
      ORDER BY u.id
    `).all();
  }

  getAllUsers() {
    try {
      return db.prepare("SELECT * FROM users ORDER BY id").all();
    } catch (error) {
      throw error;
    }
  }

  getAllGameProgress() {
    try {
      return db.prepare("SELECT * FROM game_progress ORDER BY user_id").all();
    } catch (error) {
      throw error;
    }
  }

  getAllGameStats() {
    try {
      return db.prepare("SELECT * FROM game_stats ORDER BY user_id").all();
    } catch (error) {
      throw error;
    }
  }

  getAllUserEquipment() {
    try {
      return db.prepare("SELECT * FROM user_equipment ORDER BY user_id").all();
    } catch (error) {
      throw error;
    }
  }

  getUserCount() {
    try {
      const result = db.prepare("SELECT COUNT(*) as count FROM users").get();
      return result.count;
    } catch (error) {
      throw error;
    }
  }

  getProgressCount() {
    try {
      const result = db.prepare("SELECT COUNT(*) as count FROM game_progress").get();
      return result.count;
    } catch (error) {
      throw error;
    }
  }

  getStatsCount() {
    try {
      const result = db.prepare("SELECT COUNT(*) as count FROM game_stats").get();
      return result.count;
    } catch (error) {
      throw error;
    }
  }

  getEquipmentCount() {
    try {
      const result = db.prepare("SELECT COUNT(*) as count FROM user_equipment").get();
      return result.count;
    } catch (error) {
      throw error;
    }
  }

  close() {
    db.close();
  }
}

module.exports = DatabaseManager;
