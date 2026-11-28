const assert=require("node:assert/strict");
const test=require("node:test");
const fs=require("node:fs/promises");
const os=require("node:os");
const path=require("node:path");
const SQLite=require("better-sqlite3");
const {runRollingBackup,restoreRollingBackup,dailyInterval,hash}=require("../database/rollingBackups");

function fakeStorage(){
  const objects=new Map([["pr-105/existing.sqlite3.enc",Buffer.from("legacy archive")]]);
  return {
    objects,
    failDownload:null,
    async get(key){
      const bytes=objects.get(key);
      if(!bytes)return null;
      return {bytes:key===this.failDownload?Buffer.from("corrupted transfer"):Buffer.from(bytes),etag:'"'+hash(bytes)+'"'};
    },
    async put(key,bytes,conditions={}){
      const current=objects.get(key);
      if(conditions["If-None-Match"]==="*"&&current)throw new Error("Already exists");
      if(conditions["If-Match"]&&(!current||conditions["If-Match"]!=='"'+hash(current)+'"'))throw new Error("Pointer changed");
      objects.set(key,Buffer.from(bytes));
    }
  };
}

test("verified copies roll independently and a corrupt download preserves both published snapshots",async()=>{
  const directory=await fs.mkdtemp(path.join(os.tmpdir(),"cm151-"));
  const source=path.join(directory,"production-fixture.sqlite");
  const live=new SQLite(source);
  live.pragma("journal_mode=WAL");
  live.exec("CREATE TABLE players(name TEXT); INSERT INTO players VALUES ('First')");
  const storage=fakeStorage();
  const passphrase="fixture-only-randomish-passphrase-0123456789";
  const now=Date.UTC(2026,10,28,12);
  const request=(slot,at)=>runRollingBackup({source,storage,passphrase,slot,now:at});
  const restore=(slot,name,secret=passphrase)=>restoreRollingBackup({storage,slot,passphrase:secret,destination:path.join(directory,name)});
  const names=filename=>{
    const db=new SQLite(path.join(directory,filename),{readonly:true,fileMustExist:true});
    try{return db.prepare("SELECT name FROM players ORDER BY rowid").pluck().all();}
    finally{db.close();}
  };
  try {
    const daily=await request("daily",now);
    assert.equal(daily.integrity,"ok");
    assert.ok(!storage.objects.get(daily.key).includes(Buffer.from("SQLite format 3")));
    assert.deepEqual(await request("daily",now+1),{skipped:true,createdAt:now});
    live.prepare("INSERT INTO players VALUES (?)").run("Second");
    await request("predeploy",now+100);
    const dailyBefore=storage.objects.get("rolling-v1/daily/current.json");
    const predeployBefore=storage.objects.get("rolling-v1/predeploy/current.json");
    storage.failDownload="rolling-v1/daily/1.sqlite3.enc";
    await assert.rejects(request("daily",now+dailyInterval),/Ciphertext verification failed/);
    assert.deepEqual(storage.objects.get("rolling-v1/daily/current.json"),dailyBefore);
    assert.deepEqual(storage.objects.get("rolling-v1/predeploy/current.json"),predeployBefore);
    await restore("daily","old.sqlite");
    await restore("predeploy","predeploy.sqlite");
    assert.deepEqual(names("old.sqlite"),["First"]);
    assert.deepEqual(names("predeploy.sqlite"),["First","Second"]);
    await assert.rejects(restore("predeploy","wrong.sqlite","different-test-passphrase"),/authenticate/i);
    await assert.rejects(fs.access(path.join(directory,"wrong.sqlite")),/ENOENT/);

    storage.failDownload=null;
    const replacement=await request("daily",now+dailyInterval);
    assert.equal(replacement.key,"rolling-v1/daily/1.sqlite3.enc");
    assert.deepEqual(storage.objects.get("rolling-v1/predeploy/current.json"),predeployBefore);
    await restore("daily","new.sqlite");
    assert.deepEqual(names("new.sqlite"),["First","Second"]);
    assert.deepEqual(storage.objects.get("pr-105/existing.sqlite3.enc"),Buffer.from("legacy archive"));
    assert.ok(storage.objects.size<=7);
    assert.deepEqual(live.prepare("SELECT name FROM players ORDER BY rowid").pluck().all(),["First","Second"]);
  }finally{
    live.close();
    await fs.rm(directory,{recursive:true,force:true});
  }
});

test("enabled startup with missing backup credentials stops before opening the game database",async()=>{
  const {spawnSync}=require("node:child_process");
  const directory=await fs.mkdtemp(path.join(os.tmpdir(),"cm151-gate-"));
  const source=path.join(directory,"should-not-exist.sqlite");
  try{
    // Strip mail/backup credentials so a failure never contacts a real service.
    const env=Object.fromEntries(Object.entries(process.env).filter(([name])=>!name.startsWith("R2_")&&!name.startsWith("SMTP_")&&name!=="NODE_TEST_CONTEXT"));
    const child=spawnSync(process.execPath,["scripts/start-server.js"],{env:{
      ...env,RENDER:"true",DATABASE_PATH:source,R2_BACKUP_AUTOMATION_ENABLED:"true",
    },encoding:"utf8",timeout:5000});
    assert.equal(child.status,1);
    assert.ok(!child.stdout.includes("Initializing database"));
    await assert.rejects(fs.access(source),/ENOENT/);
  }finally{
    await fs.rm(directory,{recursive:true,force:true});
  }
});
