const assert = require("node:assert/strict");
const {test} = require("node:test");
const {mkdtempSync,rmSync} = require("node:fs");
const {tmpdir} = require("node:os");
const {join} = require("node:path");
const SQLite = require("better-sqlite3");
const {touchesTile} = require("../src/shared/mapSpacing");

test("new bases and mines reserve neighboring tiles without moving existing objects",()=>{
  const directory=mkdtempSync(join(tmpdir(),"map-spacing-"));
  process.env.DATABASE_PATH=join(directory,"game.sqlite");
  const Game=require("../database/database");
  const {placedMapObjects}=require("../database/mapObjects");
  const game=new Game(), sql=new SQLite(process.env.DATABASE_PATH);
  try{
    const mines=sql.prepare("SELECT id,x,y,resource FROM resource_mines ORDER BY id").all();
    assert.equal(mines.length,80);
    for(const [i,mine] of mines.entries()){
      assert.ok(!mines.slice(i+1).some(other=>touchesTile(other,mine.x,mine.y)));
    }
    for(let i=0;i<14;i++){
      const occupied=placedMapObjects(sql);
      const {position}=game.createUser("map"+i+"@example.test","Map"+i,"fixture");
      assert.ok(!occupied.some(tile=>touchesTile(tile,position.x,position.y)));
    }
    const leader=game.findUserByUsername("Map0");
    const leaderBase=game.getPublicBases().find(base=>base.user_id===leader.id);
    const step=coordinate=>coordinate===100?-1:1;
    assert.equal(game.createAlliance(leader.id,"Spacing test").error,undefined);
    const adjacentTo=(x,y)=>game.placeAllianceMine(leader.id,x+step(x),y+step(y),"Gold");
    assert.match(adjacentTo(leaderBase.x,leaderBase.y).error,/empty (?:map )?tile/);
    assert.match(adjacentTo(mines[0].x,mines[0].y).error,/empty (?:map )?tile/);
    const available=placedMapObjects(sql);
    assert.ok(game.placeAllianceMine(leader.id,50,45,"Gold").success);
    const second=game.findUserByUsername("Map1");
    assert.equal(game.createAlliance(second.id,"Spacing test two").error,undefined);
    assert.match(game.placeAllianceMine(second.id,51,46,"Water").error,/one empty tile/);
    assert.ok(game.placeAllianceMine(second.id,52,45,"Water").success);
    const maintained=sql.prepare("SELECT x,y FROM base_positions WHERE user_id=?").get(leader.id);
    assert.deepEqual(game.ensureBase(leader.id,leader.username),{username:leader.username,...maintained});

    sql.prepare("UPDATE resource_mines SET amount=0 WHERE id=?").run(mines[0].id);
    game.settleResourceMines();
    const replacement=sql.prepare("SELECT id,x,y,resource FROM resource_mines ORDER BY id DESC LIMIT 1").get();
    assert.equal(replacement.resource,mines[0].resource);
    assert.ok(replacement.id>mines.at(-1).id);
    assert.ok(!available.some(tile=>touchesTile(tile,replacement.x,replacement.y)));
    assert.ok(![{x:50,y:45},{x:52,y:45}].some(tile=>touchesTile(tile,replacement.x,replacement.y)));
    assert.deepEqual(sql.prepare("SELECT id,x,y,resource FROM resource_mines WHERE id<=? ORDER BY id").all(mines.at(-1).id),mines.slice(1));
  }finally{
    sql.close();
    game.close();
    rmSync(directory,{recursive:true,force:true});
  }
});
