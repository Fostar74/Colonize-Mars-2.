const assert=require("node:assert/strict");
const {test}=require("node:test");
const {mkdtempSync,rmSync}=require("node:fs");
const {tmpdir}=require("node:os");
const {join}=require("node:path");
const SQLite=require("better-sqlite3");
const {hour,cargoFullAt,settleWork}=require("../database/allianceMineWork");
const {labyrinthMonster,attackMultipliers,createBattle,strike}=require("../database/labyrinthCombat");
const migrateAllianceMines=require("../database/allianceMineSchema");
const products=require("../src/shared/allianceMarket");

test("legacy migration preserves the mine at 58:13, AP and active work",()=>{
  const db=new SQLite(":memory:");
  try {
    db.exec(`CREATE TABLE resource_gathering_reports(id INTEGER PRIMARY KEY);
      CREATE TABLE alliance_wallets(user_id INTEGER PRIMARY KEY,points INTEGER,construction_remainder INTEGER);
      CREATE TABLE alliance_mines(id INTEGER PRIMARY KEY,alliance_id INTEGER,x INTEGER,y INTEGER,status TEXT,work INTEGER);
      CREATE TABLE alliance_mine_marches(id INTEGER PRIMARY KEY,mine_id INTEGER,user_id INTEGER,mode TEXT,returned_at INTEGER,work INTEGER);
      INSERT INTO alliance_wallets VALUES(1,34567,123);
      INSERT INTO alliance_mines VALUES(1,1,58,13,'construction',123456);
      INSERT INTO alliance_mine_marches VALUES(1,1,1,'construction',NULL,123456)`);
    migrateAllianceMines(db);
    migrateAllianceMines(db);
    assert.deepEqual(db.prepare("SELECT x,y,status,work FROM alliance_mines").get(),{x:58,y:13,status:"construction",work:123456});
    assert.deepEqual(db.prepare("SELECT work,legacy_construction_work,returned_at FROM alliance_mine_marches").get(),
      {work:123456,legacy_construction_work:123456,returned_at:null});
    assert.deepEqual(db.prepare("SELECT points,construction_remainder,construction_ap_remainder FROM alliance_wallets").get(),
      {points:34567,construction_remainder:123,construction_ap_remainder:0});
    const march={arrives_at:10000,launched_at:1000,gathering_rate_changed_at:15400,capacity:3,gathered:1};
    assert.equal(cargoFullAt(march),18100);
    assert.equal(settleWork({status:"gathering",amount:10},[march],18100).credits[0].amount,2);
  } finally {db.close();}
});

test("market activations, timed boosts and extra attempts retain normal limits",()=>{
  const temp=mkdtempSync(join(tmpdir(),"cm115-"));
  process.env.DATABASE_PATH=join(temp,"game.sqlite");
  const Game=require("../database/database");
  const game=new Game(), db=new SQLite(process.env.DATABASE_PATH);
  const clock=Date.now;
  let now=clock();
  Date.now=()=>now;
  try {
    const newPlayer=name=>game.createUser(name+"@example.test",name,"test-hash").userId;
    const user=newPlayer("Market"),second=newPlayer("Parity");
    assert.equal(game.createAlliance(user,"Market Alliance").error,undefined);
    db.prepare("INSERT INTO alliance_wallets(user_id,points) VALUES (?,?) ON CONFLICT(user_id) DO UPDATE SET points=excluded.points").run(user,70000);
    game.getInventory(user);
    db.prepare("UPDATE inventory_reserves SET resources=? WHERE user_id=?").run('{"Gold":500}',user);
    assert.match(game.buyAllianceMarket(user,"gold").error,/Unknown/);
    assert.equal(game.getInventory(user).resources.Gold,500);
    for(const item of Object.keys(products)){
      assert.equal(game.buyAllianceMarket(user,item).inventory.items[item],1,item);
    }
    const wallet=db.prepare("SELECT points FROM alliance_wallets WHERE user_id=?");
    assert.equal(wallet.get(user).points,70000-Object.values(products).reduce((sum,item)=>sum+item.cost,0));
    assert.equal(game.useInventoryItem(user,"external_10",1).error,undefined);
    assert.equal(game.buyAllianceMarket(user,"external_10").inventory.items.external_10,1);
    assert.match(game.useInventoryItem(user,"external_10",1).error,/already active/);
    assert.equal(game.getInventory(user).items.external_10,1);
    assert.equal(game.useInventoryItem(user,"external_25",1).error,undefined);
    const start=now;
    const external={claimed_by:user,gathering_rate:1000,amount:50000,arrives_at:start-hour,gathering_started_at:start-hour};
    assert.equal(game.externalGatheringProgress(external,start+hour,50000).amount,2250);
    assert.equal(game.externalGatheringProgress(external,start+9*hour,50000).amount,12000);
    assert.equal(game.externalGatheringProgress({...external,amount:2250},start+hour,50000).finishAt,start+hour);
    assert.equal(game.useInventoryItem(user,"production_10",1).error,undefined);
    game.runtime(user);
    db.prepare("UPDATE game_runtime SET production_at=? WHERE user_id=?").run(start,user);
    db.prepare("UPDATE game_progress SET structures=? WHERE user_id=?").run('{"Gold Synthesizer":10}',user);
    const initial=game.getGameProgress(user).resources.Gold;
    now=start+100000;
    assert.equal(game.syncGame(user).resources.Gold-initial,110);
    assert.equal(game.useInventoryItem(user,"alien_attempt",1).inventory.items.alien_attempt,undefined);
    const alien=game.getAlienCampaign(user);
    assert.equal(alien.used,0);
    assert.equal(alien.remaining,21);
    assert.match(game.attackAlienBase(user,2,{"Explorer Trooper":1},null,true).error,/previous/);
    assert.equal(game.getAlienCampaign(user).bonusMissions,1);
    const mission=db.prepare("INSERT INTO alien_missions(user_id,level,army,launched_at,arrives_at,resolved_at,returns_at,returned_at) VALUES (?,1,'{}',?,?,?,?,?)");
    for(let i=0;i<20;i++)mission.run(user,now,now,now,now,now);
    assert.match(game.attackAlienBase(user,1,{},null,true).error,/at least one/);
    db.prepare("UPDATE game_runtime SET army=? WHERE user_id=?").run('{"Explorer Trooper":1}',user);
    const launched=game.attackAlienBase(user,1,{"Explorer Trooper":1},null,true);
    assert.ok(launched.missionId,launched.error);
    assert.equal(game.getAlienCampaign(user).bonusMissions,0);
    assert.equal(game.getAlienCampaign(user).used,21);
    assert.match(game.useInventoryItem(user,"labyrinth_attempt",1).error,/unavailable/);
    assert.equal(game.getInventory(user).items.labyrinth_attempt,1);
    const levelUp=db.prepare("INSERT INTO alien_rewards(user_id,knight_level) VALUES (?,50) ON CONFLICT(user_id) DO UPDATE SET knight_level=50");
    for(const id of [user,second]){
      levelUp.run(id);
      game.getLabyrinthStatus(id);
      const slots=["ARMOR","HELMET","BOOTS","WEAPON","SHIELD","GLOVES"];
      const equipped=Object.fromEntries(slots.map(slot=>[slot,{id:"fixture-"+slot,slot,level:50}]));
      game.saveUserEquipment(id,equipped,[],{});
      db.prepare("UPDATE labyrinth_players SET combat_room=101,combat_hp_bonus=60000 WHERE user_id=?").run(id);
    }
    db.prepare("UPDATE labyrinth_players SET missions_today=10 WHERE user_id=?").run(user);
    assert.equal(game.useInventoryItem(user,"labyrinth_attempt",1).inventory.items.labyrinth_attempt,undefined);
    const manualStart=game.labyrinthBattle(user,"start");
    assert.equal(manualStart.status.missionsToday,10);
    assert.equal(manualStart.status.bonusBattles,0);
    let manual=manualStart;
    while(manual.battle)manual=game.labyrinthBattle(user,"strike");
    const auto=game.runLabyrinthMission(second);
    assert.equal(manual.victory,true);
    assert.ok(manual.log.at(-1).round>20);
    assert.deepEqual(auto.log,manual.log);
    assert.equal(auto.victory,manual.victory);
    assert.match(game.labyrinthBattle(user,"start").error,/daily/);
    const original=createBattle({...labyrinthMonster(101),damage:111,healingCap:undefined},
      {maxHp:10000,attack:1000,enemyHpReduction:0,enemyAttackReduction:0,enemyHealingReduction:0,healing:0},0);
    original.combatVersion=2;
    original.round=18;
    db.prepare("UPDATE labyrinth_players SET combat_active=? WHERE user_id=?").run(JSON.stringify(original),second);
    assert.deepEqual(game.labyrinthBattle(second,"status").battle,JSON.parse(JSON.stringify(original)));
    const existing=game.labyrinthBattle(second,"strike").battle;
    assert.equal(existing.monster.damage,111);
    assert.equal(existing.knightHp,9889);
    assert.equal(existing.log[0].damage,1000);
    const legacyEnd=game.labyrinthBattle(second,"strike");
    assert.equal(legacyEnd.defeat,true);
    assert.equal(legacyEnd.log.at(-1).round,20);
    assert.equal(legacyEnd.status.room,102);
    assert.equal(legacyEnd.status.knight.bonusHp,auto.status.knight.bonusHp);
    assert.equal(legacyEnd.status.knight.attack,1500);
  } finally {
    Date.now=clock;
    db.close();
    game.close();
    rmSync(temp,{recursive:true,force:true});
  }
});

test("Labyrinth simulation keeps early stats and all 300 rooms attainable with forge level 50",()=>{
  let earnedHp=0,previousBossAttack=0,longest=0;
  for(let room=1;room<=300;room++){
    const monster=labyrinthMonster(room);
    if(room%10===0){
      assert.ok(monster.damage>previousBossAttack);
      previousBossAttack=monster.damage;
    }
    if(room<=40){
      assert.equal(attackMultipliers[monster.stage-1],1);
      assert.equal(monster.healingCap,undefined);
    }
    const knight={maxHp:Math.round((10000+earnedHp)*1.5),attack:1500,healing:50,
      enemyAttackReduction:50,enemyHpReduction:50,enemyHealingReduction:50};
    const battle=createBattle(monster,knight,0);
    let outcome;
    do {
      outcome=strike(battle);
      assert.ok(battle.round<50,"Long fight in room "+room);
    } while(!outcome.victory&&!outcome.defeat);
    assert.equal(outcome.victory,true,"Room "+room);
    longest=Math.max(longest,battle.round);
    earnedHp+=Math.floor(monster.hp/100);
  }
  assert.ok(longest>20,"Late-game fights can continue past round 20");
});

test("even the highest-HP boss cannot outheal a surviving knight indefinitely",()=>{
  const monster=labyrinthMonster(300);
  const knight={maxHp:10000000,attack:1000,healing:50,
    enemyAttackReduction:50,enemyHpReduction:0,enemyHealingReduction:0};
  const battle=createBattle(monster,knight,0);
  let outcome;
  do {
    outcome=strike(battle);
    assert.ok(battle.round<50);
  } while(!outcome.victory&&!outcome.defeat);
  assert.equal(outcome.victory,true);
  assert.ok(battle.round>20);
});
