import React,{useEffect,useState,useCallback} from "react";
const api=(process.env.REACT_APP_API_URL||(window.location.hostname==="localhost"?"http://localhost:3001":window.location.origin)).replace(/\/$/,"");
const userId=sessionStorage.getItem("userId");
const headers=()=>({"Content-Type":"application/json",Authorization:"Bearer "+sessionStorage.getItem("authToken")});
export default function AlliancePanel(){
 const [state,setState]=useState(null),[name,setName]=useState(""),[message,setMessage]=useState(""),[busy,setBusy]=useState(false);
 const refresh=useCallback(async()=>{try{const r=await fetch(api+"/alliance/"+encodeURIComponent(userId),{headers:headers()});if(!r.ok)throw Error("Cannot load alliance");setState(await r.json());}catch(e){setMessage(e.message);}},[]);
 useEffect(()=>{refresh();const t=setInterval(refresh,10000);return()=>clearInterval(t);},[refresh]);
 const action=async(path,extra={})=>{setBusy(true);setMessage("");try{const r=await fetch(api+"/alliance/"+path,{method:"POST",headers:headers(),body:JSON.stringify({userId,...extra})});const d=await r.json();if(!r.ok)throw Error(d.message||"Action failed");setMessage(path==="help"?"Construction accelerated! +1 wheel token.":path==="request-help"?"Alliance help requested.":"Success!");await refresh();}catch(e){setMessage(e.message);}finally{setBusy(false);}};
 return <div style={{color:"#eef6ff",padding:15,minWidth:300}}>
  <h2>Alliance Command</h2><p>Help clanmates build faster and earn 1 wheel token per successful help.</p>
  {message&&<p role="status">{message}</p>}
  {!state?<p>Loading…</p>:!state.alliance?<div>
   <p>Create a new alliance or join an existing alliance by its exact name.</p>
   <input placeholder="Alliance name" maxLength={32} value={name} onChange={e=>setName(e.target.value)}/>
   <div style={{display:"flex",gap:8,marginTop:10}}><button disabled={busy} onClick={()=>action("create",{name})}>Create Alliance</button><button disabled={busy} onClick={()=>action("join",{name})}>Join Alliance</button></div>
  </div>:<div>
   <h3>🛡 {state.alliance.name}</h3>
   <p>Members: {(state.members||[]).map(m=>m.username).join(", ")}</p>
   <button disabled={busy} onClick={()=>action("request-help")}>🤝 Request help for my active construction</button>
   <h3>Construction Help Requests</h3>
   {!(state.requests||[]).length&&<p>No active help requests.</p>}
   {(state.requests||[]).map(h=><div key={h.id} style={{padding:12,border:"1px solid #47758e",borderRadius:8,marginBottom:8}}>
    <strong>{h.username}</strong> · {h.building_name} Lv {h.building_level}
    <p>Reduce remaining time by 1 minute or 1%, whichever is greater.</p>
    <button disabled={busy||h.helped||String(h.requester_id)===String(userId)} onClick={()=>action("help",{requestId:h.id})}>{h.helped?"Already helped":String(h.requester_id)===String(userId)?"Your construction":"Help · Earn 1 Token"}</button>
   </div>)}
  </div>}
 </div>;
}
