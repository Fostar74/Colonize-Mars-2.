const {categories} = require("../src/shared/unitEconomy");
const {profileFor,armyPopulation} = require("../src/shared/unitProfiles");
const {defaultFormation,marchLimit} = require("../src/shared/formations");
const {fight,playerTypes} = require("../shared/combatEngine");

const plans = ["balanced","advance","hold"];
const categoryFor = Object.fromEntries(Object.entries(categories).flatMap(([category,units])=>units.map(unit=>[unit,category])));

function migrate(db) {
  db.exec(`CREATE TABLE IF NOT EXISTS orange_empire_practice (
    commander_id INTEGER PRIMARY KEY REFERENCES orange_empire_commanders(id),
    day INTEGER NOT NULL,
    plan TEXT NOT NULL,
    simulations INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS orange_empire_lessons (
    lesson TEXT PRIMARY KEY,
    score INTEGER NOT NULL,
    samples INTEGER NOT NULL
  )`);
}

function balancedArmy(army, budget) {
  const result = {};
  let remaining = Math.min(marchLimit,budget);
  const groups = Object.values(categories).filter(units=>units.some(unit=>army[unit]>0));
  const take = (units, limit) => {
    let left = limit;
    const available = units.filter(unit=>army[unit]>(result[unit]||0));
    for (const [index,unit] of available.entries()) {
      const weight = profileFor(unit)?.population || 1;
      const count = Math.min(army[unit]-(result[unit]||0),Math.floor(left/(available.length-index)/weight));
      if (count<=0) continue;
      result[unit]=(result[unit]||0)+count;
      left-=count*weight;
    }
    remaining-=limit-left;
  };
  for (let index=0;index<groups.length;index++) take(groups[index],Math.floor(remaining/(groups.length-index)));
  if (remaining) take(groups.flat(),remaining);
  return result;
}

function formation(army, plan) {
  const defaults = defaultFormation();
  const occupied = [0,0,0,0];
  const ordered = Object.entries(army).sort(([a],[b])=>playerTypes[a].range-playerTypes[b].range);
  return ordered.map(([unit,count])=>{
    const max = Math.min(4,playerTypes[unit].range);
    const preference = defaults[unit]+(plan==="advance"?-1:plan==="hold"?1:0);
    let row = Math.max(1,Math.min(max,preference));
    if (occupied[row-1]>=7) row = occupied.findIndex((n,i)=>i<max&&n<7)+1 || row;
    occupied[row-1]++;
    return {unit,count,row};
  });
}

function practice(db, id, army, now, lessons) {
  const day = Math.floor(now/86400000);
  if (db.prepare("SELECT 1 FROM orange_empire_practice WHERE commander_id=? AND day>=?").get(id,day)) return;
  const sample = balancedArmy(army,1200);
  if (!Object.keys(sample).length) return;
  let best = plans[0], bestScore = -Infinity;
  for (const plan of plans) {
    let seed = 139;
    const random = () => {seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
    // Practice against the Empire's own units, never human garrison data.
    const result = fight(sample,sample,formation(sample,plan),{},{
      playerDefense:true,defenderFormation:formation(sample,"balanced"),random,maxRounds:12
    });
    const score = armyPopulation(result.survivors)-armyPopulation(result.defenderSurvivors)
      +100*(lessons["plan:"+plan]||0);
    if (score>bestScore) {best=plan;bestScore=score;}
  }
  db.prepare(`INSERT INTO orange_empire_practice(commander_id,day,plan,simulations) VALUES (?,?,?,?)
    ON CONFLICT(commander_id) DO UPDATE SET day=excluded.day,plan=excluded.plan,simulations=excluded.simulations`)
    .run(id,day,best,plans.length);
}

function lessons(db) {
  return Object.fromEntries(db.prepare("SELECT lesson,score,samples FROM orange_empire_lessons").all()
    .map(row=>[row.lesson,row.score/row.samples]));
}

function recordBattle(db, plan, result, army) {
  const record = db.prepare(`INSERT INTO orange_empire_lessons(lesson,score,samples) VALUES (?,?,1)
    ON CONFLICT(lesson) DO UPDATE SET score=score+excluded.score,samples=samples+1`);
  record.run("plan:"+plan,result.victory?1:-1);
  for (const [category,units] of Object.entries(categories)) {
    const before = units.reduce((sum,unit)=>sum+(army[unit]||0),0);
    if (!before) continue;
    const after = units.reduce((sum,unit)=>sum+(result.survivors[unit]||0),0);
    record.run("train:"+category,Math.round(100*(before-after)/before));
    const impact = result.report.flatMap(round=>round.events).some(event=>
      event.attacker==="Player"&&categoryFor[event.unit]===category&&event.kills>0);
    if (impact) record.run("train:"+category,100);
  }
}

module.exports = {migrate,balancedArmy,formation,practice,lessons,recordBattle};
