import MessagePanel from "./MessagePanel";
import goldIcon from "../images/gold.png";
import ironIcon from "../images/iron.png";
import waterIcon from "../images/water.png";
import solarIcon from "../images/solar.png";
import baseIcon from "../images/hq-icon.png";
import React,{useEffect,useState,useCallback} from "react";
const api=(process.env.REACT_APP_API_URL||(window.location.hostname==="localhost"?"http://localhost:3001":window.location.origin)).replace(/\/$/,"");
const getUserId=()=>sessionStorage.getItem("userId");
const headers=()=>({"Content-Type":"application/json",Authorization:"Bearer "+sessionStorage.getItem("authToken")});
export default function AlliancePanel({supportTarget,playerAction}){
 const playerName=player=>playerAction ? playerAction(player) : player.username;
 const [reinforceRecipient,setReinforceRecipient]=useState(supportTarget?.id || ""),[reinforceUnit,setReinforceUnit]=useState("Explorer Trooper"),[reinforceCount,setReinforceCount]=useState(1);
 const [loadError,setLoadError]=useState(""),[state,setState]=useState(null),[name,setName]=useState(""),[message,setMessage]=useState(""),[busy,setBusy]=useState(false),[tab,setTab]=useState(supportTarget ? "reinforcements" : "members");
 const refresh=useCallback(async()=>{try{if(!getUserId()||!sessionStorage.getItem("authToken"))throw Error("Session missing. Please log in again.");const r=await fetch(api+"/alliance/"+encodeURIComponent(getUserId()),{headers:headers(),cache:"no-store"});const d=await r.json().catch(()=>null);if(!r.ok)throw Error((d&&d.message)||(r.status===401?"Session expired. Please log in again.":"Alliance unavailable (HTTP "+r.status+")."));setState(d);setLoadError("");}catch(e){setLoadError(e.message);}},[]);
 useEffect(()=>{refresh();const t=setInterval(refresh,10000);return()=>clearInterval(t);},[refresh]);
 const helpAll=async()=>{const eligible=(state?.requests||[]).filter(h=>!h.helped&&String(h.requester_id)!==String(getUserId()));if(!eligible.length)return;setBusy(true);setMessage("");let successes=0,failures=0;for(const h of eligible){try{const r=await fetch(api+"/alliance/help",{method:"POST",headers:headers(),body:JSON.stringify({userId:getUserId(),requestId:h.id})});if(r.ok)successes++;else failures++;}catch(e){failures++;}}setMessage(`Help All: ${successes} construction(s) accelerated, ${successes} token(s) earned${failures?`, ${failures} failed`:""}.`);await refresh();setBusy(false);};
 const action=async(path,extra={})=>{setBusy(true);setMessage("");try{const r=await fetch(api+"/alliance/"+path,{method:"POST",headers:headers(),body:JSON.stringify({userId:getUserId(),...extra})});const d=await r.json();if(!r.ok)throw Error(d.message||"Action failed");setMessage(d.message||(path==="help"?"Construction accelerated! +1 wheel token.":path==="request-help"?"Alliance help requested.":"Success!"));await refresh();}catch(e){setMessage(e.message);}finally{setBusy(false);}};
 return <div style={{color:"#eef6ff",padding:15,minWidth:300}}>
  <h2>Alliance Command</h2><p>Help clanmates build faster and earn 1 wheel token per successful help.</p>
  {message&&<p role="status">{message}</p>}
  {loadError&&<div role="alert" style={{padding:12,background:"#49332d",borderRadius:8}}>{loadError} <button onClick={refresh}>Retry</button></div>}
  {!state?<p>{loadError?"Alliance data could not be loaded.":"Loading…"}</p>:!state.alliance?<div>
   {!!state.invitations?.length && <section>
    <h3>Alliance Invitations</h3>
    {state.invitations.map(invite=><p key={invite.id}>
      <strong>{invite.name}</strong>{" "}
      <button disabled={busy} onClick={()=>action("invite/respond",{allianceId:invite.id,accept:true})}>Accept</button>{" "}
      <button disabled={busy} onClick={()=>action("invite/respond",{allianceId:invite.id,accept:false})}>Decline</button>
    </p>)}
   </section>}
   <h3>Create Alliance</h3>
   <p>Choose a unique name for your new alliance.</p>
   <input aria-label="New alliance name" placeholder="New alliance name" maxLength={32} value={name} onChange={e=>setName(e.target.value)} style={{padding:9,maxWidth:"100%"}}/>
   <div style={{marginTop:10}}><button disabled={busy||name.trim().length<3} onClick={()=>action("create",{name:name.trim()})}>Create Alliance</button></div>
   <p style={{marginTop:20}}>To join an existing alliance, open <strong>Rankings → Alliances</strong> and click Apply to Join beside its name. No typing or search required.</p>
  </div>:<div>
   <h3>🛡 {state.alliance.name}</h3>
   <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:12}}>
    {Object.entries({members:"Members",applications:"Applications",help:"Construction Help",chat:"Chat",research:"Alliance Research",market:"Donation & Market"}).map(([key,label])=>
      <button key={key} onClick={()=>setTab(key)} style={{background:tab===key?"#257f8e":"#20384d",color:"white",padding:9,borderRadius:6}}>{label}</button>)}
   </div>
   {tab==="chat"&&<MessagePanel alliance playerAction={player=>playerName({...player,ally:state.members.some(member=>member.id===player.id)})}/>}
   {tab==="members"&&<div>
    {!!state.reinforcements?.length && <button onClick={()=>setTab("reinforcements")}>Active Support ({state.reinforcements.length})</button>}
    <h3>Alliance Members ({(state.members||[]).length})</h3>
    <div style={{overflowX:"auto"}}><table style={{width:"100%",borderCollapse:"collapse",textAlign:"left"}}>
     <thead><tr><th>Player</th><th>Role</th><th>Actions</th></tr></thead>
     <tbody>{(state.members||[]).map(m=><tr key={m.id} style={{borderTop:"1px solid #416177"}}>
      <td style={{padding:8}}>{playerName({...m,ally:true})}{String(m.id)===String(getUserId())?" (You)":""}</td>
      <td>{m.role}</td>
      <td style={{padding:8}}>
       {state.alliance.role==="Leader"&&m.role!=="Leader"&&<><select aria-label={"Role for "+m.username} value={m.role} onChange={e=>action("role",{targetId:m.id,role:e.target.value})} disabled={busy}>
        {["Member","Co-Leader","Treasurer","Diplomat","General","Strategist"].map(role=><option key={role}>{role}</option>)}
       </select> <button disabled={busy} onClick={()=>{if(window.confirm("Transfer leadership to "+m.username+"?"))action("transfer",{targetId:m.id});}}>Transfer Leader</button> </>}
       {String(m.id)===String(getUserId())&&m.role!=="Leader"&&<button disabled={busy} onClick={()=>{if(window.confirm("Leave this alliance?"))action("leave",{targetId:m.id});}}>Leave</button>}
       {String(m.id)!==String(getUserId())&&m.role!=="Leader"&&["Leader","Co-Leader"].includes(state.alliance.role)&&<button disabled={busy} onClick={()=>{if(window.confirm("Remove "+m.username+"?"))action("leave",{targetId:m.id});}}>Remove</button>}
      </td>
     </tr>)}</tbody>
    </table></div>
    {state.alliance.role==="Leader"&&<p style={{fontSize:12}}>Transfer leadership before leaving. One player per officer role.</p>}
   </div>}
   {tab==="research"&&<section>
    <h3>Alliance Research</h3>
    <p>Research upgrades are managed by the Leader and Co-Leader.</p>
    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))",gap:12}}>
    {Object.entries({attack:["Army Attack","Gold"],growth:["Development","Water"],health:["Army Health","Iron"],speed:["Faster Upgrades","Solar"],discount:["Cheaper Upgrades","Gold"],wallHealth:["Wall Health","Iron"],wallAttack:["Wall Attack","Solar"]}).map(([kind,[label,resource]])=>{
      const level=state.economy?.bonuses?.[kind]||0;
      const available=kind!=="wallHealth"&&kind!=="wallAttack";
      return <div key={kind} style={{padding:12,border:"1px solid #47758e",borderRadius:8,background:"#172c40"}}>
        <img src={available?{Gold:goldIcon,Iron:ironIcon,Water:waterIcon,Solar:solarIcon}[resource]:baseIcon} alt="" width="44" height="44" />
        <h4>{label}</h4><p>Level {level}/10 · {available ? level===10 ? "Max level" : `+2% per level · Next: ${1000*(level+1)} ${resource}` : "Available when wall combat launches"}</p>
        <button disabled={busy||!available||level>=10||!["Leader","Co-Leader"].includes(state.alliance.role)} onClick={()=>action("bonus/upgrade",{kind})}>Research</button>
      </div>;
    })}
    </div>
   </section>}
   {tab==="market"&&<div>
    <h3>Alliance Donation & Market</h3>
    <p>Alliance Points: <strong>{state.economy?.points||0}</strong> · Donations left today (resets at 00:00 UTC): {state.economy?.donationsRemaining??20}/20</p>
    <h4>Donate 100 resources (+10 Alliance Points)</h4>
    {["Gold","Iron","Water","Solar"].map(resource=><button key={resource} disabled={busy||!state.economy?.donationsRemaining} style={{margin:4}} onClick={()=>action("donate",{resource})}>Donate 100 {resource}</button>)}
    <h4>Alliance Treasury</h4>
    <p>{Object.entries(state.economy?.treasury||{}).map(([k,n])=>k+": "+n).join(" · ")}</p>
    <h4>Alliance Market</h4>
    {Object.entries({gold:["500 Gold",30],iron:["500 Iron",30],water:["500 Water",30],solar:["500 Solar",30],landing:["1 Mars Landing Token",100],attack:["+10% Army Attack (1h)",80],health:["+10% Army Health (1h)",80],protection:["Protection (1h)",150]}).map(([item,[label,cost]])=><div key={item} style={{marginBottom:8}}>
      <img src={{gold:goldIcon,iron:ironIcon,water:waterIcon,solar:solarIcon}[item] || baseIcon} alt="" width="28" height="28" style={{verticalAlign:"middle",marginRight:8}} />
      {label} — {cost} AP <button disabled={busy||item==="protection"||(state.economy?.points||0)<cost} onClick={()=>action("market/buy",{item})}>{item==="protection"?"Requires PvP":"Buy"}</button>
    </div>)}
    <p style={{fontSize:12}}>Army bonuses apply to Alien Base missions launched while active. Buying a boost again adds one hour.</p>
    {(state.economy?.buffs||[]).filter(buff=>buff.kind==="attack"||buff.kind==="health").map(buff=><p key={buff.kind}>
      {buff.kind==="attack"?"Attack Boost":"Health Boost"} active until {new Date(buff.expires_at).toLocaleString()}
    </p>)}
   </div>}
   {tab==="reinforcements"&&<div>
    <h3>Alliance Reinforcements</h3>
    <p>Dispatch troops to an ally, then recall them when ready. Troops are reserved from your active army until they return.</p>
    <label>Recipient <select value={reinforceRecipient} onChange={e=>setReinforceRecipient(e.target.value)}>
      <option value="">Choose member</option>
      {(state.members||[]).filter(m=>String(m.id)!==String(getUserId())).map(m=><option key={m.id} value={m.id}>{m.username}</option>)}
    </select></label>
    <label> Unit <select value={reinforceUnit} onChange={e=>setReinforceUnit(e.target.value)}>
      {["Explorer Trooper","Exo-Soldier","Plasma Bladesman","Nano Shieldman","Railgunner","Pulse Sniper","Drone Operator","Rover Scout","Hoverbike Rider","Mech Walker","Hover Drone Rider","Demolition Bot","Missile Carrier","Particle Blaster","Orbital Strike Beacon","Martian Noble","AI General","Gene Warrior"].map(u=><option key={u}>{u}</option>)}
    </select></label>
    <label> Count <input type="number" min="1" step="1" value={reinforceCount} onChange={e=>setReinforceCount(Number(e.target.value))} style={{width:95}}/></label>
    <button disabled={busy||!reinforceRecipient||!Number.isSafeInteger(reinforceCount)||reinforceCount<1} onClick={()=>action("reinforce",{recipientId:Number(reinforceRecipient),units:{[reinforceUnit]:reinforceCount}})}>Send Reinforcements</button>
    <p style={{fontSize:12}}>Travel is approximately one minute each way, modified by Hyperdrive. Defensive battle participation is not yet enabled.</p>
    {(state.reinforcements||[]).map(m=><div key={m.id} style={{padding:10,border:"1px solid #47758e",margin:"8px 0",borderRadius:6}}>
      <strong>{playerName({id:m.sender_id,username:m.sender,ally:true})} → {playerName({id:m.recipient_id,username:m.recipient,ally:true})}</strong> · {Object.entries(m.units).map(([u,n])=>n+" "+u).join(", ")}
      <p>{m.recall_at?"Returning":Date.now()<m.arrives_at?"Travelling":"Stationed"} · Arrival {new Date(m.arrives_at).toLocaleString()}</p>
      {String(m.sender_id)===String(getUserId())&&!m.recall_at&&<button disabled={busy} onClick={()=>action("recall",{missionId:m.id})}>Recall Troops</button>}
    </div>)}
    {!(state.reinforcements||[]).length&&<p>No active reinforcements.</p>}
   </div>}
   {tab==="help"&&<details>
    <summary>Help History</summary>
    <p>Recorded helps: {state.helpStats?.totalHelps||0} · Total construction time saved: {Math.floor((state.helpStats?.totalTimeSavedMs||0)/60000)} minutes</p>
    <p>Shows the 50 most recent successful assists since this feature was enabled.</p>
    {!(state.helpHistory||[]).length&&<p>No recorded assists yet.</p>}
    {(state.helpHistory||[]).map(h=><div key={h.id} style={{padding:10,marginBottom:8,border:"1px solid #47758e",borderRadius:6}}>
      <strong>{playerName({username:h.helper,ally:state.members.some(member=>member.username===h.helper)})}</strong> helped <strong>{playerName({username:h.requester,ally:state.members.some(member=>member.username===h.requester)})}</strong> with {h.building_name} level {h.building_level}
      <div>Time saved: {Math.ceil(h.reduction_ms/1000)} seconds · {new Date(h.helped_at).toLocaleString()}</div>
    </div>)}
   </details>}
   {tab==="applications"&&<div><h3>Membership Applications</h3>
    {!(state.applications||[]).length&&<p>No pending applications.</p>}
    {(state.applications||[]).map(m=><div key={m.id} style={{padding:9,borderBottom:"1px solid #416177"}}>{playerName(m)} · {new Date(m.applied_at).toLocaleString()}
     {["Leader","Co-Leader","Diplomat"].includes(state.alliance.role)&&<> <button disabled={busy} onClick={()=>action("application",{targetId:m.id,accept:true})}>Accept</button> <button disabled={busy} onClick={()=>action("application",{targetId:m.id,accept:false})}>Ignore</button></>}
    </div>)}
   </div>}
   {tab==="help"&&<div>
   <button disabled={busy} onClick={()=>action("request-help")}>🤝 Request help for my active construction</button>
   <h3>Construction Help Requests</h3>
   <p>Active requests refresh automatically every 10 seconds. Each member can help each construction once.</p>
   <button disabled={busy||!(state.requests||[]).some(h=>!h.helped&&String(h.requester_id)!==String(getUserId()))} onClick={helpAll}>🤝 Help All Eligible Requests</button>
   {!(state.requests||[]).length&&<p>No active help requests.</p>}
   {(state.requests||[]).map(h=><div key={h.id} style={{padding:12,border:"1px solid #47758e",borderRadius:8,marginBottom:8}}>
    <strong>{playerName({...h,username:h.username,id:h.requester_id,ally:true})}</strong> · {h.building_name} Lv {h.building_level}
    <p>{h.helperCount||0} member(s) helped · Reduce remaining time by 1 minute or 1%, whichever is greater.</p>
    <button disabled={busy||h.helped||String(h.requester_id)===String(getUserId())} onClick={()=>action("help",{requestId:h.id})}>{h.helped?"Already helped":String(h.requester_id)===String(getUserId())?"Your construction":"Help · Earn 1 Token"}</button>
   </div>)}
   </div>}
  </div>}
 </div>;
}
