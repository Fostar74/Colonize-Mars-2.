const {spawn} = require("node:child_process");
const fs = require("node:fs/promises");
const {tmpdir} = require("node:os");
const {join} = require("node:path");
const {hash,limit} = require("./rollingBackups");

function createStorage(env=process.env) {
  const {R2_BUCKET,R2_ENDPOINT,R2_ACCESS_KEY_ID,R2_SECRET_ACCESS_KEY}=env;
  const endpoint=String(R2_ENDPOINT||"").replace(/\/+$/,"");
  if(R2_BUCKET!=="colonize-mars-2-backups"||
    !/^https:\/\/[a-f0-9]{32}(\.(eu|fedramp))?\.r2\.cloudflarestorage\.com$/i.test(endpoint)||
    !/^[a-z0-9]+$/i.test(R2_ACCESS_KEY_ID||"")||!/^[a-z0-9]+$/i.test(R2_SECRET_ACCESS_KEY||"")) {
    throw new Error("Existing R2 settings are missing or invalid");
  }
  async function request(key,bytes,conditions={}){
    if(!/^rolling-v1\/(daily|predeploy)\/(current\.json|[01]\.sqlite3\.enc)$/.test(key))throw new Error("Invalid rolling backup key");
    const dir=await fs.mkdtemp(join(tmpdir(),"cm-r2-request-"));
    try {
      const put=bytes!==undefined;
      const body=join(dir,"body"),headers=join(dir,"headers"),upload=join(dir,"upload");
      if(put)await fs.writeFile(upload,bytes,{mode:0o600});
      const args=["-q","--config","-","--silent","--proto","=https","--connect-timeout","8","--max-time","25",
        "--max-filesize",String(limit+4096),"--aws-sigv4","aws:amz:auto:s3","--output",body,
        "--dump-header",headers,"--write-out","%{http_code}","--header","x-amz-content-sha256: "+hash(bytes||Buffer.alloc(0))];
      if(put)args.push("--upload-file",upload);
      for(const [name,value] of Object.entries(conditions))args.push("--header",name+": "+value);
      args.push(endpoint+"/"+R2_BUCKET+"/"+key);
      const status=await new Promise((resolve,reject)=>{
        const child=spawn("curl",args,{stdio:["pipe","pipe","ignore"]});
        let status="";
        child.stdout.on("data",chunk=>{status+=chunk;});
        child.stdin.on("error",()=>{});
        child.on("error",()=>reject(new Error("R2 request could not start")));
        child.on("close",code=>code===0?resolve(status):reject(new Error("R2 transfer failed")));
        child.stdin.end('user = "'+R2_ACCESS_KEY_ID+":"+R2_SECRET_ACCESS_KEY+'"\n');
      });
      if(!put&&status==="404")return null;
      if(status!=="200")throw new Error("R2 request failed ("+status+")");
      if(put)return;
      const header=(await fs.readFile(headers,"utf8")).match(/^ETag:\s*("[a-f0-9]+")\s*$/im);
      return {bytes:await fs.readFile(body),etag:header?.[1]};
    } finally {
      await fs.rm(dir,{force:true,recursive:true});
    }
  }
  return {get:key=>request(key),put:(key,bytes,conditions)=>request(key,bytes,conditions)};
}

module.exports={createStorage};
