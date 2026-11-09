import React,{useCallback,useEffect,useState} from "react";
const api=(process.env.REACT_APP_API_URL||(window.location.hostname==="localhost"?"http://localhost:3001":window.location.origin)).replace(/\/$/,"");
const headers=()=>({"Content-Type":"application/json",Authorization:"Bearer "+sessionStorage.getItem("authToken")});
const names={"Rapid Deployment":"Hyperdrive Navigation","Resource Management":"Quantum Logistics","Mining Operations":"Deep Core Extraction","Precision Fire":"Precision Targeting","Reinforced Armor":"Nano Armor Systems","Infantry Command":"Combat Augmentation","Battle Command":"Neural Command","Advanced Recon":"Quantum Intelligence","Evasion Protocol":"Probability Matrix","Combat Recovery":"Nano Regeneration","Mobile Warfare":"Assault Mobility","Heavy Artillery":"Siege Engineering","Advanced Research":"Neural Learning Matrix","Accelerated Training":"Accelerated Training"};
export default function PlayerTalents(){
 const [state,setState]=useState(null),[error,setError]=useState(""),[busy,setBusy]=useState(false);
 const userId=sessionStorage.getItem("userId");
 const refresh=useCallback(async()=>{try{if(!userId)throw Error("Log in to view protocols.");const response=await fetch(api+"/player-talents/"+encodeURIComponent(userId),{headers:headers(),cache:"no-store"});const data=await response.json();if(!response.ok)throw Error(data.message||"Could not load protocols.");setState(data);setError("");}catch(e){setError(e.message);}},[userId]);
 useEffect(()=>{refresh();},[refresh]);
 const upgrade=async name=>{setBusy(true);setError("");try{const response=await fetch(api+"/player-talents/upgrade",{method:"POST",headers:headers(),body:JSON.stringify({userId,name})});const data=await response.json();if(!response.ok)throw Error(data.message||"Upgrade failed.");await refresh();}catch(e){setError(e.message);}finally{setBusy(false);}};
 const tierNames=["Locked","Initiate","Advanced","Elite"];
 const active=new Set(["Resource Management","Accelerated Training","Advanced Research","Rapid Deployment","Precision Fire","Reinforced Armor","Infantry Command","Mobile Warfare","Heavy Artillery"]);
 return <div style={{padding:16,color:"#eaf6ff",maxWidth:1050}}>
  <h2>Commander Protocols</h2>
  <p>Develop your commander with Protocol Points (PP). Each protocol has three tiers: Initiate, Advanced and Elite.</p>
  {error&&<p role="alert" style={{color:"#ffb8aa"}}>{error} <button onClick={refresh}>Retry</button></p>}
  {!state?<p>Loading commander protocols…</p>:<>
   <p><strong>Commander Level {state.level}</strong> · XP {state.xp}{state.nextLevelXp!=null?" / "+state.nextLevelXp:" (maximum level)"} · <strong>{state.skillPoints} PP available</strong></p>
   <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(235px,1fr))",gap:12}}>
    {(state.catalog||[]).filter(item=>names[item.name]).map(item=>{const tier=Number(state.talents?.[item.name]||0);const cost=tier+1;return <section key={item.name} style={{padding:14,border:"1px solid #3b647a",borderRadius:10,background:"#122b3c"}}>
      <h3 style={{marginTop:0}}>{names[item.name]}</h3>
      <p>{tierNames[tier]} · Level {tier}/3</p>
      <p>{item.description} · {tier?item.values[tier-1]:0}{item.description.startsWith("%")?"%":""} current</p>
      <p>Tier bonuses: {item.values.join(" / ")}</p>
      {!active.has(item.name)&&<p style={{color:"#ffd28b"}}>Bonus integration pending — upgrades temporarily disabled.</p>}
      <button disabled={busy||!active.has(item.name)||tier>=3||state.skillPoints<cost} onClick={()=>upgrade(item.name)}>{tier>=3?"Elite unlocked":`Upgrade to ${tierNames[tier+1]} · ${cost} PP`}</button>
    </section>;})}
   </div>
  </>}
 </div>;
}
