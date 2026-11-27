import PlayerAvatar from "../shared/PlayerAvatar";
import AllianceMessages from "./AllianceMessages";
import AllianceMineProgress from "./AllianceMineProgress";
import marketProducts from "../shared/allianceMarket";
import { useNavigate } from "react-router-dom";
import AllianceResearch from "./AllianceResearch";
import { useLanguage } from "../language";
import LinkifiedText from "../shared/LinkifiedText";
import baseIcon from "../images/hq-icon.png";
import React,{useEffect,useState,useCallback} from "react";
const api=(process.env.REACT_APP_API_URL||(window.location.hostname==="localhost"?"http://localhost:3001":window.location.origin)).replace(/\/$/,"");
const getUserId=()=>sessionStorage.getItem("userId");
const headers=()=>({"Content-Type":"application/json",Authorization:"Bearer "+sessionStorage.getItem("authToken")});
export default function AlliancePanel({supportTarget,playerAction,tab,setTab,markMessagesDisplayed}){
  const { t , label: localLabel} = useLanguage();
  const navigate=useNavigate();
 const playerName=player=>playerAction ? playerAction(player) : player.username;
 const [reinforceRecipient,setReinforceRecipient]=useState(supportTarget?.id || ""),[reinforceUnit,setReinforceUnit]=useState("Explorer Trooper"),[reinforceCount,setReinforceCount]=useState(1);
 const [loadError,setLoadError]=useState(""),[state,setState]=useState(null),[name,setName]=useState(""),[message,setMessage]=useState(""),[busy,setBusy]=useState(false),[description,setDescription]=useState("");
 const [exchangeFrom,setExchangeFrom]=useState("Gold"),[exchangeTo,setExchangeTo]=useState("Iron"),[exchangeAmount,setExchangeAmount]=useState("100");
 const [crystalKind,setCrystalKind]=useState("green"),[crystalAmount,setCrystalAmount]=useState("");
 const refresh=useCallback(async()=>{try{if(!getUserId()||!sessionStorage.getItem("authToken"))throw Error("Session missing. Please log in again.");const r=await fetch(api+"/alliance/"+encodeURIComponent(getUserId()),{headers:headers(),cache:"no-store"});const d=await r.json().catch(()=>null);if(!r.ok)throw Error((d&&d.message)||(r.status===401?"Session expired. Please log in again.":"Alliance unavailable (HTTP "+r.status+")."));setState(d);setLoadError("");}catch(e){setLoadError(e.message);}},[]);
 useEffect(()=>{refresh();const t=setInterval(refresh,10000);return()=>clearInterval(t);},[refresh]);
 useEffect(()=>{if(state?.alliance)setDescription(state.alliance.description||"");},[state?.alliance?.id,state?.alliance?.description]);
 const action=async(path,extra={})=>{setBusy(true);setMessage("");try{const r=await fetch(api+"/alliance/"+path,{method:"POST",headers:headers(),body:JSON.stringify({userId:getUserId(),...extra})});const d=await r.json();if(!r.ok)throw Error(d.message||"Action failed");setMessage(d.message||(path==="help"?"Construction accelerated! +1 wheel token.":path==="request-help"?"Alliance help requested.":path==="market/buy"?"Purchase added to your Inventory.":"Success!"));await refresh();}catch(e){setMessage(e.message);}finally{setBusy(false);}};
 const donateCrystals=async()=>{setBusy(true);setMessage("");try{const r=await fetch(api+"/alien-stations/donate",{method:"POST",headers:headers(),body:JSON.stringify({userId:getUserId(),kind:crystalKind,amount:Number(crystalAmount)})});const d=await r.json();if(!r.ok)throw Error(d.message||"Donation failed");setCrystalAmount("");setMessage(t("Crystals donated to the alliance.","Кристалите са дарени на алианса."));await refresh();}catch(e){setMessage(e.message);}finally{setBusy(false);}};
 return <div style={{color:"#eef6ff",padding:15,minWidth:300}}>
  <h2>{t("Alliance Command","Командване на алианса")}</h2>
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
   <section style={{margin:"12px 0",padding:12,border:"1px solid #47758e",borderRadius:8,background:"#142637"}}>
    <h4 style={{marginTop:0}}>{t("Alliance profile","Профил на алианса")}</h4>
    {state.alliance.description?<p style={{overflowWrap:"anywhere"}}><LinkifiedText text={state.alliance.description}/></p>:<p>{t("The alliance has not added a profile message yet.","Алиансът все още няма представяне.")}</p>}
    {["Leader","Co-Leader"].includes(state.alliance.role)&&<>
     <label style={{display:"block",marginBottom:8}}>{t("Public message for other players","Публично съобщение за останалите играчи")}
      <textarea aria-label={localLabel("Alliance profile message")} maxLength={600} rows={4} value={description} onChange={e=>setDescription(e.target.value)} style={{display:"block",width:"100%",boxSizing:"border-box",marginTop:6,padding:9}} placeholder={localLabel("Describe your alliance and invite players to join")}/>
     </label>
     <button type="button" disabled={busy||description===(state.alliance.description||"")} onClick={()=>action("description",{description})}>{t("Save profile message","Запази представянето")}</button>
     <small style={{marginLeft:8}}>{description.length}/600</small>
    </>}
   </section>
   <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:12}}>
    {Object.entries({members:"Members",applications:"Applications",research:"Alliance Research",market:"Donation & Market",mine:"Alliance Mine",messages:"Messages"}).map(([key,label])=>
      <button key={key} onClick={()=>setTab(key)} style={{background:tab===key?"#257f8e":"#20384d",color:"white",padding:9,borderRadius:6}}>{key==="messages"?t("Messages","Съобщения"):localLabel(label)}</button>)}
   </div>
   {tab==="messages"&&<AllianceMessages key={state.alliance.id} api={api}
     canBroadcast={["Leader","Co-Leader"].includes(state.alliance.role)}
     markDisplayed={markMessagesDisplayed} playerAction={playerAction}/>}
   {tab==="members"&&<div>
    {!!state.reinforcements?.length && <button onClick={()=>setTab("reinforcements")}>{t("Active Support (","Активни подкрепления (")}{state.reinforcements.length})</button>}
    <h3>{t("Alliance Members (","Членове на алианса (")}{(state.members||[]).length})</h3>
    <div style={{overflowX:"auto"}}><table style={{width:"100%",borderCollapse:"collapse",textAlign:"left"}}>
     <thead><tr><th>{t("Player","Играч")}</th><th>{t("Role","Роля")}</th><th>{t("Actions","Действия")}</th></tr></thead>
     <tbody>{(state.members||[]).map(m=><tr key={m.id} style={{borderTop:"1px solid #416177"}}>
      <td style={{padding:8}}><PlayerAvatar player={m} size={30} /> {playerName({...m,ally:true})}{String(m.id)===String(getUserId())?localLabel(" (You)"):""}</td>
      <td>{localLabel(m.role)}</td>
      <td style={{padding:8}}>
       {state.alliance.role==="Leader"&&m.role!=="Leader"&&<><select aria-label={"Role for "+m.username} value={m.role} onChange={e=>action("role",{targetId:m.id,role:e.target.value})} disabled={busy}>
        {["Member","Co-Leader","Treasurer","Diplomat","General","Strategist"].map(role=><option key={role} value={role}>{localLabel(role)}</option>)}
       </select> <button disabled={busy} onClick={()=>{if(window.confirm("Transfer leadership to "+m.username+"?"))action("transfer",{targetId:m.id});}}>{t("Transfer Leader","Предай лидерството")}</button> </>}
       {String(m.id)===String(getUserId())&&<button disabled={busy} onClick={()=>{const isLastLeader=m.role==="Leader"&&(state.members||[]).length===1;const prompt=m.role==="Leader"?(isLastLeader?"Leave and disband this alliance? It will be removed from the rankings.":"Leave this alliance? Leadership will pass automatically to another member."):"Leave this alliance?";if(window.confirm(prompt))action("leave",{targetId:m.id});}}>{t("Leave","Напусни")}</button>}
       {String(m.id)!==String(getUserId())&&m.role!=="Leader"&&["Leader","Co-Leader"].includes(state.alliance.role)&&<button disabled={busy} onClick={()=>{if(window.confirm("Remove "+m.username+"?"))action("leave",{targetId:m.id});}}>{t("Remove","Премахни")}</button>}
      </td>
     </tr>)}</tbody>
    </table></div>
    {state.alliance.role==="Leader"&&<p style={{fontSize:12}}>{(state.members||[]).length>1?t("If you leave, leadership passes automatically to another member.","Ако напуснеш, лидерството ще премине автоматично към друг член."):t("If you are the last member, leaving disbands the alliance.","Ако си последният член, напускането разпуска алианса.")}</p>}
   </div>}
   {tab==="applications"&&<div>
    <h3>{t("Alliance Applications","Кандидатури за алианса")} ({(state.applications||[]).length})</h3>
    {!["Leader","Co-Leader","Diplomat"].includes(state.alliance.role)
      ? <p>{t("Only alliance officers can review applications.","Само ръководството може да преглежда кандидатури.")}</p>
      : !(state.applications||[]).length
        ? <p>{t("There are no pending applications.","Няма чакащи кандидатури.")}</p>
        : <div style={{display:"grid",gap:10}}>
          {(state.applications||[]).map(app=><div key={app.id} style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:12,flexWrap:"wrap",padding:12,border:"1px solid #416177",borderRadius:8,background:"#142637"}}>
            <div><strong>{playerName({...app,ally:false})}</strong><div style={{fontSize:12,opacity:.8}}>{app.applied_at?new Date(app.applied_at).toLocaleString():""}</div></div>
            <div style={{display:"flex",gap:8}}>
              <button disabled={busy} onClick={()=>action("application",{targetId:app.id,accept:true})}>{t("Accept","Приеми")}</button>
              <button disabled={busy} onClick={()=>action("application",{targetId:app.id,accept:false})}>{t("Decline","Откажи")}</button>
            </div>
          </div>)}
        </div>}
   </div>}
   {tab==="research"&&<AllianceResearch economy={state.economy} role={state.alliance.role} busy={busy}
     start={kind=>action("bonus/upgrade",{kind})}/>}
   {tab==="mine"&&state.allianceMine&&<section>
    <h4>{localLabel("Alliance Mine")}</h4>
    {state.allianceMine.active ? <>
      <p>{localLabel(state.allianceMine.active.resource)} · {state.allianceMine.active.x}:{state.allianceMine.active.y}</p>
      {state.allianceMine.active.status==="construction"
        ? <AllianceMineProgress mine={state.allianceMine.active} goal={state.allianceMine.constructionGoal} march={state.allianceMine.march}/>
        : <p>{t("Shared resources remaining","Оставащи общи ресурси")} {state.allianceMine.active.amount.toLocaleString()} · {t("2,000 per hour per player","2 000 на час за играч")}</p>}
    </> : <p>{state.allianceMine.canPlace
      ? t("Select an empty map tile to place an alliance mine.","Избери свободно поле на картата, за да поставиш алиансна мина.")
      : t("Your alliance has no active mine.","Алиансът ти няма активна мина.")}</p>}
    {(state.allianceMine.active||state.allianceMine.canPlace)&&<button type="button" onClick={()=>{
      const active=state.allianceMine.active;
      if(active)sessionStorage.setItem("mapReportTarget",JSON.stringify({x:active.x,y:active.y}));
      navigate("/map");
    }}>{t("Open map","Отвори картата")}</button>}
    <h4>{t("Total construction contributions","Общ принос към строежите")}</h4>
    {state.allianceMine.contributions.length ? <ul>{state.allianceMine.contributions.map(member=><li key={member.id}>
      {member.username} · {member.points.toLocaleString(undefined,{maximumFractionDigits:2})} {t("points","точки")}
    </li>)}</ul> : <p>{t("No contributions yet.","Все още няма принос.")}</p>}
   </section>}
   {tab==="market"&&<div>
    <h3>{t("Alliance Donation & Market","Дарения и пазар")}</h3>
    <h4>{t("Alliance Space Base Crystals","Кристали за космическата база")}</h4>
    <p>💚 {t("Alliance bank","В хазната на алианса")}: {Number(state.crystalBank?.green||0).toLocaleString()} · 🔴 {Number(state.crystalBank?.red||0).toLocaleString()}</p>
    <p>💚 {t("Your balance","Твоят баланс")}: {Number(state.crystals?.green||0).toLocaleString()} · 🔴 {Number(state.crystals?.red||0).toLocaleString()}</p>
    <div style={{display:"flex",gap:8,flexWrap:"wrap",alignItems:"center"}}>
      <select value={crystalKind} onChange={e=>setCrystalKind(e.target.value)}><option value="green">💚 {t("Green crystals","Зелени кристали")}</option><option value="red">🔴 {t("Red crystals","Червени кристали")}</option></select>
      <input aria-label={localLabel("Crystal donation amount")} type="number" min="1" step="1" value={crystalAmount} onChange={e=>setCrystalAmount(e.target.value)} placeholder={localLabel("Amount")}/>
      <button type="button" disabled={busy||!Number.isSafeInteger(Number(crystalAmount))||Number(crystalAmount)<1} onClick={donateCrystals}>{t("Donate to Alliance","Дари на алианса")}</button>
    </div>
    <p>{t("Alliance Points:","Алианс точки:")} <strong>{Number(state.economy?.points||0).toLocaleString(undefined,{maximumFractionDigits:2})}</strong> {t("· Donations left today (resets at 00:00 UTC):","· Оставащи дарения днес (нулиране в 00:00 UTC):")} {state.economy?.donationsRemaining??20}/20</p>
    <h4>{t("Donate 100 resources (+10 Alliance Points)","Дари 100 ресурса (+10 Алианс точки)")}</h4>
    {["Gold","Iron","Water","Solar"].map(resource=><button key={resource} disabled={busy||!state.economy?.donationsRemaining} style={{margin:4}} onClick={()=>action("donate",{resource})}>{t("Donate 100","Дари 100")} {localLabel(resource)}</button>)}
    <h4>{t("Alliance Treasury","Хазна на алианса")}</h4>
    <p>{Object.entries(state.economy?.treasury||{}).map(([k,n])=>k+": "+n).join(" · ")}</p>
    <h4>{t("Resource Smelting & Exchange","Претопяване и обмен на ресурси")}</h4>
    <p>{t("80% becomes your selected resource; 20% is donated to the alliance treasury in the original resource.","80% се превръщат в избрания ресурс; 20% от изходния ресурс се даряват в хазната на алианса.")}</p>
    <div style={{display:"flex",gap:8,flexWrap:"wrap",alignItems:"center"}}>
      <select aria-label={t("Resource to smelt","Ресурс за претопяване")} value={exchangeFrom} onChange={e=>setExchangeFrom(e.target.value)}>{["Gold","Iron","Water","Solar"].map(k=><option key={k} value={k}>{localLabel(k)}</option>)}</select>
      <span>→</span>
      <select aria-label={t("Desired resource","Желан ресурс")} value={exchangeTo} onChange={e=>setExchangeTo(e.target.value)}>{["Gold","Iron","Water","Solar"].map(k=><option key={k} value={k}>{localLabel(k)}</option>)}</select>
      <input aria-label={t("Amount to exchange","Количество за обмен")} type="number" min="5" step="5" value={exchangeAmount} onChange={e=>setExchangeAmount(e.target.value)} style={{width:110}}/>
      <button type="button" disabled={busy||exchangeFrom===exchangeTo||!Number.isSafeInteger(Number(exchangeAmount))||Number(exchangeAmount)<5||Number(exchangeAmount)%5!==0} onClick={()=>action("market/exchange",{from:exchangeFrom,to:exchangeTo,amount:Number(exchangeAmount)})}>{t("Smelt & Exchange","Претопи и обмени")}</button>
    </div>
    {Number.isSafeInteger(Number(exchangeAmount))&&Number(exchangeAmount)>0&&Number(exchangeAmount)%5===0&&<p>{t("You receive","Получаваш")}: {Number(exchangeAmount)*0.8} {localLabel(exchangeTo)} · {t("Alliance donation","Дарение за алианса")}: {Number(exchangeAmount)*0.2} {localLabel(exchangeFrom)}</p>}
    <h4>{t("Alliance Market","Пазар на алианса")}</h4>
    {Object.entries(marketProducts).map(([item,{label,bg,cost}])=><div key={item} style={{marginBottom:8}}>
      <img src={baseIcon} alt="" width="28" height="28" style={{verticalAlign:"middle",marginRight:8}} />
      {t(label,bg)} — {cost.toLocaleString()} {t("AP","АТ")} <button disabled={busy||(state.economy?.points||0)<cost} onClick={()=>action("market/buy",{item})}>{localLabel("Buy")}</button>
    </div>)}
    <p style={{fontSize:12}}>{t("Purchased items must be activated from Inventory. For production and external gathering, only the strongest active bonus applies.","Купените предмети се активират от инвентара. За производството и добива от външни мини действа само най-силният активен бонус.")}</p>
    {(state.economy?.buffs||[]).filter(buff=>Object.hasOwn(marketProducts,buff.kind)).map(buff=><p key={buff.kind}>
      {t(marketProducts[buff.kind].label,marketProducts[buff.kind].bg)} {t("active until","активен до")} {new Date(buff.expires_at).toLocaleString()}
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
      {["Explorer Trooper","Exo-Soldier","Plasma Bladesman","Nano Shieldman","Railgunner","Pulse Sniper","Drone Operator","Rover Scout","Hoverbike Rider","Mech Walker","Hover Drone Rider","Demolition Bot","Missile Carrier","Particle Blaster","Orbital Strike Beacon","AI General","Gene Warrior"].map(u=><option key={u} value={u}>{localLabel(u)}</option>)}
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

  </div>}
 </div>;
}
