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
    for (let i = 0; i < 40000; i++) {
      const angle = i * 2.399963229728653;
      const radius = 38 + (i % 9);
      const x = Math.max(1, Math.min(100, Math.round(50.5 + radius * Math.cos(angle))));
      const y = Math.max(1, Math.min(100, Math.round(50.5 + radius * Math.sin(angle))));
      if (!occupied.has(x + ":" + y)) return { x, y };
    }
    throw new Error("No available spawn position");
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
      db.prepare("UPDATE game_progress SET resources=?, last_saved=CURRENT_TIMESTAMP WHERE user_id=?")
        .run(JSON.stringify(current.resources), userId);
      return { ...current, quest2Claimed: true };
    })();
  }

  getAlienCampaign(userId) {
    const row = db.prepare("SELECT highest_defeated FROM alien_campaign WHERE user_id=?").get(userId);
    return { highestDefeated: row ? row.highest_defeated : 0, nextLevel: Math.min(20,(row ? row.highest_defeated : 0)+1) };
  }

  attackAlienBase(userId, level) {
    if (!Number.isInteger(level) || level < 1 || level > 20) return {error:"Invalid alien base level."};
    return db.transaction(() => {
      const campaign = this.getAlienCampaign(userId);
      if (level !== campaign.nextLevel || campaign.highestDefeated === 20)
        return {error:"Defeat the previous alien base level first."};
      const current = this.syncGame(userId);
      if (!current) return {error:"Player progress not found."};
      const strength = Object.values(current.army).reduce((sum,n)=>sum+Number(n||0),0);
      const required = level * 5;
      if (strength < required) return {error:"Not enough soldiers. Required army size: "+required};
      db.prepare("INSERT INTO alien_campaign(user_id,highest_defeated) VALUES (?,?) ON CONFLICT(user_id) DO UPDATE SET highest_defeated=excluded.highest_defeated").run(userId,level);
      const resources={...current.resources};
      const reward=level*750;
      for (const key of ["Gold","Iron","Water","Solar"]) resources[key]+=reward;
      db.prepare("UPDATE game_progress SET resources=?,last_saved=CURRENT_TIMESTAMP WHERE user_id=?").run(JSON.stringify(resources),userId);
      return {level,highestDefeated:level,nextLevel:Math.min(20,level+1),reward,resources};
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
        const resources={...progress.resources};
        for(const key of ["Gold","Iron","Water","Solar"]) resources[key]=(Number(resources[key])||0)+reward.amount;
        db.prepare("UPDATE game_progress SET resources=?,last_saved=CURRENT_TIMESTAMP WHERE user_id=?").run(JSON.stringify(resources),userId);
      } else if(reward.type==="army") {
        const army={...progress.army};
        army[reward.label]=(Number(army[reward.label])||0)+reward.amount;
        db.prepare("UPDATE game_runtime SET army=? WHERE user_id=?").run(JSON.stringify(army),userId);
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
