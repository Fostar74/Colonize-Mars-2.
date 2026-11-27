const sharp = require("sharp");
const {createHash} = require("node:crypto");
const {readFileSync,realpathSync} = require("node:fs");
const {dirname,sep} = require("node:path");

const maxBytes = 5 * 1024 * 1024;
const maxPixels = 16 * 1024 * 1024;
const size = 256;

function inputFormat(data) {
  if (data.subarray(0,3).equals(Buffer.from([0xff,0xd8,0xff]))) return "jpeg";
  if (data.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) return "png";
  if (data.toString("ascii",0,4)==="RIFF" && data.toString("ascii",8,12)==="WEBP") return "webp";
  return null;
}

async function normalizeAvatar(data) {
  if (!Buffer.isBuffer(data) || !data.length || data.length>maxBytes) throw new Error("invalid avatar size");
  const format = inputFormat(data);
  if (!format) throw new Error("unsupported avatar format");
  const image = sharp(data,{limitInputPixels:maxPixels,failOn:"warning"});
  const metadata = await image.metadata();
  if (metadata.format!==format || metadata.pages>1 || !metadata.width || !metadata.height ||
      metadata.width>8192 || metadata.height>8192 || metadata.width*metadata.height>maxPixels) {
    throw new Error("invalid avatar dimensions or format");
  }
  return image.rotate().resize(size,size,{fit:"cover",position:"centre"}).webp({quality:85}).toBuffer();
}

function isPersistentRenderDatabase(dbPath) {
  if (!process.env.RENDER) return true;
  // A writable /var/data alone can be part of the ephemeral root filesystem.
  try {
    const dir = realpathSync(dirname(dbPath));
    const mounts = readFileSync("/proc/self/mountinfo","utf8").trim().split("\n")
      .map(line=>{
        const [mount,filesystem] = line.split(" - ");
        return {point:mount.split(" ")[4].replace(/\\([0-7]{3})/g,(_,digits)=>String.fromCharCode(parseInt(digits,8))),
          type:filesystem.split(" ")[0]};
      })
      .filter(({point})=>dir===point || dir.startsWith(point===sep?sep:point+sep))
      .sort((a,b)=>b.point.length-a.point.length);
    const mount = mounts[0];
    return Boolean(mount && mount.point!==sep && !["tmpfs","ramfs","overlay"].includes(mount.type));
  } catch {
    return false;
  }
}

function migrate(db) {
  db.exec(`CREATE TABLE IF NOT EXISTS player_avatar_images (
    user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    version TEXT NOT NULL,
    image BLOB NOT NULL
  )`);
}

function store(db,userId,image) {
  const version = createHash("sha256").update(image).digest("hex");
  db.prepare(`INSERT INTO player_avatar_images(user_id,version,image) VALUES (?,?,?)
    ON CONFLICT(user_id) DO UPDATE SET version=excluded.version,image=excluded.image
    WHERE player_avatar_images.version<>excluded.version`).run(userId,version,image);
  return version;
}

module.exports = {maxBytes,normalizeAvatar,isPersistentRenderDatabase,migrate,store};
