const assert = require("node:assert/strict");
const {test} = require("node:test");
const {spawn} = require("node:child_process");
const {once} = require("node:events");
const {mkdtempSync,rmSync} = require("node:fs");
const {tmpdir} = require("node:os");
const {join} = require("node:path");
const {createHash,randomBytes} = require("node:crypto");
const sharp = require("sharp");

const directory = mkdtempSync(join(tmpdir(),"avatars-144-"));
process.env.DATABASE_PATH = join(directory,"game.sqlite");
delete process.env.RENDER;
delete process.env.ORANGE_EMPIRE_ENABLED;
delete process.env.ORANGE_EMPIRE_ATTACKS_ENABLED;
const Game = require("../database/database");
const {maxBytes,isPersistentRenderDatabase} = require("../database/playerAvatars");

test("auth, image validation, SQLite restart, shared display metadata, and removal",async()=>{
  const game = new Game();
  let child, base;
  const start = async()=>{
    child = spawn(process.execPath,["-e",`
      const express=require("express"),app=express();
      app.use(express.json({limit:"128kb"})).use(require("./routes/auth"));
      const server=app.listen(0,"127.0.0.1",()=>console.log("PORT="+server.address().port));
    `],{env:process.env,stdio:["ignore","pipe","inherit"]});
    const port = await new Promise((resolve,reject)=>{
      child.once("error",reject);
      child.once("exit",code=>reject(Error("Avatar test server exited: "+code)));
      child.stdout.on("data",chunk=>{
        const match=String(chunk).match(/PORT=(\d+)/);
        if(match)resolve(match[1]);
      });
    });
    base = "http://127.0.0.1:"+port;
  };
  const stop = async()=>{
    if (child?.exitCode===null && child.signalCode===null) {
      const exited=once(child,"exit");
      child.kill();
      await exited;
    }
    child=null;
  };
  const request = async(path,{method="GET",token,type,body}={},expected=200)=>{
    const response = await fetch(base+path,{method,body,headers:{
      ...(token?{Authorization:"Bearer "+token}:{}),...(type?{"Content-Type":type}:{})
    }});
    assert.equal(response.status,expected);
    return response;
  };
  const tokenFor = id=>{
    const token=randomBytes(32).toString("hex");
    game.storeLoginSession(createHash("sha256").update(token).digest("hex"),id,Date.now()+120000,Date.now());
    return token;
  };
  try {
    const owner=game.createUser("owner@example.test","Owner","fixture").userId;
    const other=game.createUser("other@example.test","Other","fixture").userId;
    const token=tokenFor(owner), otherToken=tokenFor(other);
    game.setPlayerAvatar(owner,"engineer-f");
    game.createAlliance(owner,"Portrait test");
    assert.ifError(game.sendMessage(owner,"alliance",null,"Hello team").error);
    assert.ifError(game.sendMessage(other,"private","Owner","Hello").error);
    const route = "/profile/"+owner+"/avatar-image";
    await start();
    const jpeg = await sharp({create:{width:410,height:270,channels:3,background:"#f84"}})
      .withMetadata({orientation:6,exif:{IFD0:{Artist:"Private metadata"}}}).jpeg().toBuffer();
    const upload = (body,auth=token,type="application/octet-stream",status=200)=>
      request(route,{method:"PUT",token:auth,type,body},status);
    await request(route,{method:"PUT",type:"image/jpeg",body:jpeg},401);
    await upload(jpeg,otherToken,"image/jpeg",403);
    await request(route,{method:"DELETE",token:otherToken},403);
    await upload(Buffer.from("<svg xmlns='http://www.w3.org/2000/svg'/>"),token,"image/svg+xml",415);
    await upload(Buffer.from("<svg/>"),token,"image/png",400);
    await upload(jpeg.subarray(0,80),token,"image/jpeg",400);
    await upload(Buffer.alloc(maxBytes+1),token,"application/octet-stream",413);
    const large = await sharp({create:{width:4097,height:4096,channels:3,background:"#123"}}).png().toBuffer();
    await upload(large,token,"image/png",400);
    assert.equal((await (await request("/profile/"+owner,{token})).json()).avatarVersion,null);

    const saved = await (await upload(jpeg,token,"image/jpeg")).json();
    assert.equal(saved.avatarId,"engineer-f");
    assert.match(saved.avatarVersion,/^[a-f0-9]{64}$/);
    const publicPath=version=>"/player-avatars/"+owner+"/"+version+".webp";
    const photo=await request(publicPath(saved.avatarVersion));
    assert.match(photo.headers.get("content-type"),/^image\/webp/);
    assert.equal(photo.headers.get("x-content-type-options"),"nosniff");
    const normalized=Buffer.from(await photo.arrayBuffer());
    const meta = await sharp(normalized).metadata();
    assert.equal(meta.width,256);
    assert.equal(meta.height,256);
    assert.equal(meta.format,"webp");
    for (const key of ["exif","icc","xmp","orientation"]) assert.equal(meta[key],undefined);
    const ranking = await (await request("/rankings/"+other,{token:otherToken})).json();
    assert.equal(ranking.players.find(row=>row.id===owner).avatarVersion,saved.avatarVersion);
    assert.equal(ranking.cyberKnights.find(row=>row.id===owner).avatarVersion,saved.avatarVersion);
    const alliance=await (await request("/alliance/"+owner,{token})).json();
    assert.equal(alliance.members.find(row=>row.id===owner).avatarVersion,saved.avatarVersion);
    const chat=await (await request("/alliance/messages/"+owner,{token})).json();
    assert.equal(chat.messages[0].senderAvatarVersion,saved.avatarVersion);
    const privateChat=await (await request("/messages/private/"+other,{token:otherToken})).json();
    assert.equal(privateChat.messages[0].recipientAvatarVersion,saved.avatarVersion);

    await stop();
    await start();
    const reloaded = await request(publicPath(saved.avatarVersion));
    assert.deepEqual(Buffer.from(await reloaded.arrayBuffer()),normalized);
    const makeImage=kind=>sharp({create:{width:80,height:120,channels:3,background:kind==="png"?"#89e":"#654"}}).toFormat(kind).toBuffer();
    const updated = await (await upload(await makeImage("png"),token,"image/png")).json();
    assert.notEqual(updated.avatarVersion,saved.avatarVersion);
    await request(publicPath(saved.avatarVersion),{},404);
    const webp = await (await upload(await makeImage("webp"),token,"image/webp")).json();
    assert.notEqual(webp.avatarVersion,updated.avatarVersion);
    const removed = await (await request(route,{method:"DELETE",token})).json();
    assert.deepEqual(removed,{avatarId:"engineer-f",avatarVersion:null});
    await request(publicPath(webp.avatarVersion),{},404);
    assert.equal((await (await request("/profile/"+other,{token:otherToken})).json()).avatarVersion,null);
  } finally {
    await stop();
    game.close();
    rmSync(directory,{recursive:true,force:true});
  }
});

test("an ephemeral Render root and memory mounts are not avatar storage",()=>{
  process.env.RENDER="true";
  try {
    assert.equal(isPersistentRenderDatabase("/game.sqlite"),false);
    assert.equal(isPersistentRenderDatabase("/dev/shm/game.sqlite"),false);
  } finally {delete process.env.RENDER;}
});
