const Database = require("better-sqlite3");
const path = require("path");
const fs = require("fs");

const dbDir = path.join(__dirname);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const dbPath = process.env.DATABASE_PATH || path.join(dbDir, "colonize_mars.db");
const db = new Database(dbPath);
db.pragma("busy_timeout = 5000");
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
      CREATE TABLE IF NOT EXISTS base_positions (
        user_id INTEGER PRIMARY KEY REFERENCES users(id),
        x INTEGER NOT NULL CHECK(x BETWEEN 1 AND 200),
        y INTEGER NOT NULL CHECK(y BETWEEN 1 AND 200),
        UNIQUE(x, y)
      )
    `);
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
        SELECT * FROM game_progress WHERE user_id = ? ORDER BY last_saved DESC, id DESC LIMIT 1 ORDER BY id DESC LIMIT 1
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

  // Allocates a unique base tile within a transaction; existing saved bases are respected.
  ensureBase(userId, username) {
    return db.transaction(() => {
      const existing = db.prepare("SELECT x, y FROM base_positions WHERE user_id = ?").get(userId);
      if (existing) return { username, ...existing };
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
      if (preferred && preferred.x >= 1 && preferred.x <= 200 && preferred.y >= 1 && preferred.y <= 200 &&
          !db.prepare("SELECT 1 FROM base_positions WHERE x = ? AND y = ?").get(preferred.x, preferred.y)) {
        selected = { x: preferred.x, y: preferred.y };
      } else {
        for (let i = 0; i < 40000; i++) {
          const x = (i % 200) + 1;
          const y = Math.floor(i / 200) + 1;
          if (!occupied.has(x + ":" + y)) { selected = { x, y }; break; }
        }
      }
      if (!selected) throw new Error("Map is full");
      db.prepare("INSERT INTO base_positions(user_id, x, y) VALUES (?, ?, ?)").run(userId, selected.x, selected.y);
      const castle = { username, ...selected };
      if (!progress) this.saveGameProgress(userId, castle, { Gold: 10000, Iron: 8000, Water: 6000, Solar: 4000 }, {});
      return castle;
    })();
  }

  createUser(email, username, hashedPassword) {
    return db.transaction(() => {
      const result = this.userQueries.createUser.run(email, username, hashedPassword);
      const userId = Number(result.lastInsertRowid);
      this.statsQueries.createStats.run(userId);
      const occupied = db.prepare(`
        SELECT 1 FROM base_positions WHERE x = ? AND y = ?
        UNION ALL
        SELECT 1 FROM game_progress
        WHERE json_valid(castle_data)
          AND CAST(json_extract(castle_data, '$.x') AS INTEGER) = ?
          AND CAST(json_extract(castle_data, '$.y') AS INTEGER) = ?
        LIMIT 1
      `);
      const reserve = db.prepare("INSERT INTO base_positions (user_id, x, y) VALUES (?, ?, ?)");
      let position = null;
      for (let i = 0; i < 40000; i++) {
        const x = (i % 200) + 1;
        const y = Math.floor(i / 200) + 1;
        if (!occupied.get(x, y, x, y)) {
          reserve.run(userId, x, y);
          position = { x, y };
          break;
        }
      }
      if (!position) throw new Error("Mars map is full");
      db.prepare(`INSERT INTO game_progress
        (user_id, castle_data, resources, structures) VALUES (?, ?, ?, ?)`)
        .run(userId, JSON.stringify({ username, ...position }),
          JSON.stringify({ Gold: 0, Iron: 0, Water: 0, Solar: 0 }), JSON.stringify({}));
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

  getGameProgress(userId) {
    try {
      const progress = this.progressQueries.getProgress.get(userId);
      if (!progress) return null;

      return {
        castle: JSON.parse(progress.castle_data),
        resources: JSON.parse(progress.resources),
        structures: JSON.parse(progress.structures),
        lastSaved: progress.last_saved,
      };
    } catch (error) {
      throw error;
    }
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
