const research = require("../src/shared/allianceResearch");
const craftingCosts = require("../src/shared/craftingCosts");
const alienBases = require("../src/shared/alienBases");
const spaceStations = require("../src/shared/spaceStations");
const {units: formationUnits, marchLimit, defaultFormation, normalizeFormation} = require("../src/shared/formations");
const {allianceUpgradeDuration,cargoCapacity:unitCargoCapacity,unitPrice,upgradePrice,unitRequirement,buildingPrice,unitTrainingDuration,unitUpgradeDetails} = require("../src/shared/unitEconomy");
const tutorialMissions = require("../shared/tutorialMissions");
const Database = require("better-sqlite3");
const path = require("path");
const fs = require("fs");

const dbDir = path.join(__dirname);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const persistentDbPath = process.env.DATABASE_PATH || (process.env.RENDER ? "/var/data/colonize_mars.db" : null);
const dbPath = persistentDbPath || path.join(dbDir, "colonize_mars.db");
fs.mkdirSync(path.dirname(dbPath), { recursive: true });

if (persistentDbPath && !fs.existsSync(dbPath)) {
  const previousDbPath = path.join(dbDir, "colonize_mars.db");
  if (fs.existsSync(previousDbPath)) {
    for (const suffix of ["", "-wal", "-shm"]) {
      const source = previousDbPath + suffix;
      if (fs.existsSync(source)) fs.copyFileSync(source, dbPath + suffix);
    }
  }
}
const db = new Database(dbPath);
db.pragma("busy_timeout = 5000");
db.pragma("foreign_keys = ON");
db.pragma("journal_mode = WAL");

function writeTradeNotification(tradeId,senderId,recipientId,senderName,resources,sentAt){
  const keys=["Gold","Iron","Water","Solar"];
  const english=keys.filter(key=>Number(resources[key]||0)>0).map(key=>`${Number(resources[key]).toLocaleString("en-US")} ${key}`).join(", ");
  const bulgarian=keys.filter(key=>Number(resources[key]||0)>0).map(key=>`${Number(resources[key]).toLocaleString("bg-BG")} ${{Gold:"злато",Iron:"желязо",Water:"вода",Solar:"слънчева енергия"}[key]}`).join(", ");
  const body=`Trade received from ${senderName}: ${english}. Resources were added to your base. / Получена търговия от ${senderName}: ${bulgarian}. Ресурсите са добавени към базата ти.`;
  const result=db.prepare("INSERT INTO player_messages(sender_id,recipient_id,alliance_id,body,sent_at) VALUES (?,?,?,?,?, 'trade')")
    .run(senderId,recipientId,null,body,sentAt);
  db.prepare("INSERT INTO trade_message_notifications(trade_id,message_id) VALUES (?,?)").run(tradeId,Number(result.lastInsertRowid));
}

function calculateCargoCapacity(survivors={}) {
  return Object.entries(survivors).reduce((total,[unit,count]) =>
    total + Math.max(0,Number(count)||0) * Number(unitCargoCapacity[unit]||0),0);
}

function calculateLoot(resources={},capacity=0) {
  const keys=["Gold","Iron","Water","Solar"];
  const available=Object.fromEntries(keys.map(key=>[key,Math.floor(Math.max(0,Math.floor(Number(resources[key])||0))*0.1)]));
  const loot=Object.fromEntries(keys.map(key=>[key,0]));
  let remaining=Math.min(Math.max(0,Math.floor(Number(capacity)||0)),Object.values(available).reduce((sum,n)=>sum+n,0));
  while(remaining>0){
    const active=keys.filter(key=>available[key]>0);
    if(!active.length)break;
    const share=Math.floor(remaining/active.length);
    let moved=0;
    if(share===0){
      for(const key of active){
        if(remaining<=0)break;
        available[key]--;loot[key]++;remaining--;moved++;
      }
    }else{
      for(const key of active){
        if(remaining<=0)break;
        const amount=Math.min(available[key],share,remaining);
        available[key]-=amount;loot[key]+=amount;remaining-=amount;moved+=amount;
      }
    }
    if(!moved)break;
  }
  return loot;
}

function disbandEmptyAlliance(allianceId){
  const alliance=db.prepare("SELECT 1 FROM alliances WHERE id=?").get(allianceId);
  if(!alliance||db.prepare("SELECT 1 FROM alliance_members WHERE alliance_id=? LIMIT 1").get(allianceId))return false;
  db.prepare("DELETE FROM alliance_station_defenders WHERE alliance_id=?").run(allianceId);
  db.prepare("DELETE FROM alliance_space_stations WHERE alliance_id=?").run(allianceId);
  db.prepare("DELETE FROM alliance_reinforcements WHERE alliance_id=?").run(allianceId);
  db.prepare("DELETE FROM alliance_help_clicks WHERE request_id IN (SELECT id FROM alliance_help WHERE alliance_id=?)").run(allianceId);
  db.prepare("DELETE FROM alliance_help WHERE alliance_id=?").run(allianceId);
  db.prepare("DELETE FROM alliance_help_history WHERE alliance_id=?").run(allianceId);
  db.prepare("DELETE FROM alliance_invitations WHERE alliance_id=?").run(allianceId);
  db.prepare("DELETE FROM alliance_applications WHERE alliance_id=?").run(allianceId);
  db.prepare("DELETE FROM player_messages WHERE alliance_id=?").run(allianceId);
  db.prepare("DELETE FROM alliance_crystal_bank WHERE alliance_id=?").run(allianceId);
  db.prepare("DELETE FROM alliance_treasury WHERE alliance_id=?").run(allianceId);
  db.prepare("DELETE FROM alliance_research_jobs WHERE alliance_id=?").run(allianceId);
  db.prepare("DELETE FROM saturday_invasion_members WHERE run_id IN (SELECT id FROM saturday_invasion_runs WHERE alliance_id=?)").run(allianceId);
  db.prepare("DELETE FROM saturday_invasion_runs WHERE alliance_id=?").run(allianceId);
  return db.prepare("DELETE FROM alliances WHERE id=?").run(allianceId).changes>0;
}

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
    db.exec("CREATE TABLE IF NOT EXISTS player_profiles (user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE, avatar_id TEXT NOT NULL DEFAULT 'pilot-m')");

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
    if (!db.prepare("PRAGMA table_info(game_runtime)").all().some(c => c.name === "upgrade_jobs")) db.exec("ALTER TABLE game_runtime ADD COLUMN upgrade_jobs TEXT NOT NULL DEFAULT '[]'");
    if (!db.prepare("PRAGMA table_info(game_runtime)").all().some(c => c.name === "training_queues")) db.exec("ALTER TABLE game_runtime ADD COLUMN training_queues TEXT NOT NULL DEFAULT '{}'");
    if (!db.prepare("PRAGMA table_info(game_runtime)").all().some(c => c.name === "barracks_reserve")) db.exec("ALTER TABLE game_runtime ADD COLUMN barracks_reserve TEXT NOT NULL DEFAULT '{}'");
    if (!db.prepare("PRAGMA table_info(game_runtime)").all().some(c => c.name === "production_carry")) {
      db.exec("ALTER TABLE game_runtime ADD COLUMN production_carry TEXT NOT NULL DEFAULT '{}'");
    }
    db.exec("CREATE TABLE IF NOT EXISTS tutorial_claims (user_id INTEGER NOT NULL REFERENCES users(id), mission_id INTEGER NOT NULL, claimed_at DATETIME DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY(user_id, mission_id))");
    db.exec("CREATE TABLE IF NOT EXISTS alien_campaign (user_id INTEGER PRIMARY KEY REFERENCES users(id), highest_defeated INTEGER NOT NULL DEFAULT 0)");
    db.exec("CREATE TABLE IF NOT EXISTS daily_login_claims (user_id INTEGER NOT NULL REFERENCES users(id), day INTEGER NOT NULL CHECK(day BETWEEN 1 AND 30), claimed_date TEXT NOT NULL, claimed_at DATETIME DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY(user_id, day), UNIQUE(user_id, claimed_date))");
    db.exec("CREATE TABLE IF NOT EXISTS inventory_reserves (user_id INTEGER PRIMARY KEY REFERENCES users(id), resources TEXT NOT NULL, army TEXT NOT NULL, items TEXT NOT NULL DEFAULT '{}')");
    if (!db.prepare("PRAGMA table_info(inventory_reserves)").all().some(column => column.name === "items")) db.exec("ALTER TABLE inventory_reserves ADD COLUMN items TEXT NOT NULL DEFAULT '{}'");
    db.exec("CREATE TABLE IF NOT EXISTS alien_missions (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL REFERENCES users(id), level INTEGER NOT NULL, army TEXT NOT NULL, launched_at INTEGER NOT NULL, arrives_at INTEGER NOT NULL, resolved_at INTEGER, result TEXT)");
    db.exec(`CREATE TABLE IF NOT EXISTS battle_simulations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id),
      level INTEGER NOT NULL,
      army TEXT NOT NULL,
      formation TEXT NOT NULL,
      simulated_at INTEGER NOT NULL,
      result TEXT NOT NULL
    )`);
    db.exec("CREATE INDEX IF NOT EXISTS battle_simulations_user ON battle_simulations(user_id,simulated_at)");
    db.exec(`CREATE TABLE IF NOT EXISTS player_missions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      attacker_id INTEGER NOT NULL REFERENCES users(id),
      defender_id INTEGER NOT NULL REFERENCES users(id),
      army TEXT NOT NULL,
      launched_at INTEGER NOT NULL,
      arrives_at INTEGER NOT NULL,
      resolved_at INTEGER,
      returns_at INTEGER,
      returned_at INTEGER,
      result TEXT,
      seen_at INTEGER,
      attacker_seen_at INTEGER,
      defender_seen_at INTEGER
    )`);
    if (!db.prepare("PRAGMA table_info(player_missions)").all().some(column => column.name === "seen_at")) {
      db.exec("ALTER TABLE player_missions ADD COLUMN seen_at INTEGER");
      db.prepare("UPDATE player_missions SET seen_at=? WHERE seen_at IS NULL AND resolved_at IS NOT NULL").run(Date.now());
    }
    const playerMissionColumns=new Set(db.prepare("PRAGMA table_info(player_missions)").all().map(column=>column.name));
    if(!playerMissionColumns.has("attacker_seen_at"))db.exec("ALTER TABLE player_missions ADD COLUMN attacker_seen_at INTEGER");
    if(!playerMissionColumns.has("defender_seen_at"))db.exec("ALTER TABLE player_missions ADD COLUMN defender_seen_at INTEGER");
    db.prepare("UPDATE player_missions SET attacker_seen_at=COALESCE(attacker_seen_at,seen_at),defender_seen_at=COALESCE(defender_seen_at,seen_at) WHERE seen_at IS NOT NULL").run();
    db.exec(`CREATE TABLE IF NOT EXISTS interbase_trades (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sender_id INTEGER NOT NULL REFERENCES users(id),
      recipient_id INTEGER NOT NULL REFERENCES users(id),
      resources TEXT NOT NULL,
      traded_at INTEGER NOT NULL
    )`);
    db.exec(`CREATE TABLE IF NOT EXISTS market_offers (id INTEGER PRIMARY KEY AUTOINCREMENT,seller_id INTEGER NOT NULL REFERENCES users(id),offered_resources TEXT NOT NULL,requested_resources TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'open',accepted_by INTEGER REFERENCES users(id),created_at INTEGER NOT NULL,resolved_at INTEGER)`);
    db.exec("CREATE INDEX IF NOT EXISTS market_offers_status ON market_offers(status,id DESC)");
    db.exec("CREATE INDEX IF NOT EXISTS player_missions_attacker ON player_missions(attacker_id,id)");
    db.exec("CREATE INDEX IF NOT EXISTS player_missions_defender ON player_missions(defender_id,id)");
    if(!db.prepare("PRAGMA table_info(alien_missions)").all().some(c=>c.name==="returns_at")) db.exec("ALTER TABLE alien_missions ADD COLUMN returns_at INTEGER");
    if(!db.prepare("PRAGMA table_info(alien_missions)").all().some(c=>c.name==="returned_at")) db.exec("ALTER TABLE alien_missions ADD COLUMN returned_at INTEGER");
    db.exec("CREATE TABLE IF NOT EXISTS player_formations (user_id INTEGER PRIMARY KEY REFERENCES users(id), presets TEXT NOT NULL, defense_slot INTEGER NOT NULL DEFAULT 0)");
    if(!db.prepare("PRAGMA table_info(player_formations)").all().some(c=>c.name==="names")) db.exec("ALTER TABLE player_formations ADD COLUMN names TEXT NOT NULL DEFAULT '{}' ");
    db.exec("CREATE TABLE IF NOT EXISTS alien_rewards (user_id INTEGER PRIMARY KEY REFERENCES users(id), victories INTEGER NOT NULL DEFAULT 0, knight_level INTEGER NOT NULL DEFAULT 1)");
    const alienRewardColumns=db.prepare("PRAGMA table_info(alien_rewards)").all().map(c=>c.name);
    if(!alienRewardColumns.includes("prestige"))db.exec("ALTER TABLE alien_rewards ADD COLUMN prestige INTEGER NOT NULL DEFAULT 0");
    if(!alienRewardColumns.includes("bonus_missions"))db.exec("ALTER TABLE alien_rewards ADD COLUMN bonus_missions INTEGER NOT NULL DEFAULT 0");
    db.exec("UPDATE alien_rewards SET prestige=victories WHERE prestige=0 AND victories>0");
    db.exec("CREATE TABLE IF NOT EXISTS mothership_events (id INTEGER PRIMARY KEY AUTOINCREMENT, week_start INTEGER NOT NULL UNIQUE, starts_at INTEGER NOT NULL, ends_at INTEGER NOT NULL, hp_remaining INTEGER NOT NULL, rewards_distributed INTEGER NOT NULL DEFAULT 0)");
    db.exec("CREATE TABLE IF NOT EXISTS mothership_attacks (id INTEGER PRIMARY KEY AUTOINCREMENT, event_id INTEGER NOT NULL REFERENCES mothership_events(id), user_id INTEGER NOT NULL REFERENCES users(id), army TEXT NOT NULL, formation TEXT NOT NULL, origin_x INTEGER NOT NULL, origin_y INTEGER NOT NULL, knight_level INTEGER NOT NULL DEFAULT 1, launched_at INTEGER NOT NULL, arrives_at INTEGER NOT NULL, resolved_at INTEGER, damage INTEGER NOT NULL DEFAULT 0, xp INTEGER NOT NULL DEFAULT 0)");
    if(!db.prepare("PRAGMA table_info(mothership_attacks)").all().some(c=>c.name==="knight_level"))db.exec("ALTER TABLE mothership_attacks ADD COLUMN knight_level INTEGER NOT NULL DEFAULT 1");
    db.exec("CREATE INDEX IF NOT EXISTS mothership_attacks_event ON mothership_attacks(event_id,id)");
    db.exec("CREATE TABLE IF NOT EXISTS mothership_hospital (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL REFERENCES users(id), event_id INTEGER NOT NULL REFERENCES mothership_events(id), wounded TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'waiting', healing_cost TEXT NOT NULL, created_at INTEGER NOT NULL, heals_at INTEGER)");
    db.exec("CREATE TABLE IF NOT EXISTS hospital_entries (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL REFERENCES users(id), source TEXT NOT NULL, source_id INTEGER NOT NULL, wounded TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'waiting', healing_cost TEXT NOT NULL DEFAULT '{}', created_at INTEGER NOT NULL, heals_at INTEGER, recovered_at INTEGER)");
    db.exec("CREATE INDEX IF NOT EXISTS hospital_entries_user_status ON hospital_entries(user_id,status,created_at)");
    db.exec("CREATE INDEX IF NOT EXISTS hospital_entries_event ON hospital_entries(source,source_id,status)");
    db.exec("CREATE TABLE IF NOT EXISTS saturday_invasion_seasons (week_start INTEGER PRIMARY KEY, ends_at INTEGER NOT NULL, settled INTEGER NOT NULL DEFAULT 0)");
    db.exec("CREATE TABLE IF NOT EXISTS saturday_invasion_runs (id INTEGER PRIMARY KEY AUTOINCREMENT, week_start INTEGER NOT NULL REFERENCES saturday_invasion_seasons(week_start), alliance_id INTEGER NOT NULL REFERENCES alliances(id), started_by INTEGER NOT NULL REFERENCES users(id), status TEXT NOT NULL DEFAULT 'active', started_at INTEGER NOT NULL, completed_at INTEGER, UNIQUE(week_start,alliance_id))");
    db.exec("CREATE TABLE IF NOT EXISTS saturday_invasion_members (run_id INTEGER NOT NULL REFERENCES saturday_invasion_runs(id), user_id INTEGER NOT NULL REFERENCES users(id), score INTEGER NOT NULL DEFAULT 0, waves INTEGER NOT NULL DEFAULT 0, eliminated INTEGER NOT NULL DEFAULT 0, next_attack_at INTEGER NOT NULL, last_battle TEXT, PRIMARY KEY(run_id,user_id))");
    db.exec("CREATE INDEX IF NOT EXISTS saturday_invasion_members_due ON saturday_invasion_members(run_id,eliminated,next_attack_at)");
    db.exec("CREATE INDEX IF NOT EXISTS saturday_invasion_runs_week ON saturday_invasion_runs(week_start,status)");
    db.exec("CREATE TABLE IF NOT EXISTS labyrinth_players (user_id INTEGER PRIMARY KEY REFERENCES users(id), mission_day TEXT NOT NULL, missions_today INTEGER NOT NULL DEFAULT 0, crystal_mission INTEGER NOT NULL DEFAULT 0, last_mission_at INTEGER NOT NULL DEFAULT 0, crystals TEXT NOT NULL DEFAULT '{\"yellow\":0,\"blue\":0,\"orange\":0,\"purple\":0}', maze TEXT NOT NULL, current_room TEXT NOT NULL, visited TEXT NOT NULL DEFAULT '[]', rooms_opened INTEGER NOT NULL DEFAULT 1, deepest_depth INTEGER NOT NULL DEFAULT 0, total_moves INTEGER NOT NULL DEFAULT 0, medicine_found INTEGER NOT NULL DEFAULT 0, completed_at INTEGER)");
    db.exec("CREATE INDEX IF NOT EXISTS labyrinth_rank ON labyrinth_players(medicine_found,deepest_depth,rooms_opened,total_moves)");

    db.exec("CREATE TABLE IF NOT EXISTS alien_side_quests (user_id INTEGER NOT NULL REFERENCES users(id), milestone INTEGER NOT NULL, PRIMARY KEY(user_id,milestone))");
    db.exec(`CREATE TABLE IF NOT EXISTS scout_missions (
      id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id), level INTEGER NOT NULL,
      quantity INTEGER NOT NULL, origin TEXT NOT NULL, target TEXT NOT NULL, launched_at INTEGER NOT NULL,
      arrives_at INTEGER NOT NULL, returns_at INTEGER NOT NULL, report TEXT, returned_at INTEGER
    );
    CREATE INDEX IF NOT EXISTS scout_missions_user ON scout_missions(user_id,id);`);
    db.exec("CREATE TABLE IF NOT EXISTS alien_recon (user_id INTEGER NOT NULL REFERENCES users(id), level INTEGER NOT NULL, scouted_at INTEGER NOT NULL, PRIMARY KEY(user_id,level))");
    db.exec("CREATE TABLE IF NOT EXISTS player_talents (user_id INTEGER PRIMARY KEY REFERENCES users(id), xp INTEGER NOT NULL DEFAULT 0, talents TEXT NOT NULL DEFAULT '{}')");
    db.exec("CREATE TABLE IF NOT EXISTS player_tokens (user_id INTEGER PRIMARY KEY REFERENCES users(id), balance INTEGER NOT NULL DEFAULT 0, last_free_spin INTEGER NOT NULL DEFAULT 0)");
    db.exec("CREATE TABLE IF NOT EXISTS wheel_spins (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL REFERENCES users(id), spun_at INTEGER NOT NULL, reward_id INTEGER NOT NULL, free INTEGER NOT NULL)");
    db.exec("CREATE TABLE IF NOT EXISTS ranking_points (user_id INTEGER PRIMARY KEY REFERENCES users(id), construction_points INTEGER NOT NULL DEFAULT 0)");
    db.exec("CREATE TABLE IF NOT EXISTS alliances (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL UNIQUE, leader_id INTEGER NOT NULL REFERENCES users(id))");
    if (!db.prepare("PRAGMA table_info(alliances)").all().some(column => column.name === "description")) db.exec("ALTER TABLE alliances ADD COLUMN description TEXT NOT NULL DEFAULT ''");
    db.exec("CREATE TABLE IF NOT EXISTS alliance_members (user_id INTEGER PRIMARY KEY REFERENCES users(id), alliance_id INTEGER NOT NULL REFERENCES alliances(id))");
    db.exec("CREATE TABLE IF NOT EXISTS player_green_crystals (user_id INTEGER PRIMARY KEY REFERENCES users(id), balance INTEGER NOT NULL DEFAULT 0, total_earned INTEGER NOT NULL DEFAULT 0)");
    db.exec("CREATE TABLE IF NOT EXISTS player_red_crystals (user_id INTEGER PRIMARY KEY REFERENCES users(id), balance INTEGER NOT NULL DEFAULT 0, total_earned INTEGER NOT NULL DEFAULT 0)");
    db.exec("CREATE TABLE IF NOT EXISTS alliance_crystal_bank (alliance_id INTEGER PRIMARY KEY REFERENCES alliances(id), green_balance INTEGER NOT NULL DEFAULT 0, red_balance INTEGER NOT NULL DEFAULT 0)");
    db.exec("CREATE TABLE IF NOT EXISTS alliance_space_stations (station_id INTEGER PRIMARY KEY CHECK(station_id BETWEEN 1 AND 4), alliance_id INTEGER NOT NULL UNIQUE REFERENCES alliances(id), unlocked_at INTEGER NOT NULL)");
    const stationColumns=db.prepare("PRAGMA table_info(alliance_space_stations)").all().map(column=>column.name);
    if(!stationColumns.includes("protection_until"))db.exec("ALTER TABLE alliance_space_stations ADD COLUMN protection_until INTEGER NOT NULL DEFAULT 0");
    if(!stationColumns.includes("plasma_wall_status"))db.exec("ALTER TABLE alliance_space_stations ADD COLUMN plasma_wall_status TEXT NOT NULL DEFAULT 'not_started'");
    if(!stationColumns.includes("plasma_wall_started_at"))db.exec("ALTER TABLE alliance_space_stations ADD COLUMN plasma_wall_started_at INTEGER");
    if(!stationColumns.includes("plasma_wall_level")){db.exec("ALTER TABLE alliance_space_stations ADD COLUMN plasma_wall_level INTEGER NOT NULL DEFAULT 0");db.exec("UPDATE alliance_space_stations SET plasma_wall_level=1,plasma_wall_status='not_started' WHERE plasma_wall_status='built'");}
    if(!stationColumns.includes("spaceport_status"))db.exec("ALTER TABLE alliance_space_stations ADD COLUMN spaceport_status TEXT NOT NULL DEFAULT 'not_started'");
    if(!stationColumns.includes("spaceport_started_at"))db.exec("ALTER TABLE alliance_space_stations ADD COLUMN spaceport_started_at INTEGER");
    db.exec("CREATE TABLE IF NOT EXISTS alliance_station_defenders (station_id INTEGER NOT NULL REFERENCES alliance_space_stations(station_id), alliance_id INTEGER NOT NULL REFERENCES alliances(id), user_id INTEGER NOT NULL REFERENCES users(id), army TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'travelling', sent_at INTEGER NOT NULL, arrives_at INTEGER NOT NULL, PRIMARY KEY(station_id,user_id))");
    db.exec("CREATE INDEX IF NOT EXISTS station_defenders_user ON alliance_station_defenders(user_id,status)");
    db.exec(`CREATE TABLE IF NOT EXISTS player_messages (
      id INTEGER PRIMARY KEY, sender_id INTEGER NOT NULL REFERENCES users(id),
      recipient_id INTEGER REFERENCES users(id), alliance_id INTEGER REFERENCES alliances(id),
      body TEXT NOT NULL, sent_at INTEGER NOT NULL, message_type TEXT NOT NULL DEFAULT 'private',
      CHECK ((recipient_id IS NULL) != (alliance_id IS NULL)));
      CREATE INDEX IF NOT EXISTS messages_sender ON player_messages(sender_id,id);
      CREATE INDEX IF NOT EXISTS messages_recipient ON player_messages(recipient_id,id);
      CREATE INDEX IF NOT EXISTS messages_alliance ON player_messages(alliance_id,id);`);
    db.exec("CREATE TABLE IF NOT EXISTS trade_message_notifications (trade_id INTEGER PRIMARY KEY REFERENCES interbase_trades(id), message_id INTEGER NOT NULL REFERENCES player_messages(id))");
    const messageColumns=db.prepare("PRAGMA table_info(player_messages)").all().map(column=>column.name);
    if(!messageColumns.includes("message_type"))db.exec("ALTER TABLE player_messages ADD COLUMN message_type TEXT NOT NULL DEFAULT 'private'");
    db.exec("UPDATE player_messages SET message_type='trade' WHERE id IN (SELECT message_id FROM trade_message_notifications) OR body LIKE 'Marketplace offer #% accepted by%' OR body LIKE 'Marketplace purchase completed from%'");
    db.exec("CREATE TABLE IF NOT EXISTS alliance_invitations (user_id INTEGER NOT NULL REFERENCES users(id), alliance_id INTEGER NOT NULL REFERENCES alliances(id), PRIMARY KEY(user_id, alliance_id))");
    db.exec("CREATE TABLE IF NOT EXISTS alliance_applications (user_id INTEGER NOT NULL REFERENCES users(id), alliance_id INTEGER NOT NULL REFERENCES alliances(id), applied_at INTEGER NOT NULL, PRIMARY KEY(user_id,alliance_id))");
    try { db.exec("ALTER TABLE alliance_members ADD COLUMN role TEXT NOT NULL DEFAULT 'Member'"); } catch(e) { if(!String(e.message).includes("duplicate column"))throw e; }
    db.exec("CREATE TABLE IF NOT EXISTS alliance_help (id INTEGER PRIMARY KEY AUTOINCREMENT, requester_id INTEGER NOT NULL REFERENCES users(id), alliance_id INTEGER NOT NULL REFERENCES alliances(id), building_name TEXT NOT NULL, building_level INTEGER NOT NULL, requested_at INTEGER NOT NULL, job_ends_at INTEGER NOT NULL)");
    if (!db.prepare("PRAGMA table_info(alliance_help)").all().some(c=>c.name==="job_key")) db.exec("ALTER TABLE alliance_help ADD COLUMN job_key TEXT");
    db.exec("CREATE TABLE IF NOT EXISTS alliance_help_clicks (request_id INTEGER NOT NULL REFERENCES alliance_help(id), helper_id INTEGER NOT NULL REFERENCES users(id), PRIMARY KEY(request_id,helper_id))");
    const missingTradeMessages=db.prepare(`SELECT t.id,t.sender_id,t.recipient_id,t.resources,t.traded_at,s.username AS sender_name
      FROM interbase_trades t JOIN users s ON s.id=t.sender_id
      LEFT JOIN trade_message_notifications n ON n.trade_id=t.id WHERE n.trade_id IS NULL ORDER BY t.id`).all();
    for(const trade of missingTradeMessages){
      writeTradeNotification(trade.id,trade.sender_id,trade.recipient_id,trade.sender_name,JSON.parse(trade.resources),trade.traded_at);
    }
    db.exec("CREATE TABLE IF NOT EXISTS alliance_reinforcements (id INTEGER PRIMARY KEY AUTOINCREMENT, alliance_id INTEGER NOT NULL REFERENCES alliances(id), sender_id INTEGER NOT NULL REFERENCES users(id), recipient_id INTEGER NOT NULL REFERENCES users(id), units TEXT NOT NULL, launched_at INTEGER NOT NULL, arrives_at INTEGER NOT NULL, recall_at INTEGER, returned_at INTEGER)");
    db.exec("CREATE TABLE IF NOT EXISTS alliance_treasury (alliance_id INTEGER PRIMARY KEY REFERENCES alliances(id), resources TEXT NOT NULL DEFAULT '{}', bonuses TEXT NOT NULL DEFAULT '{}')");
    db.exec(`CREATE TABLE IF NOT EXISTS alliance_research_jobs (
      alliance_id INTEGER PRIMARY KEY REFERENCES alliances(id) ON DELETE CASCADE,
      kind TEXT NOT NULL, level INTEGER NOT NULL, ends_at INTEGER NOT NULL
    )`);
    db.exec("CREATE TABLE IF NOT EXISTS alliance_wallets (user_id INTEGER PRIMARY KEY REFERENCES users(id), points INTEGER NOT NULL DEFAULT 0, donations_today INTEGER NOT NULL DEFAULT 0, donation_date TEXT NOT NULL DEFAULT '')");
    db.exec("CREATE TABLE IF NOT EXISTS alliance_market_buffs (user_id INTEGER NOT NULL REFERENCES users(id), kind TEXT NOT NULL, expires_at INTEGER NOT NULL, PRIMARY KEY(user_id,kind))");
    db.exec("CREATE TABLE IF NOT EXISTS alliance_help_history (id INTEGER PRIMARY KEY AUTOINCREMENT, alliance_id INTEGER NOT NULL REFERENCES alliances(id), requester_id INTEGER NOT NULL REFERENCES users(id), helper_id INTEGER NOT NULL REFERENCES users(id), building_name TEXT NOT NULL, building_level INTEGER NOT NULL, reduction_ms INTEGER NOT NULL, helped_at INTEGER NOT NULL)");
    db.transaction(()=>db.prepare("SELECT id FROM alliances WHERE NOT EXISTS (SELECT 1 FROM alliance_members WHERE alliance_id=alliances.id)").all().forEach(row=>disbandEmptyAlliance(row.id)))();
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

  syncGame(userId, now = Date.now()) {
    return db.transaction(() => {
      const allianceBonuses = this.activeAllianceBonuses(userId);
      const row = this.progressQueries.getProgress.get(userId);
      if (!row) return null;
      const state = this.runtime(userId);
      const resources = JSON.parse(row.resources);
      const structures = JSON.parse(row.structures);
      const army = JSON.parse(state.army);
      this.settleScoutMissions(userId, now, army);
      const barracksReserve = JSON.parse(state.barracks_reserve || "{}");
      const upgradeJobs=JSON.parse(state.upgrade_jobs || "[]");
      const unitUpgrades=JSON.parse(state.unit_upgrades);
      let buildingJob = state.building_job ? JSON.parse(state.building_job) : null;
      let trainingJob = state.training_job ? JSON.parse(state.training_job) : null;
      const trainingQueues = JSON.parse(state.training_queues || "{}");
      const {categories:trainingCategories}=require("../src/shared/unitEconomy");
      const categoryForUnit=unit=>Object.keys(trainingCategories).find(cat=>trainingCategories[cat].includes(unit));
      // Preserve existing pre-upgrade training without duplicating or discarding it.
      if(trainingJob){const category=categoryForUnit(trainingJob.unit);if(category){trainingQueues[category]=[trainingJob,...(trainingQueues[category]||[])];trainingJob=null;}}
      let queuedBuildingJob = state.queued_building_job ? JSON.parse(state.queued_building_job) : null;
      let changed = false;
      // Resource production is calculated from server time, including while logged out.
      const elapsedTicks = Math.floor(Math.max(0, now - state.production_at) / 10000);
      const economyBonus = this.protocolBonus(userId, "Resource Management") / 100;
      const miningBonus = this.protocolBonus(userId, "Mining Operations") / 100;
      const productionCarry = JSON.parse(state.production_carry || "{}");
      const productionMultiplier = (1 + economyBonus) * (1 + miningBonus) * (1 + allianceBonuses.growth / 100);
      const rates = { Gold: "Gold Synthesizer", Iron: "Iron Driller", Water: "Water Extractor", Solar: "Solar Array" };
      for (const [resource, name] of Object.entries(rates)) {
        const level = Number(structures[name] || 0);
        if (level > 0 && elapsedTicks > 0) {
          // Preserve sub-unit production between 10-second ticks; otherwise frequent polling
          // silently discards most of the Resource Management protocol bonus.
          const produced = level * elapsedTicks * productionMultiplier + (Number(productionCarry[resource]) || 0);
          const whole = Math.floor(produced + 1e-9);
          productionCarry[resource] = Math.max(0, Math.round((produced - whole) * 1000000) / 1000000);
          resources[resource] = (Number(resources[resource]) || 0) + whole;
          changed = true;
        }
      }
      while (buildingJob && buildingJob.endsAt <= now) {
        structures[buildingJob.name] = buildingJob.level;
        const finishedAt = buildingJob.endsAt;
        buildingJob = queuedBuildingJob
          ? {...queuedBuildingJob, startedAt: finishedAt, endsAt: finishedAt + queuedBuildingJob.duration}
          : null;
        queuedBuildingJob = null;
        changed = true;
      }
      for(const category of Object.keys(trainingCategories)){
        const queue=trainingQueues[category]||[];
        // Process every completed job, including when the player was offline.
        while(queue.length&&queue[0].endsAt<=now){
          const done=queue.shift();
          barracksReserve[done.unit]=(Number(barracksReserve[done.unit])||0)+done.quantity;
          changed=true;
        }
        trainingQueues[category]=queue;
      }
      let [activeUpgrade, queuedUpgrade] = upgradeJobs;
      // Previously both slots could run independently. Honor their existing deadlines.
      if (queuedUpgrade?.endsAt != null && queuedUpgrade.endsAt <= now &&
          (!activeUpgrade || queuedUpgrade.endsAt < activeUpgrade.endsAt)) {
        const previousActive = activeUpgrade;
        activeUpgrade = queuedUpgrade;
        queuedUpgrade = previousActive;
      }
      if (!activeUpgrade && queuedUpgrade) {
        activeUpgrade = queuedUpgrade;
        queuedUpgrade = null;
      }
      while (activeUpgrade && activeUpgrade.endsAt <= now) {
        const { unit, stat, level, completionXp, endsAt } = activeUpgrade;
        const stats = unitUpgrades[unit] || {attack:1,defense:1};
        stats[stat] = Math.max(Number(stats[stat] || 1), level);
        unitUpgrades[unit] = stats;
        this.awardPlayerXp(userId, completionXp);
        activeUpgrade = queuedUpgrade;
        queuedUpgrade = null;
        if (activeUpgrade && activeUpgrade.endsAt == null) {
          activeUpgrade.endsAt = endsAt + activeUpgrade.durationMs;
        }
        changed = true;
      }
      upgradeJobs[0] = activeUpgrade || null;
      upgradeJobs[1] = queuedUpgrade || null;
      db.prepare("UPDATE game_runtime SET production_at=?, production_carry=?, building_job=?, queued_building_job=?, training_job=?, army=?, barracks_reserve=?, training_queues=?, upgrade_jobs=?, unit_upgrades=? WHERE user_id=?")
        .run(state.production_at + elapsedTicks * 10000, JSON.stringify(productionCarry), buildingJob ? JSON.stringify(buildingJob) : null, queuedBuildingJob ? JSON.stringify(queuedBuildingJob) : null, trainingJob ? JSON.stringify(trainingJob) : null, JSON.stringify(army), JSON.stringify(barracksReserve), JSON.stringify(trainingQueues),JSON.stringify(upgradeJobs),JSON.stringify(unitUpgrades), userId);
      if (changed) db.prepare("UPDATE game_progress SET resources=?, structures=?, last_saved=CURRENT_TIMESTAMP WHERE id=?")
        .run(JSON.stringify(resources), JSON.stringify(structures), row.id);
      return {
        castle: JSON.parse(row.castle_data), resources, structures, army,
        buildingJob, queuedBuildingJob, trainingJob, trainingQueues, barracksReserve, upgradeJobs, unitUpgrades,
        questClaimed: !!state.quest_claimed, quest2Claimed: !!state.quest2_claimed,
        allianceBonuses,
        productionPerHour: Object.fromEntries(Object.entries(rates).map(([key, name]) => [key, Number(structures[name] || 0) * productionMultiplier * 360])),
        productionRates: Object.fromEntries(Object.entries(rates).map(([key,name]) => [key, Math.round(Number(structures[name] || 0) * productionMultiplier * 10) / 100])),
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
      const cost = buildingPrice(name, level + 1, current.allianceBonuses.discount);
      if (Object.keys(cost).some(key => current.resources[key] < cost[key])) return { error: "Not enough resources." };
      for (const key of Object.keys(cost)) current.resources[key] -= cost[key];
      const duration = allianceUpgradeDuration(15000 * (level + 1), current.allianceBonuses.speed);
      const startedAt=Date.now();
      const job = { name, level: level + 1, duration, startedAt, endsAt: startedAt + duration };
      if (current.buildingJob) {
        db.prepare("UPDATE game_runtime SET queued_building_job=? WHERE user_id=?").run(JSON.stringify({name,level:level+1,duration}),userId);
      } else {
        db.prepare("UPDATE game_runtime SET building_job=? WHERE user_id=?").run(JSON.stringify(job),userId);
      }
      db.prepare("UPDATE game_progress SET resources=?, last_saved=CURRENT_TIMESTAMP WHERE user_id=?")
        .run(JSON.stringify(current.resources), userId);
      const spent=Object.values(cost).reduce((sum,n)=>sum+Number(n),0);
      db.prepare("INSERT INTO ranking_points(user_id,construction_points) VALUES (?,?) ON CONFLICT(user_id) DO UPDATE SET construction_points=construction_points+excluded.construction_points").run(userId,spent);
      this.awardPlayerXp(userId,spent);
      return { ...current, resources: current.resources, buildingJob: current.buildingJob || job, queuedBuildingJob: current.buildingJob ? {name,level:level+1,duration} : null };
    })();
  }

  trainUnits(userId, unit, quantity) {
    if (!unitPrice(unit) || !Number.isInteger(quantity) || quantity < 1 || quantity > 10000)
      return { error: "Invalid unit or quantity." };
    return db.transaction(() => {
      const current = this.syncGame(userId);
      if (!current) return { error: "Player progress not found." };
      const {categories}=require("../src/shared/unitEconomy");
      const category=Object.keys(categories).find(key=>categories[key].includes(unit));
      if(!category)return {error:"Unknown troop category."};
      const queue=current.trainingQueues[category]||[];
      if(queue.length>=5)return {error:"This category has five training groups queued."};
      const requirement = unitRequirement(unit);
      if (Number(current.structures[requirement.building] || 0) < requirement.level) return {error: `Requires ${requirement.building} level ${requirement.level}.`};
      const cost = Object.fromEntries(Object.entries(unitPrice(unit)).map(([resource,value])=>[resource,value*quantity]));
      if (Object.keys(cost).some(key => current.resources[key] < cost[key])) return { error: "Not enough resources." };
      for (const key of Object.keys(cost)) current.resources[key] -= cost[key];
      const trainingBonus = this.protocolBonus(userId, "Accelerated Training") / 100;
      const duration=Math.max(1000,Math.ceil(quantity*unitTrainingDuration(unit)*1000*(1-trainingBonus)));
      const startsAt=Math.max(Date.now(),queue.length?queue[queue.length-1].endsAt:0);
      const job={unit,quantity,startsAt,endsAt:startsAt+duration};
      const trainingQueues={...current.trainingQueues,[category]:[...queue,job]};
      db.prepare("UPDATE game_runtime SET training_queues=? WHERE user_id=?").run(JSON.stringify(trainingQueues),userId);
      db.prepare("UPDATE game_progress SET resources=?, last_saved=CURRENT_TIMESTAMP WHERE user_id=?")
        .run(JSON.stringify(current.resources), userId);
      return { ...current, trainingQueues };
    })();
  }

  mobilizeBarracks(userId,unit,amount) {
    if(typeof unit!=="string" || (unit!=="ALL"&&!unitPrice(unit)))return {error:"Invalid unit."};
    return db.transaction(()=>{
      const current=this.syncGame(userId);
      if(!current)return {error:"Player not found."};
      const reserve={...current.barracksReserve};
      const units=unit==="ALL"?Object.keys(reserve):[unit];
      if(unit!=="ALL"&&(!Number.isSafeInteger(amount)||amount<1||amount>Number(reserve[unit]||0)))return {error:"Invalid mobilization quantity."};
      let trainingXp=0;
      for(const name of units){
        const n=unit==="ALL"?Number(reserve[name]||0):amount;
        if(!Number.isSafeInteger(n)||n<0)return {error:"Invalid reserve quantity."};
        current.army[name]=(Number(current.army[name])||0)+n;
        reserve[name]=(Number(reserve[name])||0)-n;
        const unitCost=Object.values(unitPrice(name)||{}).reduce((total,cost)=>total+cost,0);
        trainingXp+=3*n*unitCost;
      }
      db.prepare("UPDATE game_runtime SET army=?,barracks_reserve=? WHERE user_id=?").run(JSON.stringify(current.army),JSON.stringify(reserve),userId);
      this.awardPlayerXp(userId,trainingXp);
      return {...current,barracksReserve:reserve};
    })();
  }

  upgradeUnit(userId,unit,stat,slot){
    const {categories,upgradeDuration,unitUpgradeDetails}=require("../src/shared/unitEconomy");
    if(!Object.values(categories).some(group=>group.includes(unit))||!["attack","defense"].includes(stat)||![0,1].includes(slot))return {error:"Invalid upgrade selection."};
    return db.transaction(()=>{
      const current=this.syncGame(userId);
      if(!current)return {error:"Player not found."};
      const jobs=[...current.upgradeJobs];
      const nextSlot = jobs[0] ? 1 : 0;
      if(jobs[nextSlot])return {error:"This upgrade slot is occupied."};
      if(jobs.some(j=>j&&j.unit===unit&&j.stat===stat))return {error:"This unit stat is already upgrading."};
      const level=Number(current.unitUpgrades[unit]?.[stat]||1);
      const specific=unitUpgradeDetails(unit,stat,level,current.allianceBonuses.discount,current.allianceBonuses.speed);
      if(level>=(specific?.maxLevel||20))return {error:"Maximum upgrade level."};
      const price=specific?.cost||upgradePrice(level,current.allianceBonuses.discount);
      if(Object.entries(price).some(([resource,n])=>Number(current.resources[resource]||0)<n))return {error:"Not enough resources."};
      for(const [resource,n] of Object.entries(price))current.resources[resource]-=n;
      const completionXp=2*Object.values(price).reduce((total,cost)=>total+cost,0);
      const durationMs = specific?.durationMs||upgradeDuration(level,current.allianceBonuses.speed);
      const job = {unit,stat,level:level+1,completionXp,durationMs};
      if (nextSlot === 0) job.endsAt = Date.now() + durationMs;
      jobs[nextSlot] = job;
      db.prepare("UPDATE game_runtime SET upgrade_jobs=? WHERE user_id=?").run(JSON.stringify(jobs),userId);
      db.prepare("UPDATE game_progress SET resources=?,last_saved=CURRENT_TIMESTAMP WHERE user_id=?").run(JSON.stringify(current.resources),userId);
      return {...current,upgradeJobs:jobs};
    })();
  }

  claimFirstQuest(userId) {
    return db.transaction(() => {
      const current = this.syncGame(userId);
      if (!current) return { error: "Player progress not found." };
      if (current.questClaimed) return { error: "Reward already claimed." };
      if (!["Gold Synthesizer", "Iron Driller", "Water Extractor", "Solar Array"].every(name => Number(current.structures[name] || 0) >= 3))
        return { error: "Quest is not complete." };
      for (const key of ["Gold", "Iron", "Water", "Solar"]) this.addInventoryReward(userId,"resources",key,3000);
      db.prepare("UPDATE game_runtime SET quest_claimed=1 WHERE user_id=?").run(userId);
      this.creditTokens(userId,100);
      return { ...current, questClaimed: true, inventory: this.getInventory(userId) };
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
      for (const key of ["Gold", "Iron", "Water", "Solar"]) this.addInventoryReward(userId,"resources",key,5000);
      db.prepare("UPDATE game_runtime SET quest2_claimed=1 WHERE user_id=?").run(userId);
      this.creditTokens(userId,100);
      return { ...current, quest2Claimed: true, inventory: this.getInventory(userId) };
    })();
  }

  protocolBonus(userId,name){
    const row=db.prepare("SELECT talents FROM player_talents WHERE user_id=?").get(userId);
    if(!row)return 0;
    const tier=Math.max(0,Math.min(3,Number(JSON.parse(row.talents||"{}")[name])||0));
    const protocol=this.talentCatalog().find(item=>item.name===name);
    return tier&&protocol?protocol.values[tier-1]:0;
  }
  talentCatalog(){
    return [
      ["Rapid Deployment",[15,35,60],"% army speed"],["Resource Management",[10,25,45],"% economy"],
      ["Mining Operations",[20,50,100],"% mine production"],["Precision Fire",[15,35,60],"% ranged attack"],
      ["Reinforced Armor",[10,25,45],"% unit HP"],["Infantry Command",[10,25,40],"% infantry attack and HP"],
      ["Battle Command",[10,20,30],"% army attack (leadership)"],["Advanced Recon",[10,30,50],"% reconnaissance resource discount"],
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
    const spent=Object.values(talents).reduce((sum,t)=>sum+([0,1,3,6][Math.max(0,Math.min(3,Number(t)||0))]||0),0);
    return {level,xp:row.xp,nextLevelXp:level>=40?null:level*1000,skillPoints:Math.max(0,earned-spent),talents,catalog:this.talentCatalog()};
  }
  awardPlayerXp(userId,amount){
    if(!Number.isSafeInteger(amount)||amount<1)return;
    db.prepare("INSERT OR IGNORE INTO player_talents(user_id) VALUES (?)").run(userId);
    const bonus=this.protocolBonus(userId,"Advanced Research")/100;
    db.prepare("UPDATE player_talents SET xp=xp+? WHERE user_id=?").run(Math.max(1,Math.floor(amount*(1+bonus))),userId);
  }
  upgradePlayerTalent(userId,name){
    const activeProtocols = new Set(["Resource Management", "Accelerated Training", "Advanced Research", "Rapid Deployment", "Evasion Protocol", "Combat Recovery", "Precision Fire", "Reinforced Armor", "Infantry Command", "Mobile Warfare", "Heavy Artillery", "Mining Operations", "Battle Command", "Advanced Recon"]);
    if(!this.talentCatalog().some(t=>t.name===name))return {error:"Unknown player protocol."};
    if(!activeProtocols.has(name))return {error:"This protocol is not active yet. Protocol Points have not been spent."};
    return db.transaction(()=>{
      const state=this.playerTalents(userId),tier=state.talents[name]||0;
      if(tier>=3)return {error:"Protocol already at Elite."};
      if(state.skillPoints<tier+1)return {error:"Not enough Protocol Points."};
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

  listMessages(userId, scope){
    if(!["private","trade","alliance"].includes(scope))return {error:"Unknown message channel."};
    const member=scope==="alliance" && db.prepare("SELECT alliance_id FROM alliance_members WHERE user_id=?").get(userId);
    if(scope==="alliance"&&!member)return {error:"Join an alliance to view its chat."};
    const filter=scope==="alliance" ? "m.alliance_id=?" : "(m.recipient_id=? OR (m.sender_id=? AND m.recipient_id IS NOT NULL)) AND m.message_type=?";
    const params=scope==="alliance" ? [member.alliance_id] : [userId,userId,scope];
    const messages=db.prepare(`SELECT m.id,m.body,m.sent_at AS sentAt,m.sender_id AS senderId,m.recipient_id AS recipientId,
      sender.username AS sender,recipient.username AS recipient FROM player_messages m
      JOIN users sender ON sender.id=m.sender_id LEFT JOIN users recipient ON recipient.id=m.recipient_id
      WHERE ${filter} ORDER BY m.id DESC LIMIT 50`).all(...params);
    return {messages};
  }

  sendMessage(userId, scope, recipient, body){
    if(!["private","alliance"].includes(scope))return {error:"Unknown message channel."};
    const content=typeof body==="string" ? body.trim() : "";
    if(!content || content.length>500)return {error:"Enter a message between 1 and 500 characters."};
    return db.transaction(()=>{
      const now=Date.now();
      const latest=db.prepare("SELECT sent_at FROM player_messages WHERE sender_id=? ORDER BY id DESC LIMIT 1").get(userId);
      if(latest && now-latest.sent_at<1000)return {error:"Wait a moment before sending another message."};
      const member=scope==="alliance" && db.prepare("SELECT alliance_id FROM alliance_members WHERE user_id=?").get(userId);
      if(scope==="alliance"&&!member)return {error:"Join an alliance to use its chat."};
      const target=scope==="private" && typeof recipient==="string" && this.findUserByUsername(recipient.trim());
      if(scope==="private"&&(!target||target.id===userId))return {error:"Choose another existing player."};
      db.prepare("INSERT INTO player_messages(sender_id,recipient_id,alliance_id,body,sent_at,message_type) VALUES (?,?,?,?,?,?)")
        .run(userId,target?.id||null,member?.alliance_id||null,content,now,scope);
      return {message:"Message sent."};
    })();
  }

  rankings(userId){
    const players=db.prepare("SELECT u.id,u.username,COALESCE(a.name,'') AS alliance,COALESCE(r.xp,0) AS points,COALESCE(p.avatar_id,'pilot-m') AS avatarId FROM users u LEFT JOIN alliance_members m ON m.user_id=u.id LEFT JOIN alliances a ON a.id=m.alliance_id LEFT JOIN player_talents r ON r.user_id=u.id LEFT JOIN player_profiles p ON p.user_id=u.id ORDER BY points DESC,u.username COLLATE NOCASE").all();
    const alliances=db.prepare("SELECT a.id,a.name,a.description,u.username AS leader,COUNT(m.user_id) AS memberCount,COALESCE(SUM(r.xp),0) AS points FROM alliances a JOIN users u ON u.id=a.leader_id LEFT JOIN alliance_members m ON m.alliance_id=a.id LEFT JOIN player_talents r ON r.user_id=m.user_id GROUP BY a.id ORDER BY points DESC,memberCount DESC,a.name COLLATE NOCASE").all();
    const member=db.prepare("SELECT alliance_id,role FROM alliance_members WHERE user_id=?").get(userId);
    const pending=new Set(db.prepare("SELECT alliance_id FROM alliance_applications WHERE user_id=?").all(userId).map(a=>a.alliance_id));
    return {players,canInvite:["Leader","Co-Leader"].includes(member?.role),alliances:alliances.map(a=>({...a,pending:pending.has(a.id),joined:!!member}))};
  }
  inviteToAlliance(userId, targetId){
    if(!Number.isSafeInteger(targetId)||targetId<1||targetId===userId)return {error:"Invalid player."};
    return db.transaction(()=>{
      const officer=db.prepare("SELECT alliance_id,role FROM alliance_members WHERE user_id=?").get(userId);
      if(!officer||!["Leader","Co-Leader"].includes(officer.role))return {error:"You do not have permission to invite players."};
      if(!this.findUserById(targetId))return {error:"Player not found."};
      if(db.prepare("SELECT 1 FROM alliance_members WHERE user_id=?").get(targetId))return {error:"That player already belongs to an alliance."};
      const sent=db.prepare("INSERT OR IGNORE INTO alliance_invitations(user_id,alliance_id) VALUES (?,?)").run(targetId,officer.alliance_id);
      return {message:sent.changes?"Invitation sent.":"Invitation already pending."};
    })();
  }
  respondToAllianceInvite(userId, allianceId, accept){
    if(!Number.isSafeInteger(allianceId)||allianceId<1||typeof accept!=="boolean")return {error:"Invalid invitation response."};
    return db.transaction(()=>{
      const invite=db.prepare("SELECT 1 FROM alliance_invitations WHERE user_id=? AND alliance_id=?").get(userId,allianceId);
      if(!invite)return {error:"Invitation is no longer available."};
      if(accept){
        if(db.prepare("SELECT 1 FROM alliance_members WHERE user_id=?").get(userId))return {error:"Leave your current alliance first."};
        this.syncGame(userId);
        db.prepare("INSERT INTO alliance_members(user_id,alliance_id,role) VALUES (?,?,'Member')").run(userId,allianceId);
        db.prepare("DELETE FROM alliance_applications WHERE user_id=?").run(userId);
      }
      db.prepare("DELETE FROM alliance_invitations WHERE user_id=? AND (alliance_id=? OR ?)").run(userId,allianceId,Number(accept));
      return {message:accept?"Invitation accepted.":"Invitation declined."};
    })();
  }
  allianceDirectory(userId){
    const alliances=db.prepare("SELECT a.id,a.name,u.username AS leader,(SELECT COUNT(*) FROM alliance_members m WHERE m.alliance_id=a.id) AS memberCount FROM alliances a JOIN users u ON u.id=a.leader_id ORDER BY memberCount DESC,a.name COLLATE NOCASE").all();
    const pending=db.prepare("SELECT alliance_id FROM alliance_applications WHERE user_id=?").all(userId).map(x=>x.alliance_id);
    return {alliances:alliances.map(a=>({...a,pending:pending.includes(a.id)}))};
  }
  allianceJobKey(job){return job?String(job.startedAt??(job.endsAt-job.duration)):null;}
  allianceRequestMatches(h,job){return !!(job&&job.name===h.building_name&&job.level===h.building_level&&job.endsAt>Date.now()&&String(h.job_key??(h.job_ends_at-(job.duration||0)))===this.allianceJobKey(job));}
  settleAllianceReinforcements(userId){
    const now=Date.now();
    const returning=db.prepare("SELECT id,sender_id,units FROM alliance_reinforcements WHERE sender_id=? AND recall_at IS NOT NULL AND returned_at IS NULL AND recall_at<=?").all(userId,now);
    for(const mission of returning){
      const progress=this.syncGame(mission.sender_id);
      if(!progress)continue;
      for(const [unit,n] of Object.entries(JSON.parse(mission.units)))progress.army[unit]=(Number(progress.army[unit])||0)+n;
      db.prepare("UPDATE game_runtime SET army=? WHERE user_id=?").run(JSON.stringify(progress.army),mission.sender_id);
      db.prepare("UPDATE alliance_reinforcements SET returned_at=? WHERE id=? AND returned_at IS NULL").run(now,mission.id);
    }
  }
  sendAllianceReinforcement(userId,recipientId,units){
    if(!Number.isSafeInteger(recipientId)||recipientId<1||recipientId===userId)return {error:"Choose another alliance member."};
    if(!units||typeof units!=="object"||Array.isArray(units))return {error:"Invalid troop selection."};
    return db.transaction(()=>{
      const members=db.prepare("SELECT user_id,alliance_id FROM alliance_members WHERE user_id IN (?,?)").all(userId,recipientId);
      if(members.length!==2||members[0].alliance_id!==members[1].alliance_id)return {error:"Recipient must be in your alliance."};
      const progress=this.syncGame(userId);
      if(!progress)return {error:"Player not found."};
      const {playerTypes}=require("../shared/combatEngine");
      let total=0;
      for(const [unit,n] of Object.entries(units)){
        if(!playerTypes[unit]||!Number.isSafeInteger(n)||n<1||n>Number(progress.army[unit]||0))return {error:"Invalid troop count."};
        total+=n;
      }
      if(!total)return {error:"Select troops to send."};
      for(const [unit,n] of Object.entries(units))progress.army[unit]-=n;
      db.prepare("UPDATE game_runtime SET army=? WHERE user_id=?").run(JSON.stringify(progress.army),userId);
      const now=Date.now(),travelMs=Math.max(1000,Math.ceil(60000/(1+this.protocolBonus(userId,"Rapid Deployment")/100)));
      const result=db.prepare("INSERT INTO alliance_reinforcements(alliance_id,sender_id,recipient_id,units,launched_at,arrives_at) VALUES (?,?,?,?,?,?)").run(members[0].alliance_id,userId,recipientId,JSON.stringify(units),now,now+travelMs);
      return {missionId:Number(result.lastInsertRowid),arrivesAt:now+travelMs};
    })();
  }
  recallAllianceReinforcement(userId,missionId){
    if(!Number.isSafeInteger(missionId)||missionId<1)return {error:"Invalid reinforcement."};
    return db.transaction(()=>{
      const mission=db.prepare("SELECT * FROM alliance_reinforcements WHERE id=? AND sender_id=? AND recall_at IS NULL AND returned_at IS NULL").get(missionId,userId);
      if(!mission)return {error:"Reinforcement unavailable for recall."};
      const now=Date.now(),travelMs=Math.max(1000,Math.ceil(60000/(1+this.protocolBonus(userId,"Rapid Deployment")/100)));
      db.prepare("UPDATE alliance_reinforcements SET recall_at=? WHERE id=?").run(now+travelMs,missionId);
      return {missionId,returnsAt:now+travelMs};
    })();
  }
  activeAllianceBonuses(userId){
    const membership = db.prepare("SELECT alliance_id FROM alliance_members WHERE user_id=?").get(userId);
    const levels = membership ? this.researchState(membership.alliance_id).bonuses : {};
    return {
      ...Object.fromEntries(["attack","health","growth","speed","discount"].map(kind => [kind, research.bonusPerLevel * (levels[kind] || 0)])),
      units: Object.fromEntries(research.units.map(unit => [unit, {
        attack: research.bonusPerLevel * (levels[research.combatKey("attack", unit)] || 0),
        health: research.bonusPerLevel * (levels[research.combatKey("health", unit)] || 0)
      }]))
    };
  }
  researchState(allianceId) {
    return db.transaction(() => {
      const treasury = db.prepare("SELECT bonuses FROM alliance_treasury WHERE alliance_id=?").get(allianceId);
      const bonuses = treasury ? JSON.parse(treasury.bonuses) : {};
      const job = db.prepare("SELECT kind,level,ends_at AS endsAt FROM alliance_research_jobs WHERE alliance_id=?").get(allianceId);
      if (!job || job.endsAt > Date.now()) return { bonuses, researchJob: job || null };
      db.prepare("DELETE FROM alliance_research_jobs WHERE alliance_id=?").run(allianceId);
      if (job.kind === "growth") {
        const members = db.prepare("SELECT user_id FROM alliance_members WHERE alliance_id=?").all(allianceId);
        for (const member of members) this.syncGame(member.user_id, job.endsAt);
      }
      bonuses[job.kind] = job.level;
      db.prepare("UPDATE alliance_treasury SET bonuses=? WHERE alliance_id=?").run(JSON.stringify(bonuses), allianceId);
      return { bonuses, researchJob: null };
    }).immediate();
  }
  allianceEconomy(userId,allianceId){
    db.prepare("INSERT OR IGNORE INTO alliance_treasury(alliance_id,resources,bonuses) VALUES (?,?,?)").run(allianceId,JSON.stringify({Gold:0,Iron:0,Water:0,Solar:0}),"{}");
    db.prepare("INSERT OR IGNORE INTO alliance_wallets(user_id) VALUES (?)").run(userId);
    const wallet=db.prepare("SELECT points,donations_today,donation_date FROM alliance_wallets WHERE user_id=?").get(userId);
    const today=new Date().toISOString().slice(0,10);
    const treasury=db.prepare("SELECT resources FROM alliance_treasury WHERE alliance_id=?").get(allianceId);
    const buffs=db.prepare("SELECT kind,expires_at FROM alliance_market_buffs WHERE user_id=? AND expires_at>?").all(userId,Date.now());
    return {points:wallet.points,donationsRemaining:20-(wallet.donation_date===today?wallet.donations_today:0),treasury:JSON.parse(treasury.resources),...this.researchState(allianceId),buffs};
  }
  donateAlliance(userId,resource){
    if(!["Gold","Iron","Water","Solar"].includes(resource))return {error:"Invalid donation resource."};
    return db.transaction(()=>{
      const member=db.prepare("SELECT alliance_id FROM alliance_members WHERE user_id=?").get(userId);
      if(!member)return {error:"Join an alliance first."};
      const economy=this.allianceEconomy(userId,member.alliance_id);
      if(economy.donationsRemaining<=0)return {error:"Daily donation limit reached (20)."};
      const amount=100;
      const progress=this.syncGame(userId);
      if(!progress||Number(progress.resources[resource]||0)<amount)return {error:"Not enough resources for donation."};
      progress.resources[resource]-=amount;
      economy.treasury[resource]=(economy.treasury[resource]||0)+amount;
      const today=new Date().toISOString().slice(0,10);
      db.prepare("UPDATE game_progress SET resources=? WHERE user_id=?").run(JSON.stringify(progress.resources),userId);
      db.prepare("UPDATE alliance_treasury SET resources=? WHERE alliance_id=?").run(JSON.stringify(economy.treasury),member.alliance_id);
      db.prepare("UPDATE alliance_wallets SET points=points+10,donations_today=CASE WHEN donation_date=? THEN donations_today+1 ELSE 1 END,donation_date=? WHERE user_id=?").run(today,today,userId);
      return {pointsEarned:10,resource,amount,economy:this.allianceEconomy(userId,member.alliance_id)};
    })();
  }
  upgradeAllianceBonus(userId,kind){
    if (!Object.hasOwn(research.catalog, kind)) return {error:"Unknown alliance bonus."};
    const item = research.catalog[kind];
    return db.transaction(() => {
      const member = db.prepare("SELECT alliance_id,role FROM alliance_members WHERE user_id=?").get(userId);
      if (!member || !["Leader","Co-Leader"].includes(member.role)) return {error:"Alliance leadership required."};
      const economy = this.allianceEconomy(userId, member.alliance_id);
      const level = economy.bonuses[kind] || 0;
      if (economy.researchJob) return {error:"An alliance research is already in progress."};
      if (level >= research.maxLevel) return {error:"Maximum alliance bonus level."};
      if (item.parent && (economy.bonuses[item.parent] || 0) < research.prerequisiteLevel) return {error:"Research prerequisite is locked."};
      const { price, durationMs } = research.nextResearch(item, level);
      if ((economy.treasury[item.resource] || 0) < price) return {error:"Alliance treasury lacks resources."};
      economy.treasury[item.resource] -= price;
      db.prepare("UPDATE alliance_treasury SET resources=? WHERE alliance_id=?").run(JSON.stringify(economy.treasury), member.alliance_id);
      db.prepare("INSERT INTO alliance_research_jobs(alliance_id,kind,level,ends_at) VALUES (?,?,?,?)")
        .run(member.alliance_id, kind, level + 1, Date.now() + durationMs);
      return {economy:this.allianceEconomy(userId, member.alliance_id)};
    }).immediate();
  }
  buyAllianceMarket(userId,item){
    const catalog={gold:{cost:30},iron:{cost:30},water:{cost:30},solar:{cost:30},landing:{cost:100},attack:{cost:80},health:{cost:80},protection:{cost:150}};
    const product=catalog[item];if(!Object.hasOwn(catalog,item))return {error:"Unknown market item."};
    return db.transaction(()=>{
      const member=db.prepare("SELECT alliance_id FROM alliance_members WHERE user_id=?").get(userId);
      if(!member)return {error:"Join an alliance first."};
      const e=this.allianceEconomy(userId,member.alliance_id);
      if(e.points<product.cost)return {error:"Not enough alliance points."};
      const inventory=this.getInventory(userId);
      if(["gold","iron","water","solar"].includes(item)){
        const resource=item[0].toUpperCase()+item.slice(1);
        inventory.resources[resource]=(inventory.resources[resource]||0)+500;
        db.prepare("UPDATE inventory_reserves SET resources=? WHERE user_id=?").run(JSON.stringify(inventory.resources),userId);
      }else{
        inventory.items[item]=(inventory.items[item]||0)+1;
        db.prepare("UPDATE inventory_reserves SET items=? WHERE user_id=?").run(JSON.stringify(inventory.items),userId);
      }
      db.prepare("UPDATE alliance_wallets SET points=points-? WHERE user_id=?").run(product.cost,userId);
      return {item,inventory:this.getInventory(userId),economy:this.allianceEconomy(userId,member.alliance_id)};
    })();
  }
  useInventoryItem(userId,item,amount){
    const catalog={landing:"token",attack:"buff",health:"buff",protection:"buff"};
    if(!Object.hasOwn(catalog,item))return {error:"This item cannot be used."};
    if(!Number.isSafeInteger(amount)||amount<1||amount>10000)return {error:"Enter a valid item quantity."};
    return db.transaction(()=>{
      const inventory=this.getInventory(userId);
      if(Number(inventory.items[item]||0)<amount)return {error:"You do not have that many items."};
      inventory.items[item]-=amount;
      if(inventory.items[item]<=0)delete inventory.items[item];
      db.prepare("UPDATE inventory_reserves SET items=? WHERE user_id=?").run(JSON.stringify(inventory.items),userId);
      if(item==="landing")this.creditTokens(userId,amount);
      else{
        const duration=(item==="protection"?86400000:3600000)*amount;
        const now=Date.now();
        db.prepare("INSERT INTO alliance_market_buffs(user_id,kind,expires_at) VALUES (?,?,?) ON CONFLICT(user_id,kind) DO UPDATE SET expires_at=MAX(expires_at,excluded.expires_at-?)+?")
          .run(userId,item,now+duration,duration,duration);
      }
      return {item,amount,inventory:this.getInventory(userId)};
    })();
  }
  saveAllianceDescription(userId,description){
    if(typeof description!=="string"||description.trim().length>600)return {error:"Alliance profile message must be 600 characters or fewer."};
    const membership=db.prepare("SELECT alliance_id,role FROM alliance_members WHERE user_id=?").get(userId);
    if(!membership||!["Leader","Co-Leader"].includes(membership.role))return {error:"Only the leader or co-leader can edit the alliance profile."};
    const clean=description.trim();
    db.prepare("UPDATE alliances SET description=? WHERE id=?").run(clean,membership.alliance_id);
    return {description:clean};
  }
  allianceState(userId){
    this.settleAllianceReinforcements(userId);
    const membership=db.prepare("SELECT a.id,a.name,a.description,a.leader_id,m.role FROM alliance_members m JOIN alliances a ON a.id=m.alliance_id WHERE m.user_id=?").get(userId);
    if(!membership){
      const invitations=db.prepare("SELECT a.id,a.name FROM alliance_invitations i JOIN alliances a ON a.id=i.alliance_id WHERE i.user_id=? ORDER BY a.name").all(userId);
      return {alliance:null,requests:[],invitations,...this.allianceDirectory(userId)};
    }
    const members=db.prepare("SELECT u.id,u.username,m.role FROM alliance_members m JOIN users u ON u.id=m.user_id WHERE m.alliance_id=? ORDER BY CASE WHEN m.role='Leader' THEN 0 WHEN m.role='Co-Leader' THEN 1 ELSE 2 END,u.username").all(membership.id);
    const applications=db.prepare("SELECT u.id,u.username,a.applied_at FROM alliance_applications a JOIN users u ON u.id=a.user_id WHERE a.alliance_id=? ORDER BY a.applied_at").all(membership.id);
    const requests=db.prepare("SELECT h.id,h.requester_id,h.building_name,h.building_level,h.requested_at,h.job_key,h.job_ends_at,u.username FROM alliance_help h JOIN users u ON u.id=h.requester_id WHERE h.alliance_id=? ORDER BY h.id DESC LIMIT 30").all(membership.id).filter(h=>{
      const job=this.syncGame(h.requester_id)?.buildingJob;
      return this.allianceRequestMatches(h,job);
    }).map(h=>({...h,helped:!!db.prepare("SELECT 1 FROM alliance_help_clicks WHERE request_id=? AND helper_id=?").get(h.id,userId),helperCount:db.prepare("SELECT COUNT(*) AS n FROM alliance_help_clicks WHERE request_id=?").get(h.id).n}));
    const helpHistory=db.prepare("SELECT h.id,h.building_name,h.building_level,h.reduction_ms,h.helped_at,requester.username AS requester,helper.username AS helper FROM alliance_help_history h JOIN users requester ON requester.id=h.requester_id JOIN users helper ON helper.id=h.helper_id WHERE h.alliance_id=? ORDER BY h.helped_at DESC,h.id DESC LIMIT 50").all(membership.id);
    const helpStats=db.prepare("SELECT COUNT(*) AS totalHelps,COALESCE(SUM(reduction_ms),0) AS totalTimeSavedMs FROM alliance_help_history WHERE alliance_id=?").get(membership.id);
    const reinforcements=db.prepare("SELECT r.id,r.sender_id,r.recipient_id,r.units,r.launched_at,r.arrives_at,r.recall_at,r.returned_at,s.username AS sender,t.username AS recipient FROM alliance_reinforcements r JOIN users s ON s.id=r.sender_id JOIN users t ON t.id=r.recipient_id WHERE r.alliance_id=? AND r.returned_at IS NULL AND (r.sender_id=? OR r.recipient_id=?) ORDER BY r.id DESC LIMIT 100").all(membership.id,userId,userId).map(r=>({...r,units:JSON.parse(r.units)}));
    const bank=db.prepare("SELECT green_balance,red_balance FROM alliance_crystal_bank WHERE alliance_id=?").get(membership.id)||{green_balance:0,red_balance:0};
    const crystals={green:Number(db.prepare("SELECT balance FROM player_green_crystals WHERE user_id=?").get(userId)?.balance||0),red:Number(db.prepare("SELECT balance FROM player_red_crystals WHERE user_id=?").get(userId)?.balance||0)};
    return {alliance:membership,members,applications,requests,helpHistory,helpStats,reinforcements,crystals,crystalBank:{green:Number(bank.green_balance||0),red:Number(bank.red_balance||0)},economy:this.allianceEconomy(userId,membership.id),...this.allianceDirectory(userId)};
  }
  createAlliance(userId,name){
    if(typeof name!=="string"||name.trim().length<3||name.trim().length>32)return {error:"Alliance name must be 3–32 characters."};
    return db.transaction(()=>{
      if(db.prepare("SELECT 1 FROM alliance_members WHERE user_id=?").get(userId))return {error:"Leave your current alliance first."};
      if(db.prepare("SELECT 1 FROM alliances WHERE name=? COLLATE NOCASE").get(name.trim()))return {error:"Alliance name already exists."};
      const id=db.prepare("INSERT INTO alliances(name,leader_id) VALUES (?,?)").run(name.trim(),userId).lastInsertRowid;
      db.prepare("INSERT INTO alliance_members(user_id,alliance_id,role) VALUES (?,?,'Leader')").run(userId,id);
      db.prepare("DELETE FROM alliance_applications WHERE user_id=?").run(userId);
      db.prepare("DELETE FROM alliance_invitations WHERE user_id=?").run(userId);
      return this.allianceState(userId);
    })();
  }
  joinAlliance(userId,name){
    if(typeof name!=="string"||!name.trim())return {error:"Choose an alliance."};
    return db.transaction(()=>{
      if(db.prepare("SELECT 1 FROM alliance_members WHERE user_id=?").get(userId))return {error:"Already in an alliance."};
      const a=db.prepare("SELECT id FROM alliances WHERE name=? COLLATE NOCASE").get(name.trim());
      if(!a)return {error:"Alliance not found."};
      const memberCount=db.prepare("SELECT COUNT(*) AS n FROM alliance_members WHERE alliance_id=?").get(a.id).n;
      if(memberCount===0){
        db.prepare("INSERT INTO alliance_members(user_id,alliance_id,role) VALUES (?,?,'Leader')").run(userId,a.id);
        db.prepare("UPDATE alliances SET leader_id=? WHERE id=?").run(userId,a.id);
        db.prepare("DELETE FROM alliance_applications WHERE user_id=?").run(userId);
        db.prepare("DELETE FROM alliance_invitations WHERE user_id=?").run(userId);
        return {joined:true,message:"The alliance had no members. You joined as its new leader."};
      }
      db.prepare("INSERT OR IGNORE INTO alliance_applications(user_id,alliance_id,applied_at) VALUES (?,?,?)").run(userId,a.id,Date.now());
      return {applied:true,message:"Application sent. Wait for alliance leadership to accept."};
    })();
  }
  allianceApplication(userId,applicantId,accept){
    return db.transaction(()=>{
      const officer=db.prepare("SELECT alliance_id,role FROM alliance_members WHERE user_id=?").get(userId);
      if(!officer||!["Leader","Co-Leader","Diplomat"].includes(officer.role))return {error:"You cannot process applications."};
      const application=db.prepare("SELECT 1 FROM alliance_applications WHERE user_id=? AND alliance_id=?").get(applicantId,officer.alliance_id);
      if(!application)return {error:"Application not found."};
      if(accept){
        if(db.prepare("SELECT 1 FROM alliance_members WHERE user_id=?").get(applicantId))return {error:"Applicant is already in an alliance."};
        this.syncGame(applicantId);
        db.prepare("INSERT INTO alliance_members(user_id,alliance_id,role) VALUES (?,?,'Member')").run(applicantId,officer.alliance_id);
        db.prepare("DELETE FROM alliance_applications WHERE user_id=?").run(applicantId);
        db.prepare("DELETE FROM alliance_invitations WHERE user_id=?").run(applicantId);
      }else db.prepare("DELETE FROM alliance_applications WHERE user_id=? AND alliance_id=?").run(applicantId,officer.alliance_id);
      return this.allianceState(userId);
    })();
  }
  allianceRole(userId,targetId,role){
    const allowed=["Member","Co-Leader","Treasurer","Diplomat","General","Strategist"];
    if(!allowed.includes(role))return {error:"Invalid alliance role."};
    return db.transaction(()=>{
      const officer=db.prepare("SELECT alliance_id,role FROM alliance_members WHERE user_id=?").get(userId);
      const target=db.prepare("SELECT alliance_id,role FROM alliance_members WHERE user_id=?").get(targetId);
      if(!officer||!target||officer.alliance_id!==target.alliance_id||officer.role!=="Leader"||target.role==="Leader")return {error:"Only the leader can assign member roles."};
      if(role!=="Member"&&db.prepare("SELECT 1 FROM alliance_members WHERE alliance_id=? AND role=? AND user_id<>?").get(officer.alliance_id,role,targetId))return {error:"This role is already assigned."};
      db.prepare("UPDATE alliance_members SET role=? WHERE user_id=?").run(role,targetId);
      return this.allianceState(userId);
    })();
  }
  allianceLeave(userId,targetId){
    return db.transaction(()=>{
      const actor=db.prepare("SELECT alliance_id,role FROM alliance_members WHERE user_id=?").get(userId);
      const target=db.prepare("SELECT alliance_id,role FROM alliance_members WHERE user_id=?").get(targetId);
      if(!actor||!target||actor.alliance_id!==target.alliance_id)return {error:"Player is not in your alliance."};
      if(userId!==targetId&&!["Leader","Co-Leader"].includes(actor.role))return {error:"Insufficient permission to remove member."};
      if(target.role==="Leader"&&userId!==targetId)return {error:"The alliance leader cannot be removed by another member."};
      if(target.role==="Leader"){
        const successor=db.prepare(`SELECT user_id FROM alliance_members WHERE alliance_id=? AND user_id<>?
          ORDER BY CASE role WHEN 'Co-Leader' THEN 0 WHEN 'General' THEN 1 WHEN 'Strategist' THEN 2 WHEN 'Treasurer' THEN 3 WHEN 'Diplomat' THEN 4 ELSE 5 END,user_id LIMIT 1`)
          .get(actor.alliance_id,targetId);
        if(successor){
          db.prepare("UPDATE alliance_members SET role='Leader' WHERE user_id=?").run(successor.user_id);
          db.prepare("UPDATE alliances SET leader_id=? WHERE id=?").run(successor.user_id,actor.alliance_id);
        }
      }
      if(target.role==="Co-Leader"&&actor.role!=="Leader"&&userId!==targetId)return {error:"Only leader can remove co-leader."};
      this.syncGame(targetId);
      db.prepare("DELETE FROM alliance_members WHERE user_id=?").run(targetId);
      const disbanded=disbandEmptyAlliance(actor.alliance_id);
      return {success:true,disbanded};
    })();
  }
  allianceTransfer(userId,targetId){
    return db.transaction(()=>{
      const actor=db.prepare("SELECT alliance_id,role FROM alliance_members WHERE user_id=?").get(userId);
      const target=db.prepare("SELECT alliance_id FROM alliance_members WHERE user_id=?").get(targetId);
      if(!actor||actor.role!=="Leader"||!target||target.alliance_id!==actor.alliance_id||targetId===userId)return {error:"Leadership transfer not allowed."};
      db.prepare("UPDATE alliance_members SET role='Member' WHERE user_id=?").run(userId);
      db.prepare("UPDATE alliance_members SET role='Leader' WHERE user_id=?").run(targetId);
      db.prepare("UPDATE alliances SET leader_id=? WHERE id=?").run(targetId,actor.alliance_id);
      return this.allianceState(userId);
    })();
  }
  requestAllianceHelp(userId){
    return db.transaction(()=>{
      const a=db.prepare("SELECT alliance_id FROM alliance_members WHERE user_id=?").get(userId);
      if(!a)return {error:"Join an alliance first."};
      const job=this.syncGame(userId)?.buildingJob;
      if(!job||job.endsAt<=Date.now())return {error:"No active construction to request help for."};
      const key=this.allianceJobKey(job);
      const old=db.prepare("SELECT id FROM alliance_help WHERE requester_id=? AND building_name=? AND building_level=? AND (job_key=? OR (job_key IS NULL AND job_ends_at=?))").get(userId,job.name,job.level,key,job.endsAt);
      if(old)return {error:"Help already requested for this construction."};
      const id=db.prepare("INSERT INTO alliance_help(requester_id,alliance_id,building_name,building_level,requested_at,job_ends_at,job_key) VALUES (?,?,?,?,?,?,?)").run(userId,a.alliance_id,job.name,job.level,Date.now(),job.endsAt,key).lastInsertRowid;
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
      if(!this.allianceRequestMatches(h,job))return {error:"Construction already finished."};
      const now = Date.now();
      const remaining = job.endsAt - now;
      if (remaining <= 0) return {error:"Construction already finished."};
      const reduction = Math.min(remaining, Math.max(60000, Math.ceil(remaining * .01)));
      job.endsAt -= reduction;
      db.prepare("UPDATE game_runtime SET building_job=? WHERE user_id=?").run(JSON.stringify(job),h.requester_id);
      db.prepare("INSERT INTO alliance_help_clicks(request_id,helper_id) VALUES (?,?)").run(requestId,userId);
      db.prepare("INSERT INTO alliance_help_history(alliance_id,requester_id,helper_id,building_name,building_level,reduction_ms,helped_at) VALUES (?,?,?,?,?,?,?)").run(h.alliance_id,h.requester_id,userId,h.building_name,h.building_level,reduction,now);
      this.creditTokens(userId,1);
      return {reductionMs:reduction,tokens:this.getTokens(userId).balance};
    })();
  }

  getInventory(userId) {
    db.prepare("INSERT OR IGNORE INTO inventory_reserves(user_id,resources,army,items) VALUES (?,?,?,?)").run(userId,JSON.stringify({Gold:10000,Iron:10000,Water:10000,Solar:10000}),"{}","{}");
    const row=db.prepare("SELECT resources,army,items FROM inventory_reserves WHERE user_id=?").get(userId);
    return {resources:JSON.parse(row.resources),army:JSON.parse(row.army),items:JSON.parse(row.items||"{}"),boosters:{universalForge:this.getUserEquipment(userId)?.craftingPoints?.Universal || 0}};
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
    // Columns: light infantry, heavy infantry, ranged, elite infantry,
    // mobile cavalry equivalents, artillery, elite guard.
    const garrisons = [[50,0,0,0,0,0,0],[75,0,0,0,0,0,0],[125,0,75,0,0,0,0],[350,175,150,0,0,0,0],[450,225,500,0,0,0,0],[550,275,800,275,0,0,0],[650,325,1200,325,25,0,0],[750,375,1700,375,75,25,0],[850,425,2300,425,200,85,0],[950,475,2900,475,325,145,0],[1050,525,3500,525,550,180,0],[1150,575,6300,575,850,240,0],[1250,625,7500,625,1250,290,0],[1350,675,8700,675,1700,405,0],[1450,725,9900,725,2250,545,200],[1550,775,10950,775,2800,615,400],[1650,825,11850,825,3350,690,550],[1750,875,12750,875,4050,765,700],[1850,925,13650,925,4700,840,850],[2200,1100,15300,1100,6500,920,1100]];
    const names = ["Alien Infantry","Xeno Warrior","Spore Archer","Plasma Stalker","War Drone","Siege Behemoth","Praetorian Guard"];
    const army = {};
    garrisons[level - 1].forEach((count, index) => { if (count > 0) army[names[index]] = count; });
    if (level === 20) army["Alien Overlord"] = 1;
    return army;
  }

  settleScoutMissions(userId, now, army) {
    const due = db.prepare("SELECT * FROM scout_missions WHERE user_id=? AND returned_at IS NULL AND arrives_at<=?").all(userId, now);
    for (const mission of due) {
      if (!mission.report) {
        db.prepare("UPDATE scout_missions SET report=? WHERE id=?").run(JSON.stringify(this.getAlienArmy(mission.level)), mission.id);
        db.prepare(`INSERT INTO alien_recon(user_id,level,scouted_at) VALUES (?,?,?)
          ON CONFLICT(user_id,level) DO UPDATE SET scouted_at=MAX(scouted_at,excluded.scouted_at)`).run(userId, mission.level, mission.arrives_at);
      }
      if (now >= mission.returns_at) {
        army["Rover Scout"] = (Number(army["Rover Scout"]) || 0) + mission.quantity;
        db.prepare("UPDATE scout_missions SET returned_at=? WHERE id=?").run(now, mission.id);
      }
    }
  }

  getFormations(userId) {
    const row=db.prepare("SELECT presets,defense_slot,names FROM player_formations WHERE user_id=?").get(userId);
    const stored = row ? JSON.parse(row.presets) : {};
    const storedNames = row?.names ? JSON.parse(row.names) : {};
    const hasSplitPresets = !!stored.attack || !!stored.defense;
    const legacyPresets = hasSplitPresets ? {} : stored;
    const legacyNames = storedNames.attack || storedNames.defense ? {} : storedNames;
    const normalizeSlots = source => Object.fromEntries(Object.entries(source || {})
      .map(([slot, formation]) => [slot, normalizeFormation(formation)]));
    const attackPresets = normalizeSlots(hasSplitPresets ? stored.attack : legacyPresets);
    const defensePresets = normalizeSlots(stored.defense || {});
    const attackNames = hasSplitPresets ? (storedNames.attack || {}) : legacyNames;
    const defenseNames = hasSplitPresets ? (storedNames.defense || {}) : {};
    const defenseSlot = row?.defense_slot || 0;
    return {presets:attackPresets,names:attackNames,attackPresets,attackNames,defensePresets,defenseNames,defenseSlot};
  }

  saveFormation(userId, slot, rows, defenseSlot, name, mode="attack") {
    return db.transaction(()=>{
      const settings=this.getFormations(userId);
      if(rows!==undefined){
        if(!["attack","defense"].includes(mode)) return {error:"Choose attack or defense formation."};
        if(!Number.isInteger(slot)||slot<1||slot>5||!rows||typeof rows!=="object"||Array.isArray(rows)
          || Object.keys(rows).some(key => key !== "columns" && !formationUnits.includes(key))
          || !formationUnits.every(unit=>Number.isInteger(rows[unit])&&rows[unit]>=1&&rows[unit]<=4)){
          return {error:"Choose formation slot 1–5 and a valid row for every unit."};
        }
        if(typeof name !== "string" || !name.trim() || name.trim().length > 32) return {error:"Enter a formation name up to 32 characters."};
        const presets = mode === "defense" ? settings.defensePresets : settings.attackPresets;
        const names = mode === "defense" ? settings.defenseNames : settings.attackNames;
        presets[slot]=normalizeFormation(rows);
        names[slot]=name.trim();
      }
      if(defenseSlot!==undefined){
        if(!Number.isInteger(defenseSlot)||defenseSlot<0||defenseSlot>5||(defenseSlot!==0&&!settings.defensePresets[defenseSlot])){
          return {error:"Choose the default defense or a saved defense formation."};
        }
        settings.defenseSlot=defenseSlot;
      }
      const storedPresets={attack:settings.attackPresets,defense:settings.defensePresets};
      const storedNames={attack:settings.attackNames,defense:settings.defenseNames};
      db.prepare(`INSERT INTO player_formations(user_id,presets,defense_slot,names) VALUES (?,?,?,?)
        ON CONFLICT(user_id) DO UPDATE SET presets=excluded.presets,defense_slot=excluded.defense_slot,names=excluded.names`)
        .run(userId,JSON.stringify(storedPresets),settings.defenseSlot,JSON.stringify(storedNames));
      return settings;
    })();
  }

    launchPlayerAttack(userId, selectedArmy, formation, targetCoords) {
    if (!targetCoords || typeof targetCoords.username !== "string") return {error:"Choose a player base on the map."};
    const target = db.prepare(`SELECT u.id,u.username,b.x,b.y,m.alliance_id
      FROM users u JOIN base_positions b ON b.user_id=u.id
      LEFT JOIN alliance_members m ON m.user_id=u.id
      WHERE u.username=? AND b.x=? AND b.y=?`).get(targetCoords.username,targetCoords.x,targetCoords.y);
    if (!target) return {error:"Player base not found at those coordinates."};
    if (target.id === userId) return {error:"You cannot attack your own base."};
    const attackerAlliance=db.prepare("SELECT alliance_id FROM alliance_members WHERE user_id=?").get(userId)?.alliance_id;
    if(attackerAlliance&&target.alliance_id&&Number(attackerAlliance)===Number(target.alliance_id))return {error:"You cannot attack a member of your alliance."};
    if(db.prepare("SELECT 1 FROM alliance_market_buffs WHERE user_id=? AND kind='protection' AND expires_at>?").get(target.id,Date.now()))
      return {error:"This player is protected by an active 24-hour Plasma Shield."};
    return db.transaction(()=>{
      const current=this.syncGame(userId);
      if (!current) return {error:"Player not found."};
      if (!selectedArmy||typeof selectedArmy!=="object"||Array.isArray(selectedArmy)) return {error:"Choose an army."};
      const {playerTypes}=require("../shared/combatEngine");
      let total=0;
      for(const [unit,count] of Object.entries(selectedArmy)){
        if(!playerTypes[unit]||!Number.isSafeInteger(count)||count<0||count>Number(current.army[unit]||0)) return {error:"Invalid troop selection."};
        total+=count;
      }
      if(!total) return {error:"Select at least one unit."};
      if(total>marchLimit) return {error:"A march can contain at most 50,000 troops."};
      const selected=Object.fromEntries(Object.entries(selectedArmy).filter(([,count])=>count>0));
      const rows=defaultFormation();
      const battleFormation=formation||Object.entries(selected).map(([unit,count])=>({unit,count,row:rows[unit]}));
      if(!Array.isArray(battleFormation)||battleFormation.length>100) return {error:"Invalid formation."};
      const tally={};
      for(const group of battleFormation){
        if(!group||!playerTypes[group.unit]||!Number.isSafeInteger(group.count)||group.count<=0||!Number.isInteger(group.row)||group.row<1||group.row>4) return {error:"Invalid formation."};
        tally[group.unit]=(tally[group.unit]||0)+group.count;
      }
      if(Object.keys({...selected,...tally}).some(unit=>(selected[unit]||0)!==(tally[unit]||0))) return {error:"Formation does not match selected troops."};
      for(const [unit,count] of Object.entries(selected)) current.army[unit]-=count;
      db.prepare("UPDATE game_runtime SET army=? WHERE user_id=?").run(JSON.stringify(current.army),userId);
      const now=Date.now();
      const speedBonus=this.protocolBonus(userId,"Rapid Deployment")/100;
      const travelMs=Math.max(1000,Math.ceil(60000/(1+speedBonus)));
      const origin={username:this.findUserById(userId)?.username||current.castle.username,x:current.castle.x,y:current.castle.y};
      const destination={username:target.username,x:target.x,y:target.y};
      const armyData={units:selected,formation:battleFormation,origin,target:destination};
      const mission=db.prepare("INSERT INTO player_missions(attacker_id,defender_id,army,launched_at,arrives_at) VALUES (?,?,?,?,?)")
        .run(userId,target.id,JSON.stringify(armyData),now,now+travelMs);
      return {missionId:Number(mission.lastInsertRowid),launchedAt:now,arrivesAt:now+travelMs,origin,target:destination,units:selected,formation:battleFormation};
    })();
  }

  resolvePlayerMissions(userId) {
    return db.transaction(()=>{
      const now=Date.now();
      const returning=db.prepare("SELECT * FROM player_missions WHERE (attacker_id=? OR defender_id=?) AND resolved_at IS NOT NULL AND returned_at IS NULL AND returns_at<=?")
        .all(userId,userId,now);
      for(const mission of returning){
        const result=JSON.parse(mission.result||"{}");
        const current=this.syncGame(mission.attacker_id);
        if(current){
          for(const [unit,count] of Object.entries(result.survivors||{})) current.army[unit]=(Number(current.army[unit])||0)+count;
          db.prepare("UPDATE game_runtime SET army=? WHERE user_id=?").run(JSON.stringify(current.army),mission.attacker_id);
        }
        db.prepare("UPDATE player_missions SET returned_at=? WHERE id=?").run(now,mission.id);
      }
      const due=db.prepare("SELECT * FROM player_missions WHERE (attacker_id=? OR defender_id=?) AND resolved_at IS NULL AND arrives_at<=? ORDER BY id")
        .all(userId,userId,now);
      for(const mission of due){
        const data=JSON.parse(mission.army);
        const attacker=this.syncGame(mission.attacker_id);
        const defender=this.syncGame(mission.defender_id);
        if(!attacker||!defender){
          const failed={victory:false,rounds:0,report:[],survivors:data.units||{},defenderSurvivors:{},defendersRemaining:0,error:"A player base is unavailable."};
          db.prepare("UPDATE player_missions SET resolved_at=?,returns_at=?,result=?,seen_at=NULL,attacker_seen_at=NULL,defender_seen_at=NULL WHERE id=?").run(now,now+60000,JSON.stringify(failed),mission.id);
          continue;
        }
        const shield=db.prepare("SELECT expires_at FROM alliance_market_buffs WHERE user_id=? AND kind='protection' AND expires_at>?").get(mission.defender_id,now);
        if(shield){
          const travelMs=Math.max(1000,mission.arrives_at-mission.launched_at);
          const shielded={victory:false,rounds:0,report:[],survivors:data.units||{},defenderInitial:defender.army||{},defenderSurvivors:defender.army||{},
            defendersRemaining:Object.values(defender.army||{}).reduce((sum,count)=>sum+Number(count||0),0),
            loot:{Gold:0,Iron:0,Water:0,Solar:0},totalLoot:0,cargoCapacity:0,shielded:true};
          db.prepare("UPDATE player_missions SET resolved_at=?,returns_at=?,result=?,seen_at=NULL,attacker_seen_at=NULL,defender_seen_at=NULL WHERE id=?")
            .run(now,now+travelMs,JSON.stringify(shielded),mission.id);
          continue;
        }
        const defence=this.getFormations(mission.defender_id);
        const defenseRows=defence.defenseSlot ? defence.defensePresets[defence.defenseSlot] : null;
        const fallback=defaultFormation(true);
        const defenseFormation=Object.entries(defender.army).filter(([,count])=>Number(count)>0).map(([unit,count])=>({
          unit,count,row:defenseRows?.[unit]||fallback[unit]||1
        }));
        const {fight,playerTypes}=require("../shared/combatEngine");
        const validDefenders=Object.fromEntries(Object.entries(defender.army).filter(([unit,count])=>playerTypes[unit]&&Number(count)>0));
        const result=fight(data.units||{},validDefenders,data.formation,{unitUpgrades:data.unitUpgrades||attacker.unitUpgrades||{}},{
          playerDefense:true,
          defenderUnitUpgrades:defender.unitUpgrades||{},
          defenderFormation:defenseFormation.filter(group=>validDefenders[group.unit])
        });
        const defenderWounded={};
        for(const [unit,count] of Object.entries(validDefenders)){
          const killed=Math.max(0,Number(count||0)-Number(result.defenderSurvivors?.[unit]||0));
          const saved=Math.floor(killed*0.10);
          if(saved>0)defenderWounded[unit]=saved;
        }
        result.defenderInitial={...validDefenders};
        result.defenderWounded=defenderWounded;
        if(Object.keys(defenderWounded).length)this.recordHospitalWounds(mission.defender_id,"player-defense",mission.id,defenderWounded,"waiting");
        const cargo=calculateCargoCapacity(result.survivors||{});
        const loot=result.victory ? calculateLoot(defender.resources,cargo) : {Gold:0,Iron:0,Water:0,Solar:0};
        result.cargoCapacity=cargo;
        result.loot=loot;
        result.totalLoot=Object.values(loot).reduce((sum,amount)=>sum+amount,0);
        if(result.totalLoot>0){
          for(const resource of ["Gold","Iron","Water","Solar"]){
            defender.resources[resource]=(Number(defender.resources[resource])||0)-loot[resource];
            attacker.resources[resource]=(Number(attacker.resources[resource])||0)+loot[resource];
          }
          db.prepare("UPDATE game_progress SET resources=?,last_saved=CURRENT_TIMESTAMP WHERE user_id=?").run(JSON.stringify(attacker.resources),mission.attacker_id);
          db.prepare("UPDATE game_progress SET resources=?,last_saved=CURRENT_TIMESTAMP WHERE user_id=?").run(JSON.stringify(defender.resources),mission.defender_id);
        }
        for(const [unit,count] of Object.entries(result.defenderSurvivors||{})) defender.army[unit]=count;
        db.prepare("UPDATE game_runtime SET army=? WHERE user_id=?").run(JSON.stringify(defender.army),mission.defender_id);
        const travelMs=Math.max(1000,mission.arrives_at-mission.launched_at);
        db.prepare("UPDATE player_missions SET resolved_at=?,returns_at=?,result=?,seen_at=NULL,attacker_seen_at=NULL,defender_seen_at=NULL WHERE id=?")
          .run(now,now+travelMs,JSON.stringify(result),mission.id);
      }
      return true;
    })();
  }

  recallPlayerAttack(userId, missionId) {
    const id=Number(missionId);
    if(!Number.isSafeInteger(id)||id<=0)return {error:"Invalid march."};
    return db.transaction(()=>{
      const now=Date.now();
      const mission=db.prepare("SELECT * FROM player_missions WHERE id=? AND attacker_id=? AND resolved_at IS NULL AND returned_at IS NULL").get(id,Number(userId));
      if(!mission)return {error:"This attack can no longer be recalled."};
      if(mission.arrives_at<=now)return {error:"The attack has already reached its target."};
      const data=JSON.parse(mission.army||"{}");
      const survivors=data.units||{};
      const defender=this.syncGame(mission.defender_id);
      const defenderArmy=defender?.army||{};
      const result={recalled:true,battleSkipped:true,victory:false,rounds:0,report:[],survivors,
        defenderInitial:{...defenderArmy},defenderSurvivors:{...defenderArmy},
        loot:{Gold:0,Iron:0,Water:0,Solar:0},totalLoot:0,cargoCapacity:0};
      const returnAt=now+Math.max(1000,mission.arrives_at-now);
      db.prepare("UPDATE player_missions SET resolved_at=?,returns_at=?,result=?,seen_at=NULL,attacker_seen_at=NULL,defender_seen_at=NULL WHERE id=?").run(now,returnAt,JSON.stringify(result),id);
      return {success:true,missionId:id,returnsAt:returnAt};
    })();
  }

  markIncomingReportsRead(userId) {
    const id=Number(userId),now=Date.now();
    db.prepare("UPDATE player_missions SET defender_seen_at=?,seen_at=? WHERE defender_id=? AND resolved_at IS NOT NULL AND defender_seen_at IS NULL").run(now,now,id);
    db.prepare("UPDATE player_missions SET attacker_seen_at=? WHERE attacker_id=? AND resolved_at IS NOT NULL AND attacker_seen_at IS NULL").run(now,id);
    return {success:true};
  }

  getPlayerMissions(userId) {
    return db.prepare(`SELECT m.*,a.username AS attacker_name,d.username AS defender_name
      FROM player_missions m
      JOIN users a ON a.id=m.attacker_id
      JOIN users d ON d.id=m.defender_id
      WHERE m.attacker_id=? OR m.defender_id=?
      ORDER BY m.id DESC LIMIT 20`).all(userId,userId).map(({army,result,seen_at,attacker_seen_at,defender_seen_at,...mission})=>{
        const data=JSON.parse(army);
        const incoming=Number(mission.defender_id)===Number(userId);
        const parsed=result?JSON.parse(result):null;
        if(parsed&&!incoming){
          delete parsed.defenderInitial;
          delete parsed.defenderSurvivors;
          delete parsed.defenderWounded;
          delete parsed.defendersRemaining;
        }
        return {...mission,...data,result:parsed,incoming,unread:incoming?defender_seen_at==null:attacker_seen_at==null};
      });
  }

  getMarketOffers(userId) {
    return db.prepare("SELECT o.*,s.username AS seller_name FROM market_offers o JOIN users s ON s.id=o.seller_id WHERE o.status='open' OR o.seller_id=? ORDER BY CASE WHEN o.status='open' THEN 0 ELSE 1 END,o.id DESC LIMIT 100").all(userId)
      .map(o=>({...o,offeredResources:JSON.parse(o.offered_resources),requestedResources:JSON.parse(o.requested_resources)}));
  }

  createMarketOffer(userId,offeredInput,requestedInput) {
    const keys=["Gold","Iron","Water","Solar"];
    const normalize=input=>{
      if(!input||typeof input!=="object"||Array.isArray(input)||Object.keys(input).some(k=>!keys.includes(k)))return null;
      const result=Object.fromEntries(keys.map(k=>[k,Number(input[k]||0)]));
      return keys.every(k=>Number.isSafeInteger(result[k])&&result[k]>=0)?result:null;
    };
    const offered=normalize(offeredInput),requested=normalize(requestedInput);
    if(!offered||!requested)return {error:"Enter valid resource amounts."};
    const sum=obj=>Object.values(obj).reduce((a,n)=>a+n,0),offeredTotal=sum(offered),requestedTotal=sum(requested);
    if(!offeredTotal||!requestedTotal)return {error:"An offer must include both resources for sale and requested payment."};
    return db.transaction(()=>{
      const seller=this.syncGame(userId);if(!seller)return {error:"Player base not found."};
      const level=Math.min(3,Number(seller.structures["Cargo Depot"]||0)),capacity=level*5000;
      if(level<3)return {error:"Upgrade the Cargo Depot to level 3 to use the marketplace."};
      if(offeredTotal>capacity||requestedTotal>capacity)return {error:"Each side of an offer is limited to "+capacity.toLocaleString()+" resources."};
      for(const k of keys)if(offered[k]>Number(seller.resources[k]||0))return {error:"Not enough resources to reserve this offer."};
      for(const k of keys)seller.resources[k]-=offered[k];
      db.prepare("UPDATE game_progress SET resources=?,last_saved=CURRENT_TIMESTAMP WHERE user_id=?").run(JSON.stringify(seller.resources),userId);
      const row=db.prepare("INSERT INTO market_offers(seller_id,offered_resources,requested_resources,created_at) VALUES (?,?,?,?)").run(userId,JSON.stringify(offered),JSON.stringify(requested),Date.now());
      return {offerId:Number(row.lastInsertRowid),offers:this.getMarketOffers(userId),remaining:seller.resources,capacity};
    })();
  }

  acceptMarketOffer(userId,offerId) {
    const keys=["Gold","Iron","Water","Solar"];
    return db.transaction(()=>{
      const offer=db.prepare("SELECT * FROM market_offers WHERE id=? AND status='open'").get(offerId);
      if(!offer)return {error:"This offer is no longer available."};
      if(Number(offer.seller_id)===Number(userId))return {error:"You cannot accept your own offer."};
      const seller=this.syncGame(offer.seller_id),buyer=this.syncGame(userId);
      if(!seller||!buyer)return {error:"Player base not found."};
      if(Number(seller.structures["Cargo Depot"]||0)<3||Number(buyer.structures["Cargo Depot"]||0)<3)return {error:"Both players need a level 3 Cargo Depot to trade."};
      const offered=JSON.parse(offer.offered_resources),requested=JSON.parse(offer.requested_resources);
      for(const k of keys)if(Number(requested[k]||0)>Number(buyer.resources[k]||0))return {error:"You do not have enough resources to accept this offer."};
      for(const k of keys){buyer.resources[k]=(Number(buyer.resources[k])||0)+Number(offered[k]||0)-Number(requested[k]||0);seller.resources[k]=(Number(seller.resources[k])||0)+Number(requested[k]||0);}
      db.prepare("UPDATE game_progress SET resources=?,last_saved=CURRENT_TIMESTAMP WHERE user_id=?").run(JSON.stringify(buyer.resources),userId);
      db.prepare("UPDATE game_progress SET resources=?,last_saved=CURRENT_TIMESTAMP WHERE user_id=?").run(JSON.stringify(seller.resources),offer.seller_id);
      const now=Date.now(),changed=db.prepare("UPDATE market_offers SET status='accepted',accepted_by=?,resolved_at=? WHERE id=? AND status='open'").run(userId,now,offerId);
      if(changed.changes!==1)throw new Error("Offer was accepted by another player.");
      const sellerName=this.findUserById(offer.seller_id)?.username||"Another player",buyerName=this.findUserById(userId)?.username||"Another player";
      const notify=(sender,recipient,body)=>db.prepare("INSERT INTO player_messages(sender_id,recipient_id,alliance_id,body,sent_at,message_type) VALUES (?,?,?,?,?, 'trade')").run(sender,recipient,null,body,now);
      notify(userId,offer.seller_id,"Marketplace offer #"+offerId+" accepted by "+buyerName+". Payment received. / Офертата #"+offerId+" е приета от "+buyerName+". Плащането е получено.");
      notify(offer.seller_id,userId,"Marketplace purchase completed from "+sellerName+". Resources added to your base. / Покупката от "+sellerName+" е завършена. Ресурсите са добавени в базата ти.");
      db.prepare("INSERT INTO interbase_trades(sender_id,recipient_id,resources,traded_at) VALUES (?,?,?,?)").run(offer.seller_id,userId,JSON.stringify(offered),now);
      return {offerId:Number(offerId),buyerResources:buyer.resources,sellerResources:seller.resources};
    })();
  }

  cancelMarketOffer(userId,offerId) {
    return db.transaction(()=>{
      const offer=db.prepare("SELECT * FROM market_offers WHERE id=? AND seller_id=? AND status='open'").get(offerId,userId);
      if(!offer)return {error:"Open offer not found."};
      const seller=this.syncGame(userId);if(!seller)return {error:"Player base not found."};
      const offered=JSON.parse(offer.offered_resources);
      for(const k of ["Gold","Iron","Water","Solar"])seller.resources[k]=(Number(seller.resources[k])||0)+Number(offered[k]||0);
      db.prepare("UPDATE game_progress SET resources=?,last_saved=CURRENT_TIMESTAMP WHERE user_id=?").run(JSON.stringify(seller.resources),userId);
      db.prepare("UPDATE market_offers SET status='cancelled',resolved_at=? WHERE id=? AND status='open'").run(Date.now(),offerId);
      return {offerId:Number(offerId),remaining:seller.resources};
    })();
  }

  tradeBetweenBases() { return {error:"Instant transfers are disabled. Use the marketplace offer and acceptance flow."}; }

  settleEndedEvents(now=Date.now()) {
    const ended=db.prepare("SELECT id FROM mothership_events WHERE ends_at<=? AND rewards_distributed=0").all(now);
    for(const event of ended){
      this.resolveMothershipAttacks(event.id);
      this.settleMothershipRewards(event.id);
    }
    this.resolveSaturdayAllianceInvasions(now);
    return ended.length;
  }

  motherWeekStart(now=Date.now()) {
    const date=new Date(now),days=(date.getUTCDay()+6)%7;
    return Date.UTC(date.getUTCFullYear(),date.getUTCMonth(),date.getUTCDate()-days);
  }

  mothershipHealingCost(army={}) {
    const cost={Gold:0,Iron:0,Water:0,Solar:0};
    for(const [unit,countRaw] of Object.entries(army)){
      const count=Math.max(0,Number(countRaw)||0),price=unitPrice(unit);
      if(!price||!count)continue;
      for(const key of Object.keys(cost))cost[key]+=Math.ceil(Number(price[key]||0)*0.25*count);
    }
    return cost;
  }

  recordHospitalWounds(userId,source,sourceId,wounded,status="waiting",recoveryAt=null) {
    const cleaned=Object.fromEntries(Object.entries(wounded||{}).map(([unit,count])=>[unit,Math.max(0,Math.floor(Number(count)||0))]).filter(([,count])=>count>0));
    if(!Object.keys(cleaned).length)return null;
    const cost=status==="waiting"?this.mothershipHealingCost(cleaned):{Gold:0,Iron:0,Water:0,Solar:0};
    const result=db.prepare("INSERT INTO hospital_entries(user_id,source,source_id,wounded,status,healing_cost,created_at,heals_at) VALUES (?,?,?,?,?,?,?,?)")
      .run(userId,source,sourceId,JSON.stringify(cleaned),status,JSON.stringify(cost),Date.now(),recoveryAt);
    return Number(result.lastInsertRowid);
  }

  recoverEventHospital(source,sourceId,now=Date.now()) {
    const rows=db.prepare("SELECT * FROM hospital_entries WHERE source=? AND source_id=? AND status='event'").all(source,sourceId);
    for(const row of rows){
      const current=this.syncGame(row.user_id);if(!current)continue;
      for(const [unit,count] of Object.entries(JSON.parse(row.wounded||"{}")))current.army[unit]=(Number(current.army[unit])||0)+Number(count||0);
      db.prepare("UPDATE game_runtime SET army=? WHERE user_id=?").run(JSON.stringify(current.army),row.user_id);
      db.prepare("UPDATE hospital_entries SET status='healed',recovered_at=? WHERE id=? AND status='event'").run(now,row.id);
    }
    return rows.length;
  }

  getHospital(userId) {
    // Resolve arriving player attacks so newly wounded defenders appear immediately.
    this.resolvePlayerMissions(userId);
    // Calling the event readers also settles completed events and releases their wounded units.
    this.getMothershipEvent(userId);
    this.getSaturdayAllianceInvasion(userId);
    const now=Date.now();
    return db.transaction(()=>{
      const completed=db.prepare("SELECT * FROM hospital_entries WHERE user_id=? AND status='healing' AND heals_at<=?").all(userId,now);
      for(const row of completed){
        const current=this.syncGame(userId);if(!current)continue;
        for(const [unit,count] of Object.entries(JSON.parse(row.wounded||"{}")))current.army[unit]=(Number(current.army[unit])||0)+Number(count||0);
        db.prepare("UPDATE game_runtime SET army=? WHERE user_id=?").run(JSON.stringify(current.army),userId);
        db.prepare("UPDATE hospital_entries SET status='healed',recovered_at=? WHERE id=?").run(now,row.id);
      }
      const rows=db.prepare("SELECT * FROM hospital_entries WHERE user_id=? AND status IN ('waiting','healing','event') ORDER BY created_at,id").all(userId)
        .map(row=>({...row,wounded:JSON.parse(row.wounded||"{}"),healingCost:JSON.parse(row.healing_cost||"{}")}));
      const legacy=db.prepare("SELECT h.*,e.ends_at FROM mothership_hospital h JOIN mothership_events e ON e.id=h.event_id WHERE h.user_id=? AND h.status IN ('waiting','healing') ORDER BY h.created_at,h.id").all(userId)
        .map(row=>({id:"legacy-mother-"+row.id,user_id:userId,source:"mothership",source_id:row.event_id,wounded:JSON.parse(row.wounded||"{}"),status:"event",healingCost:{},created_at:row.created_at,recovery_at:row.ends_at}));
      const saturdayEnds=db.prepare("SELECT r.id,s.ends_at FROM saturday_invasion_runs r JOIN saturday_invasion_seasons s ON s.week_start=r.week_start WHERE r.status='active'").all();
      const entries=[...rows.map(row=>{
        let recoveryAt=row.heals_at||null;
        if(row.status==="event"){
          if(row.source==="mothership")recoveryAt=db.prepare("SELECT ends_at FROM mothership_events WHERE id=?").get(row.source_id)?.ends_at||null;
          if(row.source==="saturday-invasion")recoveryAt=saturdayEnds.find(run=>run.id===row.source_id)?.ends_at||null;
        }
        return {...row,recoveryAt};
      }),...legacy];
      const wounded={};for(const entry of entries)for(const [unit,count] of Object.entries(entry.wounded||{}))wounded[unit]=(Number(wounded[unit])||0)+Number(count||0);
      return {entries,wounded,totalWounded:Object.values(wounded).reduce((sum,count)=>sum+Number(count||0),0),capacity:null};
    })();
  }

  startHospitalTreatment(userId) {
    return db.transaction(()=>{
      const now=Date.now(),current=this.syncGame(userId);if(!current)return {error:"Player not found."};
      const active=db.prepare("SELECT 1 FROM hospital_entries WHERE user_id=? AND status='healing' LIMIT 1").get(userId);
      if(active)return {error:"A hospital treatment is already underway."};
      const rows=db.prepare("SELECT * FROM hospital_entries WHERE user_id=? AND source='player-defense' AND status='waiting' ORDER BY created_at,id").all(userId);
      if(!rows.length)return {error:"There are no wounded troops waiting for treatment."};
      const cost={Gold:0,Iron:0,Water:0,Solar:0};
      const treatments=rows.map(row=>{
        const rowCost=this.mothershipHealingCost(JSON.parse(row.wounded||"{}"));
        for(const key of Object.keys(cost))cost[key]+=Number(rowCost[key]||0);
        return {id:row.id,cost:rowCost};
      });
      for(const [key,amount] of Object.entries(cost))if(Number(current.resources[key]||0)<amount)return {error:"Not enough "+key+" for hospital treatment."};
      for(const [key,amount] of Object.entries(cost))current.resources[key]-=amount;
      db.prepare("UPDATE game_progress SET resources=?,last_saved=CURRENT_TIMESTAMP WHERE user_id=?").run(JSON.stringify(current.resources),userId);
      const healsAt=now+60000;
      const update=db.prepare("UPDATE hospital_entries SET status='healing',healing_cost=?,heals_at=? WHERE id=? AND status='waiting'");
      for(const treatment of treatments)update.run(JSON.stringify(treatment.cost),healsAt,treatment.id);
      return {healsAt,cost};
    })();
  }

  resolveMothershipAttacks(eventId) {
    return db.transaction(()=>{
    const now=Date.now();
    const due=db.prepare("SELECT * FROM mothership_attacks WHERE event_id=? AND resolved_at IS NULL AND arrives_at<=? ORDER BY id").all(eventId,now);
    for(const attack of due){
      const current=this.syncGame(attack.user_id),army=JSON.parse(attack.army),formation=JSON.parse(attack.formation);
      if(!current)continue;
      const {playerTypes}=require("../shared/combatEngine");
      const gear=this.getUserEquipment(attack.user_id),items=Object.values(gear?.equippedItems||{});
      let gearAttack=0,gearXp=0;
      for(const item of items)for(const stat of item?.stats||[]){
        if(typeof stat!=="string")continue;
        const match=stat.match(/(\d+(?:\.\d+)?)\s*%/);if(!match)continue;
        if(/mother ship damage|army attack|attack damage/i.test(stat))gearAttack+=Number(match[1]);
        if(/experience gain|xp gain/i.test(stat))gearXp+=Number(match[1]);
      }
      const alliance=current.allianceBonuses||{},buffs=db.prepare("SELECT kind FROM alliance_market_buffs WHERE user_id=? AND expires_at>?").all(attack.user_id,now);
      const buffAttack=buffs.some(b=>b.kind==="attack")?10:0,protocols={
        infantry:this.protocolBonus(attack.user_id,"Infantry Command"),
        ranged:this.protocolBonus(attack.user_id,"Precision Fire"),
        mobile:this.protocolBonus(attack.user_id,"Mobile Warfare"),
        artillery:this.protocolBonus(attack.user_id,"Heavy Artillery")
      };
      let damage=0;
      for(const group of formation){
        const type=playerTypes[group.unit];if(!type)continue;
        const upgrades=current.unitUpgrades?.[group.unit]||{};
        const upgradeBonus=Math.max(0,Number(upgrades.attack||1)-1)*10+Math.max(0,Number(upgrades.defense||1)-1)*3;
        const categoryBonus=protocols[type.category]||0;
        const attackBonus=upgradeBonus+categoryBonus+(Number(alliance.attack)||0)+buffAttack+gearAttack+this.protocolBonus(attack.user_id,"Battle Command")+Number(attack.knight_level||1)*2;
        damage+=Math.max(0,Number(group.count)||0)*Number(type.attack||0)*(1+attackBonus/100);
      }
      damage=Math.max(1,Math.floor(damage));
      const xp=Math.max(1,Math.floor(damage/1000*(1+gearXp/100)));
      this.awardPlayerXp(attack.user_id,xp);
      db.prepare("INSERT OR IGNORE INTO alien_rewards(user_id) VALUES (?)").run(attack.user_id);
      db.prepare("UPDATE alien_rewards SET prestige=prestige+1,knight_level=1+CAST((prestige+1)/20 AS INTEGER) WHERE user_id=?").run(attack.user_id);
      const wounded=army;
      const eventEnds=db.prepare("SELECT ends_at FROM mothership_events WHERE id=?").get(eventId)?.ends_at||null;
      this.recordHospitalWounds(attack.user_id,"mothership",eventId,wounded,"event",eventEnds);
      db.prepare("UPDATE mothership_attacks SET resolved_at=?,damage=?,xp=? WHERE id=?").run(now,damage,xp,attack.id);
      db.prepare("UPDATE mothership_events SET hp_remaining=MAX(1,hp_remaining-?) WHERE id=?").run(damage,eventId);
    }
    return due.length;
    })();
  }

  settleMothershipRewards(eventId) {
    return db.transaction(()=>{
    const event=db.prepare("SELECT * FROM mothership_events WHERE id=?").get(eventId);
    if(!event||event.rewards_distributed||Date.now()<event.ends_at)return;
    if(db.prepare("SELECT 1 FROM mothership_attacks WHERE event_id=? AND resolved_at IS NULL LIMIT 1").get(eventId))return;
    const rankings=db.prepare("SELECT a.user_id,u.username,SUM(a.damage) AS damage,COUNT(*) AS attacks FROM mothership_attacks a JOIN users u ON u.id=a.user_id WHERE a.event_id=? GROUP BY a.user_id ORDER BY damage DESC,MIN(a.launched_at),a.user_id").all(eventId);
    const participants=db.prepare("SELECT DISTINCT user_id FROM mothership_attacks WHERE event_id=?").all(eventId);
    for(const {user_id} of participants){
      const current=this.syncGame(user_id);if(!current)continue;
      const eventHospital=db.prepare("SELECT * FROM hospital_entries WHERE user_id=? AND source='mothership' AND source_id=? AND status='event'").all(user_id,eventId);
      const legacyHospital=db.prepare("SELECT * FROM mothership_hospital WHERE user_id=? AND event_id=? AND status IN ('waiting','healing')").all(user_id,eventId);
      const wounded={};
      for(const row of eventHospital)for(const [unit,count] of Object.entries(JSON.parse(row.wounded||"{}")))wounded[unit]=(Number(wounded[unit])||0)+Number(count||0);
      for(const row of legacyHospital)for(const [unit,count] of Object.entries(JSON.parse(row.wounded||"{}")))wounded[unit]=(Number(wounded[unit])||0)+Number(count||0);
      const resources=this.mothershipHealingCost(wounded);
      const rank=rankings.findIndex(row=>row.user_id===user_id)+1;
      if(rank>0&&rank<=10){
        const amount=rank===1?30000:rank===2?25000:rank===3?20000:10000;
        for(const key of Object.keys(resources))resources[key]+=amount;
        db.prepare("INSERT OR IGNORE INTO alien_rewards(user_id) VALUES (?)").run(user_id);
        db.prepare("UPDATE alien_rewards SET bonus_missions=bonus_missions+20 WHERE user_id=?").run(user_id);
        const old=this.getUserEquipment(user_id),inventory=[...(old?.gearInventory||[])],slots=["HELMET","SHIELD","BOOTS","WEAPON","ARMOR","GLOVES"];
        const count=rank===1?3:rank===2?2:1;
        for(let n=0;n<count;n++){
          const slot=slots[(event.id+rank+n)%slots.length];
          inventory.push({id:"mothership-"+event.id+"-"+user_id+"-"+n,name:"Mother Ship Relic",slot,rarity:rank===1?"Legendary":"Epic",level:0,stats:["Mother Ship Damage +5%","Army Attack +3%","Experience Gain +5%"],bonusSlots:3,obtainedFrom:"Mother Ship Hunt · Rank "+rank});
        }
        this.saveUserEquipment(user_id,old?.equippedItems||{},inventory,old?.craftingPoints||{});
      }
      // Event troops are held as wounded and return automatically when the event closes.
      for(const [unit,count] of Object.entries(wounded))current.army[unit]=(Number(current.army[unit])||0)+Number(count||0);
      db.prepare("UPDATE game_runtime SET army=? WHERE user_id=?").run(JSON.stringify(current.army),user_id);
      db.prepare("UPDATE hospital_entries SET status='healed',recovered_at=? WHERE user_id=? AND source='mothership' AND source_id=? AND status='event'")
        .run(Date.now(),user_id,eventId);
      db.prepare("UPDATE mothership_hospital SET status='healed' WHERE user_id=? AND event_id=? AND status IN ('waiting','healing')").run(user_id,eventId);
      for(const key of Object.keys(resources))current.resources[key]=(Number(current.resources[key])||0)+Math.ceil(resources[key]);
      db.prepare("UPDATE game_progress SET resources=?,last_saved=CURRENT_TIMESTAMP WHERE user_id=?").run(JSON.stringify(current.resources),user_id);
      db.prepare("INSERT INTO player_messages(sender_id,recipient_id,alliance_id,body,sent_at) VALUES (?,?,?,?,?)")
        .run(user_id,user_id,null,rank>0&&rank<=10?"Mother Ship Hunt reward: global rank "+rank+"; +20 Cyber Knight missions, equipment and resources. Wounded troops returned automatically. / Награда от Лова на Майчиния кораб: глобално място "+rank+"; +20 мисии на Киберрицаря, екипировка и ресурси. Ранените войници са възстановени автоматично.":"Mother Ship Hunt consolation resources were delivered. Wounded troops returned automatically. / Получи утешителни ресурси след Лова на Майчиния кораб. Ранените войници са възстановени автоматично.",Date.now());
    }
    db.prepare("UPDATE mothership_events SET rewards_distributed=1 WHERE id=? AND rewards_distributed=0").run(eventId);
    return true;
    })();
  }

  saturdayInvasionWindow(now=Date.now()) {
    const dayMs=86400000,date=new Date(now),today=Date.UTC(date.getUTCFullYear(),date.getUTCMonth(),date.getUTCDate());
    const daysUntilSaturday=(6-date.getUTCDay()+7)%7;
    let startsAt=today+daysUntilSaturday*dayMs;
    if(now>=startsAt+dayMs)startsAt+=7*dayMs;
    return {startsAt,endsAt:startsAt+dayMs};
  }

  startSaturdayAllianceInvasion(userId) {
    const now=Date.now(),window=this.saturdayInvasionWindow(now);
    if(now<window.startsAt||now>=window.endsAt)return {error:"The Saturday invasion can only be started on Saturday (UTC)."};
    return db.transaction(()=>{
      const member=db.prepare("SELECT m.alliance_id,m.role,a.name FROM alliance_members m JOIN alliances a ON a.id=m.alliance_id WHERE m.user_id=?").get(userId);
      if(!member)return {error:"Join an alliance before starting the event."};
      if(member.role!=="Leader")return {error:"Only the alliance leader can start this event."};
      db.prepare("INSERT OR IGNORE INTO saturday_invasion_seasons(week_start,ends_at) VALUES (?,?)").run(window.startsAt,window.endsAt);
      const prior=db.prepare("SELECT id FROM saturday_invasion_runs WHERE week_start=? AND alliance_id=?").get(window.startsAt,member.alliance_id);
      if(prior)return {error:"Your alliance has already started this Saturday's invasion."};
      const runId=db.prepare("INSERT INTO saturday_invasion_runs(week_start,alliance_id,started_by,started_at) VALUES (?,?,?,?)").run(window.startsAt,member.alliance_id,userId,now).lastInsertRowid;
      const members=db.prepare("SELECT user_id FROM alliance_members WHERE alliance_id=?").all(member.alliance_id);
      for(const row of members)db.prepare("INSERT INTO saturday_invasion_members(run_id,user_id,next_attack_at) VALUES (?,?,?)").run(runId,row.user_id,now+30000);
      return {success:true,runId,alliance:member.name,participants:members.length,message:"Saturday invasion started for your alliance."};
    })();
  }

  resolveSaturdayAllianceInvasions(now=Date.now()) {
    return db.transaction(()=>{
      const events=db.prepare("SELECT r.*,s.ends_at FROM saturday_invasion_runs r JOIN saturday_invasion_seasons s ON s.week_start=r.week_start WHERE r.status='active' AND s.settled=0 ORDER BY r.id").all();
      for(const event of events){
        const due=db.prepare("SELECT * FROM saturday_invasion_members WHERE run_id=? AND eliminated=0 AND next_attack_at<=? ORDER BY user_id").all(event.id,now);
        for(const participant of due){
          const current=this.syncGame(participant.user_id);
          if(!current){db.prepare("UPDATE saturday_invasion_members SET eliminated=1 WHERE run_id=? AND user_id=?").run(event.id,participant.user_id);continue;}
          const army=Object.fromEntries(Object.entries(current.army||{}).filter(([,count])=>Number(count)>0));
          const armySize=Object.values(army).reduce((sum,count)=>sum+Number(count||0),0);
          if(!armySize){
            db.prepare("UPDATE saturday_invasion_members SET eliminated=1,waves=waves+1,next_attack_at=? WHERE run_id=? AND user_id=?").run(event.ends_at,event.id,participant.user_id);
            continue;
          }
          const level=Math.min(20,participant.waves+1),aliens=this.getAlienArmy(level);
          const formations=require("../src/shared/formations"),combat=require("../shared/combatEngine");
          const defaultRows=formations.defaultFormation();
          const defense=this.getFormations(participant.user_id),preset=defense.defensePresets?.[String(defense.defenseSlot)]||{};
          const defenseFormation=Object.entries(army).map(([unit,count])=>({unit,count,row:Number(preset[unit])||Number(defaultRows[unit])||1}));
          const alliance=current.allianceBonuses||{};
          const result=combat.fight(aliens,army,null,{
            unitResearch:alliance.units||{},
            unitUpgrades:participant.unit_upgrades?JSON.parse(participant.unit_upgrades):{},
            infantryAttack:this.protocolBonus(participant.user_id,"Infantry Command"),
            infantryHealth:this.protocolBonus(participant.user_id,"Infantry Command"),
            mobileAttack:this.protocolBonus(participant.user_id,"Mobile Warfare"),
            artilleryAttack:this.protocolBonus(participant.user_id,"Heavy Artillery"),
            dodge:this.protocolBonus(participant.user_id,"Evasion Protocol"),
            revive:this.protocolBonus(participant.user_id,"Nano Regeneration")
          },{playerDefense:true,defenderFormation,attackerIsAlien:true});
          const survivors=result.defenderSurvivors||{};
          const wounded={};
          for(const [unit,count] of Object.entries(army)){
            const lost=Math.max(0,(Number(count)||0)-(Number(survivors[unit])||0));
            if(lost>0)wounded[unit]=lost;
          }
          const lost=Object.values(wounded).reduce((sum,count)=>sum+Number(count||0),0);
          if(Object.keys(wounded).length)this.recordHospitalWounds(participant.user_id,"saturday-invasion",event.id,wounded,"event",event.ends_at);
          const score=Object.values(aliens).reduce((sum,count)=>sum+Number(count||0),0)-Object.values(result.survivors||{}).reduce((sum,count)=>sum+Number(count||0),0);
          db.prepare("UPDATE game_runtime SET army=? WHERE user_id=?").run(JSON.stringify(survivors),participant.user_id);
          const remaining=Object.values(survivors).reduce((sum,count)=>sum+Number(count||0),0);
          const eliminated=remaining<=0;
          const battle={level,rounds:result.rounds,enemyUnits:Object.values(aliens).reduce((sum,count)=>sum+count,0),alienCasualties:Math.max(0,score),troopsLost:lost,troopsWounded:lost,remaining};
          db.prepare("UPDATE saturday_invasion_members SET score=score+?,waves=waves+1,eliminated=?,next_attack_at=?,last_battle=? WHERE run_id=? AND user_id=?").run(Math.max(0,score),eliminated?1:0,eliminated?event.ends_at:now+30000,JSON.stringify(battle),event.id,participant.user_id);
        }
        const alive=db.prepare("SELECT COUNT(*) AS n FROM saturday_invasion_members WHERE run_id=? AND eliminated=0").get(event.id).n;
        if(!alive){
          db.prepare("UPDATE saturday_invasion_runs SET status='completed',completed_at=? WHERE id=?").run(now,event.id);
          this.recoverEventHospital("saturday-invasion",event.id,now);
        }
      }
      const seasons=db.prepare("SELECT week_start FROM saturday_invasion_seasons WHERE settled=0 AND ends_at<=?").all(now);
      for(const season of seasons)this.settleSaturdayAllianceInvasion(season.week_start);
      return events.length;
    })();
  }

  settleSaturdayAllianceInvasion(weekStart) {
    return db.transaction(()=>{
      const season=db.prepare("SELECT * FROM saturday_invasion_seasons WHERE week_start=?").get(weekStart);
      if(!season||season.settled||Date.now()<season.ends_at)return false;
      const ranking=db.prepare("SELECT r.alliance_id,a.name,SUM(m.score) AS score FROM saturday_invasion_runs r JOIN alliances a ON a.id=r.alliance_id LEFT JOIN saturday_invasion_members m ON m.run_id=r.id WHERE r.week_start=? GROUP BY r.alliance_id ORDER BY score DESC,a.name COLLATE NOCASE").all(weekStart);
      const prizes=[50000,30000,15000];
      ranking.slice(0,3).forEach((rank,index)=>{
        const prize=prizes[index];
        if(!prize||!rank.score)return;
        const participants=db.prepare("SELECT user_id FROM saturday_invasion_members m JOIN saturday_invasion_runs r ON r.id=m.run_id WHERE r.week_start=? AND r.alliance_id=?").all(weekStart,rank.alliance_id);
        for(const {user_id} of participants){
          const progress=this.progressQueries.getProgress.get(user_id);if(!progress)continue;
          const resources=JSON.parse(progress.resources);
          for(const key of ["Gold","Iron","Water","Solar"])resources[key]=(Number(resources[key])||0)+prize;
          db.prepare("UPDATE game_progress SET resources=?,last_saved=CURRENT_TIMESTAMP WHERE id=?").run(JSON.stringify(resources),progress.id);
        }
      });
      const completedAt=Date.now();
      db.prepare("UPDATE saturday_invasion_runs SET status='completed',completed_at=COALESCE(completed_at,?) WHERE week_start=? AND status='active'").run(completedAt,weekStart);
      for(const run of db.prepare("SELECT id FROM saturday_invasion_runs WHERE week_start=?").all(weekStart))this.recoverEventHospital("saturday-invasion",run.id,completedAt);
      db.prepare("UPDATE saturday_invasion_seasons SET settled=1 WHERE week_start=? AND settled=0").run(weekStart);
      return true;
    })();
  }

  getSaturdayAllianceInvasion(userId) {
    const now=Date.now(),upcoming=this.saturdayInvasionWindow(now),previous=db.prepare("SELECT MAX(week_start) AS week_start FROM saturday_invasion_seasons WHERE week_start<=?").get(now)?.week_start;
    const window=previous&&now<previous+7*86400000?{startsAt:previous,endsAt:previous+86400000}:upcoming;
    const isOpen=now>=window.startsAt&&now<window.endsAt;
    db.prepare("INSERT OR IGNORE INTO saturday_invasion_seasons(week_start,ends_at) VALUES (?,?)").run(window.startsAt,window.endsAt);
    this.resolveSaturdayAllianceInvasions(now);
    const alliance=db.prepare("SELECT a.id,a.name,m.role FROM alliance_members m JOIN alliances a ON a.id=m.alliance_id WHERE m.user_id=?").get(userId)||null;
    const myRun=alliance?db.prepare("SELECT id,status FROM saturday_invasion_runs WHERE week_start=? AND alliance_id=?").get(window.startsAt,alliance.id):null;
    const alliances=db.prepare("SELECT a.id,a.name,r.status,COALESCE(SUM(m.score),0) AS score,COUNT(DISTINCT m.user_id) AS participants,SUM(CASE WHEN m.eliminated=1 THEN 1 ELSE 0 END) AS eliminated FROM saturday_invasion_runs r JOIN alliances a ON a.id=r.alliance_id LEFT JOIN saturday_invasion_members m ON m.run_id=r.id WHERE r.week_start=? GROUP BY a.id,r.status ORDER BY score DESC,a.name COLLATE NOCASE").all(window.startsAt).map((row,index)=>({...row,rank:index+1}));
    const players=db.prepare("SELECT u.id AS userId,u.username,m.score,m.waves,m.eliminated,r.status AS runStatus,r.alliance_id,a.name AS alliance FROM saturday_invasion_members m JOIN users u ON u.id=m.user_id JOIN saturday_invasion_runs r ON r.id=m.run_id JOIN alliances a ON a.id=r.alliance_id WHERE r.week_start=? ORDER BY m.score DESC,u.username COLLATE NOCASE").all(window.startsAt).map((row,index)=>({...row,rank:index+1}));
    const mine=alliance?players.find(row=>row.userId===userId&&row.alliance_id===alliance.id)||null:null;
    const season=db.prepare("SELECT settled FROM saturday_invasion_seasons WHERE week_start=?").get(window.startsAt);
    return {name:"Saturday Alien Invasion",startsAt:window.startsAt,endsAt:window.endsAt,active:isOpen,settled:!!season?.settled,alliance:alliance?{...alliance,run:myRun||null,canStart:isOpen&&alliance.role==="Leader"&&!myRun}:null,myResult:mine,alliances,players,rewards:[50000,30000,15000].map((amount,index)=>({rank:index+1,resources:amount})),nextStartsAt:window.startsAt};
  }

  getMothershipEvent(userId) {
    const now=Date.now(),weekStart=this.motherWeekStart(now),startsAt=weekStart,endsAt=weekStart+86400000;
    db.prepare("INSERT OR IGNORE INTO mothership_events(week_start,starts_at,ends_at,hp_remaining) VALUES (?,?,?,?)").run(weekStart,startsAt,endsAt,9000000000000000);
    const event=db.prepare("SELECT * FROM mothership_events WHERE week_start=?").get(weekStart);
    this.resolveMothershipAttacks(event.id);
    this.settleMothershipRewards(event.id);
    const attacks=db.prepare("SELECT a.id,a.user_id,u.username,a.origin_x,a.origin_y,a.launched_at,a.arrives_at,a.resolved_at,a.damage,a.xp FROM mothership_attacks a JOIN users u ON u.id=a.user_id WHERE a.event_id=? ORDER BY a.id").all(event.id);
    const rankings=db.prepare("SELECT a.user_id,u.username,SUM(a.damage) AS damage,COUNT(*) AS attacks FROM mothership_attacks a JOIN users u ON u.id=a.user_id WHERE a.event_id=? GROUP BY a.user_id ORDER BY damage DESC,MIN(a.launched_at),a.user_id LIMIT 10").all(event.id);
    const mine=db.prepare("SELECT COUNT(*) AS count FROM mothership_attacks WHERE event_id=? AND user_id=?").get(event.id,userId).count;
    const prestige=db.prepare("SELECT prestige FROM alien_rewards WHERE user_id=?").get(userId)?.prestige||0;
    return {id:event.id,name:"Mother Ship Hunt",startsAt:event.starts_at,endsAt:event.ends_at,active:now>=event.starts_at&&now<event.ends_at,settled:!!event.rewards_distributed,coordinates:{x:50,y:50},hp:event.hp_remaining,attacksRemaining:Math.max(0,10-mine),myAttacks:mine,prestige,attacks,rankings,nextStartsAt:event.ends_at<=now?weekStart+7*86400000:weekStart+7*86400000};
  }

  launchMothershipAttack(userId,selectedArmy,formation,includeCyberKnight) {
    if(includeCyberKnight!==true)return {error:"Cyber Knight must lead the Mother Ship attack."};
    return db.transaction(()=>{
      const now=Date.now(),weekStart=this.motherWeekStart(now),event=db.prepare("SELECT * FROM mothership_events WHERE week_start=?").get(weekStart);
      if(!event||now<event.starts_at||now>=event.ends_at)return {error:"The Mother Ship Hunt is not active."};
      const used=db.prepare("SELECT COUNT(*) AS n FROM mothership_attacks WHERE event_id=? AND user_id=?").get(event.id,userId).n;
      if(used>=10)return {error:"All 10 attacks for this weekly event have been used."};
      if(db.prepare("SELECT 1 FROM mothership_attacks WHERE event_id=? AND user_id=? AND resolved_at IS NULL").get(event.id,userId))return {error:"Your Cyber Knight is still travelling to the Mother Ship."};
      if(db.prepare("SELECT 1 FROM alien_missions WHERE user_id=? AND returned_at IS NULL").get(userId))return {error:"Your Cyber Knight is already on an Alien Base mission."};
      const current=this.syncGame(userId);if(!current)return {error:"Player not found."};
      const {playerTypes}=require("../shared/combatEngine");
      if(!selectedArmy||typeof selectedArmy!=="object"||Array.isArray(selectedArmy))return {error:"Choose troops."};
      const selected={};let total=0;
      for(const [unit,count] of Object.entries(selectedArmy)){
        if(!playerTypes[unit]||!Number.isSafeInteger(count)||count<0||count>Number(current.army[unit]||0))return {error:"Invalid troop selection."};
        if(count){selected[unit]=count;total+=count;}
      }
      if(!total||total>marchLimit)return {error:"Select 1 to 50,000 troops."};
      const rows=defaultFormation(),battleFormation=formation||Object.entries(selected).map(([unit,count])=>({unit,count,row:rows[unit]})),tally={};
      if(!Array.isArray(battleFormation)||battleFormation.length>100)return {error:"Invalid formation."};
      for(const group of battleFormation){
        if(!group||!playerTypes[group.unit]||!Number.isSafeInteger(group.count)||group.count<1||!Number.isInteger(group.row)||group.row<1||group.row>4)return {error:"Invalid formation."};
        tally[group.unit]=(tally[group.unit]||0)+group.count;
      }
      if(Object.keys({...selected,...tally}).some(unit=>(selected[unit]||0)!==(tally[unit]||0)))return {error:"Formation does not match selected troops."};
      for(const [unit,count] of Object.entries(selected))current.army[unit]-=count;
      db.prepare("UPDATE game_runtime SET army=? WHERE user_id=?").run(JSON.stringify(current.army),userId);
      const travelMs=30000,origin={x:current.castle.x,y:current.castle.y},arrivesAt=now+travelMs;
      const attack=db.prepare("INSERT INTO mothership_attacks(event_id,user_id,army,formation,origin_x,origin_y,knight_level,launched_at,arrives_at) VALUES (?,?,?,?,?,?,?,?,?)")
        .run(event.id,userId,JSON.stringify(selected),JSON.stringify(battleFormation),origin.x,origin.y,Number(db.prepare("SELECT knight_level FROM alien_rewards WHERE user_id=?").get(userId)?.knight_level||1),now,arrivesAt);
      return {attackId:Number(attack.lastInsertRowid),launchedAt:now,arrivesAt,origin,target:{x:50,y:50},attacksRemaining:9-used,army:selected,formation:battleFormation};
    })();
  }

  getMothershipHospital(userId) {
    const now=Date.now();
    return db.transaction(()=>{
      const complete=db.prepare("SELECT * FROM mothership_hospital WHERE user_id=? AND status='healing' AND heals_at<=?").all(userId,now);
      for(const item of complete){
        const current=this.syncGame(userId);if(!current)continue;
        for(const [unit,count] of Object.entries(JSON.parse(item.wounded)))current.army[unit]=(Number(current.army[unit])||0)+Number(count||0);
        db.prepare("UPDATE game_runtime SET army=? WHERE user_id=?").run(JSON.stringify(current.army),userId);
        db.prepare("UPDATE mothership_hospital SET status='healed' WHERE id=?").run(item.id);
      }
      const entries=db.prepare("SELECT * FROM mothership_hospital WHERE user_id=? AND status IN ('waiting','healing') ORDER BY id").all(userId)
        .map(row=>({...row,wounded:JSON.parse(row.wounded),healingCost:JSON.parse(row.healing_cost)}));
      return {entries};
    })();
  }

  startMothershipHealing() {
    return {error:"Mother Ship event wounds are recovered automatically when the event ends."};
  }

  createLabyrinthMap(){
    const rooms={},directions=["North","East","South"];let serial=0;
    const addRoom=(depth,parent,goal=false)=>{const id="room-"+(serial++);rooms[id]={id,depth,parent,children:[],goal};return rooms[id];};
    const start=addRoom(0,null,false);let spine=start;
    for(let depth=0;depth<10;depth++){
      const next=addRoom(depth+1,spine.id,depth+1===10);
      const available=directions.slice().sort(()=>Math.random()-0.5);
      const mainDirection=available.pop();spine.children.push({id:next.id,direction:mainDirection});
      const branchCount=require("crypto").randomInt(0,3);
      for(let branch=0;branch<branchCount&&available.length;branch++){
        const first=addRoom(depth+1,spine.id,false);spine.children.push({id:first.id,direction:available.pop()});
        let tail=first;
        const length=require("crypto").randomInt(1,11-depth);
        for(let step=1;step<length;step++){const child=addRoom(depth+1+step,tail.id,false);const dir=directions[require("crypto").randomInt(directions.length)];tail.children.push({id:child.id,direction:dir});tail=child;}
      }
      spine=next;
    }
    return {rooms,start:start.id,goal:spine.id};
  }

  getLabyrinthStatus(userId){
    const knight=Number(db.prepare("SELECT knight_level FROM alien_rewards WHERE user_id=?").get(userId)?.knight_level||1);
    const today=new Date().toISOString().slice(0,10);let row=db.prepare("SELECT * FROM labyrinth_players WHERE user_id=?").get(userId)||null;
    if(knight>=10&&!row){
      const maze=this.createLabyrinthMap();
      db.prepare("INSERT OR IGNORE INTO labyrinth_players(user_id,mission_day,crystal_mission,crystals,maze,current_room,visited) VALUES (?,?,?,?,?,?,?)")
        .run(userId,today,require("crypto").randomInt(1,11),JSON.stringify({yellow:0,blue:0,orange:0,purple:0}),JSON.stringify(maze),maze.start,JSON.stringify([maze.start]));
      row=db.prepare("SELECT * FROM labyrinth_players WHERE user_id=?").get(userId);
    }
    if(row&&row.mission_day!==today){
      db.prepare("UPDATE labyrinth_players SET mission_day=?,missions_today=0,crystal_mission=?,last_mission_at=0 WHERE user_id=?").run(today,require("crypto").randomInt(1,11),userId);
      row=db.prepare("SELECT * FROM labyrinth_players WHERE user_id=?").get(userId);
    }
    const rankings=db.prepare("SELECT l.user_id,u.username,l.medicine_found,l.deepest_depth,l.rooms_opened,l.total_moves,l.completed_at FROM labyrinth_players l JOIN users u ON u.id=l.user_id ORDER BY l.medicine_found DESC,CASE WHEN l.medicine_found=1 THEN l.completed_at END ASC,l.deepest_depth DESC,l.rooms_opened DESC,l.total_moves ASC,u.username COLLATE NOCASE LIMIT 50").all().map((entry,index)=>({...entry,rank:index+1}));
    if(knight<10)return {unlocked:false,knightLevel:knight,requiredLevel:10,rankings};
    const maze=JSON.parse(row.maze),visited=JSON.parse(row.visited||"[]"),current=maze.rooms[row.current_room];
    const visitedRooms=visited.map(id=>maze.rooms[id]).filter(Boolean).map(room=>({id:room.id,depth:room.depth,goal:room.goal,current:room.id===row.current_room}));
    const exits=(current?.children||[]).filter(exit=>!visited.includes(exit.id)).map(exit=>({id:exit.id,direction:exit.direction}));
    return {unlocked:true,knightLevel:knight,missionsToday:Number(row.missions_today||0),missionsPerDay:10,crystalMission:Number(row.crystal_mission||0),nextMissionAt:Number(row.last_mission_at||0)+1000,crystals:JSON.parse(row.crystals||"{}"),currentRoom:row.current_room,currentDepth:Number(current?.depth||0),exits,visitedRooms,roomsOpened:Number(row.rooms_opened||1),deepestDepth:Number(row.deepest_depth||0),totalMoves:Number(row.total_moves||0),medicineFound:!!row.medicine_found,completedAt:row.completed_at||null,rankings};
  }

  runLabyrinthMission(userId){
    const status=this.getLabyrinthStatus(userId);if(!status.unlocked)return {error:"Reach Cyber Knight level 10 to enter the Labyrinth."};
    return db.transaction(()=>{
      const row=db.prepare("SELECT * FROM labyrinth_players WHERE user_id=?").get(userId);if(!row)return {error:"Labyrinth state is unavailable."};
      if(Number(row.missions_today)>=10)return {error:"You have completed all 10 Labyrinth missions for today."};
      const now=Date.now();if(Number(row.last_mission_at||0)+1000>now)return {error:"The next mission will be ready in one second."};
      const missionNo=Number(row.missions_today)+1,crystals=JSON.parse(row.crystals||"{}");let crystal=null;
      if(missionNo===Number(row.crystal_mission)){const colors=["yellow","blue","orange","purple"];crystal=colors[require("crypto").randomInt(colors.length)];crystals[crystal]=(Number(crystals[crystal])||0)+1;}
      const slots=["HELMET","SHIELD","BOOTS","WEAPON","ARMOR","GLOVES"],slot=slots[require("crypto").randomInt(slots.length)];
      const roll=require("crypto").randomInt(100),rarity=roll<55?"Common":roll<80?"Uncommon":roll<95?"Rare":"Epic";
      const item={id:"labyrinth-"+userId+"-"+now+"-"+missionNo,name:"Labyrinth "+slot,slot,rarity,level:Math.max(1,status.knightLevel),stats:[],bonusSlots:rarity==="Epic"?4:rarity==="Rare"?3:rarity==="Uncommon"?2:1,obtainedFrom:"Labyrinth"};
      const gear=this.getUserEquipment(userId);this.saveUserEquipment(userId,gear?.equippedItems||{},[...(gear?.gearInventory||[]),item],gear?.craftingPoints||{});
      db.prepare("UPDATE labyrinth_players SET missions_today=?,last_mission_at=?,crystals=? WHERE user_id=?").run(missionNo,now,JSON.stringify(crystals),userId);
      return {success:true,mission:missionNo,item,crystal,status:this.getLabyrinthStatus(userId)};
    })();
  }

  moveLabyrinth(userId,roomId){
    const status=this.getLabyrinthStatus(userId);if(!status.unlocked)return {error:"Reach Cyber Knight level 10 to enter the Labyrinth."};
    return db.transaction(()=>{
      const row=db.prepare("SELECT * FROM labyrinth_players WHERE user_id=?").get(userId);if(!row)return {error:"Labyrinth state is unavailable."};
      if(Number(row.medicine_found))return {error:"The medicine has already been found."};
      const crystals=JSON.parse(row.crystals||"{}");
      for(const color of ["yellow","blue","orange","purple"])if(Number(crystals[color]||0)<1)return {error:"Collect one crystal of each color to open the next square."};
      const maze=JSON.parse(row.maze),visited=JSON.parse(row.visited||"[]"),current=maze.rooms[row.current_room];
      const exit=(current?.children||[]).find(option=>option.id===roomId);if(!exit||visited.includes(roomId))return {error:"Choose an unopened neighboring square."};
      for(const color of ["yellow","blue","orange","purple"])crystals[color]--;
      visited.push(roomId);const next=maze.rooms[roomId],found=!!next.goal,now=Date.now();
      db.prepare("UPDATE labyrinth_players SET current_room=?,visited=?,crystals=?,rooms_opened=rooms_opened+1,deepest_depth=MAX(deepest_depth,?),total_moves=total_moves+1,medicine_found=?,completed_at=? WHERE user_id=?")
        .run(roomId,JSON.stringify(visited),JSON.stringify(crystals),Number(next.depth||0),found?1:0,found?now:null,userId);
      return {success:true,medicineFound:found,status:this.getLabyrinthStatus(userId)};
    })();
  }

  backtrackLabyrinth(userId,roomId){
    const status=this.getLabyrinthStatus(userId);if(!status.unlocked)return {error:"Reach Cyber Knight level 10 to enter the Labyrinth."};
    return db.transaction(()=>{
      const row=db.prepare("SELECT * FROM labyrinth_players WHERE user_id=?").get(userId);if(!row)return {error:"Labyrinth state is unavailable."};
      const visited=JSON.parse(row.visited||"[]");if(!visited.includes(roomId))return {error:"You can return only to a square you have already visited."};
      db.prepare("UPDATE labyrinth_players SET current_room=? WHERE user_id=?").run(roomId,userId);
      return {success:true,status:this.getLabyrinthStatus(userId)};
    })();
  }

  getAlienCampaign(userId) {
    this.resolvePlayerMissions(userId);
    this.resolveAlienMissions(userId);
    const current = this.syncGame(userId);
    const playerMissions=this.getPlayerMissions(userId);
    const scoutMissions = db.prepare("SELECT * FROM scout_missions WHERE user_id=? AND (returned_at IS NULL OR id IN (SELECT id FROM scout_missions WHERE user_id=? ORDER BY id DESC LIMIT 20)) ORDER BY id DESC")
      .all(userId,userId).map(({origin,target,report,...mission})=>({...mission,origin:JSON.parse(origin),target:JSON.parse(target),report:report ? JSON.parse(report) : null}));

    const row=db.prepare("SELECT highest_defeated FROM alien_campaign WHERE user_id=?").get(userId);
    const highestDefeated=row?.highest_defeated||0;
    const nextLevel=Math.min(20,highestDefeated+1);
    const today=new Date().toISOString().slice(0,10);
    const used=db.prepare("SELECT COUNT(*) AS n FROM alien_missions WHERE user_id=? AND launched_at>=? AND launched_at<?").get(userId,Date.parse(today+"T00:00:00Z"),Date.parse(today+"T00:00:00Z")+86400000).n;
    const missions=db.prepare("SELECT id,level,launched_at,arrives_at,resolved_at,returns_at,returned_at,result,army FROM alien_missions WHERE user_id=? ORDER BY id DESC LIMIT 15").all(userId).map(({army,result,...m})=>{
      const march=JSON.parse(army);
      return {...m, units:march.units, formation:march.formation, cyberKnightLevel:march.cyberKnightLevel, origin:march.origin, target:march.target, result:result?JSON.parse(result):null};
    });
    const knight=db.prepare("SELECT victories,knight_level,prestige,bonus_missions FROM alien_rewards WHERE user_id=?").get(userId)||{victories:0,knight_level:1,prestige:0,bonus_missions:0};
    const sideQuests=[1,5,10,15,20].map(level=>({level,completed:highestDefeated>=level,claimed:!!db.prepare("SELECT 1 FROM alien_side_quests WHERE user_id=? AND milestone=?").get(userId,level)}));
    const knightBusy=missions.some(m=>m.returned_at===null) || !!db.prepare("SELECT 1 FROM mothership_attacks WHERE user_id=? AND resolved_at IS NULL LIMIT 1").get(userId);
    const supportRoutes=db.prepare(`SELECT r.id,r.launched_at,r.arrives_at,r.recall_at,s.username AS sender,t.username AS recipient
      FROM alliance_reinforcements r JOIN users s ON s.id=r.sender_id JOIN users t ON t.id=r.recipient_id
      WHERE r.returned_at IS NULL AND (r.sender_id=? OR r.recipient_id=?)
        AND COALESCE(r.recall_at,r.arrives_at)>?`).all(userId,userId,Date.now());
    return {scoutMissions,playerMissions,supportRoutes,stations:this.getAlienStationStatus(userId),formations:this.getFormations(userId),tradeModuleLevel:Math.min(3,Number(current.structures["Cargo Depot"]||0)),knightBusy,highestDefeated,nextLevel,defenders:this.getAlienArmy(nextLevel),garrisons:Object.fromEntries(Array.from({length:20},(_,i)=>[i+1,this.getAlienArmy(i+1)])),remaining:Math.max(0,20-used)+Number(knight.bonus_missions||0),bonusMissions:Number(knight.bonus_missions||0),prestige:Number(knight.prestige||0),used,missions,knightLevel:knight.knight_level,victories:knight.victories,sideQuests,mothershipEvent:this.getMothershipEvent(userId)};
  }

  getAlienStationStatus(userId){
    const now=Date.now();
    this.resolveStationProjects(now);
    this.resolveStationDefenders(now);
    const ranked=db.prepare("SELECT a.id,a.name,COUNT(m.user_id) AS memberCount,COALESCE(SUM(p.xp),0) AS points FROM alliances a LEFT JOIN alliance_members m ON m.alliance_id=a.id LEFT JOIN player_talents p ON p.user_id=m.user_id GROUP BY a.id ORDER BY points DESC,memberCount DESC,a.name COLLATE NOCASE").all();
    const eligible=ranked.slice(0,4).map((row,index)=>({...row,rank:index+1}));
    const member=db.prepare("SELECT m.alliance_id,m.role,a.name FROM alliance_members m JOIN alliances a ON a.id=m.alliance_id WHERE m.user_id=?").get(userId)||null;
    const personalGreen=Number(db.prepare("SELECT balance FROM player_green_crystals WHERE user_id=?").get(userId)?.balance||0);
    const personalRed=Number(db.prepare("SELECT balance FROM player_red_crystals WHERE user_id=?").get(userId)?.balance||0);
    const bank=member?db.prepare("SELECT green_balance,red_balance FROM alliance_crystal_bank WHERE alliance_id=?").get(member.alliance_id)||{green_balance:0,red_balance:0}:{green_balance:0,red_balance:0};
    const owned=db.prepare("SELECT s.*,a.name AS alliance_name FROM alliance_space_stations s JOIN alliances a ON a.id=s.alliance_id").all();
    const ownerByStation=Object.fromEntries(owned.map(row=>[row.station_id,row]));
    const ownStation=owned.find(row=>row.alliance_id===member?.alliance_id)||null;
    const eligibleAlliance=!!member&&eligible.some(row=>row.id===member.alliance_id);
    const defenders=db.prepare("SELECT d.station_id,d.user_id,u.username,d.army,d.status,d.sent_at,d.arrives_at FROM alliance_station_defenders d JOIN users u ON u.id=d.user_id ORDER BY d.station_id,d.status,d.user_id").all().map(row=>({...row,army:JSON.parse(row.army||"{}")}));
    const myDefense=ownStation?defenders.find(row=>row.station_id===ownStation.station_id&&row.user_id===userId)||null:null;
    return {
      required:10000,personalGreen,personalRed,allianceGreen:Number(bank.green_balance||0),allianceRed:Number(bank.red_balance||0),
      allianceId:member?.alliance_id||null,allianceName:member?.name||null,allianceRole:member?.role||null,
      eligibleAlliance,rank:eligible.find(row=>row.id===member?.alliance_id)?.rank||null,ownStation:ownStation?.station_id||null,
      canUnlock:!!member&&member.role==="Leader"&&eligibleAlliance&&!ownStation&&Number(bank.green_balance||0)>=10000,
      canDonate:!!member,canDefend:!!member&&!!ownStation,
      eligibleAlliances:eligible.map(({id,name,points,memberCount,rank})=>({id,name,points:Number(points||0),memberCount:Number(memberCount||0),rank})),
      myDefense,
      stations:spaceStations.map(station=>{
        const owner=ownerByStation[station.id];
        return {...station,locked:!owner,allianceId:owner?.alliance_id||null,allianceName:owner?.alliance_name||null,
          unlockedAt:owner?.unlocked_at||null,protectionUntil:Number(owner?.protection_until||0),protected:Number(owner?.protection_until||0)>now,
          plasmaWallLevel:Number(owner?.plasma_wall_level||0),plasmaWallMaxLevel:20,
          plasmaWallStatus:owner?.plasma_wall_status||"not_started",plasmaWallStartedAt:owner?.plasma_wall_started_at||null,
          plasmaWallCompletesAt:owner?.plasma_wall_status==="building"?Number(owner.plasma_wall_started_at||0)+86400000:null,
          spaceportUnlocked:Number(owner?.plasma_wall_level||0)>=20,
          spaceportStatus:owner?.spaceport_status||"not_started",spaceportStartedAt:owner?.spaceport_started_at||null,
          spaceportCompletesAt:owner?.spaceport_status==="building"?Number(owner.spaceport_started_at||0)+604800000:null,
          defenders:defenders.filter(defender=>defender.station_id===station.id)};
      })
    };
  }

  donateAlienCrystals(userId,kind,amount){
    if(!["green","red"].includes(kind)||!Number.isSafeInteger(amount)||amount<1)return {error:"Choose a positive amount of green or red crystals."};
    return db.transaction(()=>{
      const member=db.prepare("SELECT alliance_id FROM alliance_members WHERE user_id=?").get(userId);
      if(!member)return {error:"Join an alliance before donating crystals."};
      const table=kind==="green"?"player_green_crystals":"player_red_crystals";
      const column=kind==="green"?"green_balance":"red_balance";
      const personal=db.prepare("SELECT balance FROM "+table+" WHERE user_id=?").get(userId);
      const balance=Number(personal?.balance||0);
      if(amount>balance)return {error:"You do not have that many crystals."};
      db.prepare("UPDATE "+table+" SET balance=balance-? WHERE user_id=?").run(amount,userId);
      db.prepare("INSERT INTO alliance_crystal_bank(alliance_id,"+column+") VALUES (?,?) ON CONFLICT(alliance_id) DO UPDATE SET "+column+"="+column+"+excluded."+column).run(member.alliance_id,amount);
      const bank=db.prepare("SELECT green_balance,red_balance FROM alliance_crystal_bank WHERE alliance_id=?").get(member.alliance_id);
      return {success:true,kind,amount,personalBalance:balance-amount,allianceGreen:Number(bank.green_balance||0),allianceRed:Number(bank.red_balance||0)};
    })();
  }

  resolveStationProjects(now=Date.now()){
    const rows=db.prepare("SELECT station_id,plasma_wall_status,plasma_wall_level,plasma_wall_started_at,spaceport_status,spaceport_started_at FROM alliance_space_stations").all();
    for(const row of rows){
      if(row.plasma_wall_status==="building"&&Number(row.plasma_wall_started_at||0)+86400000<=now){
        const nextLevel=Math.min(20,Number(row.plasma_wall_level||0)+1);
        db.prepare("UPDATE alliance_space_stations SET plasma_wall_level=?,plasma_wall_status=?,plasma_wall_started_at=NULL WHERE station_id=? AND plasma_wall_status='building' AND plasma_wall_started_at=?")
          .run(nextLevel,nextLevel>=20?"built":"not_started",row.station_id,row.plasma_wall_started_at);
      }
      if(row.spaceport_status==="building"&&Number(row.spaceport_started_at||0)+604800000<=now)
        db.prepare("UPDATE alliance_space_stations SET spaceport_status='built',spaceport_started_at=NULL WHERE station_id=? AND spaceport_status='building' AND spaceport_started_at=?").run(row.station_id,row.spaceport_started_at);
    }
    return rows.length;
  }

  buildAlienStation(userId,kind){
    if(!["plasma-wall","spaceport"].includes(kind))return {error:"Choose the plasma wall or spaceport."};
    this.resolveStationProjects();
    return db.transaction(()=>{
      const member=db.prepare("SELECT alliance_id,role FROM alliance_members WHERE user_id=?").get(userId);
      if(!member)return {error:"Join an alliance first."};
      if(member.role!=="Leader")return {error:"Only the alliance leader can start construction."};
      const station=db.prepare("SELECT * FROM alliance_space_stations WHERE alliance_id=?").get(member.alliance_id);
      if(!station)return {error:"Unlock a station before starting construction."};
      const isWall=kind==="plasma-wall";
      if(isWall&&Number(station.plasma_wall_level||0)>=20)return {error:"The Plasma Wall is already at level 20."};
      if(!isWall&&Number(station.plasma_wall_level||0)<20)return {error:"Reach Plasma Wall level 20 to unlock the Spaceport."};
      const statusColumn=isWall?"plasma_wall_status":"spaceport_status";
      const startColumn=isWall?"plasma_wall_started_at":"spaceport_started_at";
      const status=station[statusColumn];
      if(status==="building")return {error:"This structure is already under construction."};
      if(!isWall&&status==="built")return {error:"The Spaceport has already been completed."};
      const greenCost=isWall?100:3000,redCost=isWall?0:100;
      const bank=db.prepare("SELECT green_balance,red_balance FROM alliance_crystal_bank WHERE alliance_id=?").get(member.alliance_id)||{green_balance:0,red_balance:0};
      if(Number(bank.green_balance||0)<greenCost)return {error:"The alliance needs "+greenCost+" donated green crystals."};
      if(Number(bank.red_balance||0)<redCost)return {error:"The alliance needs "+redCost+" donated red crystals."};
      const now=Date.now(),duration=isWall?86400000:604800000;
      db.prepare("UPDATE alliance_crystal_bank SET green_balance=green_balance-?,red_balance=red_balance-? WHERE alliance_id=?").run(greenCost,redCost,member.alliance_id);
      db.prepare("UPDATE alliance_space_stations SET "+statusColumn+"='building',"+startColumn+"=? WHERE station_id=?").run(now,station.station_id);
      return {success:true,kind,startedAt:now,completesAt:now+duration,cost:{green:greenCost,red:redCost},durationMs:duration,plasmaWallLevel:Number(station.plasma_wall_level||0)};
    })();
  }

  resolveStationDefenders(now=Date.now()){
    const result=db.prepare("UPDATE alliance_station_defenders SET status='garrison' WHERE status='travelling' AND arrives_at<=?").run(now);
    return result.changes;
  }

  sendStationDefense(userId,stationId,selectedArmy){
    if(!Number.isInteger(stationId)||stationId<1||stationId>4)return {error:"Choose a valid station."};
    return db.transaction(()=>{
      const member=db.prepare("SELECT alliance_id FROM alliance_members WHERE user_id=?").get(userId);
      const station=db.prepare("SELECT alliance_id,protection_until FROM alliance_space_stations WHERE station_id=?").get(stationId);
      if(!member||!station||member.alliance_id!==station.alliance_id)return {error:"Only members of the owning alliance can reinforce this station."};
      if(db.prepare("SELECT 1 FROM alliance_station_defenders WHERE station_id=? AND user_id=?").get(stationId,userId))return {error:"You already have troops assigned to this station."};
      const current=this.syncGame(userId);if(!current)return {error:"Player not found."};
      if(!selectedArmy||typeof selectedArmy!=="object"||Array.isArray(selectedArmy))return {error:"Choose troops."};
      const {playerTypes}=require("../shared/combatEngine");
      const selected={};let total=0;
      for(const [unit,count] of Object.entries(selectedArmy)){
        if(!playerTypes[unit]||!Number.isSafeInteger(count)||count<0||count>Number(current.army[unit]||0))return {error:"Invalid troop selection."};
        if(count){selected[unit]=count;total+=count;}
      }
      if(!total||total>marchLimit)return {error:"Choose 1 to 50,000 troops."};
      for(const [unit,count] of Object.entries(selected))current.army[unit]-=count;
      db.prepare("UPDATE game_runtime SET army=? WHERE user_id=?").run(JSON.stringify(current.army),userId);
      const now=Date.now(),travelMs=Math.max(1000,Math.ceil(60000/(1+this.protocolBonus(userId,"Rapid Deployment")/100)));
      db.prepare("INSERT INTO alliance_station_defenders(station_id,alliance_id,user_id,army,status,sent_at,arrives_at) VALUES (?,?,?,?,'travelling',?,?)")
        .run(stationId,member.alliance_id,userId,JSON.stringify(selected),now,now+travelMs);
      return {success:true,stationId,army:selected,sentAt:now,arrivesAt:now+travelMs,protectedUntil:Number(station.protection_until||0)};
    })();
  }

  recallStationDefense(userId,stationId){
    return db.transaction(()=>{
      const row=db.prepare("SELECT * FROM alliance_station_defenders WHERE station_id=? AND user_id=?").get(stationId,userId);
      if(!row)return {error:"No troops from your base are stationed here."};
      const current=this.syncGame(userId);if(!current)return {error:"Player not found."};
      const army=JSON.parse(row.army||"{}");
      for(const [unit,count] of Object.entries(army))current.army[unit]=(Number(current.army[unit])||0)+Number(count||0);
      db.prepare("UPDATE game_runtime SET army=? WHERE user_id=?").run(JSON.stringify(current.army),userId);
      db.prepare("DELETE FROM alliance_station_defenders WHERE station_id=? AND user_id=?").run(stationId,userId);
      return {success:true,army};
    })();
  }


  unlockAlienStation(userId,stationId){
    if(!Number.isInteger(stationId)||stationId<1||stationId>4)return {error:"Choose one of the four stations."};
    return db.transaction(()=>{
      const member=db.prepare("SELECT m.alliance_id,m.role,a.name FROM alliance_members m JOIN alliances a ON a.id=m.alliance_id WHERE m.user_id=?").get(userId);
      if(!member)return {error:"Join an alliance before unlocking a station."};
      if(member.role!=="Leader")return {error:"Only the alliance leader can unlock a station."};
      const ranked=db.prepare("SELECT a.id,COALESCE(SUM(p.xp),0) AS points,COUNT(m.user_id) AS memberCount FROM alliances a LEFT JOIN alliance_members m ON m.alliance_id=a.id LEFT JOIN player_talents p ON p.user_id=m.user_id GROUP BY a.id ORDER BY points DESC,memberCount DESC,a.name COLLATE NOCASE").all();
      if(!ranked.slice(0,4).some(row=>row.id===member.alliance_id))return {error:"Only one of the four highest-ranked alliances can unlock a station."};
      if(db.prepare("SELECT 1 FROM alliance_space_stations WHERE alliance_id=?").get(member.alliance_id))return {error:"Your alliance has already unlocked a station."};
      if(db.prepare("SELECT 1 FROM alliance_space_stations WHERE station_id=?").get(stationId))return {error:"That station has already been claimed."};
      const bank=db.prepare("SELECT green_balance FROM alliance_crystal_bank WHERE alliance_id=?").get(member.alliance_id);
      if(Number(bank?.green_balance||0)<10000)return {error:"Your alliance needs 10,000 donated green crystals."};
      const now=Date.now(),protectionUntil=now+86400000;
      db.prepare("UPDATE alliance_crystal_bank SET green_balance=green_balance-10000 WHERE alliance_id=?").run(member.alliance_id);
      db.prepare("INSERT INTO alliance_space_stations(station_id,alliance_id,unlocked_at,protection_until) VALUES (?,?,?,?)").run(stationId,member.alliance_id,now,protectionUntil);
      return {success:true,stationId,allianceId:member.alliance_id,allianceName:member.name,unlockedAt:now,protectionUntil};
    })();
  }

  simulateAlienBattle(userId,level,selectedArmy,formation) {
    if(!Number.isInteger(level)||level<1||level>20)return {error:"Choose an alien base level between 1 and 20."};
    if(!selectedArmy||typeof selectedArmy!=="object"||Array.isArray(selectedArmy))return {error:"Choose troops for the simulation."};
    return db.transaction(()=>{
      const current=this.syncGame(userId);
      if(!current)return {error:"Player not found."};
      if(Number(current.structures["Combat Simulator"]||0)<1)return {error:"Build the Combat Simulator to level 1 first."};
      const {fight,playerTypes}=require("../shared/combatEngine");
      const selected={};
      let total=0;
      for(const [unit,count] of Object.entries(selectedArmy)){
        if(!playerTypes[unit]||!Number.isSafeInteger(count)||count<0||count>Number(current.army[unit]||0))return {error:"Invalid troop selection."};
        if(count>0){selected[unit]=count;total+=count;}
      }
      if(!total)return {error:"Select at least one unit."};
      if(total>marchLimit)return {error:"A simulation can include at most 50,000 troops."};
      if(!Array.isArray(formation)||!formation.length)return {error:"Choose a formation."};
      const tally={};
      for(const group of formation){
        if(!group||!playerTypes[group.unit]||!Number.isSafeInteger(group.count)||group.count<1||!Number.isInteger(group.row)||group.row<1||group.row>4)return {error:"Invalid formation."};
        tally[group.unit]=(tally[group.unit]||0)+group.count;
      }
      if(Object.keys({...selected,...tally}).some(unit=>(selected[unit]||0)!==(tally[unit]||0)))return {error:"Formation does not match the selected troops."};
      const activeBuffs=db.prepare("SELECT kind FROM alliance_market_buffs WHERE user_id=? AND expires_at>?").all(userId,Date.now());
      const alliance=current.allianceBonuses||{};
      const result=fight(selected,this.getAlienArmy(level),formation,{
        rangedAttack:this.protocolBonus(userId,"Precision Fire"),
        allHealth:this.protocolBonus(userId,"Reinforced Armor")+(alliance.health||0)+(activeBuffs.some(buff=>buff.kind==="health")?10:0),
        allAttack:(alliance.attack||0)+(activeBuffs.some(buff=>buff.kind==="attack")?10:0),
        unitUpgrades:current.unitUpgrades,
        unitResearch:Object.fromEntries(Object.keys(selected).map(unit=>[unit,alliance.units?.[unit]||{}])),
        unitUpgrades:current.unitUpgrades,
        infantryAttack:this.protocolBonus(userId,"Infantry Command"),
        infantryHealth:this.protocolBonus(userId,"Infantry Command"),
        mobileAttack:this.protocolBonus(userId,"Mobile Warfare"),
        artilleryAttack:this.protocolBonus(userId,"Heavy Artillery"),
        dodge:this.protocolBonus(userId,"Evasion Protocol"),
        revive:this.protocolBonus(userId,"Nano Regeneration")
      });
      const simulatedAt=Date.now();
      const insert=db.prepare("INSERT INTO battle_simulations(user_id,level,army,formation,simulated_at,result) VALUES (?,?,?,?,?,?)")
        .run(userId,level,JSON.stringify(selected),JSON.stringify(formation),simulatedAt,JSON.stringify(result));
      return {simulationId:Number(insert.lastInsertRowid),level,simulatedAt,result,troopsReturned:true};
    })();
  }

  attackAlienBase(userId,level,selectedArmy,formation,includeCyberKnight,targetCoords) {
    if(includeCyberKnight!==true)return {error:"Add Cyber Knight before launching the attack."};
    if(!Number.isInteger(level)||level<1||level>20)return {error:"Invalid alien base level."};
    const target=targetCoords===undefined ? undefined : alienBases.find(base=>base.level===level&&base.x===targetCoords?.x&&base.y===targetCoords?.y);
    if(targetCoords!==undefined&&!target)return {error:"Invalid Alien Base coordinates."};
    return db.transaction(()=>{
      const campaign=this.getAlienCampaign(userId);
      if(level>campaign.nextLevel)return {error:"Defeat the previous alien base level first."};
      if(campaign.remaining<=0)return {error:"All 20 daily attacks have been used. Reset is at 00:00 UTC."};
      if(campaign.knightBusy)return {error:"Cyber Knight is on an Alien Base mission. Wait until the Knight returns."};
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
      if(total>marchLimit)return {error:"Cyber Knight can command at most 50,000 troops."};
      // Validate formation before reserving any troops.
      // Battle is computed at arrival, using the chosen formation and static garrison.
      const selected=Object.fromEntries(Object.entries(selectedArmy).filter(([,n])=>n>0));
      const rows=defaultFormation();
      const battleFormation=formation || Object.entries(selected).map(([unit,count])=>({unit,count,row:rows[unit]}));
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
      const now=Date.now();
      // Hyperdrive increases march speed (not a flat reduction in travel duration).
      const speedBonus=this.protocolBonus(userId,"Rapid Deployment")/100;
      const travelMs=Math.max(1000,Math.ceil(60000/(1+speedBonus)));
      const arrivesAt=now+travelMs;
      const activeBuffs = db.prepare("SELECT kind FROM alliance_market_buffs WHERE user_id=? AND expires_at>?").all(userId,now);
      const allianceCombat = {
        units: Object.fromEntries(Object.keys(selected).map(unit => [unit, current.allianceBonuses.units[unit]])),
        attack: current.allianceBonuses.attack + (activeBuffs.some(buff => buff.kind==="attack") ? 10 : 0),
        health: current.allianceBonuses.health + (activeBuffs.some(buff => buff.kind==="health") ? 10 : 0)
      };
      const origin={x:current.castle.x,y:current.castle.y};
      const allianceId=db.prepare("SELECT alliance_id FROM alliance_members WHERE user_id=?").get(userId)?.alliance_id||null;
      const mission=db.prepare("INSERT INTO alien_missions(user_id,level,army,launched_at,arrives_at) VALUES (?,?,?,?,?)").run(userId,level,JSON.stringify({units:selected,formation:battleFormation,cyberKnightLevel:campaign.knightLevel,allianceCombat,unitUpgrades:current.unitUpgrades,allianceId,origin,target}),now,arrivesAt);
      if(campaign.used>=20&&Number(campaign.bonusMissions||0)>0)db.prepare("UPDATE alien_rewards SET bonus_missions=MAX(0,bonus_missions-1) WHERE user_id=?").run(userId);
      return {missionId:Number(mission.lastInsertRowid),level,launchedAt:now,arrivesAt,origin,target,remaining:campaign.remaining-1};
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
        const result=fight(armyData.units,this.getAlienArmy(mission.level),armyData.formation,{
          rangedAttack:this.protocolBonus(userId,"Precision Fire"),
          allHealth:this.protocolBonus(userId,"Reinforced Armor") + (armyData.allianceCombat?.health || 0),
          allAttack:armyData.allianceCombat?.attack || 0,
          unitResearch:armyData.allianceCombat?.units,
          unitUpgrades:armyData.unitUpgrades,
          infantryAttack:this.protocolBonus(userId,"Infantry Command"),
          infantryHealth:this.protocolBonus(userId,"Infantry Command"),
          mobileAttack:this.protocolBonus(userId,"Mobile Warfare"),
          artilleryAttack:this.protocolBonus(userId,"Heavy Artillery"),
          dodge:this.protocolBonus(userId,"Evasion Protocol"),
          revive:this.protocolBonus(userId,"Combat Recovery"),
           leadership:this.protocolBonus(userId,"Battle Command")
        });
        if(armyData.cyberKnightLevel)result.cyberKnightLevel=armyData.cyberKnightLevel;
        if(result.victory){
          const greenCrystals=mission.level>=11&&mission.level<=19?100+(mission.level-11)*50:0;
          const redCrystals=mission.level===20?1:0;
          if(greenCrystals){
            db.prepare("INSERT INTO player_green_crystals(user_id,balance,total_earned) VALUES (?,?,?) ON CONFLICT(user_id) DO UPDATE SET balance=balance+excluded.balance,total_earned=total_earned+excluded.total_earned").run(userId,greenCrystals,greenCrystals);
            result.greenCrystals=greenCrystals;
          }
          if(redCrystals){
            db.prepare("INSERT INTO player_red_crystals(user_id,balance,total_earned) VALUES (?,?,?) ON CONFLICT(user_id) DO UPDATE SET balance=balance+excluded.balance,total_earned=total_earned+excluded.total_earned").run(userId,redCrystals,redCrystals);
            result.redCrystals=redCrystals;
          }
          this.awardPlayerXp(userId,mission.level*100);
          db.prepare("INSERT INTO alien_campaign(user_id,highest_defeated) VALUES (?,?) ON CONFLICT(user_id) DO UPDATE SET highest_defeated=MAX(highest_defeated,excluded.highest_defeated)").run(userId,mission.level);
          db.prepare("INSERT OR IGNORE INTO alien_rewards(user_id) VALUES (?)").run(userId);
          db.prepare("UPDATE alien_rewards SET victories=victories+1 WHERE user_id=?").run(userId);
          const rewardType=["equipment","crafting","resources","army"][(mission.id-1)%4];
          if(rewardType==="equipment"){
            const slots=["HELMET","SHIELD","BOOTS","WEAPON","ARMOR","GLOVES"];
            const slot=slots[(mission.id-1)%slots.length];
            const bonusCount=mission.level===20?5:Math.min(4,1+Math.floor(mission.level/5));
            const rarity = mission.level === 20 ? "Legendary" : mission.level >= 15 ? "Epic" : mission.level >= 10 ? "Rare" : mission.level >= 5 ? "Uncommon" : "Common";
            const item={id:"alien-"+mission.id,name:"Alien "+slot,slot,rarity,level:0,stats:[],bonusSlots:bonusCount,obtainedFrom:"Alien Base "+mission.level};
            const old=this.getUserEquipment(userId);
            this.saveUserEquipment(userId,old?.equippedItems||{},[...(old?.gearInventory||[]),item],old?.craftingPoints||{});
            result.reward={type:"equipment",item};
          }else if(rewardType==="crafting"){
            const old=this.getUserEquipment(userId);
            const points={...(old?.craftingPoints||{})};
            const amount = 20 + 5 * (mission.level - 1);
            points.Universal=(Number(points.Universal)||0)+amount;
            this.saveUserEquipment(userId,old?.equippedItems||{},old?.gearInventory||[],points);
            result.reward={type:"crafting",amount};
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
        db.prepare("INSERT OR IGNORE INTO alien_rewards(user_id) VALUES (?)").run(userId);
        db.prepare("UPDATE alien_rewards SET prestige=prestige+1,knight_level=1+CAST((prestige+1)/20 AS INTEGER) WHERE user_id=?").run(userId);
        db.prepare("UPDATE alien_missions SET resolved_at=?,returns_at=?,result=? WHERE id=?").run(Date.now(),Date.now()+Math.max(1000,Math.ceil(60000/(1+this.protocolBonus(userId,"Rapid Deployment")/100))),JSON.stringify(result),mission.id);
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
    const tradeModuleLevel=Math.min(3,level("Cargo Depot"));
    const sentTrade=!!db.prepare("SELECT 1 FROM interbase_trades WHERE sender_id=? LIMIT 1").get(userId) || !!db.prepare("SELECT 1 FROM market_offers WHERE seller_id=? AND status=? LIMIT 1").get(userId,"accepted");
    const upgradeLabLevel=Math.min(4,level("Upgrade Lab"));
    const troopUpgradeDone=Object.values(current.unitUpgrades||{}).some(stats=>["attack","defense"].some(stat=>Number(stats?.[stat]||1)>1));
    const allocatedProtocols=Object.values(this.playerTalents(userId).talents||{}).some(tier=>Number(tier)>0);
    const inAlliance=!!db.prepare("SELECT 1 FROM alliance_members WHERE user_id=? LIMIT 1").get(userId);
    const formationState = this.getFormations(userId);
    const missions = tutorialMissions.map((m, index) => {
      const previous = tutorialMissions.slice(0, index);
      let progress = 0, target = 1;
      if (m.kind === "mines") { progress = mineNames.filter(n => level(n) >= m.target).length; target = 4; }
      else if (m.kind === "building") { progress = Math.min(level(m.target),m.level); target = m.level; }
      else if (m.kind === "army") { progress = level("Training Center") >= 1 ? Math.min(10,Object.values(current.army).reduce((a,b)=>a+Number(b||0),0)) : 0; target=10; }
      else if (m.kind === "units") { progress = Math.min(25,Number(current.army["Explorer Trooper"]||0)) + Math.min(25,Number(current.army["Plasma Bladesman"]||0)) + Math.min(25,Number(current.army["Railgunner"]||0)); target=75; }
      else if (m.kind === "formation") {
        const savedFormation = Object.entries(formationState.presets || {}).some(([slot, rows]) =>
          String(formationState.names?.[slot] || "").trim().length >= 3 &&
          formationUnits.every(unit => Number.isInteger(rows?.[unit]) && rows[unit] >= 1 && rows[unit] <= 4)
        );
        progress = savedFormation ? 1 : 0;
      }
      else if (m.kind === "simulation") {
        const simulatorBuilt = level("Combat Simulator") >= 1;
        const hasSimulation = !!db.prepare("SELECT 1 FROM battle_simulations WHERE user_id=? LIMIT 1").get(userId);
        progress = (simulatorBuilt ? 1 : 0) + (hasSimulation ? 1 : 0);
        target = 2;
      }
      else if (m.kind === "trade") { progress=(tradeModuleLevel>=m.level?1:0)+(sentTrade?1:0); target=2; }
      else if (m.kind === "weaponry") { progress=(upgradeLabLevel>=m.level?1:0)+(troopUpgradeDone?1:0); target=2; }
      else if (m.kind === "protocols") { progress=allocatedProtocols?1:0; target=1; }
      else if (m.kind === "alliance") { progress=inAlliance?1:0; target=1; }
      else if (m.kind === "final") { progress = previous.filter(mission => claimed.has(mission.id)).length; target = previous.length; }
      const completed = progress >= target && m.kind !== "future";
      const unlocked = index === 0 || claimed.has(previous[index - 1].id);
      return {...m,number:index+1,building:m.kind==="building"?m.target:m.kind==="army"?"Training Center":m.kind==="trade"&&tradeModuleLevel<m.level?"Cargo Depot":m.kind==="weaponry"&&upgradeLabLevel<m.level?"Upgrade Lab":null,tradeModuleLevel,tradeSent:sentTrade,upgradeLabLevel,troopUpgradeDone,allocatedProtocols,inAlliance,progress,target,completed,claimed:claimed.has(m.id),unlocked,available:m.kind!=="future"};
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
      // Tutorial resource rewards are stored in Inventory until the player withdraws them.
      // The claim, token credit and reserve update share this database transaction.
      const inventory = this.getInventory(userId);
      for (const key of ["Gold","Iron","Water","Solar"]) {
        inventory.resources[key] = (Number(inventory.resources[key]) || 0) + mission.reward;
      }
      db.prepare("UPDATE inventory_reserves SET resources=? WHERE user_id=?")
        .run(JSON.stringify(inventory.resources),userId);
      if (missionId===1) db.prepare("UPDATE game_runtime SET quest_claimed=1 WHERE user_id=?").run(userId);
      if (missionId===2) db.prepare("UPDATE game_runtime SET quest2_claimed=1 WHERE user_id=?").run(userId);
      return {inventory,missionId};
    })();
  }

  dailyLoginReward(day) {
    const multiplier = 5;
    if (day % 7 === 0) return {type:"equipment",label:"Cyber Knight Armor",amount:multiplier,item:{id:"login-armor-"+day,name:"Cyber Knight Armor",slot:"ARMOR",rarity:"Rare",level:1,stats:["+5 Defense"]}};
    if (day % 5 === 0) return {type:"army",label:"Explorer Trooper",amount:(5+day)*multiplier};
    return {type:"resources",label:"Gold, Iron, Water, Solar",amount:(250+day*100)*multiplier};
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
        for (let copy = 1; copy <= reward.amount; copy++) {
          inventory.push({...reward.item,id:reward.item.id+"-"+copy,obtainedFrom:"Daily login day "+day});
        }
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

  craftEquipment(userId, itemId, expectedLevel) {
    return db.transaction(() => {
      const equipment = this.getUserEquipment(userId);
      const item = equipment?.gearInventory.find(gear => gear.id === itemId);
      if (!item) return {error:"Item not found."};
      const level = Number(item.level ?? item.levelRequirement ?? 0);
      if (level !== expectedLevel) return {error:"Item level changed. Reopen the equipment panel."};
      if (level >= 50) return {error:"Maximum equipment level reached."};
      const cost = craftingCosts[String(item.rarity).toLowerCase()];
      if (!Number.isInteger(cost)) return {error:"Unknown equipment rarity."};
      const slot = String(item.slot || item.type || "").toUpperCase();
      if (!["HELMET","SHIELD","BOOTS","WEAPON","ARMOR","GLOVES"].includes(slot)) return {error:"Invalid equipment slot."};
      const points = equipment.craftingPoints;
      const slotPoints = Number(points[slot]) || 0;
      const universal = Number(points.Universal) || 0;
      if (slotPoints + universal < cost) return {error:"Not enough Crafting Points."};
      const fromSlot = Math.min(slotPoints, cost);
      points[slot] = slotPoints - fromSlot;
      points.Universal = universal - (cost - fromSlot);
      item.level = level + 1;
      for (const [key, equipped] of Object.entries(equipment.equippedItems)) {
        if (equipped?.id === itemId) equipment.equippedItems[key] = item;
      }
      this.saveUserEquipment(userId, equipment.equippedItems, equipment.gearInventory, points);
      return {equipment};
    })();
  }

  saveEquipmentFromClient(userId, equippedItems, gearInventory, craftingPoints) {
    const current = this.getUserEquipment(userId);
    if (gearInventory === undefined && craftingPoints === undefined) {
      const inventory = current?.gearInventory || [];
      const equipped = Object.fromEntries(Object.entries(equippedItems).flatMap(([slot, item]) => {
        const saved = inventory.find(gear => gear.id === item?.id && (gear.slot || gear.type || "").toUpperCase() === slot);
        return saved ? [[slot, saved]] : [];
      }));
      return this.saveUserEquipment(userId, equipped, inventory, current?.craftingPoints || {});
    }
    return this.saveUserEquipment(userId, equippedItems, gearInventory || [],
      {...craftingPoints, Universal:current?.craftingPoints?.Universal || 0});
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
      SELECT u.username, b.x, b.y, m.alliance_id,
        (SELECT MAX(expires_at) FROM alliance_market_buffs shield
         WHERE shield.user_id=u.id AND shield.kind='protection' AND shield.expires_at>?) AS protected_until
      FROM base_positions b JOIN users u ON u.id = b.user_id
      LEFT JOIN alliance_members m ON m.user_id=u.id
      ORDER BY u.id
    `).all(Date.now());
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

  getPlayerProfile(userId) {
    db.prepare("INSERT OR IGNORE INTO player_profiles (user_id, avatar_id) VALUES (?, 'pilot-m')").run(Number(userId));
    return db.prepare("SELECT avatar_id AS avatarId FROM player_profiles WHERE user_id=?").get(Number(userId));
  }

  setPlayerAvatar(userId, avatarId) {
    const allowed = new Set(["defender-m","defender-f","attacker-m","attacker-f","farmer-m","farmer-f","scientist-m","scientist-f","pilot-m","pilot-f","doctor-m","doctor-f","engineer-m","engineer-f","tactician-m","tactician-f","leader-m","leader-f"]);
    if (!allowed.has(avatarId)) return {error:"Choose a valid avatar."};
    db.prepare("INSERT INTO player_profiles (user_id, avatar_id) VALUES (?, ?) ON CONFLICT(user_id) DO UPDATE SET avatar_id=excluded.avatar_id").run(Number(userId), avatarId);
    return {avatarId};
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
