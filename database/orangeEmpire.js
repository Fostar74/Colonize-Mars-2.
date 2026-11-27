const tactics = require("./orangeEmpireTactics");
const {placedMapObjects} = require("./mapObjects");
const {playerLevelFromXp, maxPlayerLevel} = require("../src/shared/playerTargeting");
const {marchLimit} = require("../src/shared/formations");
const {armyPopulation, profileFor, unitUpgradeMaxLevel} = require("../src/shared/unitProfiles");
const {
  categories, buildingNames, buildingMaxLevel, buildingPrice, buildingRequirements, buildingDuration, unitRequirement,
  unitPrice, unitTrainingDuration, unitUpgradeDetails, upgradePrice, upgradeDuration
} = require("../src/shared/unitEconomy");

const allianceId = "orange-empire";
const commanderCount = 10;
const maxCommanderLevel = maxPlayerLevel + 5;
const resourcesByBuilding = {
  Gold: "Gold Synthesizer", Iron: "Iron Driller", Water: "Water Extractor", Solar: "Solar Array"
};
const militaryBuildings = ["Training Center", "Drone Factory", "Vehicle Bay", "Upgrade Lab", "Order", "Defense Grid"];
const militaryUnits = Object.values(categories).flat();
const protocolOrder = ["Resource Management", "Accelerated Training", "Battle Command", "Reinforced Armor"];
const tickMs = 10000;
const catchUpMs = 24 * 60 * 60 * 1000;

function migrate(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS orange_empire_alliance (
      id TEXT PRIMARY KEY CHECK (id='orange-empire'),
      name TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS orange_empire_commanders (
      id INTEGER PRIMARY KEY CHECK (id BETWEEN 1 AND 10),
      alliance_id TEXT NOT NULL REFERENCES orange_empire_alliance(id),
      x INTEGER NOT NULL CHECK (x BETWEEN 1 AND 100),
      y INTEGER NOT NULL CHECK (y BETWEEN 1 AND 100),
      last_processed_at INTEGER NOT NULL,
      state TEXT NOT NULL,
      UNIQUE (x,y)
    );
    CREATE TABLE IF NOT EXISTS orange_empire_bootstrap (
      commander_id INTEGER PRIMARY KEY REFERENCES orange_empire_commanders(id),
      applied_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS orange_empire_attacks (
      id INTEGER PRIMARY KEY,
      commander_id INTEGER NOT NULL REFERENCES orange_empire_commanders(id),
      player_id INTEGER NOT NULL REFERENCES users(id),
      week_start INTEGER NOT NULL,
      slot INTEGER NOT NULL CHECK(slot IN (1,2)),
      station_id INTEGER,
      station_alliance_id INTEGER,
      origin_x INTEGER NOT NULL, origin_y INTEGER NOT NULL,
      x INTEGER NOT NULL, y INTEGER NOT NULL,
      launched_at INTEGER NOT NULL, arrives_at INTEGER NOT NULL,
      army TEXT NOT NULL, combat TEXT NOT NULL,
      result TEXT, returns_at INTEGER, returned_at INTEGER,
      UNIQUE(player_id,week_start,slot)
    );
    CREATE INDEX IF NOT EXISTS orange_empire_attack_arrivals ON orange_empire_attacks(arrives_at) WHERE result IS NULL;
    CREATE INDEX IF NOT EXISTS orange_empire_attack_returns ON orange_empire_attacks(returns_at) WHERE returned_at IS NULL;
    CREATE TABLE IF NOT EXISTS orange_empire_support (
      id INTEGER PRIMARY KEY,
      attack_id INTEGER NOT NULL REFERENCES orange_empire_attacks(id),
      sender_id INTEGER NOT NULL REFERENCES users(id),
      army TEXT NOT NULL,
      arrives_at INTEGER NOT NULL, travel_ms INTEGER NOT NULL,
      returns_at INTEGER, returned_at INTEGER,
      UNIQUE(attack_id,sender_id)
    );
    CREATE INDEX IF NOT EXISTS orange_empire_support_returns ON orange_empire_support(returns_at) WHERE returned_at IS NULL;
  `);
  tactics.migrate(db);
}

function initialState(army) {
  return {
    resources: Object.fromEntries(Object.keys(resourcesByBuilding).map(resource => [resource, 10000])),
    structures: {}, army, upgrades: {}, protocols: {}, knight: {level: 1, equippedItems: {}},
    jobs: {}, xp: 0, productionCarry: {}
  };
}

function bootstrap(state, id, template) {
  const emperor = id === commanderCount;
  const targetLevel = emperor ? 25 : 14 + id;
  for (const name of buildingNames) {
    state.structures[name] = Math.max(state.structures[name] || 0, Math.min(targetLevel, buildingMaxLevel(name)));
  }

  const targetPopulation = emperor ? 500000 : 80000 + 20000 * id;
  const deficit = targetPopulation - armyPopulation(state.army);
  if (deficit <= 0) return;

  // Scale the existing seed mix by its actual population, keeping every
  // already-earned troop. The one-population infantry absorbs rounding.
  const templatePopulation = armyPopulation(template);
  const reinforcements = Object.fromEntries(Object.entries(template)
    .filter(([unit,count]) => militaryUnits.includes(unit) && count > 0)
    .map(([unit,count]) => [unit, Math.floor(count * deficit / templatePopulation)]));
  reinforcements["Explorer Trooper"] += (deficit - armyPopulation(reinforcements)) / profileFor("Explorer Trooper").population;
  for (const [unit,count] of Object.entries(reinforcements)) {
    if (count) state.army[unit] = (state.army[unit] || 0) + count;
  }
}

function canSpend(resources, cost) {
  return cost && Object.entries(cost).every(([resource, amount]) => resources[resource] >= amount);
}

function spend(resources, cost) {
  for (const [resource, amount] of Object.entries(cost)) resources[resource] -= amount;
}

function allocateProtocols(state) {
  const level = playerLevelFromXp(state.xp, maxCommanderLevel);
  let points = level + Math.floor(level / 5);
  for (const tier of Object.values(state.protocols)) points -= tier * (tier + 1) / 2;
  for (const name of protocolOrder) {
    let tier = state.protocols[name] || 0;
    while (tier < 3 && points >= tier + 1) {
      tier++;
      points -= tier;
      state.protocols[name] = tier;
    }
  }
}

function produce(state, ticks, catalog) {
  const bonus = catalog.find(item => item.name === "Resource Management");
  const percent = bonus.values[(state.protocols[bonus.name] || 0) - 1] || 0;
  for (const [resource, building] of Object.entries(resourcesByBuilding)) {
    const hundredths = (state.structures[building] || 0) * ticks * (100 + percent)
      + (state.productionCarry[resource] || 0);
    state.resources[resource] += Math.floor(hundredths / 100);
    state.productionCarry[resource] = hundredths % 100;
  }
}

function settle(state, previous, now, catalog) {
  // Drop the oldest offline production. Complete already-paid jobs once, even
  // when their completion falls outside the retained production window.
  let cursor = Math.max(previous, now - catchUpMs);
  const due = Object.entries(state.jobs).filter(([,job]) => job.endsAt <= now)
    .sort(([,a], [,b]) => a.endsAt - b.endsAt);
  for (const [key, job] of due) {
    const ticks = Math.max(0, Math.floor((job.endsAt - cursor) / tickMs));
    produce(state, ticks, catalog);
    cursor += ticks * tickMs;
    if (key === "building") {
      // A paid job can finish after the one-time boost has raised its building.
      state.structures[job.name] = Math.max(state.structures[job.name] || 0, job.level);
    }
    else if (key === "upgrade") {
      state.upgrades[job.unit] ??= {};
      state.upgrades[job.unit][job.stat] = job.level;
    } else {
      state.army[job.unit] = (state.army[job.unit] || 0) + 1;
    }
    state.xp = Math.max(state.xp,Math.min((maxCommanderLevel - 1) * 1000, state.xp + job.xp));
    allocateProtocols(state);
    delete state.jobs[key];
  }
  const ticks = Math.floor((now - cursor) / tickMs);
  produce(state, ticks, catalog);
}

function startJobs(state, now, catalog, lessons = {}) {
  const {structures, resources, jobs} = state;
  const production = Object.values(resourcesByBuilding);
  let reserve = {};
  if (!jobs.building) {
    const buildings = [...production, ...militaryBuildings].sort((a,b) => (structures[a] || 0) - (structures[b] || 0));
    const plans = buildings.map(name => {
      const level = (structures[name] || 0) + 1;
      return {name, level, cost: buildingPrice(name, level)};
    }).filter(({name, level, cost}) => cost &&
      Object.entries(buildingRequirements(name, level)).every(([building, minimum]) => (structures[building] || 0) >= minimum));
    const plan = plans.find(({cost}) => canSpend(resources, cost));
    if (plan) {
      const {name, level, cost} = plan;
      spend(resources, cost);
      jobs.building = {name, level, endsAt: now + buildingDuration(name, level), xp: totalCost(cost)};
    } else if (plans.length) {
      reserve = plans[0].cost;
    }
  }

  // Let production accumulate for the next building while military jobs spend
  // only the surplus. Otherwise frequent training can starve construction.
  const canSpendSurplus = cost => Object.entries(cost).every(([resource, amount]) =>
    resources[resource] - (reserve[resource] || 0) >= amount);
  // Keep one active
  // job per military queue so recovery never needs to replay queue decisions.
  const training = catalog.find(item => item.name === "Accelerated Training");
  const trainingBonus = (training.values[(state.protocols[training.name] || 0) - 1] || 0) / 100;
  const priorities = Object.entries(categories).sort(([a],[b])=>(lessons["train:"+b]||0)-(lessons["train:"+a]||0));
  for (const [category, units] of priorities) {
    if (jobs[category]) continue;
    const unit = [...units].sort((a,b) => (state.army[a] || 0) - (state.army[b] || 0)).find(name => {
      const {building, level} = unitRequirement(name);
      return (structures[building] || 0) >= level && canSpendSurplus(unitPrice(name));
    });
    if (!unit) continue;
    const cost = unitPrice(unit);
    const trainingLevel = structures[unitRequirement(unit).building];
    const duration = Math.max(1000, Math.ceil(unitTrainingDuration(unit) * 1000 *
      (1 - trainingBonus) * (1 - Math.min(0.9, trainingLevel * 0.03))));
    spend(resources, cost);
    jobs[category] = {unit, endsAt: now + duration, xp: 3 * totalCost(cost)};
  }

  if (!jobs.upgrade && structures["Upgrade Lab"]) {
    const upgrades = militaryUnits.filter(unit => state.army[unit] > 0).flatMap(unit =>
      ["attack", "defense"].map(stat => ({unit, stat, level: state.upgrades[unit]?.[stat] || 1})));
    upgrades.sort((a,b) => a.level - b.level);
    for (const {unit, stat, level} of upgrades) {
      if (level >= unitUpgradeMaxLevel(unit, stat)) continue;
      const details = unitUpgradeDetails(unit, stat, level);
      const cost = details?.cost || upgradePrice(level);
      if (!canSpendSurplus(cost)) continue;
      const duration = Math.max(1000, Math.ceil((details?.durationMs || upgradeDuration(level)) *
        (1 - structures["Upgrade Lab"] * 0.015)));
      spend(resources, cost);
      jobs.upgrade = {unit, stat, level: level + 1, endsAt: now + duration, xp: 2 * totalCost(cost)};
      break;
    }
  }
}

function totalCost(cost) {
  return Object.values(cost).reduce((total, value) => total + value, 0);
}

function advance(db, {chooseSpawn, garrison, catalog}, now = Date.now()) {
  if (!enabled()) return;
  db.transaction(() => {
    db.prepare("INSERT OR IGNORE INTO orange_empire_alliance(id,name) VALUES (?,?)")
      .run(allianceId, "The Orange Empire");
    const rows = db.prepare(`SELECT c.*, b.commander_id AS bootstrapped FROM orange_empire_commanders c
      LEFT JOIN orange_empire_bootstrap b ON b.commander_id=c.id ORDER BY c.id`).all();
    const markBootstrap = db.prepare("INSERT INTO orange_empire_bootstrap(commander_id,applied_at) VALUES (?,?)");
    if (rows.length < commanderCount) {
      const occupied = placedMapObjects(db);
      const ids = new Set(rows.map(row => row.id));
      const insert = db.prepare(`INSERT INTO orange_empire_commanders
        (id,alliance_id,x,y,last_processed_at,state) VALUES (?,?,?,?,?,?)`);
      for (let id = 1; id <= commanderCount; id++) {
        if (ids.has(id)) continue;
        const tile = chooseSpawn(occupied);
        occupied.push(tile);
        const template = garrison(id);
        const state = initialState({...template});
        bootstrap(state, id, template);
        allocateProtocols(state);
        startJobs(state, now, catalog);
        insert.run(id, allianceId, tile.x, tile.y, now, JSON.stringify(state));
        markBootstrap.run(id, now);
      }
    }
    const save = db.prepare("UPDATE orange_empire_commanders SET last_processed_at=?,state=? WHERE id=?");
    const lessons = tactics.lessons(db);
    for (const row of rows) {
      const ticks = Math.floor((now - row.last_processed_at) / tickMs);
      if (ticks < 1 && row.bootstrapped) continue;
      const through = row.last_processed_at + Math.max(0,ticks) * tickMs;
      const state = JSON.parse(row.state);
      if (ticks > 0) settle(state, row.last_processed_at, through, catalog);
      if (!row.bootstrapped) {
        bootstrap(state, row.id, garrison(row.id));
        markBootstrap.run(row.id, now);
      }
      if (ticks > 0) {
        tactics.practice(db,row.id,state.army,through,lessons);
        startJobs(state, through, catalog, lessons);
      }
      save.run(through, JSON.stringify(state), row.id);
    }
  }).immediate();
}

function enabled() {
  return process.env.ORANGE_EMPIRE_ENABLED === "true";
}

function mapBases(db) {
  if (!enabled()) return [];
  return db.prepare(`SELECT id,x,y,
    json_extract(state,'$.knight.level') AS knightLevel FROM orange_empire_commanders ORDER BY id`)
    .all().map(({id, x, y, knightLevel}) => ({
      id, x, y, knightLevel, emperor: id === commanderCount, level: maxCommanderLevel
    }));
}

function combatEnabled() {
  return enabled() && process.env.ORANGE_EMPIRE_ATTACKS_ENABLED === "true";
}
function eligibleHumanTarget({isHuman, xp, protectedUntil = 0}, now) {
  return isHuman === true && playerLevelFromXp(xp) === maxPlayerLevel && protectedUntil <= now;
}

function validAttackArmy(army) {
  if (!army || typeof army !== "object" || Array.isArray(army)) return false;
  const entries = Object.entries(army);
  if (!entries.length || !entries.every(([unit, count]) =>
    militaryUnits.includes(unit) && Number.isSafeInteger(count) && count > 0 && count <= marchLimit)) return false;
  const population = armyPopulation(army);
  return population > 0 && population <= marchLimit;
}

module.exports = {advance, combatEnabled, eligibleHumanTarget, mapBases, migrate, validAttackArmy};
