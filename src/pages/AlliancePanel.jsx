import React,{useEffect,useState,useCallback} from "react";
const api=(process.env.REACT_APP_API_URL||(window.location.hostname==="localhost"?"http://localhost:3001":window.location.origin)).replace(/\/$/,"");
const userId=sessionStorage.getItem("userId");
const headers=()=>({"Content-Type":"application/json",Authorization:"Bearer "+sessionStorage.getItem("authToken")});
export default function AlliancePanel(){
 const [state,setState]=useState(null),[name,setName]=useState(""),[message,setMessage]=useState(""),[busy,setBusy]=useState(false),[tab,setTab]=useState("members");
 const refresh=useCallback(async()=>{try{const r=await fetch(api+"/alliance/"+encodeURIComponent(userId),{headers:headers()});if(!r.ok)throw Error("Cannot load alliance");setState(await r.json());}catch(e){setMessage(e.message);}},[]);
 useEffect(()=>{refresh();const t=setInterval(refresh,10000);return()=>clearInterval(t);},[refresh]);
 const action=async(path,extra={})=>{setBusy(true);setMessage("");try{const r=await fetch(api+"/alliance/"+path,{method:"POST",headers:headers(),body:JSON.stringify({userId,...extra})});const d=await r.json();if(!r.ok)throw Error(d.message||"Action failed");setMessage(d.message||(path==="help"?"Construction accelerated! +1 wheel token.":path==="request-help"?"Alliance help requested.":"Success!"));await refresh();}catch(e){setMessage(e.message);}finally{setBusy(false);}};
 return <div style={{color:"#eef6ff",padding:15,minWidth:300}}>
  <h2>Alliance Command</h2><p>Help clanmates build faster and earn 1 wheel token per successful help.</p>
  {message&&<p role="status">{message}</p>}
  {!state?<p>Loading…</p>:!state.alliance?<div>
   <p>Create a new alliance or apply to join an existing alliance by its exact name.</p>
   <input placeholder="Alliance name" maxLength={32} value={name} onChange={e=>setName(e.target.value)}/>
   <div style={{display:"flex",gap:8,marginTop:10}}><button disabled={busy} onClick={()=>action("create",{name})}>Create Alliance</button><button disabled={busy} onClick={()=>action("join",{name})}>Apply to Join</button></div>
  </div>:<div>
   <h3>🛡 {state.alliance.name}</h3>
   <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:12}}>
    {["members","applications","help"].map(t=><button key={t} onClick={()=>setTab(t)} style={{background:tab===t?"#257f8e":"#20384d",color:"white",padding:9,borderRadius:6}}>{t==="members"?"Members":t==="applications"?"Applications":"Construction Help"}</button>)}
   </div>
   {tab==="members"&&<div>
    <h3>Alliance Members ({(state.members||[]).length})</h3>
    <div style={{overflowX:"auto"}}><table style={{width:"100%",borderCollapse:"collapse",textAlign:"left"}}>
     <thead><tr><th>Player</th><th>Role</th><th>Actions</th></tr></thead>
     <tbody>{(state.members||[]).map(m=><tr key={m.id} style={{borderTop:"1px solid #416177"}}>
      <td style={{padding:8}}>{m.username}{String(m.id)===String(userId)?" (You)":""}</td>
      <td>{m.role}</td>
      <td style={{padding:8}}>
       {state.alliance.role==="Leader"&&m.role!=="Leader"&&<><select aria-label={"Role for "+m.username} value={m.role} onChange={e=>action("role",{targetId:m.id,role:e.target.value})} disabled={busy}>
        {["Member","Co-Leader","Treasurer","Diplomat","General","Strategist"].map(role=><option key={role}>{role}</option>)}
       </select> <button disabled={busy} onClick={()=>{if(window.confirm("Transfer leadership to "+m.username+"?"))action("transfer",{targetId:m.id});}}>Transfer Leader</button> </>}
       {String(m.id)===String(userId)&&m.role!=="Leader"&&<button disabled={busy} onClick={()=>{if(window.confirm("Leave this alliance?"))action("leave",{targetId:m.id});}}>Leave</button>}
       {String(m.id)!==String(userId)&&m.role!=="Leader"&&["Leader","Co-Leader"].includes(state.alliance.role)&&<button disabled={busy} onClick={()=>{if(window.confirm("Remove "+m.username+"?"))action("leave",{targetId:m.id});}}>Remove</button>}
      </td>
     </tr>)}</tbody>
    </table></div>
    {state.alliance.role==="Leader"&&<p style={{fontSize:12}}>Transfer leadership before leaving. One player per officer role.</p>}
   </div>}
   {tab==="applications"&&<div><h3>Membership Applications</h3>
    {!(state.applications||[]).length&&<p>No pending applications.</p>}
    {(state.applications||[]).map(m=><div key={m.id} style={{padding:9,borderBottom:"1px solid #416177"}}>{m.username} · {new Date(m.applied_at).toLocaleString()}
     {["Leader","Co-Leader","Diplomat"].includes(state.alliance.role)&&<> <button disabled={busy} onClick={()=>action("application",{targetId:m.id,accept:true})}>Accept</button> <button disabled={busy} onClick={()=>action("application",{targetId:m.id,accept:false})}>Ignore</button></>}
    </div>)}
   </div>}
   {tab==="help"&&<div>
   <button disabled={busy} onClick={()=>action("request-help")}>🤝 Request help for my active construction</button>
   <h3>Construction Help Requests</h3>
   {!(state.requests||[]).length&&<p>No active help requests.</p>}
   {(state.requests||[]).map(h=><div key={h.id} style={{padding:12,border:"1px solid #47758e",borderRadius:8,marginBottom:8}}>
    <strong>{h.username}</strong> · {h.building_name} Lv {h.building_level}
    <p>Reduce remaining time by 1 minute or 1%, whichever is greater.</p>
    <button disabled={busy||h.helped||String(h.requester_id)===String(userId)} onClick={()=>action("help",{requestId:h.id})}>{h.helped?"Already helped":String(h.requester_id)===String(userId)?"Your construction":"Help · Earn 1 Token"}</button>
   </div></div>}
  </div>}
 </div>;
}
