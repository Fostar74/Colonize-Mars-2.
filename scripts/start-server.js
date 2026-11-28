const {fork} = require("node:child_process");
const fs = require("node:fs/promises");
const path = require("node:path");
const {dailyInterval} = require("../database/rollingBackups");

const retryInterval=6*60*60*1000;
const checkInterval=15*60*1000;

function runBackup(slot) {
  return new Promise((resolve,reject)=>{
    let result;
    const child=fork(path.join(__dirname,"rolling-backup.js"),[slot],{timeout:160000});
    child.on("message",message=>{result=message;});
    child.on("error",reject);
    child.on("exit",code=>code===0&&result?resolve(result):reject(new Error("Backup worker did not verify the slot")));
  });
}

function alertSender(env) {
  const {R2_BACKUP_ALERT_EMAIL,SMTP_USER,SMTP_PASS,SMTP_HOST,SMTP_PORT}=env;
  const address=/^[A-Za-z0-9.!#$%&'*+=?^_`{|}~-]+@[A-Za-z0-9.-]+$/;
  const port=Number(SMTP_PORT);
  if(!address.test(R2_BACKUP_ALERT_EMAIL||"")||!address.test(SMTP_USER||"")||!SMTP_PASS||
     SMTP_HOST!=="smtp.gmail.com"||![465,587].includes(port))throw new Error("Backup alert inbox and SMTP must be configured");
  const smtp=require("nodemailer").createTransport({
    host:SMTP_HOST,port,secure:port===465,requireTLS:true,tls:{rejectUnauthorized:true,minVersion:"TLSv1.2"},
    auth:{user:SMTP_USER,pass:SMTP_PASS},logger:false,debug:false,
    connectionTimeout:8000,greetingTimeout:8000,socketTimeout:10000,
  });
  return () => smtp.sendMail({
    from:{address:SMTP_USER},to:{address:R2_BACKUP_ALERT_EMAIL},
    subject:"Colonize Mars 2 backup needs attention",
    text:"The automated SQLite backup failed or is stale. Check Render logs for Rolling R2 backup status. The published backup slot was not intentionally replaced on failure.",
  });
}

async function start() {
  if(process.env.R2_BACKUP_AUTOMATION_ENABLED!=="true"){
    require("../server");
    return;
  }
  const alert=alertSender(process.env);
  const stamp="/var/data/.colonize-r2-daily.json";
  let state={};
  try{state=JSON.parse(await fs.readFile(stamp,"utf8"));}
  catch(error){if(error.code!=="ENOENT")throw error;}

  async function save(){
    const tmp=stamp+".tmp";
    await fs.writeFile(tmp,JSON.stringify(state),{mode:0o600});
    await fs.rename(tmp,stamp);
  }
  async function notify(){
    if(Date.now()-(state.alertedAt||0)<dailyInterval)return;
    state.alertedAt=Date.now();
    await save();
    try{await alert();}catch{console.error("Rolling R2 alert delivery failed; check the authorized SMTP inbox configuration");}
  }

  // Render mounts /var/data at service startup. Do not import server.js, which initializes and migrates SQLite, before verification.
  try{await runBackup("predeploy");}
  catch(error){
    console.error("Startup blocked before SQLite migrations because the predeploy backup failed");
    await notify();
    throw error;
  }
  require("../server");

  let running=false;
  async function daily(){
    const now=Date.now();
    if(running||now-(state.attemptedAt||0)<retryInterval||now-(state.verifiedAt||0)<dailyInterval)return;
    running=true;
    try{
      state.attemptedAt=now;
      await save();
      const result=await runBackup("daily");
      state.verifiedAt=result.createdAt;
      await save();
    }catch{
      console.error("Rolling R2 daily backup failed or is stale");
      try{await notify();}catch{console.error("Rolling R2 alert state could not be recorded");}
    }finally{running=false;}
  }
  daily();
  setInterval(daily,checkInterval).unref();
}

start().catch(()=>{
  console.error("Service startup stopped before SQLite migration. Check Render backup configuration and logs.");
  process.exitCode=1;
});
