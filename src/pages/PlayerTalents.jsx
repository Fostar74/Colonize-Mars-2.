import React,{useEffect,useState} from "react";
const api=(process.env.REACT_APP_API_URL||(window.location.hostname==="localhost"?"http://localhost:3001":window.location.origin)).replace(/\/$/,"");
const userId=sessionStorage.getItem("userId");
const headers=()=>({"Content-Type":"application/json",Authorization:"Bearer "+sessionStorage.getItem("authToken")});
export default function PlayerTalents(){
 const [data,setData]=useState(null),[busy,setBusy]=useState(false),[message,setMessage]=useState("");
 useEffect(()=>{fetch(api+"/player-talents/"+encodeURIComponent(userId),{headers:headers()}).then(r=>r.json()).then(setData).catch(e=>setMessage(e.message));},[]);
 const upgrade=async name=>{setBusy(true);setMessage("");try{const r=await fetch(api+"/player-talents/upgrade",{method:"POST",headers:headers(),body:JSON.stringify({userId,name})});const d=await r.json();if(!r.ok)throw Error(d.message||"Upgrade failed");setData(d);}catch(e){setMessage(e.message);}finally{setBusy(false);}};
 return <div style={{padding:16,color:"#eaf6ff"}}><h2>Player Talents</h2><p>These talents belong to your player account, not to Cyber Knight. Each talent costs 1 + 2 + 3 = 6 skill points to master.</p>
 {data&&<div style={{padding:12,background:"#1a3b52",borderRadius:8,marginBottom:14}}>Player Level: <b>{data.level}/40</b> · XP: <b>{data.xp}</b> · Available Skill Points: <b>{data.skillPoints}</b> {data.nextLevelXp&&<span>· Next level at {data.nextLevelXp} XP</span>}</div>}
 {message&&<p role="status">{message}</p>}
 <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(225px,1fr))",gap:10}}>{(data?.catalog||[]).map(t=>{const tier=data.talents[t.name]||0;return <div key={t.name} style={{border:"1px solid #52758c",borderRadius:9,padding:12,background:"#193147"}}><strong>{t.name}</strong><p>{["Untrained","Apprentice","Advanced","Master"][tier]} · {tier?t.values[tier-1]+t.description:"Not active"}</p><p style={{fontSize:12}}>Apprentice {t.values[0]} · Advanced {t.values[1]} · Master {t.values[2]} {t.description}</p><button disabled={busy||tier===3||data.skillPoints<tier+1} onClick={()=>upgrade(t.name)}>{tier===3?"Mastered":"Upgrade · "+(tier+1)+" points"}</button></div>;})}</div>
 <p style={{fontSize:12}}>Talent upgrades are saved server-side. Their detailed combat effects and special-unit interactions are being integrated separately.</p>
 </div>;
}
