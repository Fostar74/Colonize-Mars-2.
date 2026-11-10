import React,{useEffect,useState,useCallback} from "react";
const api=(process.env.REACT_APP_API_URL||(window.location.hostname==="localhost"?"http://localhost:3001":window.location.origin)).replace(/\/$/,"");
const headers=()=>({"Content-Type":"application/json",Authorization:"Bearer "+sessionStorage.getItem("authToken")});
const id=()=>sessionStorage.getItem("userId");
export default function Rankings(){
 const [tab,setTab]=useState("players"),[data,setData]=useState(null),[error,setError]=useState(""),[busy,setBusy]=useState(false),[message,setMessage]=useState("");
 const [inviteTarget,setInviteTarget]=useState(null);
 const invite=async()=>{
  setBusy(true);setMessage("");
  try{
   const response=await fetch(api+"/alliance/invite",{method:"POST",headers:headers(),body:JSON.stringify({userId:id(),targetId:inviteTarget.id})});
   const result=await response.json();
   if(!response.ok)throw Error(result.message||"Invitation failed.");
   setMessage(result.message);setInviteTarget(null);
  }catch(error){setMessage(error.message);}finally{setBusy(false);}
 };
 const refresh=useCallback(async()=>{try{const r=await fetch(api+"/rankings/"+encodeURIComponent(id()),{headers:headers(),cache:"no-store"});const d=await r.json();if(!r.ok)throw Error(d.message||"Rankings unavailable.");setData(d);setError("");}catch(e){setError(e.message)}},[]);
 useEffect(()=>{refresh();const t=setInterval(refresh,15000);return()=>clearInterval(t)},[refresh]);
 const apply=async(a)=>{setBusy(true);setMessage("");try{const r=await fetch(api+"/alliance/join",{method:"POST",headers:headers(),body:JSON.stringify({userId:id(),name:a.name})});const d=await r.json();if(!r.ok)throw Error(d.message||"Application failed.");setMessage(d.message||"Application sent.");await refresh();}catch(e){setMessage(e.message)}finally{setBusy(false)}};
 return <div style={{padding:15,color:"#eef6ff"}}>
  <h2>🏆 Rankings</h2><p>1 resource spent on construction = 1 ranking XP. Army, upgrades and battle scoring will be added later.</p>
  <div style={{display:"flex",gap:8,marginBottom:14}}>{["players","alliances"].map(t=><button key={t} onClick={()=>setTab(t)} style={{background:tab===t?"#257f8e":"#20384d",color:"white",padding:10,borderRadius:7}}>{t==="players"?"Players":"Alliances"}</button>)}</div>
  {error&&<p role="alert">{error} <button onClick={refresh}>Retry</button></p>}
  {message&&<p role="status">{message}</p>}
  {tab==="players"&&inviteTarget&&<p>
   <button disabled={busy} onClick={invite}>Invite {inviteTarget.username} to your alliance</button>{" "}
   <button disabled={busy} onClick={()=>setInviteTarget(null)}>Cancel</button>
  </p>}
  {!data&&!error&&<p>Loading rankings…</p>}
  {data&&<div style={{overflowX:"auto"}}><table style={{width:"100%",borderCollapse:"collapse",textAlign:"left"}}>
   <thead>{tab==="players"?<tr><th>Rank</th><th>Player</th><th>Alliance</th><th>XP</th></tr>:<tr><th>Rank</th><th>Alliance</th><th>Leader</th><th>Members</th><th>XP</th><th>Action</th></tr>}</thead>
   <tbody>{tab==="players"?(data.players||[]).map((p,i)=><tr key={p.id} style={{borderTop:"1px solid #416177"}}><td style={{padding:9}}>{i+1}</td><td>{data.canInvite&&!p.alliance&&String(p.id)!==id()?<button disabled={busy} onClick={()=>setInviteTarget(p)}>{p.username}</button>:p.username}{String(p.id)===id()?" (You)":""}</td><td>{p.alliance||"—"}</td><td>{Number(p.points).toLocaleString()}</td></tr>):(data.alliances||[]).map((a,i)=><tr key={a.id} style={{borderTop:"1px solid #416177"}}><td style={{padding:9}}>{i+1}</td><td>🛡 {a.name}</td><td>{a.leader}</td><td>{a.memberCount}</td><td>{Number(a.points).toLocaleString()}</td><td><button disabled={busy||a.pending||a.joined} onClick={()=>apply(a)}>{a.pending?"Application Pending":a.joined?"Already in an alliance":"Apply to Join"}</button></td></tr>)}</tbody>
  </table>{tab==="alliances"&&!(data.alliances||[]).length&&<p>No alliances created yet. Open Alliance to create one.</p>}</div>}
 </div>;
}
