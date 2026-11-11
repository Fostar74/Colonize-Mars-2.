import AllianceResearch from "./AllianceResearch";
import { useLanguage } from "../language";
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
export default function AlliancePanel({supportTarget,playerAction,constructionHelpOnly=false}){
  const { t , label: localLabel} = useLanguage();
 const playerName=player=>playerAction ? playerAction(player) : player.username;
 const [reinforceRecipient,setReinforceRecipient]=useState(supportTarget?.id || ""),[reinforceUnit,setReinforceUnit]=useState("Explorer Trooper"),[reinforceCount,setReinforceCount]=useState(1);
 const [loadError,setLoadError]=useState(""),[state,setState]=useState(null),[name,setName]=useState(""),[message,setMessage]=useState(""),[busy,setBusy]=useState(false),[tab,setTab]=useState(supportTarget ? "reinforcements" : "members");
 const refresh=useCallback(async()=>{try{if(!getUserId()||!sessionStorage.getItem("authToken"))throw Error("Session missing. Please log in again.");const r=await fetch(api+"/alliance/"+encodeURIComponent(getUserId()),{headers:headers(),cache:"no-store"});const d=await r.json().catch(()=>null);if(!r.ok)throw Error((d&&d.message)||(r.status===401?"Session expired. Please log in again.":"Alliance unavailable (HTTP "+r.status+")."));setState(d);setLoadError("");}catch(e){setLoadError(e.message);}},[]);
 useEffect(()=>{refresh();const t=setInterval(refresh,10000);return()=>clearInterval(t);},[refresh]);
 const helpAll=async()=>{const eligible=(state?.requests||[]).filter(h=>!h.helped&&String(h.requester_id)!==String(getUserId()));if(!eligible.length)return;setBusy(true);setMessage("");let successes=0,failures=0;for(const h of eligible){try{const r=await fetch(api+"/alliance/help",{method:"POST",headers:headers(),body:JSON.stringify({userId:getUserId(),requestId:h.id})});if(r.ok)successes++;else failures++;}catch(e){failures++;}}setMessage(`Help All: ${successes} construction(s) accelerated, ${successes} token(s) earned${failures?`, ${failures} failed`:""}.`);await refresh();setBusy(false);};
 const action=async(path,extra={})=>{setBusy(true);setMessage("");try{const r=await fetch(api+"/alliance/"+path,{method:"POST",headers:headers(),body:JSON.stringify({userId:getUserId(),...extra})});const d=await r.json();if(!r.ok)throw Error(d.message||"Action failed");setMessage(d.message||(path==="help"?"Construction accelerated! +1 wheel token.":path==="request-help"?"Alliance help requested.":"Success!"));await refresh();}catch(e){setMessage(e.message);}finally{setBusy(false);}};
 const constructionHelp = <div>
   <button disabled={busy} onClick={()=>action("request-help")}>{t("🤝 Request help for my active construction","🤝 Поискай помощ за текущия строеж")}</button>
   <h3>{t("Construction Help Requests","Заявки за строителна помощ")}</h3>
   <p>{t("Active requests refresh automatically every 10 seconds. Each member can help each construction once.","Заявките се обновяват на всеки 10 секунди. Всеки член може да помогне веднъж за всеки строеж.")}</p>
   <button disabled={busy||!(state?.requests||[]).some(h=>!h.helped&&String(h.requester_id)!==String(getUserId()))} onClick={helpAll}>{t("🤝 Help All Eligible Requests","🤝 Помогни на всички")}</button>
   {!(state?.requests||[]).length&&<p>{t("No active help requests.","Няма активни заявки.")}</p>}
   {(state?.requests||[]).map(h=><div key={h.id} style={{padding:12,border:"1px solid #47758e",borderRadius:8,marginBottom:8}}>
    <strong>{playerName({...h,id:h.requester_id,ally:true})}</strong> · {h.building_name} {t("Lv","Ниво")} {h.building_level}
    <p>{h.helperCount||0} {t("member(s) helped · Reduce remaining time by 1 minute or 1%, whichever is greater.","членове помогнаха · Намалява оставащото време с 1 минута или 1%, което е повече.")}</p>
    <button disabled={busy||h.helped||String(h.requester_id)===String(getUserId())} onClick={()=>action("help",{requestId:h.id})}>{h.helped?localLabel("Already helped"):String(h.requester_id)===String(getUserId())?localLabel("Your construction"):localLabel("Help · Earn 1 Token")}</button>
   </div>)}
   </div>;
 if(constructionHelpOnly){
  if(!state?.alliance && !loadError)return null;
  return <section aria-label="Alliance construction help" style={{color:"#eef6ff",padding:12,marginBottom:12,border:"1px solid #47758e",borderRadius:8}}>
   {message&&<p role="status">{localLabel(message)}</p>}
   {loadError&&<p role="alert">{localLabel(loadError)} <button onClick={refresh}>{t("Retry","Опитай пак")}</button></p>}
   {state?.alliance&&constructionHelp}
  </section>;
 }
 return <div style={{color:"#eef6ff",padding:15,minWidth:300}}>
  <h2>{t("Alliance Command","Командване на алианса")}</h2><p>{t("Help clanmates build faster and earn 1 wheel token per successful help.","Помагай на съюзниците да строят по-бързо и печели по 1 жетон за всяка помощ.")}</p>
  {message&&<p role="status">{localLabel(message)}</p>}
  {loadError&&<div role="alert" style={{padding:12,background:"#49332d",borderRadius:8}}>{localLabel(loadError)} <button onClick={refresh}>{t("Retry","Опитай пак")}</button></div>}
  {!state?<p>{loadError?"Alliance data could not be loaded.":localLabel("Loading…")}</p>:!state.alliance?<div>
   {!!state.invitations?.length && <section>
    <h3>{t("Alliance Invitations","Покани за алианс")}</h3>
    {state.invitations.map(invite=><p key={invite.id}>
      <strong>{invite.name}</strong>{" "}
      <button disabled={busy} onClick={()=>action("invite/respond",{allianceId:invite.id,accept:true})}>{t("Accept","Приеми")}</button>{" "}
      <button disabled={busy} onClick={()=>action("invite/respond",{allianceId:invite.id,accept:false})}>{t("Decline","Откажи")}</button>
    </p>)}
   </section>}
   <h3>{t("Create Alliance","Създай алианс")}</h3>
   <p>{t("Choose a unique name for your new alliance.","Избери уникално име за новия алианс.")}</p>
   <input aria-label={localLabel("New alliance name")} placeholder={localLabel("New alliance name")} maxLength={32} value={name} onChange={e=>setName(e.target.value)} style={{padding:9,maxWidth:"100%"}}/>
   <div style={{marginTop:10}}><button disabled={busy||name.trim().length<3} onClick={()=>action("create",{name:name.trim()})}>{t("Create Alliance","Създай алианс")}</button></div>
   <p style={{marginTop:20}}>{t("To join an existing alliance, open","За да се присъединиш, отвори")} <strong>{t("Rankings → Alliances","Класиране → Алианси")}</strong> {t("and click Apply to Join beside its name. No typing or search required.","и натисни бутона за кандидатстване до името му.")}</p>
  </div>:<div>
   <h3>🛡 {state.alliance.name}</h3>
   <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:12}}>
    {Object.entries({members:"Members",applications:"Applications",help:"Construction Help",chat:"Chat",research:"Alliance Research",market:"Donation & Market"}).map(([key,label])=>
      <button key={key} onClick={()=>setTab(key)} style={{background:tab===key?"#257f8e":"#20384d",color:"white",padding:9,borderRadius:6}}>{localLabel(label)}</button>)}
   </div>
   {tab==="chat"&&<MessagePanel alliance playerAction={player=>playerName({...player,ally:state.members.some(member=>member.id===player.id)})}/>}
   {tab==="members"&&<div>
    {!!state.reinforcements?.length && <button onClick={()=>setTab("reinforcements")}>{t("Active Support (","Активни подкрепления (")}{state.reinforcements.length})</button>}
    <h3>{t("Alliance Members (","Членове на алианса (")}{(state.members||[]).length})</h3>
    <div style={{overflowX:"auto"}}><table style={{width:"100%",borderCollapse:"collapse",textAlign:"left"}}>
     <thead><tr><th>{t("Player","Играч")}</th><th>{t("Role","Роля")}</th><th>{t("Actions","Действия")}</th></tr></thead>
     <tbody>{(state.members||[]).map(m=><tr key={m.id} style={{borderTop:"1px solid #416177"}}>
      <td style={{padding:8}}>{playerName({...m,ally:true})}{String(m.id)===String(getUserId())?localLabel(" (You)"):""}</td>
      <td>{localLabel(m.role)}</td>
      <td style={{padding:8}}>
       {state.alliance.role==="Leader"&&m.role!=="Leader"&&<><select aria-label={"Role for "+m.username} value={m.role} onChange={e=>action("role",{targetId:m.id,role:e.target.value})} disabled={busy}>
        {["Member","Co-Leader","Treasurer","Diplomat","General","Strategist"].map(role=><option key={role} value={role}>{localLabel(role)}</option>)}
       </select> <button disabled={busy} onClick={()=>{if(window.confirm("Transfer leadership to "+m.username+"?"))action("transfer",{targetId:m.id});}}>{t("Transfer Leader","Предай лидерството")}</button> </>}
       {String(m.id)===String(getUserId())&&m.role!=="Leader"&&<button disabled={busy} onClick={()=>{if(window.confirm("Leave this alliance?"))action("leave",{targetId:m.id});}}>{t("Leave","Напусни")}</button>}
       {String(m.id)!==String(getUserId())&&m.role!=="Leader"&&["Leader","Co-Leader"].includes(state.alliance.role)&&<button disabled={busy} onClick={()=>{if(window.confirm("Remove "+m.username+"?"))action("leave",{targetId:m.id});}}>{t("Remove","Премахни")}</button>}
      </td>
     </tr>)}</tbody>
    </table></div>
    {state.alliance.role==="Leader"&&<p style={{fontSize:12}}>{t("Transfer leadership before leaving. One player per officer role.","Предай лидерството преди да напуснеш. Всяка офицерска роля се заема от един играч.")}</p>}
   </div>}
   {tab==="research"&&<AllianceResearch economy={state.economy} role={state.alliance.role} busy={busy}
     start={kind=>action("bonus/upgrade",{kind})}/>}
   {tab==="market"&&<div>
    <h3>{t("Alliance Donation & Market","Дарения и пазар")}</h3>
    <p>{t("Alliance Points:","Точки на алианса:")} <strong>{state.economy?.points||0}</strong> {t("· Donations left today (resets at 00:00 UTC):","· Оставащи дарения днес (нулиране в 00:00 UTC):")} {state.economy?.donationsRemaining??20}/20</p>
    <h4>{t("Donate 100 resources (+10 Alliance Points)","Дари 100 ресурса (+10 точки на алианса)")}</h4>
    {["Gold","Iron","Water","Solar"].map(resource=><button key={resource} disabled={busy||!state.economy?.donationsRemaining} style={{margin:4}} onClick={()=>action("donate",{resource})}>{t("Donate 100","Дари 100")} {localLabel(resource)}</button>)}
    <h4>{t("Alliance Treasury","Хазна на алианса")}</h4>
    <p>{Object.entries(state.economy?.treasury||{}).map(([k,n])=>k+": "+n).join(" · ")}</p>
    <h4>{t("Alliance Market","Пазар на алианса")}</h4>
    {Object.entries({gold:["500 Gold",30],iron:["500 Iron",30],water:["500 Water",30],solar:["500 Solar",30],landing:["1 Mars Landing Token",100],attack:["+10% Army Attack (1h)",80],health:["+10% Army Health (1h)",80],protection:["Protection (1h)",150]}).map(([item,[label,cost]])=><div key={item} style={{marginBottom:8}}>
      <img src={{gold:goldIcon,iron:ironIcon,water:waterIcon,solar:solarIcon}[item] || baseIcon} alt="" width="28" height="28" style={{verticalAlign:"middle",marginRight:8}} />
      {label} — {cost} {t("AP","ТА")} <button disabled={busy||item==="protection"||(state.economy?.points||0)<cost} onClick={()=>action("market/buy",{item})}>{item==="protection"?localLabel("Requires PvP"):localLabel("Buy")}</button>
    </div>)}
    <p style={{fontSize:12}}>{t("Army bonuses apply to Alien Base missions launched while active. Buying a boost again adds one hour.","Бойните бонуси важат за походи срещу извънземни бази, започнати докато бонусът е активен. Повторна покупка добавя час.")}</p>
    {(state.economy?.buffs||[]).filter(buff=>buff.kind==="attack"||buff.kind==="health").map(buff=><p key={buff.kind}>
      {buff.kind==="attack"?"Attack Boost":"Health Boost"} {t("active until","активен до")} {new Date(buff.expires_at).toLocaleString()}
    </p>)}
   </div>}
   {tab==="reinforcements"&&<div>
    <h3>{t("Alliance Reinforcements","Подкрепления на алианса")}</h3>
    <p>{t("Dispatch troops to an ally, then recall them when ready. Troops are reserved from your active army until they return.","Изпрати войски на съюзник и ги отзови при нужда. Войските се отделят от активната армия, докато се върнат.")}</p>
    <label>{t("Recipient","Получател")} <select value={reinforceRecipient} onChange={e=>setReinforceRecipient(e.target.value)}>
      <option value="">{t("Choose member","Избери съюзник")}</option>
      {(state.members||[]).filter(m=>String(m.id)!==String(getUserId())).map(m=><option key={m.id} value={m.id}>{m.username}</option>)}
    </select></label>
    <label> {t("Unit","Единица")} <select value={reinforceUnit} onChange={e=>setReinforceUnit(e.target.value)}>
      {["Explorer Trooper","Exo-Soldier","Plasma Bladesman","Nano Shieldman","Railgunner","Pulse Sniper","Drone Operator","Rover Scout","Hoverbike Rider","Mech Walker","Hover Drone Rider","Demolition Bot","Missile Carrier","Particle Blaster","Orbital Strike Beacon","Martian Noble","AI General","Gene Warrior"].map(u=><option key={u} value={u}>{localLabel(u)}</option>)}
    </select></label>
    <label> {t("Count","Брой")} <input type="number" min="1" step="1" value={reinforceCount} onChange={e=>setReinforceCount(Number(e.target.value))} style={{width:95}}/></label>
    <button disabled={busy||!reinforceRecipient||!Number.isSafeInteger(reinforceCount)||reinforceCount<1} onClick={()=>action("reinforce",{recipientId:Number(reinforceRecipient),units:{[reinforceUnit]:reinforceCount}})}>{t("Send Reinforcements","Изпрати подкрепления")}</button>
    <p style={{fontSize:12}}>{t("Travel is approximately one minute each way, modified by Hyperdrive. Defensive battle participation is not yet enabled.","Пътуването е около минута в посока и зависи от хипердвигателя. Участието в отбранителни битки предстои.")}</p>
    {(state.reinforcements||[]).map(m=><div key={m.id} style={{padding:10,border:"1px solid #47758e",margin:"8px 0",borderRadius:6}}>
      <strong>{playerName({id:m.sender_id,username:m.sender,ally:true})} → {playerName({id:m.recipient_id,username:m.recipient,ally:true})}</strong> · {Object.entries(m.units).map(([u,n])=>n+" "+u).join(", ")}
      <p>{m.recall_at?localLabel("Returning"):Date.now()<m.arrives_at?localLabel("Travelling"):localLabel("Stationed")} {t("· Arrival","· Пристигане")} {new Date(m.arrives_at).toLocaleString()}</p>
      {String(m.sender_id)===String(getUserId())&&!m.recall_at&&<button disabled={busy} onClick={()=>action("recall",{missionId:m.id})}>{t("Recall Troops","Отзови войските")}</button>}
    </div>)}
    {!(state.reinforcements||[]).length&&<p>{t("No active reinforcements.","Няма активни подкрепления.")}</p>}
   </div>}
   {tab==="help"&&<details>
    <summary>{t("Help History","История на помощта")}</summary>
    <p>{t("Recorded helps:","Записани помощи:")} {state.helpStats?.totalHelps||0} {t("· Total construction time saved:","· Общо спестено време:")} {Math.floor((state.helpStats?.totalTimeSavedMs||0)/60000)} {t("minutes","минути")}</p>
    <p>{t("Shows the 50 most recent successful assists since this feature was enabled.","Показва последните 50 успешни помощи.")}</p>
    {!(state.helpHistory||[]).length&&<p>{t("No recorded assists yet.","Няма записани помощи.")}</p>}
    {(state.helpHistory||[]).map(h=><div key={h.id} style={{padding:10,marginBottom:8,border:"1px solid #47758e",borderRadius:6}}>
      <strong>{playerName({username:h.helper,ally:state.members.some(member=>member.username===h.helper)})}</strong> {t("helped","помогна на")} <strong>{playerName({username:h.requester,ally:state.members.some(member=>member.username===h.requester)})}</strong> {t("with","за")} {h.building_name} {t("level","ниво")} {h.building_level}
      <div>{t("Time saved:","Спестено време:")} {Math.ceil(h.reduction_ms/1000)} {t("seconds ·","секунди ·")} {new Date(h.helped_at).toLocaleString()}</div>
    </div>)}
   </details>}
   {tab==="applications"&&<div><h3>{t("Membership Applications","Кандидатури за членство")}</h3>
    {!(state.applications||[]).length&&<p>{t("No pending applications.","Няма чакащи кандидатури.")}</p>}
    {(state.applications||[]).map(m=><div key={m.id} style={{padding:9,borderBottom:"1px solid #416177"}}>{playerName(m)} · {new Date(m.applied_at).toLocaleString()}
     {["Leader","Co-Leader","Diplomat"].includes(state.alliance.role)&&<> <button disabled={busy} onClick={()=>action("application",{targetId:m.id,accept:true})}>{t("Accept","Приеми")}</button> <button disabled={busy} onClick={()=>action("application",{targetId:m.id,accept:false})}>{t("Ignore","Игнорирай")}</button></>}
    </div>)}
   </div>}
   {tab==="help"&&constructionHelp}
  </div>}
 </div>;
}
