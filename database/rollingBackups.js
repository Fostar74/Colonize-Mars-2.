const crypto = require("node:crypto");
const fs = require("node:fs/promises");
const path = require("node:path");
const os = require("node:os");
const SQLite = require("better-sqlite3");

const dailyInterval = 86400000;
const limit = 64 * 1024 * 1024;
const prefix = "rolling-v1";
const magic = Buffer.from("CMR1");
const hash = data => crypto.createHash("sha256").update(data).digest("hex");
const validSlot = slot => ["daily","predeploy"].includes(slot);
const objectKey = (slot,index) => `${prefix}/${slot}/${index}.sqlite3.enc`;

function encrypt(bytes,passphrase) {
  const salt=crypto.randomBytes(16),iv=crypto.randomBytes(12);
  const key=crypto.scryptSync(passphrase,salt,32);
  const cipher=crypto.createCipheriv("aes-256-gcm",key,iv);
  cipher.setAAD(magic);
  const encrypted=Buffer.concat([cipher.update(bytes),cipher.final()]);
  return Buffer.concat([magic,salt,iv,cipher.getAuthTag(),encrypted]);
}

function decrypt(bytes,passphrase) {
  if(bytes.length<48||!bytes.subarray(0,4).equals(magic))throw new Error("Invalid encrypted snapshot");
  const key=crypto.scryptSync(passphrase,bytes.subarray(4,20),32);
  const decipher=crypto.createDecipheriv("aes-256-gcm",key,bytes.subarray(20,32));
  decipher.setAAD(magic);
  decipher.setAuthTag(bytes.subarray(32,48));
  return Buffer.concat([decipher.update(bytes.subarray(48)),decipher.final()]);
}

function integrity(filename) {
  const db=new SQLite(filename,{readonly:true,fileMustExist:true});
  try {
    const rows=db.pragma("integrity_check");
    if(rows.length!==1||rows[0].integrity_check!=="ok")throw new Error("SQLite integrity check failed");
  } finally {
    db.close();
  }
}

function decodePointer(object,slot) {
  if(!object)return null;
  if(object.bytes.length>4096||!/^"[a-f0-9]+"$/i.test(object.etag||""))throw new Error("Invalid backup pointer");
  const pointer=JSON.parse(object.bytes.toString("utf8"));
  if(pointer.version!==1||pointer.slot!==slot||![0,1].includes(pointer.index)||
    !Number.isSafeInteger(pointer.createdAt)||pointer.createdAt<0||
    !/^[a-f0-9]{64}$/.test(pointer.ciphertextHash)||!/^[a-f0-9]{64}$/.test(pointer.sqliteHash)) {
    throw new Error("Invalid backup pointer");
  }
  return pointer;
}

async function runRollingBackup({source,storage,passphrase,slot,now=Date.now()}) {
  if(!validSlot(slot)||typeof passphrase!=="string"||!/^[A-Za-z0-9_-]{32,}$/.test(passphrase))throw new Error("Invalid backup configuration");
  const pointerKey=`${prefix}/${slot}/current.json`;
  const currentObject=await storage.get(pointerKey);
  const current=decodePointer(currentObject,slot);
  if(slot==="daily"&&current&&now>=current.createdAt&&now-current.createdAt<dailyInterval) {
    return {skipped:true,createdAt:current.createdAt};
  }

  const folder=await fs.mkdtemp(path.join(os.tmpdir(),"cm-r2-backup-"));
  try {
    const snapshot=path.join(folder,"snapshot.sqlite");
    const original=new SQLite(source,{readonly:true,fileMustExist:true,timeout:5000});
    try {
      await original.backup(snapshot);
    } finally {
      original.close();
    }
    const size=(await fs.stat(snapshot)).size;
    if(size<1||size>limit)throw new Error("Backup size exceeds the verified storage bound");
    integrity(snapshot);
    const plain=await fs.readFile(snapshot);
    const ciphertext=encrypt(plain,passphrase);
    const index=current?1-current.index:0;
    const key=objectKey(slot,index);
    const pointer={version:1,slot,index,createdAt:now,ciphertextHash:hash(ciphertext),sqliteHash:hash(plain)};

    // Write only the inactive object in this slot. The published copy remains untouched.
    await storage.put(key,ciphertext);
    const fetched=await storage.get(key);
    if(!fetched||hash(fetched.bytes)!==pointer.ciphertextHash)throw new Error("Ciphertext verification failed");
    const recovered=decrypt(fetched.bytes,passphrase);
    if(hash(recovered)!==pointer.sqliteHash)throw new Error("Snapshot hash verification failed");
    const restored=path.join(folder,"restored.sqlite");
    await fs.writeFile(restored,recovered,{mode:0o600});
    integrity(restored);
    await storage.put(pointerKey,Buffer.from(JSON.stringify(pointer)),currentObject?{"If-Match":currentObject.etag}:{"If-None-Match":"*"});
    const published=decodePointer(await storage.get(pointerKey),slot);
    if(published?.ciphertextHash!==pointer.ciphertextHash)throw new Error("Backup pointer verification failed");
    return {key,createdAt:now,integrity:"ok"};
  } finally {
    await fs.rm(folder,{force:true,recursive:true});
  }
}

async function restoreRollingBackup({storage,passphrase,slot,destination}) {
  if(!validSlot(slot))throw new Error("Invalid backup slot");
  const pointer=decodePointer(await storage.get(`${prefix}/${slot}/current.json`),slot);
  if(!pointer)throw new Error("No verified backup");
  const object=await storage.get(objectKey(slot,pointer.index));
  if(!object||hash(object.bytes)!==pointer.ciphertextHash)throw new Error("Ciphertext verification failed");
  const plain=decrypt(object.bytes,passphrase);
  if(hash(plain)!==pointer.sqliteHash)throw new Error("Snapshot hash verification failed");
  await fs.writeFile(destination,plain,{flag:"wx",mode:0o600});
  try {
    integrity(destination);
  } catch(error) {
    await fs.rm(destination,{force:true});
    throw error;
  }
  return {createdAt:pointer.createdAt,integrity:"ok"};
}

module.exports={runRollingBackup,restoreRollingBackup,dailyInterval,limit,hash};
