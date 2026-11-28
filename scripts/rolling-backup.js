const fs = require("node:fs/promises");
const path = require("node:path");
const os = require("node:os");
const {createStorage} = require("../database/r2BackupStorage");
const {runRollingBackup,restoreRollingBackup} = require("../database/rollingBackups");

async function main() {
  const args=process.argv.slice(2);
  const verify=args[0]==="--verify";
  const slot=args[verify?1:0];
  if(!["daily","predeploy"].includes(slot)||args.length!==(verify?2:1))throw new Error("Specify the backup slot");
  const storage=createStorage();
  const passphrase=process.env.R2_BACKUP_PASSPHRASE;
  if(!/^[A-Za-z0-9_-]{32,}$/.test(passphrase||""))throw new Error("Backup encryption secret missing or invalid");

  if(verify){
    const folder=await fs.mkdtemp(path.join(os.tmpdir(),"cm-backup-verify-"));
    try{
      const result=await restoreRollingBackup({storage,passphrase,slot,destination:path.join(folder,"restored.sqlite")});
      console.log("Rolling R2 "+slot+" verified "+new Date(result.createdAt).toISOString()+" SQLite integrity_check ok");
    }finally{
      await fs.rm(folder,{recursive:true,force:true});
    }
    return;
  }

  if(process.env.RENDER!=="true"||process.env.R2_BACKUP_AUTOMATION_ENABLED!=="true")throw new Error("Production automation is disabled");
  if(!process.send)throw new Error("Use the existing service startup process to run backups");
  const source=await fs.realpath(process.env.DATABASE_PATH||"/var/data/colonize_mars.db");
  const file=await fs.stat(source);
  if(!source.startsWith("/var/data/")||!file.isFile()||!file.size)throw new Error("Existing persistent SQLite database unavailable");
  const result=await runRollingBackup({source,storage,passphrase,slot});
  console.log("Rolling R2 "+slot+" "+(result.skipped?"already verified ":"verified ")+
    new Date(result.createdAt).toISOString()+" SQLite integrity_check ok");
  process.send(result);
}

main().catch(error=>{
  // Only controlled messages are reported. Library errors may contain paths and runtime details.
  console.error("Rolling R2 backup failed",error.message?.match(/^R2 request failed \(\d{3}\)$/)?.[0]||"check configuration, R2 access and SQLite integrity");
  process.exitCode=1;
}).finally(()=>{
  if(process.connected)process.disconnect();
});
