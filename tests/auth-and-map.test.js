const assert = require("node:assert/strict");
const {test} = require("node:test");
const {mkdtempSync,rmSync} = require("node:fs");
const {tmpdir} = require("node:os");
const {join} = require("node:path");
const {spawn} = require("node:child_process");
const {once} = require("node:events");
const SQLite = require("better-sqlite3");
const {castleMarkerSize,nearestMapMarker} = require("../src/shared/mapHitTargets");
const directory = mkdtempSync(join(tmpdir(),"cm127-"));
process.env.DATABASE_PATH = join(directory,"game.sqlite");
const Game = require("../database/database");

test("logins repair missing records, preserve progress, and survive a restart",async()=>{
  let child, base, db;
  const start=async()=>{
    child=spawn(process.execPath,["-e",`
      const express=require("express"),app=express();
      app.use(express.json()).use(require("./routes/auth"));
      const listener=app.listen(0, "127.0.0.1",()=>console.log("PORT="+listener.address().port));
    `],{env:process.env,stdio:["ignore","pipe","inherit"]});
    base=await new Promise((resolve,reject)=>{
      child.once("exit",code=>reject(Error("Auth test server exited "+code)));
      child.stdout.on("data",chunk=>{
        const port=String(chunk).match(/PORT=(\d+)/)?.[1];
        if(port)resolve("http://127.0.0.1:"+port);
      });
    });
  };
  const stop=async()=>{
    const exited=once(child,"exit");
    child.kill();
    await exited;
    child=null;
  };
  const request=async(endpoint,{body,token,method}={},status=200)=>{
    const response=await fetch(base+endpoint,{method:method||(body?"POST":"GET"),
      headers:{"Content-Type":"application/json",...(token?{Authorization:"Bearer "+token}:{})},body:body?JSON.stringify(body):undefined});
    const data=response.status===204?null:await response.json();
    assert.equal(response.status,status,JSON.stringify(data));
    return data;
  };
  try{
    await start();
    const first={username:"Explorer",email:"explorer@example.test",password:"fixture-password-01"};
    const second={username:first.email,email:"second@example.test",password:"fixture-password-02"};
    const {userId,position}=await request("/register",{body:first},201);
    await request("/register",{body:second},201);
    await request("/login",{body:{username:first.username,password:"wrong"}},401);
    const login=identifier=>request("/login",{body:{username:identifier,password:first.password}});
    const session=await login(first.username);
    assert.equal(session.userId,userId);
    assert.deepEqual(session.gameProgress.castle,{username:first.username,...position});
    db=new SQLite(process.env.DATABASE_PATH);
    assert.equal(db.prepare("SELECT COUNT(*) AS n FROM player_talents WHERE user_id=? AND xp>0").get(userId).n,0);
    assert.notEqual(db.prepare("SELECT token_hash FROM login_sessions WHERE user_id=?").get(userId).token_hash,session.token);
    await stop();
    await start();
    const path="/get-progress/"+userId;
    await request(path,{token:session.token});
    await request("/logout",{token:session.token,method:"POST"},204);
    await request(path,{token:session.token},401);
    const byEmail=await login(first.email.toUpperCase());
    assert.equal(byEmail.userId,userId);
    db.prepare("DELETE FROM game_progress WHERE user_id=?").run(userId);
    db.prepare("DELETE FROM game_stats WHERE user_id=?").run(userId);
    db.prepare("UPDATE game_runtime SET army=? WHERE user_id=?").run('{"Railgunner":7}',userId);
    const repaired=await login(first.username);
    assert.deepEqual(repaired.gameProgress.castle,{username:first.username,...position});
    assert.equal(repaired.gameProgress.army.Railgunner,7);
    assert.equal(repaired.gameStats.total_play_time,0);
    db.prepare("UPDATE game_progress SET resources=? WHERE user_id=?").run('{"Gold":123,"Iron":4,"Water":5,"Solar":6}',userId);
    assert.equal((await login(first.username)).gameProgress.resources.Gold,123);
    assert.equal(db.prepare("SELECT COUNT(*) AS n FROM game_progress WHERE user_id=?").get(userId).n,1);
  }finally{
    if(child)await stop();
    db?.close();
  }
});

test("inactive bases ignore only the level gap and their visible marker selects the true coordinates",()=>{
  const game=new Game(), sql=new SQLite(process.env.DATABASE_PATH);
  try{
    const attacker=game.createUser("officer@example.test","Officer","fixture");
    const target=game.createUser("moyaz@example.test","MoyazFixture","fixture");
    const id=attacker.userId, enemy=target.userId;
    game.runtime(id);
    sql.prepare("UPDATE game_runtime SET army=? WHERE user_id=?").run('{"Rover Scout":10,"Explorer Trooper":100}',id);
    sql.prepare("INSERT INTO player_talents(user_id,xp) VALUES (?,10000)").run(id);
    const destination={username:"MoyazFixture",...target.position};
    const scout=()=>game.launchPlayerScout(id,destination,1);
    const attack=()=>game.launchPlayerAttack(id,{"Explorer Trooper":2},null,destination,false,true);
    assert.match(scout().error,/level difference/);
    assert.match(attack().error,/level difference/);
    sql.prepare("UPDATE users SET created_at=datetime('now','-9 days') WHERE id=?").run(enemy);
    assert.equal(game.getPublicBases().find(base=>base.user_id===enemy).abandoned,1);
    assert.ok(scout().missionId);
    assert.ok(attack().missionId);
    game.markPlayerActive(enemy);
    assert.match(scout().error,/level difference/);
    assert.match(attack().error,/level difference/);
    sql.prepare("UPDATE player_activity SET last_seen_at=? WHERE user_id=?").run(Date.now()-8*86400000,enemy);
    game.createAlliance(id,"Map test alliance");
    const alliance=game.allianceState(id).alliance.id;
    sql.prepare("INSERT INTO alliance_members(user_id,alliance_id) VALUES (?,?)").run(enemy,alliance);
    assert.match(attack().error,/member of your alliance/);
    sql.prepare("DELETE FROM alliance_members WHERE user_id=?").run(enemy);
    sql.prepare("INSERT INTO alliance_market_buffs(user_id,kind,expires_at) VALUES (?,'protection',?)").run(enemy,Date.now()+60000);
    assert.match(scout().error,/Plasma Shield/);
    assert.match(attack().error,/Plasma Shield/);
    const marker={x:5,y:35};
    const offset={x:23,y:-101};
    for(let zoom=.15;zoom<=1;zoom+=.05){
      const size=60*zoom;
      const x=(marker.x-.5)*size+offset.x,y=35.05*size+offset.y;
      assert.equal(nearestMapMarker([marker],{x,y},offset,size,castleMarkerSize(size)*.54),marker);
      assert.equal(nearestMapMarker([marker],{x:x+castleMarkerSize(size),y},offset,size,castleMarkerSize(size)*.54),null);
    }
  }finally{sql.close();game.close();rmSync(directory,{recursive:true,force:true});}
});
