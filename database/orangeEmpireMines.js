const {blockedMineTiles} = require("./externalMines");
const {tileKey} = require("../src/shared/mapSpacing");
const {armyPopulation,profileFor} = require("../src/shared/unitProfiles");
const {armyTravelDuration,cargoCapacity} = require("../src/shared/unitEconomy");
const {marchLimit} = require("../src/shared/formations");
const {hour,constructionTarget,settleWork,cargoFullAt} = require("./allianceMineWork");

const allianceMineId = "orange-empire-mine";
const resources = {gold:"Gold",iron:"Iron",water:"Water",solar:"Solar"};
const allianceStock = 1000000;

function migrate(db) {
  db.exec(`CREATE TABLE IF NOT EXISTS orange_empire_alliance_mine (
    id TEXT PRIMARY KEY CHECK(id='orange-empire-mine'),
    x INTEGER NOT NULL, y INTEGER NOT NULL,
    resource TEXT NOT NULL,
    status TEXT NOT NULL,
    work INTEGER NOT NULL DEFAULT 0,
    amount INTEGER NOT NULL DEFAULT ${allianceStock}
  );
  CREATE TABLE IF NOT EXISTS orange_empire_mine_marches (
    id INTEGER PRIMARY KEY,
    commander_id INTEGER NOT NULL REFERENCES orange_empire_commanders(id),
    external_id INTEGER UNIQUE REFERENCES resource_mines(id),
    mode TEXT NOT NULL CHECK(mode IN ('external','construction','gathering')),
    units TEXT NOT NULL, population INTEGER NOT NULL, capacity INTEGER NOT NULL,
    launched_at INTEGER NOT NULL, arrives_at INTEGER NOT NULL,
    credited_at INTEGER NOT NULL, gathering_started_at INTEGER,
    gathered INTEGER NOT NULL DEFAULT 0, rate INTEGER
  );
  CREATE UNIQUE INDEX IF NOT EXISTS orange_empire_alliance_march_owner
    ON orange_empire_mine_marches(commander_id) WHERE external_id IS NULL;`);
}

function reserveArmy(army, stock) {
  const units = {};
  let population = marchLimit;
  let cargo = stock;
  for (const [unit,count] of Object.entries(army)) {
    const weight = profileFor(unit)?.population;
    const capacity = cargoCapacity[unit];
    if (!weight || !capacity || !count || cargo <= 0) continue;
    const selected = Math.min(count,Math.floor(population/weight),Math.ceil(cargo/capacity));
    if (selected <= 0) continue;
    units[unit] = selected;
    population -= selected*weight;
    cargo -= selected*capacity;
  }
  return units;
}

function dispatch(db, commander, state, mine, mode, catalog, now) {
  const units = reserveArmy(state.army,mode==="construction" ? Infinity : mine.amount);
  if (!Object.keys(units).length) return false;
  const capacity = Object.entries(units).reduce((sum,[unit,count])=>sum+cargoCapacity[unit]*count,0);
  const bonus = name => catalog.find(item=>item.name===name)?.values[(state.protocols[name]||0)-1] || 0;
  const arrivesAt = now+Math.max(10000,armyTravelDuration(Math.hypot(commander.x-mine.x,commander.y-mine.y)*1000,units,bonus("Rapid Deployment")));
  const rate = mode==="external" ? 1000*(1+bonus("Mining Operations")/100) : null;
  db.prepare(`INSERT INTO orange_empire_mine_marches
    (commander_id,external_id,mode,units,population,capacity,launched_at,arrives_at,credited_at,gathering_started_at,rate)
    VALUES (?,?,?,?,?,?,?,?,?,?,?)`).run(commander.id,mode==="external"?mine.id:null,mode,JSON.stringify(units),
      armyPopulation(units),capacity,now,arrivesAt,arrivesAt,mode==="construction"?null:arrivesAt,rate);
  for (const [unit,count] of Object.entries(units)) state.army[unit]-=count;
  return true;
}

function schedule(db, catalog, now) {
  const commanders = db.prepare("SELECT * FROM orange_empire_commanders ORDER BY id").all();
  if (!commanders.length) return;
  const allianceMine = db.prepare("SELECT * FROM orange_empire_alliance_mine").get() || placeMine(db,commanders.at(-1));
  const occupied = db.prepare(`SELECT c.id,m.mode,COUNT(m.id) AS count FROM orange_empire_commanders c
    JOIN orange_empire_mine_marches m ON m.commander_id=c.id GROUP BY c.id,m.mode`).all();
  const freeMines = db.prepare(`SELECT * FROM resource_mines r WHERE claimed_by IS NULL AND amount>0
    AND NOT EXISTS (SELECT 1 FROM orange_empire_mine_marches m WHERE m.external_id=r.id)`).all();
  for (const commander of commanders) {
    const state = JSON.parse(commander.state);
    const slots = 4 + ([0,1,3,5][state.protocols["Mining Operations"]||0]||0);
    const active = occupied.find(row=>row.id===commander.id&&row.mode==="external")?.count || 0;
    let launched = false;
    // Limit launches per tick and choose the nearest unclaimed deposit.
    if (active < slots && freeMines.length) {
      let nearest = 0;
      const distance = mine => (commander.x-mine.x)**2+(commander.y-mine.y)**2;
      for (let i=1;i<freeMines.length;i++) if (distance(freeMines[i])<distance(freeMines[nearest])) nearest=i;
      if (dispatch(db,commander,state,freeMines[nearest],"external",catalog,now)) {
        freeMines.splice(nearest,1);
        launched = true;
      }
    }
    if (allianceMine && !occupied.some(row=>row.id===commander.id&&row.mode!=="external")) {
      if (dispatch(db,commander,state,allianceMine,allianceMine.status,catalog,now)) launched = true;
    }
    if (launched) db.prepare("UPDATE orange_empire_commanders SET state=? WHERE id=?").run(JSON.stringify(state),commander.id);
  }
}

function placeMine(db, commander) {
  const blocked = blockedMineTiles(db);
  let position, best = Infinity;
  for (let x=1;x<=100;x++) for (let y=1;y<=100;y++) {
    if (blocked.has(tileKey(x,y))) continue;
    const distance=(x-commander.x)**2+(y-commander.y)**2;
    if (distance<best) {best=distance;position={x,y};}
  }
  if (!position) return null;
  db.prepare("INSERT INTO orange_empire_alliance_mine(id,x,y,resource,status) VALUES (?,?,?,'Gold','construction')")
    .run(allianceMineId,position.x,position.y);
  return db.prepare("SELECT * FROM orange_empire_alliance_mine").get();
}

function credit(db, march, resource, amount) {
  const {state:raw} = db.prepare("SELECT state FROM orange_empire_commanders WHERE id=?").get(march.commander_id);
  const state = JSON.parse(raw);
  for (const [unit,count] of Object.entries(JSON.parse(march.units))) state.army[unit]=(state.army[unit]||0)+count;
  state.resources[resource]=(state.resources[resource]||0)+amount;
  db.prepare("UPDATE orange_empire_commanders SET state=? WHERE id=?").run(JSON.stringify(state),march.commander_id);
  db.prepare("DELETE FROM orange_empire_mine_marches WHERE id=?").run(march.id);
}

function settle(db, now, retired) {
  const external = db.prepare(`SELECT m.*,r.amount,r.resource,r.x,r.y FROM orange_empire_mine_marches m
    JOIN resource_mines r ON r.id=m.external_id WHERE m.arrives_at<=? ORDER BY m.id`).all(now);
  for (const march of external) {
    const amount = Math.min(march.capacity,march.amount);
    if (now < march.arrives_at+Math.ceil(amount*hour/march.rate)) continue;
    credit(db,march,resources[march.resource],amount);
    if (amount===march.amount) {
      retired.push(march);
      db.prepare("DELETE FROM resource_mines WHERE id=?").run(march.external_id);
    } else {
      db.prepare("UPDATE resource_mines SET amount=amount-? WHERE id=?").run(amount,march.external_id);
    }
  }
  const mine = db.prepare("SELECT * FROM orange_empire_alliance_mine").get();
  if (!mine) return;
  const marches = db.prepare("SELECT * FROM orange_empire_mine_marches WHERE external_id IS NULL ORDER BY id");
  if (mine.status==="construction") {
    const {credits,remaining,finished,at} = settleWork(mine,marches.all(),now);
    for (const {march,amount} of credits) {
      if (amount) db.prepare("UPDATE orange_empire_mine_marches SET credited_at=? WHERE id=?").run(at,march.id);
    }
    const work = constructionTarget-remaining;
    if (work!==mine.work || finished) db.prepare("UPDATE orange_empire_alliance_mine SET work=?,status=?").run(work,finished?"gathering":"construction");
    if (!finished) return;
    db.prepare("UPDATE orange_empire_mine_marches SET mode='gathering',gathering_started_at=MAX(arrives_at,?) WHERE external_id IS NULL").run(at);
    mine.status="gathering";
  }
  const {credits,remaining,finished} = settleWork(mine,marches.all(),now);
  for (const {march,amount} of credits) {
    const collected = march.gathered+amount;
    if (finished || now>=cargoFullAt(march)) credit(db,march,mine.resource,collected);
    else if (amount) db.prepare("UPDATE orange_empire_mine_marches SET gathered=? WHERE id=?").run(collected,march.id);
  }
  if (finished) db.prepare("DELETE FROM orange_empire_alliance_mine").run();
  else if (remaining!==mine.amount) db.prepare("UPDATE orange_empire_alliance_mine SET amount=?").run(remaining);
}

function mapMine(db) {
  if (process.env.ORANGE_EMPIRE_ENABLED!=="true") return [];
  return db.prepare("SELECT id,x,y,LOWER(resource) AS resource,status,1 AS npc FROM orange_empire_alliance_mine").all();
}

module.exports = {migrate,schedule,settle,mapMine};
