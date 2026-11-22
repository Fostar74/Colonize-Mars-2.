import { createPortal } from "react-dom";
import { useLanguage } from "../language";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import StructurePanel from "./StructurePanel";
import BattleSimulator from "./BattleSimulator";
import CyberKnightPanel from "./CyberKnightPanel";
import Quests from "./Quests";
import AlliancePanel from "./AlliancePanel";
import Rankings from "./Rankings";
import MessagePanel from "./MessagePanel";
import PlayerTalents from "./PlayerTalents";
import Inventory from "./Inventory";
import ReportsPanel from "./ReportsPanel";
import InformationPanel from "./InformationPanel";

import "./Game.css";
import marsBackground from "../images/mars-background.jpg";
import labyrinthKnightArt from "../images/cyber-knight-expanded.jpg";
import labyrinthMonsterArt from "../images/labyrinth-monster.svg";
import labyrinthCavernArt from "../images/labyrinth-cavern.svg";
import AVATARS from "../shared/avatarCatalog";
// Restore the original Mars aircraft artwork on both desktop and mobile.
const desktopColonyBackground = marsBackground;
const mobileColonyBackground = marsBackground;

const reportReadStorageKey = userId => `colonize-mars-read-battle-reports:${userId}`;
const resolvedBattleReportIds = data => [
  ...(data?.missions || []).filter(mission => mission.result).map(mission => `alien:${mission.id}`),
  ...(data?.playerMissions || []).filter(mission => mission.result).map(mission => `player:${mission.id}`),
  ...(data?.scoutMissions || []).filter(mission => mission.returned_at || mission.returnedAt).map(mission => `spy:${mission.id}`),
  ...(data?.mothershipReports || []).map(report => `mothership:${report.id}`),
  ...(data?.gatheringReports || []).map(report => `gathering:${report.id}`)
];
const unreadBattleReportCount = (data,userId) => {
  let seen=[];
  try{seen=JSON.parse(localStorage.getItem(reportReadStorageKey(userId))||`[]`);}catch{}
  const read=new Set(Array.isArray(seen)?seen:[]);
  return resolvedBattleReportIds(data).filter(id=>!read.has(id)).length;
};
const rememberBattleReports = (data,userId) => {
  let seen=[];
  try{seen=JSON.parse(localStorage.getItem(reportReadStorageKey(userId))||`[]`);}catch{}
  const all=new Set([...(Array.isArray(seen)?seen:[]),...resolvedBattleReportIds(data)]);
  localStorage.setItem(reportReadStorageKey(userId),JSON.stringify([...all].slice(-500)));
};
const hospitalReadStorageKey = userId => `colonize-mars-read-hospital-alerts:${userId}`;
const readHospitalAlertIds = userId => {
  try {
    const ids=JSON.parse(localStorage.getItem(hospitalReadStorageKey(userId))||`[]`);
    return new Set(Array.isArray(ids)?ids.map(String):[]);
  } catch {
    return new Set();
  }
};
const saveHospitalAlertIds = (userId,ids) => {
  if(!userId)return;
  try { localStorage.setItem(hospitalReadStorageKey(userId),JSON.stringify([...new Set(ids.map(String))])); } catch {}
};

function MarketPanel() {
  const {t,label}=useLanguage();
  const resources=["Gold","Iron","Water","Solar"];
  const empty=()=>({Gold:0,Iron:0,Water:0,Solar:0});
  const [offers,setOffers]=useState([]);
  const [offered,setOffered]=useState(empty);
  const [requested,setRequested]=useState(empty);
  const [busy,setBusy]=useState(false);
  const [notice,setNotice]=useState("");
  const [userId]=useState(()=>sessionStorage.getItem("userId"));
  const api=(process.env.REACT_APP_API_URL||window.location.origin).replace(/\/$/,"");
  const headers={"Content-Type":"application/json",Authorization:"Bearer "+sessionStorage.getItem("authToken")};
  const refresh=async()=>{
    const response=await fetch(api+"/market/"+encodeURIComponent(userId),{headers,cache:"no-store"});
    const data=await response.json();
    if(!response.ok)throw Error(data.message||"Marketplace unavailable.");
    setOffers(data.offers||[]);
  };
  useEffect(()=>{refresh().catch(error=>setNotice(error.message));},[]);
  const send=async(path,body={})=>{
    setBusy(true);setNotice("");
    try{
      const response=await fetch(api+path,{method:"POST",headers,body:JSON.stringify({userId,...body})});
      const data=await response.json();if(!response.ok)throw Error(data.message||"Trade action failed.");
      await refresh();
      setNotice(path==="/market/offers"
        ? t("Offer published successfully.","Офертата е публикувана успешно.")
        : path.endsWith("/accept")
          ? t("Trade completed. Both players have been notified in Messages.","Сделката приключи. И двамата играчи получиха съобщение.")
          : t("Offer cancelled and resources returned.","Офертата е отменена и ресурсите са върнати."));
      setOffered(empty());setRequested(empty());window.dispatchEvent(new Event("game-progress-updated"));
    }catch(error){setNotice(error.message);}finally{setBusy(false);}
  };
  const total=obj=>Object.values(obj).reduce((sum,value)=>sum+Number(value||0),0);
  const format=obj=>resources.filter(key=>Number(obj?.[key]||0)>0).map(key=>Number(obj[key]).toLocaleString()+" "+label(key)).join(" · ")||"—";
  const inputGrid=(values,setValues,title)=><section style={{padding:10,border:"1px solid #6a8193",borderRadius:8,margin:"10px 0"}}>
    <strong>{title}</strong><div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(130px,1fr))",gap:8,marginTop:8}}>
      {resources.map(key=><label key={key} style={{display:"flex",flexDirection:"column",gap:4,fontSize:13}}>{label(key)}
        <input type="number" min="0" max="15000" value={values[key]} onChange={e=>setValues(old=>({...old,[key]:Math.max(0,Math.min(15000,Math.floor(Number(e.target.value)||0)))}))}/>
      </label>)}
    </div><small>{t("Total","Общо")}: {total(values).toLocaleString()} / 15,000</small>
  </section>;
  return <div style={{color:"#f5f0e6"}}>
    <p>{t("Create a barter offer. Offered resources are reserved until it is accepted or you cancel it. Each side is limited to 15,000 resources; both players need a level 3 Cargo Depot.","Създай бартерна оферта. Предложените ресурси се запазват, докато бъде приета или отменена. Всяка страна на сделката е ограничена до 15 000 ресурса; и двамата играчи трябва да имат Товарно депо ниво 3.")}</p>
    {inputGrid(offered,setOffered,t("You offer","Ти предлагаш"))}
    {inputGrid(requested,setRequested,t("You request in exchange","Искаш в замяна"))}
    <button type="button" disabled={busy||total(offered)<=0||total(requested)<=0||total(offered)>15000||total(requested)>15000}
      onClick={()=>send("/market/offers",{offered,requested})}>{t("Publish offer","Публикувай оферта")}</button>
    {notice&&<p role="status">{notice}</p>}
    <h3>{t("Marketplace offers","Оферти на пазара")}</h3>
    {!offers.length&&<p>{t("No offers yet.","Все още няма оферти.")}</p>}
    <div style={{display:"grid",gap:10}}>
      {offers.map(offer=><article key={offer.id} style={{padding:12,background:"#20384d",border:"1px solid #668196",borderRadius:8}}>
        <strong>#{offer.id} · {t("Seller:","Продавач:")} {offer.seller_name}</strong>
        <div style={{marginTop:6}}><b>{t("Offers:","Предлага:")}</b> {format(offer.offeredResources)}</div>
        <div><b>{t("Wants:","Иска:")}</b> {format(offer.requestedResources)}</div>
        <div style={{display:"flex",gap:8,marginTop:8}}>
          {offer.status==="open"&&String(offer.seller_id)!==String(userId)&&<button disabled={busy} onClick={()=>send("/market/offers/"+offer.id+"/accept")}>{t("Accept offer","Приеми офертата")}</button>}
          {offer.status==="open"&&String(offer.seller_id)===String(userId)&&<button disabled={busy} onClick={()=>send("/market/offers/"+offer.id+"/cancel")}>{t("Cancel and return resources","Отмени и върни ресурсите")}</button>}
          {offer.status!=="open"&&<span>{offer.status==="accepted"?t("Accepted","Приета"):t("Cancelled","Отменена")}</span>}
        </div>
      </article>)}
    </div>
  </div>;
}

function HospitalPanel() {
  const {t,label}=useLanguage();
  const [entries,setEntries]=useState([]);
  const [notice,setNotice]=useState("");
  const [busy,setBusy]=useState(false);
  const [tick,setTick]=useState(Date.now());
  const userId=sessionStorage.getItem("userId");
  const api=(process.env.REACT_APP_API_URL||window.location.origin).replace(/\/$/,"");
  const headers={"Content-Type":"application/json",Authorization:"Bearer "+sessionStorage.getItem("authToken")};
  const refresh=async()=>{
    const response=await fetch(api+"/hospital/"+encodeURIComponent(userId),{headers,cache:"no-store"});
    const data=await response.json();if(!response.ok)throw Error(data.message||"Hospital unavailable.");
    setEntries(data.entries||[]);
  };
  useEffect(()=>{refresh().catch(error=>setNotice(error.message));const timer=setInterval(()=>{setTick(Date.now());refresh().catch(()=>{});},5000);return()=>clearInterval(timer);},[]);
  const treat=async()=>{
    setBusy(true);setNotice("");
    try{
      const response=await fetch(api+"/hospital/treat",{method:"POST",headers,body:JSON.stringify({userId})});
      const data=await response.json();if(!response.ok)throw Error(data.message||"Could not start treatment.");
      await refresh();
      setNotice(data.queued?t("Treatment queued after the current batch.","Лечението е добавено след текущата опашка."):t("Treatment started. The recovery time is shown above.","Лечението започна. Времето за възстановяване е показано по-горе."));
      window.dispatchEvent(new Event("game-progress-updated"));
    }catch(error){setNotice(error.message);}finally{setBusy(false);}
  };
  const waiting=entries.filter(entry=>entry.status==="waiting"&&["player-defense","player-attack","alien-base"].includes(entry.source));
  const active=entries.find(entry=>entry.status==="healing");
  const total=entries.reduce((sum,entry)=>sum+Object.values(entry.wounded||{}).reduce((subtotal,count)=>subtotal+Number(count||0),0),0);
  const fmt=army=>Object.entries(army||{}).filter(([,count])=>Number(count)>0).map(([unit,count])=>Number(count).toLocaleString()+" "+label(unit)).join(" · ")||"0";
  const sourceName=source=>source==="player-defense"?t("Base Defense","Защита на базата"):source==="player-attack"?t("Player Attack","Атака срещу играч"):source==="alien-base"?t("Alien Base Mission","Мисия срещу извънземна база"):source==="mothership"?t("Attack the Alien Command Ship","Атакувай Командния кораб на извънземните"):t("Alien Invasion","Alien Invasion");
  const frame={color:"#38251c",padding:14,borderRadius:12,border:"3px solid #ab7149",background:"linear-gradient(145deg,#f3e4c8 0%,#e7c79d 48%,#d99463 100%)",boxShadow:"inset 0 0 0 2px rgba(255,255,255,.4)"};
  const card={margin:"10px 0",padding:12,background:"rgba(255,248,230,.84)",border:"1px solid #bb8b61",borderRadius:8};
  return <div style={frame}>
    <header style={{padding:"12px 14px",marginBottom:12,borderRadius:8,color:"#fff4df",background:"linear-gradient(90deg,#65331f,#a4492e,#65331f)",textAlign:"center"}}>
      <div style={{fontSize:12,letterSpacing:2}}>{t("MARS BASE · MEDICAL DECK","МАРСИАНСКА БАЗА · МЕДИЦИНСКИ ОТСЕК")}</div>
      <h2 style={{margin:"5px 0"}}>✚ {t("Field Hospital","Полева болница")}</h2>
      <div>{t("Hospital capacity: Unlimited","Капацитет на болницата: Неограничен")} · {t("Wounded units:","Ранени войници:")} <strong>{total.toLocaleString()}</strong></div>
    </header>
    {notice&&<p role="status" style={{padding:10,borderRadius:6,background:"rgba(255,255,255,.65)"}}>{notice}</p>}
    {active&&<section style={{...card,border:"2px solid #b05d35"}}>
      <strong>{t("Treatment in progress","Лечението продължава")}</strong>
      <div>{t("Time remaining:","Оставащо време:")} {Math.max(0,Math.ceil((Number(active.heals_at)-tick)/1000))} {t("seconds","секунди")}</div>
      <div>{fmt(active.wounded)}</div>
    </section>}
    {entries.map(entry=><article key={entry.id} style={card}>
      <div style={{display:"flex",justifyContent:"space-between",gap:8,flexWrap:"wrap"}}>
        <strong>{sourceName(entry.source)}</strong>
        <span>{entry.status==="event"?t("Auto-recovery after event","Автоматично възстановяване след събитието"):entry.status==="healing"?t("In treatment","В лечение"):t("Waiting for treatment","Чакат лечение")}</span>
      </div>
      <div style={{marginTop:8}}><strong>{t("Wounded units:","Ранени войници:")}</strong> {fmt(entry.wounded)}</div>
      {entry.status==="waiting"&&["player-defense","player-attack","alien-base"].includes(entry.source)&&<div style={{marginTop:6}}>
        <div>{t("Treatment cost: Free","Цена на лечението: Безплатно")}</div>
        <div>{t("Treatment time follows the unit training time.","Времето за лечение съответства на времето за обучение на войниците.")}</div>
      </div>}
      {entry.status==="healing"&&<div>{t("Time remaining:","Оставащо време:")} {Math.max(0,Math.ceil((Number(entry.heals_at)-tick)/1000))} {t("seconds","секунди")}</div>}
      {entry.status==="event"&&entry.recoveryAt&&<div>{t("Returns to the garrison after:","Войниците се връщат в гарнизона след:")} {new Date(entry.recoveryAt).toLocaleString()}</div>}
    </article>)}
    {!entries.length&&<div style={card}>{t("No wounded troops. Your garrison is ready.","Няма ранени войници. Гарнизонът е в готовност.")}</div>}
    {!!waiting.length&&<button type="button" disabled={busy} onClick={treat} style={{padding:"11px 18px",border:0,borderRadius:7,color:"white",fontWeight:"bold",background:"#26853a",cursor:busy?"wait":"pointer",opacity:busy?.7:1}}>
      {busy?t("Adding to treatment queue…","Добавяне в опашката за лечение…"):active?t("Queue wounded troops","Добави ранените в опашката"):t("Treat wounded troops","Лекувай ранените войници")}
    </button>}
    <p style={{fontSize:12,marginBottom:0}}>{t("Only 30% of troops lost in alien base and player battles are sent here. Treatment is free and takes the same time as training those units. Event casualties return automatically after the event.","В болницата отиват 30% от загубените войници при битки с извънземни бази и играчи. Лечението е безплатно и отнема същото време като обучението на тези единици. Загубите от събития се възстановяват автоматично след края им.")}</p>
  </div>;
}


function LabyrinthMap({labyrinth,busy,onMove,onBacktrack,t}){
  const rooms=labyrinth.mapRooms||[],byId=Object.fromEntries(rooms.map(room=>[room.id,room]));
  const corridors=labyrinth.corridors||{},step=62,offset=43;
  const position=room=>({x:offset+room.x*step,y:offset+room.y*step});
  const accessible=new Set((labyrinth.movesToday||0)>=(labyrinth.movesPerDay||10)?[]:(labyrinth.exits||[]).map(exit=>exit.id));
  const width=11*step+offset*2,height=11*step+offset*2;
  return <div style={{margin:"14px 0",padding:12,border:"1px solid #8064a3",borderRadius:14,background:"linear-gradient(145deg,#101629,#1b1325)"}}>
    <strong>🗺️ {t("Underground Labyrinth — your map","Подземен лабиринт — твоята карта")}</strong>
    <p style={{fontSize:12,color:"#c9c0df",margin:"8px 0"}}>{t("Only your discovered chambers and connecting corridors are visible. Dark stone marks unexplored areas. North ↑ · East → · South ↓ · West ←.","Виждаш само своите открити зали и свързващите ги коридори. Тъмният камък скрива неизследваните части. Север ↑ · Изток → · Юг ↓ · Запад ←.")}</p>
    <div style={{overflow:"auto",maxHeight:540,border:"2px solid #4c405b",borderRadius:9,background:"#090d17"}}>
      <svg viewBox={`0 0 ${width} ${height}`} style={{width:Math.max(320,width),height,display:"block"}} role="img" aria-label={t("Underground labyrinth","Подземен лабиринт")}>
        <defs><pattern id="maze-stone" width="25" height="25" patternUnits="userSpaceOnUse"><rect width="25" height="25" fill="#111723"/><path d="M0 12H25M12 0V12M5 12V25" stroke="#1c2431" strokeWidth="1"/></pattern><radialGradient id="maze-floor"><stop stopColor="#334254"/><stop offset="1" stopColor="#202736"/></radialGradient></defs>
        <rect width={width} height={height} fill="url(#maze-stone)"/>
        {rooms.map(room=>{const p=position(room);return <rect key={"floor-"+room.id} x={p.x-22} y={p.y-22} width="44" height="44" rx="5" fill={room.visited?"url(#maze-floor)":"#171525"} stroke={room.visited?"#58657b":"#3a304e"} strokeWidth="3"/>;})}
        {Object.entries(corridors).flatMap(([id,exits])=>{const a=byId[id];if(!a)return [];return exits.filter(otherId=>byId[otherId]&&id<otherId).map(otherId=>{const b=byId[otherId],p=position(a),q=position(b),both=a.visited&&b.visited;return <g key={id+"-"+otherId}><line x1={p.x} y1={p.y} x2={q.x} y2={q.y} stroke="#090d17" strokeWidth="26"/><line x1={p.x} y1={p.y} x2={q.x} y2={q.y} stroke={both?"#53677a":"#352b50"} strokeWidth="17" strokeDasharray={both?"none":"4 6"}/></g>;});})}
        {rooms.map(room=>{const p=position(room),canMove=(room.visited&&!room.current)||accessible.has(room.id);return <g key={room.id} onClick={()=>{if(busy||!canMove)return;room.visited?onBacktrack(room.id):onMove(room.id);}} style={{cursor:canMove&&!busy?"pointer":"default"}} role={canMove?"button":undefined} aria-label={room.id}>
          <rect x={p.x-19} y={p.y-19} width="38" height="38" rx="5" fill={room.current?"#8b692b":room.goal?"#913f76":room.visited?"#304a65":"#242037"} stroke={room.current?"#ffe3a1":room.goal?"#ff9ee2":canMove?"#bba3e9":"#556078"} strokeWidth={room.current?4:2}/>
          <text x={p.x} y={p.y+5} textAnchor="middle" fill="#fff" fontSize="12" fontWeight="bold">{room.current?"♞":room.goal?"✚":room.visited?room.x+","+room.y:"?"}</text>
        </g>;})}
        <text x="16" y="23" fill="#d6c3ff" fontSize="15" fontWeight="bold">↑ N</text>
      </svg>
    </div>
    <p style={{fontSize:12,color:"#d6c9e8",marginTop:8}}>🟨 {t("Cyber Knight","Киберрицар")} · 🟦 {t("Visited","Посетена")} · 🟪 {t("Unknown passage","Неизследван проход")} · 🩷 {t("Medicine, once discovered","Лекарство, след откриване")}</p>
    <p style={{fontSize:12,color:"#d6c9e8"}}>{t("Current coordinates","Текущи координати")}: <b>{byId[labyrinth.currentRoom]?.x??5}, {byId[labyrinth.currentRoom]?.y??5}</b> · {t("Depth","Дълбочина")} {labyrinth.currentDepth}/10</p>
  </div>;
}

function EventsPanel() {
  const {language,t}=useLanguage();
  const navigate=useNavigate();
  const [data,setData]=useState(null);
  const [motherShip,setMotherShip]=useState(null);
  const [labyrinth,setLabyrinth]=useState(null);
  const [labyrinthBattle,setLabyrinthBattle]=useState(null);
  const [labyrinthImpact,setLabyrinthImpact]=useState(0);
  const [labyrinthOpen,setLabyrinthOpen]=useState(false);
  const [labyrinthInside,setLabyrinthInside]=useState(false);
  const [labyrinthBusy,setLabyrinthBusy]=useState(false);
  const [labyrinthNotice,setLabyrinthNotice]=useState("");
  const [labyrinthTick,setLabyrinthTick]=useState(Date.now());
  const [busy,setBusy]=useState(false);
  const [notice,setNotice]=useState("");
  const userId=sessionStorage.getItem("userId");
  const api=(process.env.REACT_APP_API_URL||window.location.origin).replace(/\/$/,"");
  const headers={Authorization:"Bearer "+sessionStorage.getItem("authToken"),"Content-Type":"application/json"};
  const refresh=async()=>{
    const response=await fetch(api+"/events/"+encodeURIComponent(userId),{headers,cache:"no-store"});
    const result=await response.json();
    if(!response.ok)throw Error(result.message||"Events unavailable.");
    setData(result.saturdayInvasion);
    setMotherShip(result.motherShip||null);
    setLabyrinth(result.labyrinth||null);
    const battleResponse=await fetch(api+"/events/labyrinth/battle",{method:"POST",headers,body:JSON.stringify({userId:Number(userId),action:"status"})});
    if(battleResponse.ok){const battleResult=await battleResponse.json();setLabyrinthBattle(battleResult.battle||null);}
  };
  useEffect(()=>{refresh().catch(error=>setNotice(error.message));const timer=setInterval(()=>refresh().catch(()=>{}),10000);const tick=setInterval(()=>setLabyrinthTick(Date.now()),1000);return()=>{clearInterval(timer);clearInterval(tick);};},[]);
  const start=async()=>{
    const restarting=Boolean(data?.alliance?.run);
    setBusy(true);setNotice("");
    try{
      const endpoint=restarting?"/events/saturday-invasion/restart":"/events/saturday-invasion/start";
      const response=await fetch(api+endpoint,{method:"POST",headers,body:JSON.stringify({userId:Number(userId)})});
      const result=await response.json();
      if(!response.ok)throw Error(result.message||"Could not start the event.");
      setNotice(restarting?t("Event restarted from wave 1. Troops wounded in the previous run have been returned.","Събитието е рестартирано от вълна 1. Войниците, ранени в предишното участие, са върнати."):t("Event started for your alliance.","Събитието е стартирано за алианса."));
      await refresh();
    }catch(error){setNotice(error.message);}
    finally{setBusy(false);}
  };
  const date=value=>value?new Date(value).toLocaleString(language==="bg"?"bg-BG":"en-US",{dateStyle:"medium",timeStyle:"short",timeZone:"UTC"})+" UTC":"—";
  const crystalLabel={yellow:t("yellow","жълт"),blue:t("blue","син"),orange:t("orange","оранжев"),purple:t("purple","лилав")};
  const runLabyrinthMission=async(room)=>{
    setLabyrinthBusy(true);setLabyrinthNotice("");
    try{
      const response=await fetch(api+"/events/labyrinth/mission",{method:"POST",headers,body:JSON.stringify({userId:Number(userId),room})});
      const result=await response.json();
      if(!response.ok)throw Error(result.message||"Labyrinth battle failed.");
      setLabyrinth(result.status);
      setLabyrinthNotice((result.victory?t("VICTORY","ПОБЕДА"):t("DEFEAT","ЗАГУБА"))+" · "+result.monster.name+" · "+(result.victory?"+ "+result.gainedHp+" HP":"0 HP")+(result.crystalReward?" · "+({yellow:"💛",blue:"💙",orange:"🧡",purple:"💜"}[result.crystalReward]||"💎")+" +1 "+t("crystal","кристал"):"")+(result.greenCrystal?" · 💚 "+t("Daily green crystal","Дневен зелен кристал"):"")+(result.medicineFound?" · 🧪 NOVA!":""));
    }catch(error){setLabyrinthNotice(error.message);}
    finally{setLabyrinthBusy(false);}
  };
  const replayClearedLabyrinthRoom=async(room)=>{
    setLabyrinthBusy(true);setLabyrinthNotice("");
    try{
      if(labyrinthBattle){
        const leave=await fetch(api+"/events/labyrinth/battle",{method:"POST",headers,body:JSON.stringify({userId:Number(userId),action:"retreat"})});
        const left=await leave.json();
        if(!leave.ok||left.error)throw Error(left.message||left.error||"Could not leave current battle.");
        setLabyrinthBattle(null);
        if(left.status)setLabyrinth(left.status);
      }
      const response=await fetch(api+"/events/labyrinth/mission",{method:"POST",headers,body:JSON.stringify({userId:Number(userId),room})});
      const result=await response.json();
      if(!response.ok||result.error)throw Error(result.message||result.error||"Automatic battle failed.");
      if(result.status)setLabyrinth(result.status);
      setLabyrinthBattle(result.battle||null);
      setLabyrinthNotice((result.victory?t("VICTORY","ПОБЕДА"):t("DEFEAT","ЗАГУБА"))+" · "+(result.monster?.name||"")+" · "+(result.victory?"+ "+result.gainedHp+" HP":"0 HP")+(result.crystalReward?" · "+({yellow:"💛",blue:"💙",orange:"🧡",purple:"💜"}[result.crystalReward]||"💎")+" +1 "+t("crystal","кристал"):""));
    }catch(error){setLabyrinthNotice(error.message);}
    finally{setLabyrinthBusy(false);}
  };
  const labyrinthCombat=async(action,room)=>{
    setLabyrinthBusy(true);setLabyrinthNotice("");
    try{
      const response=await fetch(api+"/events/labyrinth/battle",{method:"POST",headers,body:JSON.stringify({userId:Number(userId),action,room})});
      const result=await response.json();
      if(!response.ok)throw Error(result.message||"Battle action failed.");
      setLabyrinthBattle(result.battle||null);setLabyrinth(result.status);
      if(action==="strike"){
        setLabyrinthImpact(n=>n+1);
        await new Promise(resolve=>setTimeout(resolve,1700));
      }
      if(result.testReset)setLabyrinthNotice(t("Test battles reset. Earned HP and progress preserved.","Опитите за тест са възстановени. HP и напредъкът са запазени."));
      if(result.victory)setLabyrinthNotice(t("VICTORY!","ПОБЕДА!")+" +"+result.gainedHp+" HP"+(result.crystalReward?" · "+({yellow:"💛",blue:"💙",orange:"🧡",purple:"💜"}[result.crystalReward]||"💎")+" +1 "+t("crystal","кристал"):""));
      if(result.defeat)setLabyrinthNotice(t("DEFEAT","ЗАГУБА"));
      if(result.retreated)setLabyrinthNotice(t("Battle left. Your daily attempt is spent, but you can now replay cleared rooms.","Напусна битката. Дневният опит е изразходван, но вече можеш да повтаряш спечелени стаи."));
    }catch(error){setLabyrinthNotice(error.message);}
    finally{setLabyrinthBusy(false);}
  };
  const labyrinthAction=async(path,payload,successText)=>{
    setLabyrinthBusy(true);setLabyrinthNotice("");
    try{const response=await fetch(api+path,{method:"POST",headers,body:JSON.stringify({userId:Number(userId),...payload})});const result=await response.json();if(!response.ok)throw Error(result.message||"Labyrinth action failed.");setLabyrinth(result.status);setLabyrinthNotice(successText);}
    catch(error){setLabyrinthNotice(error.message);}
    finally{setLabyrinthBusy(false);}
  };
  if(!data)return <div><p>{notice||t("Loading events…","Зареждане на събитията…")}</p></div>;
  return <div style={{color:"#eef6ff",padding:12,minWidth:320}}>
    <h2>{t("Alien Invasion","Alien Invasion")}</h2>
    <p>{data.active?t("Event is active","Събитието е активно"):data.settled?t("Event results are final","Класирането е окончателно"):t("Scheduled for","Насрочено за")} {date(data.startsAt)} – {date(data.endsAt)}</p>
    <p>{t("Alliance prizes are awarded at the Sunday 00:00 UTC reset after all alliances finish: 1st place 50,000, 2nd 30,000, 3rd 15,000 of EACH resource for every participating member. Prizes are saved in Inventory and can be withdrawn later.","Наградите се раздават при ресета в неделя в 00:00 UTC, след като приключат всички алианси: 1-во място 50 000, 2-ро 30 000, 3-то 15 000 от ВСЕКИ ресурс за всеки участвал член. Наградите се пазят в Инвентара и могат да се изтеглят по-късно.")}</p>
    {data.reward&&<p role="status" style={{fontWeight:700}}>🎁 {t("Reward deposited in Inventory","Наградата е добавена в Инвентара")}: #{data.reward.rank} · {Number(data.reward.amountEach).toLocaleString()} {t("of each resource","от всеки ресурс")}. <button type="button" onClick={()=>navigate("/game?inventory=1")}>{t("Open Inventory","Отвори Инвентара")}</button></p>}
    <p>{t("The first alien wave launches immediately from an alien base and reaches each participating alliance member after one minute. A stronger wave launches every minute. Alliance reinforcements sent to an active participant arrive in 30 seconds. The event ends when all participants are eliminated or wave 20 is completed.","Първата извънземна вълна потегля веднага от извънземна база и достига всеки участващ член на алианса след една минута. По-силна вълна потегля всяка минута. Подкрепленията към участник пристигат за 30 секунди. Събитието приключва, когато всички участници бъдат елиминирани или бъде завършена вълна 20.")}</p>
    {data.alliance&&<div style={{border:"1px solid #789",borderRadius:8,padding:10,marginBottom:12}}>
      <strong>{data.alliance.name}</strong>
      {data.alliance.run&&<span> · {data.alliance.run.status==="active"?t("Participating","Участва"):t("Run complete","Участието приключи")}</span>}
      {data.alliance.canStart&&<div style={{marginTop:8}}><button type="button" disabled={busy} onClick={start}>{busy?t("Starting…","Стартиране…"):t("Start for my alliance","Стартирай за алианса")}</button></div>}
      {data.alliance.run&&["Leader","Co-Leader"].includes(data.alliance.role)&&<div style={{marginTop:8}}><button type="button" disabled={busy} onClick={start}>{busy?t("Restarting…","Рестартиране…"):t("Restart from wave 1","Рестартирай от вълна 1")}</button></div>}
      {data.myResult&&<div style={{marginTop:8,padding:10,borderRadius:8,background:"rgba(30,50,70,.7)"}}>
        <p style={{margin:"0 0 6px"}}>{t("Your rank","Твоето място")}: #{data.myResult.rank} · {t("points","точки")}: {Number(data.myResult.score||0).toLocaleString()} · {data.myResult.eliminated?t("Eliminated","Елиминиран"):t("Still defending","Продължаваш защитата")}</p>
        <p style={{margin:"0 0 6px"}}>{t("Waves survived","Издържани вълни")}: {Number(data.myResult.waves||0)} / 20</p>
        {data.myResult.lastBattle&&<p style={{margin:"0 0 6px"}}>{t("Last attack","Последна атака")} · {t("Alien base level","Ниво на извънземната база")} {data.myResult.lastBattle.level}: {Number(data.myResult.lastBattle.alienCasualties||0).toLocaleString()} {t("aliens eliminated","извънземни елиминирани")} · {Number(data.myResult.lastBattle.remaining||0).toLocaleString()} {t("troops remaining","войници остават")}</p>}
        {data.alliance.run?.status==="active"&&!data.myResult.eliminated&&<p style={{margin:0}}>{t("Next wave in","Следваща вълна след")}: {Math.max(0,Math.ceil((Number(data.myResult.nextAttackAt||labyrinthTick)-labyrinthTick)/1000))} {t("seconds","секунди")}</p>}
      </div>}
      {data.myAttacks?.length>0&&<section style={{marginTop:10,padding:10,borderRadius:8,background:"rgba(16,28,40,.76)"}}>
        <h3 style={{marginTop:0}}>{t("Alien attack log","Дневник на извънземните атаки")}</h3>
        {data.myAttacks.map(attack=>{
          const result=attack.result;
          const remaining=Math.max(0,Math.ceil((Number(attack.arrivesAt)-labyrinthTick)/1000));
          return <details key={attack.id} style={{marginBottom:8,borderBottom:"1px solid #536c80",paddingBottom:8}}>
            <summary>{result?.eliminated?t("Attack cancelled: no army","Атаката е отменена: няма армия"):result?t("Battle report","Бойни доклади"):t("Alien attack in transit","Извънземна атака на път")} #{attack.id} · {t("Alien base level","Ниво на извънземната база")} {attack.level}{!result&&` · ${remaining} ${t("seconds remaining","секунди остават")}`}</summary>
            {result&&<>
              <p>{Number(result.alienCasualties||0).toLocaleString()} {t("aliens eliminated","извънземни елиминирани")} · {Number(result.troopsLost||0).toLocaleString()} {t("troops wounded","войници ранени")} · {Number(result.remaining||0).toLocaleString()} {t("troops remaining","войници остават")}</p>
              {(result.report||[]).map(round=><details key={round.round}><summary>{t("Round","Рунд")} {round.round}</summary>
                {round.events.map((event,index)=><p key={index} style={{fontSize:12,margin:"4px 0"}}>{event.restored>0?`${t("Nano Regeneration","Нанорегенерация")}: ${event.restored} ${t(event.unit,event.unit)} ${t("restored","възстановени")}`:`${t(event.attacker,event.attacker)}: ${event.units} ${t(event.unit,event.unit)} → ${t(event.target,event.target)} · ${event.damage} ${t("damage","щети")}${Number.isInteger(event.kills)?` · ${event.kills} ${t("defeated","убити")}`:""}`}</p>)}
              </details>)}
            </>}
          </details>;
        })}
      </section>}
      {}
      {data.alliance&&!data.alliance.run&&!data.alliance.canStart&&<p>{t("Only an alliance leader or co-leader can start the event, and only during Saturday UTC.","Само лидерът или заместникът на алианса може да стартира събитието в събота по UTC.")}</p>}
    </div>}
    <section style={{margin:"18px 0",padding:16,border:"1px solid #536c80",borderRadius:12,background:"rgba(14,27,44,.75)"}} aria-label={t("Saturday invasion standings","Класиране на съботната инвазия")}>
    <h3>{t("Alliance standings","Класиране на алиансите")}</h3>
    {data.alliances.length?<div style={{overflowX:"auto"}}><table><thead><tr><th>#</th><th>{t("Alliance","Алианс")}</th><th>{t("Points","Точки")}</th><th>{t("Status","Статус")}</th></tr></thead><tbody>{data.alliances.map(row=><tr key={row.id}><td>{row.rank}</td><td>{row.name}</td><td>{Number(row.score||0).toLocaleString()}</td><td>{row.status==="active"?t("Active","Активен"):t("Complete","Приключил")}</td></tr>)}</tbody></table></div>:<p>{t("No alliances have started yet.","Все още няма стартирали алианси.")}</p>}
    <h3>{t("Individual standings","Индивидуално класиране")}</h3>
    {data.players.length?<div style={{overflowX:"auto"}}><table><thead><tr><th>#</th><th>{t("Player","Играч")}</th><th>{t("Alliance","Алианс")}</th><th>{t("Points","Точки")}</th><th>{t("Status","Статус")}</th></tr></thead><tbody>{data.players.slice(0,20).map(row=><tr key={row.userId}><td>{row.rank}</td><td>{row.username}</td><td>{row.alliance}</td><td>{Number(row.score||0).toLocaleString()}</td><td>{row.eliminated?t("Eliminated","Елиминиран"):row.runStatus==="active"?t("Active","Активен"):t("Survived","Оцеля")}</td></tr>)}</tbody></table></div>:<p>{t("No scores yet.","Все още няма точки.")}</p>}
    <p>{t("Top three alliances receive resources for each participating member:","Първите три алианса получават ресурси за всеки участвал член:")} 1) 50,000 · 2) 30,000 · 3) 15,000 {t("of each resource.","от всеки ресурс.")}</p>
    </section>
    {motherShip&&<div style={{border:"1px solid #789",borderRadius:8,padding:10,marginBottom:12}}>
      <h2>{t("Attack the Alien Command Ship","Атакувай Командния кораб на извънземните")}</h2>
      <p>{motherShip.active?t("Event is active","Събитието е активно"):motherShip.settled?t("Results are final","Класирането е окончателно"):t("Scheduled weekly event","Седмично събитие")}: {date(motherShip.startsAt)} – {date(motherShip.endsAt)}</p>
      <p>{t("The flight takes 30 seconds. After the battle, your full army and Cyber Knight return immediately, ready to attack again. Each attack has a damage total in Reports.","Полетът трае 30 секунди. След битката цялата армия и Киберрицарят се връщат веднага и са готови за нова атака. Нанесените щети от всяка атака се виждат в „Доклади“.")}</p>
      <p>{t("Attacks remaining","Оставащи атаки")}: {motherShip.attacksRemaining} · {t("Alien Command Ship health","Живот на командния кораб на извънземните")}: {Number(motherShip.hp||0).toLocaleString()}</p>
      {motherShip.rankings?.length>0&&<div style={{overflowX:"auto"}}><table><thead><tr><th>#</th><th>{t("Player","Играч")}</th><th>{t("Damage","Щети")}</th><th>{t("Attacks","Атаки")}</th></tr></thead><tbody>{motherShip.rankings.slice(0,10).map((row,index)=><tr key={row.user_id}><td>{index+1}</td><td>{row.username}</td><td>{Number(row.damage||0).toLocaleString()}</td><td>{row.attacks}</td></tr>)}</tbody></table></div>}
      <button type="button" onClick={()=>navigate("/map?campaign=1")}>{t("Open campaigns","Отвори кампаниите")}</button>
    </div>}
    <div style={{marginTop:18,padding:20,border:"1px solid #6576b3",borderRadius:14,background:"linear-gradient(120deg,#111729,#39243c)",textAlign:"center"}}>
      <h2>⚔️ {t("Underground Labyrinth","Подземен Лабиринт")}</h2>
      <p>{t("30 floors · 10 chambers per floor · Player-controlled combat","30 нива · 10 зали на ниво · Битки, управлявани от играча")}</p>
      <button type="button" onClick={()=>{setLabyrinthOpen(true);setLabyrinthInside(Boolean(labyrinthBattle));}} style={{padding:"15px 32px",fontSize:18,fontWeight:900,background:"#ae6b27",color:"white",borderRadius:10}}>🚪 {labyrinthBattle?t("Continue battle","Продължи битката"):t("ENTER THE LABYRINTH","ВЛЕЗ В ЛАБИРИНТА")}</button>
    </div>
    {labyrinthOpen&&createPortal(<div role="dialog" aria-modal="true" aria-label={t("Cyber Knight Labyrinth","Лабиринтът на Cyber Knight")} style={{position:"fixed",inset:0,zIndex:99999,background:"#02050df2",overflowY:"auto",padding:"clamp(8px,2vw,28px)"}}>
      <div style={{maxWidth:1400,margin:"auto",minHeight:"100%"}}>
          <section style={{position:"relative",border:"1px solid #896da9",borderRadius:14,padding:16,background:"linear-gradient(145deg,#11101b,#282035)",color:"#f5edff",minHeight:"100%"}}>
      <button type="button" onClick={()=>{setLabyrinthOpen(false);setLabyrinthInside(false);}} style={{position:"sticky",top:0,float:"right",zIndex:15,padding:"9px 16px",background:"#a52e41",color:"white",borderRadius:8,fontWeight:900}}>✕ {t("Leave labyrinth","Изход")}</button>
      <h2 style={{color:"#e1bbff"}}>⚔️ {t("The Labyrinth · Cyber Knight","Лабиринтът · Cyber Knight")}</h2>
      <p>{t("Thirty underground stages, ten battles per stage. Nova’s medicine awaits after chamber 30-10.","30 подземни нива с по 10 битки. Лекарството за Nova те очаква след стая 30-10.")}</p>
      {!labyrinth?<p>{t("Loading…","Зареждане…")}</p>:!labyrinth.unlocked?<p>{t("Unlocks at Cyber Knight level 7.","Отключва се на ниво 7 на Cyber Knight.")} · {labyrinth.knightLevel}/7</p>:<>
        <div style={{display:"flex",justifyContent:"space-between",flexWrap:"wrap",gap:10,marginBottom:14}}>
          <strong>🛡️ {t("Stage","Ниво")} {labyrinth.stage} / 30 · {t("Room","Стая")} {labyrinth.chamber} / 10</strong>
          <strong>⚔️ {t("Daily battles","Дневни битки")}: {labyrinth.missionsToday} / 10</strong>
          <span>💚 {t("Green crystals","Зелени кристали")}: {labyrinth.crystals?.green||0}</span>
          <span>💛 {labyrinth.crystals?.yellow||0} · 💙 {labyrinth.crystals?.blue||0} · 🧡 {labyrinth.crystals?.orange||0} · 💜 {labyrinth.crystals?.purple||0}</span>
        </div>
        <div style={{display:"flex",gap:5,marginBottom:14}}>
          {Array.from({length:10},(_,i)=><div key={i} title={String(i+1)} style={{flex:1,textAlign:"center",borderRadius:5,padding:"7px 0",fontSize:12,fontWeight:700,background:i+1<labyrinth.chamber?"#286b59":i+1===labyrinth.chamber?"#7952a8":"#262334",border:"1px solid #5e5275"}}>{i+1}</div>)}
        </div>
        {!labyrinthInside?<div style={{minHeight:"min(65vh,680px)",display:"grid",placeItems:"center",border:"2px solid #826147",borderRadius:16,background:"linear-gradient(#0008,#0009),url("+labyrinthCavernArt+") center/cover",textAlign:"center",padding:24}}>
          <div>
            <div style={{fontSize:75,textShadow:"0 0 25px #f59e45",animation:"labyrinthPortalPulse 2s ease-in-out infinite alternate"}}>🚪</div>
            <h2 style={{fontSize:"clamp(24px,4vw,42px)",color:"#ffe5b5"}}>{t("The entrance to the underground chamber","Вход към подземната зала")} {labyrinth.stage}-{labyrinth.chamber}</h2>
            <p>{t("Behind the gate awaits","Зад портата те очаква")} <strong>{labyrinth.monster?.name}</strong>. {t("Enter to face it.","Влез, за да се изправиш срещу него.")}</p>
            <button type="button" onClick={()=>setLabyrinthInside(true)} style={{background:"linear-gradient(90deg,#a94a18,#e29c39)",color:"white",padding:"17px 36px",borderRadius:10,fontWeight:900,fontSize:20}}>{t("OPEN GATE AND ENTER","ОТВОРИ ПОРТАТА И ВЛЕЗ")}</button>
          </div>
          <style>{`@keyframes labyrinthPortalPulse{from{transform:scale(.94);filter:brightness(.7)}to{transform:scale(1.06);filter:brightness(1.4)}}`}</style>
        </div>:<>
        <div style={{border:"2px solid #5477aa",borderRadius:14,padding:16,background:"linear-gradient(#08122355,#05091599),url("+labyrinthCavernArt+") center/cover",overflow:"hidden",position:"relative",minHeight:330}}>
          <div style={{textAlign:"center",fontWeight:900,color:"#ffe2a3",marginBottom:8}}>{labyrinthBattle?t("UNDERGROUND CHAMBER","ПОДЗЕМНА ЗАЛА")+" "+Math.ceil(labyrinthBattle.room/10)+"-"+(((labyrinthBattle.room-1)%10)+1)+" · "+t("ROUND","РУНД")+" "+(labyrinthBattle.round+1):t("UNDERGROUND CHAMBER","ПОДЗЕМНА ЗАЛА")+" "+labyrinth.stage+"-"+labyrinth.chamber}</div>
          {labyrinthImpact>0&&labyrinthBusy&&<div key={"blast"+labyrinthImpact} aria-hidden="true" style={{position:"absolute",left:"12%",right:"12%",top:"56%",height:15,pointerEvents:"none",zIndex:7}}>
            <span style={{position:"absolute",left:0,top:0,width:55,height:12,borderRadius:"50%",background:"linear-gradient(90deg,#05a7ff,#b5ffff,#fff)",boxShadow:"0 0 16px 7px #00c9ff,0 0 35px 14px #007fff",animation:"labyrinthBolt .8s ease-in forwards"}}/>
            <span style={{position:"absolute",right:0,top:0,width:65,height:15,borderRadius:"50%",background:"linear-gradient(90deg,#fff,#ff5d5d,#b90038)",boxShadow:"0 0 15px 6px #ff334f",animation:"labyrinthCounter .8s ease-in .8s both"}}/>
          </div>}
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,alignItems:"end"}}>
            <div style={{textAlign:"center"}}>
              <strong>Cyber Knight</strong>
              <div style={{background:"#162136",border:"1px solid #3bb3e6",borderRadius:8,overflow:"hidden",margin:"8px auto",maxWidth:320,height:20}}><div style={{width:Math.max(0,100*(labyrinthBattle?.knightHp??labyrinth.knight?.maxHp??1)/(labyrinthBattle?.knight?.maxHp||labyrinth.knight?.maxHp||1))+"%",height:"100%",background:"linear-gradient(90deg,#15934b,#53ef91)",transition:"width .5s"}}/></div>
              <div>{Number(labyrinthBattle?.knightHp??labyrinth.knight?.maxHp??0).toLocaleString()} / {Number(labyrinthBattle?.knight?.maxHp||labyrinth.knight?.maxHp||0).toLocaleString()} HP</div>
              <img src={labyrinthKnightArt} alt="Cyber Knight in plasma armor with blaster" style={{width:"min(100%,320px)",height:300,objectFit:"contain",objectPosition:"center",borderRadius:12,maskImage:"linear-gradient(to bottom,#000 70%,transparent 100%)",filter:"drop-shadow(0 0 18px #13b5fc)",animation:labyrinthImpact?"labyrinthHeroStrike .65s ease-out":"none"}} key={"knight"+labyrinthImpact}/>
            </div>
            <div style={{textAlign:"center"}}>
              <strong>{labyrinthBattle?.monster?.name||labyrinth.monster?.name}</strong>
              <div style={{background:"#261322",border:"1px solid #e45c78",borderRadius:8,overflow:"hidden",margin:"8px auto",maxWidth:320,height:20}}><div style={{width:Math.max(0,100*(labyrinthBattle?.monsterHp??labyrinth.monster?.hp??1)/(labyrinthBattle?.monsterMaxHp||labyrinth.monster?.hp||1))+"%",height:"100%",background:"linear-gradient(90deg,#b3203e,#ff6c61)",transition:"width .5s"}}/></div>
              <div>{Number(labyrinthBattle?.monsterHp??labyrinth.monster?.hp??0).toLocaleString()} / {Number(labyrinthBattle?.monsterMaxHp||labyrinth.monster?.hp||0).toLocaleString()} HP</div>
              <img src={(labyrinth.stage===2?"/labyrinth-monsters/Menacing%20Werewolf%20in%20Torchlit%20Labyrinth.png":"/labyrinth-monsters/floor-"+String(labyrinth.stage).padStart(2,"0")+".webp")} onError={event=>{const img=event.currentTarget;if(!img.dataset.labyrinthFallback){img.dataset.labyrinthFallback="1";img.src="/labyrinth-monsters/floor-01.webp";}else{img.onerror=null;img.src=labyrinthMonsterArt;}}} alt={labyrinth.monster?.name||"Alien monster"} style={{width:"min(100%,290px)",height:280,objectFit:"contain",filter:"drop-shadow(0 0 25px #fa4769)",animation:labyrinthImpact?"labyrinthMonsterHit .65s ease-out":"none"}} key={"monster"+labyrinth.stage+"-"+labyrinth.chamber+"-"+labyrinthImpact}/>
            </div>
          </div>
          <style>{`@keyframes labyrinthBolt{0%{left:0;opacity:0;transform:scale(.5)}15%{opacity:1}85%{opacity:1}100%{left:95%;opacity:0;transform:scale(1.6)}}@keyframes labyrinthCounter{0%{right:0;opacity:0;transform:scale(.5)}15%{opacity:1}85%{opacity:1}100%{right:95%;opacity:0;transform:scale(1.6)}}@keyframes labyrinthHeroStrike{0%{transform:translateX(0)}35%{transform:translateX(25px) scale(1.05)}100%{transform:translateX(0)}}@keyframes labyrinthMonsterHit{0%{transform:translateX(0);filter:brightness(1)}40%{transform:translateX(12px);filter:brightness(2.5)}70%{transform:translateX(-12px)}100%{transform:translateX(0);filter:brightness(1)}}`}</style>
          {labyrinthBattle?.log?.length>0&&<p style={{background:"#060c1dcc",padding:10,borderRadius:8,textAlign:"center"}}>{t("Last round","Последен рунд")}: ⚔️ −{labyrinthBattle.log[labyrinthBattle.log.length-2]?.damage||labyrinthBattle.log[labyrinthBattle.log.length-1]?.damage} · {t("Monster counterattack","Контраатака на чудовището")}: −{labyrinthBattle.log[labyrinthBattle.log.length-1]?.actor==="monster"?labyrinthBattle.log[labyrinthBattle.log.length-1].damage:0}</p>}
        </div>

        </>}
        {labyrinthInside&&<>
        <p style={{color:"#cfbde9"}}>{t("Every victory permanently adds 1% of the monster's original HP and one random colored crystal (yellow, blue, orange or purple). All battles start at full health.","Всяка победа добавя постоянно 1% от живота на чудовището и 1 случаен цветен кристал (жълт, син, оранжев или лилав). Всяка битка започва с пълен живот.")}</p>
        {labyrinth.medicineFound?<p style={{color:"#f8b7d8",fontWeight:800}}>🧪 {t("You found Nova's medicine!","Откри лекарството за Nova!")}</p>:<>
          {labyrinthBattle?<div style={{display:"flex",gap:12,flexWrap:"wrap",marginBottom:12}}>
            <button type="button" disabled={labyrinthBusy} onClick={()=>labyrinthCombat("strike")} style={{padding:"14px 28px",fontWeight:900,fontSize:18,background:"#b65b18",color:"white",borderRadius:10}}>⚔️ {t("ATTACK","АТАКУВАЙ")} · {t("Round","Рунд")} {labyrinthBattle.round+1}</button>

          </div>:<button type="button" disabled={labyrinthBusy||labyrinth.missionsToday>=10} onClick={()=>labyrinthCombat("start")} style={{padding:"12px 24px",fontWeight:800,background:"#7452b1",color:"white",borderRadius:9}}>{t("Enter chamber and face monster","Влез в залата и се изправи срещу чудовището")}</button>}
          {labyrinthBattle&&<div style={{marginTop:12}}><p style={{color:"#e6cda7"}}>{t("You can leave this battle to replay an easier cleared room. The attempt is not refunded.","Можеш да напуснеш тази битка и да повториш по-лесна спечелена стая. Опитът не се връща.")}</p><button type="button" disabled={labyrinthBusy} onClick={()=>labyrinthCombat("retreat")} style={{padding:"9px 16px",background:"#6d4050",color:"white",borderRadius:8}}>{t("Leave battle","Напусни битката")}</button></div>}
          {labyrinth.room>1&&<div style={{marginTop:12}}>
            <label htmlFor="labyrinth-replay-room">{t("Repeat a cleared room (automatic battle)","Повтори спечелена стая (автоматична битка)")}: </label>
            <select id="labyrinth-replay-room" defaultValue={Math.max(1,labyrinth.room-1)} onChange={e=>{e.currentTarget.dataset.room=e.target.value;}} style={{padding:7,background:"#28213b",color:"white"}}>
              {Array.from({length:Math.min(300,labyrinth.room-1)},(_,i)=><option key={i+1} value={i+1}>{Math.ceil((i+1)/10)}-{i%10+1}</option>)}
            </select>
            <button type="button" disabled={labyrinthBusy||labyrinth.missionsToday>=10} onClick={()=>replayClearedLabyrinthRoom(Number(document.getElementById("labyrinth-replay-room")?.value)||1)} style={{marginLeft:8,padding:"8px 14px"}}>{t("Auto battle","Автоматична битка")}</button>
          </div>}
        </>}
        <p>💚 {labyrinth.dailyRewardClaimed?t("Today's green crystal collected.","Днешният зелен кристал е получен."):t("Your first battle today awards a green crystal.","Първата битка за деня носи зелен кристал.")}</p>
        {labyrinthNotice&&<p role="status" style={{fontWeight:700,color:"#f2d58f"}}>{labyrinthNotice}</p>}
        {(labyrinth.combatLog||[]).length>0&&<details><summary>{t("Last battle · turn-by-turn report","Последна битка · доклад по рундове")}</summary><div style={{maxHeight:260,overflowY:"auto"}}>{labyrinth.combatLog.map((entry,i)=><p key={i} style={{margin:"4px 0",fontSize:12}}>{entry.turn}. {entry.actor==="knight"?"Cyber Knight":"Monster"}: −{entry.damage} · 🛡️ {entry.knightHp} HP · 👾 {entry.monsterHp} HP</p>)}</div></details>}
      </>}
        </>}

      <h3>{t("Labyrinth standings","Класиране в Лабиринта")}</h3>
      {(labyrinth?.rankings||[]).length?<div style={{overflowX:"auto"}}><table><thead><tr><th>#</th><th>{t("Player","Играч")}</th><th>{t("Room","Стая")}</th><th>{t("Permanent HP","Постоянен HP")}</th></tr></thead><tbody>{labyrinth.rankings.slice(0,20).map(row=><tr key={row.user_id}><td>{row.rank}</td><td>{row.username}</td><td>{Math.min(30,Math.ceil(row.combat_room/10))}-{(row.combat_room-1)%10+1}</td><td>+{row.combat_hp_bonus}</td></tr>)}</tbody></table></div>:<p>{t("No Cyber Knights yet.","Все още няма Киберрицари.")}</p>}
    </section>

      </div>
    </div>,document.body)}
    {notice&&<p role="status">{notice}</p>}
  </div>;
}

function Game() {
  const {language, choose, t, label: localLabel} = useLanguage();
  const navigate=useNavigate();
  const [showUpgradeCenter, setShowUpgradeCenter] = useState(false);
  const [showBattleSimulator,setShowBattleSimulator]=useState(false);
  const [showPopup, setShowPopup] = useState(false);
  const [castleName, setCastleName] = useState("Headquarter");
  const [resources, setResources] = useState(null);
  const [utcClock,setUtcClock]=useState(()=>new Date().toISOString().slice(11,19));
  const [activeHelpCount,setActiveHelpCount]=useState(0);

  const [optionsVisible, setOptionsVisible] = useState(false);
  const [showInformation,setShowInformation]=useState(false);
  const [avatarId,setAvatarId]=useState(()=>sessionStorage.getItem("avatarId")||"pilot-m");
  const [showAvatarPicker,setShowAvatarPicker]=useState(false);
  const [avatarSaving,setAvatarSaving]=useState(false);
  const [avatarNotice,setAvatarNotice]=useState("");
  const [showCyberKnight, setShowCyberKnight] = useState(false);
  const [showQuests, setShowQuests] = useState(false);
  const [showReports,setShowReports]=useState(false);
  const [unreadIncoming,setUnreadIncoming]=useState(0);
  const [unreadBattleReports,setUnreadBattleReports]=useState(0);
  const [hospitalWoundedCount,setHospitalWoundedCount]=useState(0);
  const [hospitalEntries,setHospitalEntries]=useState([]);
  const [incomingAlert,setIncomingAlert]=useState(false);
  const [eventNotification,setEventNotification]=useState(null);
  const [messageNotifications,setMessageNotifications]=useState([]);
  const lastUnreadRef=useRef(0);
  const handleReportsRead=useCallback(async()=>{
    setIncomingAlert(false);
    try{
      const reportApi=(process.env.REACT_APP_API_URL||(window.location.hostname==="localhost"?"http://localhost:3001":window.location.origin)).replace(/\/$/,"");
      const response=await fetch(reportApi+"/reports/"+encodeURIComponent(sessionStorage.getItem("userId")),{headers:{Authorization:"Bearer "+sessionStorage.getItem("authToken")},cache:"no-store"});
      if(response.ok){const data=await response.json();const userId=sessionStorage.getItem("userId");rememberBattleReports(data,userId);setUnreadBattleReports(0);const count=Number(data.unreadIncoming)||0;setUnreadIncoming(count);lastUnreadRef.current=count;}
    }catch{}
  },[]);
  const [showAlliance,setShowAlliance]=useState(false);
  const [showRankings,setShowRankings]=useState(false);
  const [showEvents,setShowEvents]=useState(false);
  const [showTalents,setShowTalents]=useState(false);
  const [showInventory, setShowInventory] = useState(false);
  const [showMarket,setShowMarket]=useState(()=>window.location.hash.includes("market=1"));
  const [showHospital,setShowHospital]=useState(()=>window.location.hash.includes("hospital=1"));
  const [messageRecipient,setMessageRecipient]=useState(null);
  const [supportTarget,setSupportTarget]=useState(null);
  const [playerMenu,setPlayerMenu]=useState(null);
  const [playerNotice,setPlayerNotice]=useState("");
  const [inviting,setInviting]=useState(false);

  const api=useMemo(()=> (process.env.REACT_APP_API_URL || (window.location.hostname==="localhost"?"http://localhost:3001":window.location.origin)).replace(/\/$/,""),[]);
  useEffect(()=>{
    let active=true;
    const checkBuildVersion=async()=>{
      try{
        const response=await fetch(api+"/app-version",{headers:{Authorization:"Bearer "+sessionStorage.getItem("authToken")},cache:"no-store"});
        if(!response.ok)return;
        const data=await response.json();
        const version=String(data.version||"");
        if(!active||!version)return;
        const key="colonize-mars-build-version";
        const previous=sessionStorage.getItem(key);
        if(!previous){sessionStorage.setItem(key,version);return;}
        if(previous!==version&&document.visibilityState==="visible"){
          sessionStorage.setItem(key,version);
          window.location.reload();
        }
      }catch{}
    };
    const onVisible=()=>{if(document.visibilityState==="visible")checkBuildVersion();};
    checkBuildVersion();
    const timer=window.setInterval(checkBuildVersion,45000);
    document.addEventListener("visibilitychange",onVisible);
    return()=>{active=false;window.clearInterval(timer);document.removeEventListener("visibilitychange",onVisible);};
  },[api]);
  useEffect(()=>{
    let active=true;
    const refreshEventNotifications=async()=>{
      try{
        const userId=sessionStorage.getItem("userId");
        const response=await fetch(api+"/notifications/"+encodeURIComponent(userId),{headers:{Authorization:"Bearer "+sessionStorage.getItem("authToken")},cache:"no-store"});
        if(!response.ok)return;
        const data=await response.json();
        if(!active)return;
        const notices=data.notifications||[];
        const event=notices.find(item=>item.kind==="saturday_invasion_started");
        const messages=notices.filter(item=>item.kind==="player_message"||item.kind==="game_message"||item.kind==="trade_message");
        if(event)setEventNotification(old=>old||event);
        setMessageNotifications(messages);
      }catch{}
    };
    refreshEventNotifications();
    const timer=setInterval(refreshEventNotifications,10000);
    return()=>{active=false;clearInterval(timer);};
  },[api]);

  useEffect(()=>{
    let active=true;
    const refreshAttackAlerts=async()=>{
      try{
        const userId=sessionStorage.getItem("userId");
        const response=await fetch(api+"/reports/"+encodeURIComponent(userId),{headers:{Authorization:"Bearer "+sessionStorage.getItem("authToken")},cache:"no-store"});
        if(!response.ok)return;
        const data=await response.json();
        if(!active)return;
        const count=Number(data.unreadIncoming)||0;
        setUnreadIncoming(count);
        setUnreadBattleReports(unreadBattleReportCount(data,userId));
        if(count>0&&lastUnreadRef.current===0)setIncomingAlert(true);
        if(count===0)setIncomingAlert(false);
        lastUnreadRef.current=count;
      }catch{}
    };
    const refreshHospitalAlerts=async()=>{
      try{
        const userId=sessionStorage.getItem(`userId`);
        if(!userId)return;
        const response=await fetch(api+`/hospital/`+encodeURIComponent(userId),{headers:{Authorization:`Bearer `+sessionStorage.getItem(`authToken`)},cache:`no-store`});
        if(!response.ok)return;
        const data=await response.json();
        if(!active)return;
        const entries=data.entries||[];
        const activeIds=new Set(entries.map(entry=>String(entry.id)));
        const previouslyRead=readHospitalAlertIds(userId);
        const stillRead=[...previouslyRead].filter(id=>activeIds.has(id));
        saveHospitalAlertIds(userId,stillRead);
        const readIds=new Set(stillRead);
        const unread=entries.filter(entry=>!readIds.has(String(entry.id)));
        const count=unread.reduce((total,entry)=>total+Object.values(entry.wounded||{}).reduce((subtotal,value)=>subtotal+Math.max(0,Number(value)||0),0),0);
        setHospitalEntries(entries);
        setHospitalWoundedCount(count);
      }catch{}
    };
    refreshAttackAlerts();
    refreshHospitalAlerts();
    const timer=setInterval(()=>{refreshAttackAlerts();refreshHospitalAlerts();},10000);
    return()=>{active=false;clearInterval(timer);};
  },[api]);
  const saveAvatar=async nextAvatar=>{
    setAvatarSaving(true);setAvatarNotice("");
    try{
      const userId=sessionStorage.getItem("userId");
      const response=await fetch(api+"/profile/avatar",{method:"POST",headers:{"Content-Type":"application/json",Authorization:"Bearer "+sessionStorage.getItem("authToken")},body:JSON.stringify({userId,avatarId:nextAvatar.id})});
      const data=await response.json();
      if(!response.ok)throw new Error(data.message||"Unable to save avatar.");
      setAvatarId(data.avatarId);sessionStorage.setItem("avatarId",data.avatarId);
      setAvatarNotice(t("Avatar saved.","Аватарът е запазен."));
    }catch(error){setAvatarNotice(error.message||t("Unable to save avatar.","Аватарът не можа да бъде запазен."));}
    finally{setAvatarSaving(false);}
  };

  const playerAction=player=><button type="button" onClick={async ()=>{
    setPlayerMenu(player);
    setPlayerNotice("");
    const id=sessionStorage.getItem("userId");
    try{
      const response=await fetch(api+"/rankings/"+encodeURIComponent(id),{
        headers:{Authorization:"Bearer "+sessionStorage.getItem("authToken")},cache:"no-store"
      });
      if(!response.ok)return;
      const data=await response.json();
      const selectedIndex=data.players.findIndex(entry=>entry.username===player.username);
      const selected=data.players[selectedIndex];
      const own=data.players.find(entry=>String(entry.id)===id);
      if(selected)setPlayerMenu(current=>current===player ? {
        ...selected,
        rank:selectedIndex+1,
        ally:!!own?.alliance && selected.alliance===own.alliance,
        canInvite:data.canInvite && !selected.alliance && String(selected.id)!==id
      } : current);
    }catch(_){}
  }}>{player.username}</button>;

  const showPlayerBase=()=>{
    sessionStorage.setItem("mapPlayerTarget",playerMenu.username);
    navigate("/map");
  };

  const invitePlayer=async()=>{
    setInviting(true);
    try{
      const response=await fetch(api+"/alliance/invite",{method:"POST",headers:{
        "Content-Type":"application/json",Authorization:"Bearer "+sessionStorage.getItem("authToken")
      },body:JSON.stringify({userId:sessionStorage.getItem("userId"),targetId:playerMenu.id})});
      const result=await response.json();
      setPlayerNotice(result.message);
    }catch(error){setPlayerNotice(error.message);}finally{setInviting(false);}
  };

  const [questTarget,setQuestTarget]=useState(null);
  const onProgressChange = data => setResources(data.resources);

  const refreshActiveHelpCount=async()=>{
    const uid=sessionStorage.getItem("userId");
    if(!uid)return;
    try{
      const response=await fetch(api+"/alliance/"+encodeURIComponent(uid),{headers:{Authorization:"Bearer "+sessionStorage.getItem("authToken")},cache:"no-store"});
      if(!response.ok)return;
      const state=await response.json();
      setActiveHelpCount((state.requests||[]).filter(request=>!request.helped&&String(request.requester_id)!==String(uid)).length);
    }catch(_){/* Keep the last known count during temporary connectivity interruptions. */}
  };

  const openQuestTarget = target => {
    setQuestTarget(target);
    setShowQuests(false);
    setShowUpgradeCenter(false);
    setShowPopup(true);
  };

  useEffect(() => {
    if (!sessionStorage.getItem("authToken")) { window.location.href = "/#/"; return; }
    const savedResources = sessionStorage.getItem("resources");
    if (savedResources) {
      try { setResources(JSON.parse(savedResources)); } catch (_) {}
    }
    fetch(api+"/profile/"+encodeURIComponent(sessionStorage.getItem("userId")),{headers:{Authorization:"Bearer "+sessionStorage.getItem("authToken")},cache:"no-store"})
      .then(response=>response.ok?response.json():null).then(profile=>{if(profile?.avatarId){setAvatarId(profile.avatarId);sessionStorage.setItem("avatarId",profile.avatarId);}}).catch(()=>{});
    const saved = sessionStorage.getItem("castle");
    if (saved) {
      const castle = JSON.parse(saved);
      setCastleName(`Headquarter (${castle.x}:${castle.y})`);
    }
  }, [api]);

  useEffect(()=>{
    const updateClock=()=>setUtcClock(new Date().toISOString().slice(11,19));
    updateClock();
    const clockTimer=setInterval(updateClock,1000);
    refreshActiveHelpCount();
    const helpTimer=setInterval(refreshActiveHelpCount,15000);
    const onHelpUpdated=()=>refreshActiveHelpCount();
    window.addEventListener("alliance-help-updated",onHelpUpdated);
    return()=>{clearInterval(clockTimer);clearInterval(helpTimer);window.removeEventListener("alliance-help-updated",onHelpUpdated);};
  },[]);

  // Keep the HUD synchronized with the server even when the base panel is closed.
  // The server accrues mine production and persists it in SQLite on each read.
  useEffect(() => {
    const userId = sessionStorage.getItem("userId");
    if (!userId) return undefined;
    let active = true;
    let inFlight = false;
    const base = (process.env.REACT_APP_API_URL || (window.location.hostname === "localhost" ? "http://localhost:3001" : window.location.origin)).replace(new RegExp("/$"), "");
    const refresh = async () => {
      if (!active || inFlight || document.hidden) return;
      inFlight = true;
      try {
        const response = await fetch(base + "/get-progress/" + encodeURIComponent(userId), {
          headers: { Authorization: "Bearer " + sessionStorage.getItem("authToken") },
          cache: "no-store"
        });
        if (!response.ok) return;
        const data = await response.json();
        const progress = data.gameProgress;
        if (active && progress?.resources) {
          setResources(progress.resources);
          sessionStorage.setItem("resources", JSON.stringify(progress.resources));
          if (progress.structures) sessionStorage.setItem("structures", JSON.stringify(progress.structures));
        }
      } catch (_) {
        // Keep last known values during temporary connectivity interruptions.
      } finally { inFlight = false; }
    };
    const onVisible = () => { if (!document.hidden) refresh(); };
    const onUpdated = () => {
      try { setResources(JSON.parse(sessionStorage.getItem("resources") || "{}")); } catch (_) {}
    };
    refresh();
    const interval = setInterval(refresh, 2000);
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("game-progress-updated", onUpdated);
    return () => {
      active = false;
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("game-progress-updated", onUpdated);
    };
  }, []);

  const logout = () => {
    sessionStorage.clear();
    window.location.href = "/";
  };

  const markNotificationRead=async notification=>{
    if(!notification)return;
    try{
      const response=await fetch(api+"/notifications/"+encodeURIComponent(sessionStorage.getItem("userId"))+"/read",{
        method:"POST",headers:{"Content-Type":"application/json",Authorization:"Bearer "+sessionStorage.getItem("authToken")},
        body:JSON.stringify({notificationId:notification.id})
      });
      if(response.ok){
        setEventNotification(current=>current?.id===notification.id?null:current);
        setMessageNotifications(current=>current.filter(item=>item.id!==notification.id));
      }
    }catch{}
  };
  const closeEventNotification=async openEvent=>{
    const notification=eventNotification;
    if(openEvent)setShowEvents(true);
    await markNotificationRead(notification);
  };
  const openBlueNotification=async notification=>{
    if(notification?.kind==="gathering_return")navigate("/map");
    else setMessageRecipient("");
    await markNotificationRead(notification);
  };

  return (
    <div
      className="game-container game-colony-background"
      style={{
        "--mars-desktop-background": `url("${desktopColonyBackground}")`,
        "--mars-mobile-background": `url("${mobileColonyBackground}")`,
        "--mars-fallback-background": `url(${marsBackground})`,
        backgroundImage: `url("${marsBackground}")`,
        backgroundSize: "cover",
        backgroundPosition: "center center",
        backgroundRepeat: "no-repeat",
        minHeight: "100dvh",
      }}
    >
      <div className="top-resource-bar">
        <div>{t("Gold","Злато")}: {resources?.Gold ?? resources?.gold ?? "—"}</div>
        <div>{t("Iron","Желязо")}: {resources?.Iron ?? resources?.iron ?? "—"}</div>
        <div>{t("Water","Вода")}: {resources?.Water ?? resources?.water ?? "—"}</div>
        <div>{t("Solar","Слънчева енергия")}: {resources?.Solar ?? resources?.solar ?? "—"}</div>
      </div>

      <div className="castle-top-bar">
        <button className={"castle-name-btn"+(activeHelpCount>0?" has-building-help":"")} aria-label={activeHelpCount>0?t("Headquarters. "+activeHelpCount+" active construction help requests.","Щаб. "+activeHelpCount+" активни заявки за помощ.") :t("Headquarters","Щаб")} title={activeHelpCount>0?t(activeHelpCount+" active construction help requests","Активни заявки за строителна помощ: "+activeHelpCount):undefined} onClick={() => {setQuestTarget(null);setShowPopup(true);}}>
          {language === "bg" ? castleName.replace("Headquarter","Щаб") : castleName}
          {activeHelpCount>0&&<span className="hq-help-badge" aria-label={String(activeHelpCount)}>{activeHelpCount>9?"9+":activeHelpCount}</span>}
        </button>
        <div className="utc-clock" aria-label={t("Server time in UTC","Сървърно време UTC")}><span>{t("Server time","Сървърно време")}</span><strong>{utcClock} UTC</strong></div>
      </div>

      <div className="bottom-bar">
        <button onClick={() => setShowCyberKnight(true)}>{t("Cyber Knight","Киберрицар")}</button>
        <button onClick={()=>setShowTalents(true)}>{t("Commander Protocols","Протоколи на командира")}</button>
        <button onClick={() => setShowQuests(true)}>{t("Quests","Мисии")}</button>
        <button onClick={() => navigate("/map?campaign=1")}>{t("Campaign","Кампании")}</button>
        <button onClick={()=>setShowEvents(true)}>{t("Events","Събития")}</button>
        <button onClick={()=>setShowMarket(true)}>{t("Market","Пазар")}</button>
        <button className={hospitalWoundedCount>0?"reports-nav-button reports-unread":""} onClick={()=>{
          const userId=sessionStorage.getItem("userId");
          saveHospitalAlertIds(userId,hospitalEntries.map(entry=>entry.id));
          setHospitalWoundedCount(0);
          setShowHospital(true);
        }}>{t("Hospital","Болница")}{hospitalWoundedCount>0&&<span className="reports-badge">{hospitalWoundedCount}</span>}</button>
        <button onClick={() => navigate("/map")}>{t("Map","Карта")}</button>
        <button onClick={()=>{setSupportTarget(null);setShowAlliance(true);}}>{t("Alliance","Алианс")}</button>
        <button onClick={()=>setShowRankings(true)}>{t("Rankings","Класиране")}</button>
        <button className={messageNotifications.length?"messages-nav-button messages-unread":""} onClick={()=>setMessageRecipient("")}>{t("Messages","Съобщения")}{messageNotifications.length>0&&<span className="messages-badge">{messageNotifications.length}</span>}</button>
        <button className={unreadIncoming+unreadBattleReports>0?"reports-nav-button reports-unread":""} onClick={()=>{setShowReports(true);setIncomingAlert(false);}}>{t("Reports","Доклади")}{unreadIncoming+unreadBattleReports>0&&<span className="reports-badge">{unreadIncoming+unreadBattleReports}</span>}</button>
        <button onClick={() => setShowInventory(true)}>{t("Inventory","Инвентар")}</button>
        <button onClick={() => setOptionsVisible(!optionsVisible)}>{t("Options","Настройки")}</button>
      </div>

      {optionsVisible && (
        <div id="optionsMenu">
          <label>{t("Language","Език")}{" "}
            <select value={language} onChange={event=>choose(event.target.value)}>
              <option value="bg" lang="bg">Български</option>
              <option value="en" lang="en">English</option>
            </select>
          </label>{" "}
          <button type="button" onClick={()=>{setShowAvatarPicker(value=>!value);setAvatarNotice("");}}>{t("Player avatar","Аватар на играча")} · {AVATARS.find(avatar=>avatar.id===avatarId)?.icon||"👨‍🚀"}</button>{" "}
          <button type="button" onClick={()=>setShowInformation(true)}>{t("Information","Информация")}</button>{" "}
          <button onClick={logout}>{t("Log Out","Изход")}</button>
          {showAvatarPicker&&<section aria-label={t("Choose an avatar","Избери аватар")} style={{marginTop:12,padding:12,background:"#111820",border:"1px solid #59768a",borderRadius:10,width:"min(92vw, 560px)",boxSizing:"border-box"}}>
            <h3 style={{marginTop:0}}>{t("Choose your Mars avatar","Избери своя марсиански аватар")}</h3>
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(105px,1fr))",gap:8}}>
              {AVATARS.map(avatar=><button key={avatar.id} type="button" disabled={avatarSaving} aria-pressed={avatarId===avatar.id} onClick={()=>saveAvatar(avatar)} style={{display:"flex",flexDirection:"column",alignItems:"center",gap:5,padding:"9px 6px",borderRadius:10,border:avatarId===avatar.id?"2px solid #43c8b3":"1px solid #547188",background:avatarId===avatar.id?"#174c53":"#1c3143",color:"white",cursor:"pointer"}}>
                <span aria-hidden="true" style={{width:50,height:50,borderRadius:"50%",display:"grid",placeItems:"center",fontSize:29,background:"radial-gradient(circle at 35% 30%,#718a9c,#263443 72%)"}}>{avatar.icon}</span>
                <span>{t(avatar.role,avatar.roleBg)}</span>
              </button>)}
            </div>
            {avatarNotice&&<p role="status">{avatarNotice}</p>}
          </section>}
        </div>
      )}

      {showPopup && !showUpgradeCenter && (
        <div className="popup">
          <div className="popup-header">
            <span>{t("BASE CONTROL PANEL","УПРАВЛЕНИЕ НА БАЗАТА")}</span>
            <button className="close-button" onClick={() => setShowPopup(false)}>
              X
            </button>
          </div>
          <div className="popup-content">
            
            <StructurePanel questTarget={questTarget} onProgressChange={onProgressChange} onOpenUpgrades={() => setShowUpgradeCenter(true)} onOpenSimulator={()=>setShowBattleSimulator(true)} />
          </div>
        </div>
      )}

      {showUpgradeCenter && (
        <div className="popup">
          <div className="popup-header">
            <span>{t("Upgrade Center","Център за подобрения")}</span>
            <button className="close-button" onClick={() => setShowUpgradeCenter(false)}>X</button>
          </div>
          <div className="popup-content">
            <StructurePanel upgradesOnly onProgressChange={onProgressChange} />
          </div>
        </div>
      )}

      {showInformation&&<div className="popup" style={{zIndex:1007}}><div className="popup-header" style={{gap:16}}><span>{t("GAME INFORMATION","ИНФОРМАЦИЯ ЗА ИГРАТА")}</span><button className="close-button" aria-label={t("Close","Затвори")} onClick={()=>setShowInformation(false)}>X</button></div><div className="popup-content"><InformationPanel/></div></div>}
      {showBattleSimulator&&<div className="popup" style={{zIndex:1004}}>
        <div className="popup-header"><span>{t("COMBAT SIMULATOR","БОЕН СИМУЛАТОР")}</span><button className="close-button" onClick={()=>setShowBattleSimulator(false)}>X</button></div>
        <div className="popup-content"><BattleSimulator/></div>
      </div>}
      {showCyberKnight && (
        <CyberKnightPanel onClose={() => setShowCyberKnight(false)} />
      )}

      {showHospital&&<div className="popup" style={{zIndex:1006}}><div className="popup-header"><span>{t("HOSPITAL","БОЛНИЦА")}</span><button className="close-button" onClick={()=>setShowHospital(false)}>X</button></div><div className="popup-content"><HospitalPanel/></div></div>}
      {showMarket&&<div className="popup" style={{zIndex:1005}}><div className="popup-header"><span>{t("INTERBASE MARKET","МЕЖДУБАЗОВ ПАЗАР")}</span><button className="close-button" onClick={()=>setShowMarket(false)}>X</button></div><div className="popup-content"><MarketPanel/></div></div>}
      {showInventory && (
        <div className="popup">
          <div className="popup-header"><span>{t("INVENTORY","ИНВЕНТАР")}</span><button className="close-button" onClick={() => setShowInventory(false)}>X</button></div>
          <div className="popup-content"><Inventory onClose={() => setShowInventory(false)} /></div>
        </div>
      )}

      {showTalents&&<div className="popup"><div className="popup-header"><span>{t("COMMANDER PROTOCOLS","ПРОТОКОЛИ НА КОМАНДИРА")}</span><button className="close-button" onClick={()=>setShowTalents(false)}>X</button></div><div className="popup-content"><PlayerTalents/></div></div>}
      {showEvents&&<div className="popup" style={{zIndex:1004}}><div className="popup-header"><span>{t("EVENTS","СЪБИТИЯ")}</span><button className="close-button" onClick={()=>setShowEvents(false)}>X</button></div><div className="popup-content"><EventsPanel/></div></div>}
      {showAlliance&&<div className="popup"><div className="popup-header"><span>{t("ALLIANCE","АЛИАНС")}</span><button className="close-button" onClick={()=>setShowAlliance(false)}>X</button></div><div className="popup-content"><AlliancePanel key={supportTarget?.id || "alliance"} supportTarget={supportTarget} playerAction={playerAction}/></div></div>}
      {showRankings&&<div className="popup"><div className="popup-header"><span>{t("RANKINGS","КЛАСИРАНЕ")}</span><button className="close-button" onClick={()=>setShowRankings(false)}>X</button></div><div className="popup-content"><Rankings playerAction={playerAction}/></div></div>}
      {messageRecipient!==null&&<div className="popup" style={{zIndex:1002}}>
        <div className="popup-header"><span>{t("MESSAGES","СЪОБЩЕНИЯ")}</span><button className="close-button" onClick={()=>setMessageRecipient(null)}>X</button></div>
        <div className="popup-content"><MessagePanel key={messageRecipient} recipient={messageRecipient} playerAction={playerAction}/></div>
      </div>}
      {playerMenu&&<div className="popup" style={{zIndex:1003}}>
        <div className="popup-header"><span>{playerMenu.username}</span><button className="close-button" onClick={()=>setPlayerMenu(null)}>X</button></div>
        <div className="popup-content" style={{display:"flex",flexDirection:"column",gap:12,alignContent:"flex-start",padding:16,boxSizing:"border-box"}}>
          <section style={{display:"flex",alignItems:"center",gap:14,background:"#172c3d",border:"1px solid #547188",borderRadius:12,padding:16}}>
            <span aria-hidden="true" style={{width:78,height:78,flex:"0 0 78px",borderRadius:"50%",display:"grid",placeItems:"center",fontSize:44,background:"radial-gradient(circle at 35% 30%,#718a9c,#263443 72%)"}}>{AVATARS.find(avatar=>avatar.id===playerMenu.avatarId)?.icon||"👨‍🚀"}</span>
            <div><h2 style={{margin:"0 0 6px"}}>{t("Player profile","Профил на играча")}</h2><strong style={{fontSize:20}}>{playerMenu.username}</strong><div>{(()=>{const avatar=AVATARS.find(item=>item.id===playerMenu.avatarId)||AVATARS.find(item=>item.id==="pilot-m");return t(avatar.role,avatar.roleBg);})()}</div></div>
          </section>
          <div style={{display:"flex",gap:18,flexWrap:"wrap"}}>
            <span>{t("Alliance","Алианс")}: {playerMenu.alliance||"—"}</span>
            {Number.isFinite(Number(playerMenu.rank))&&<span>{t("Rank","Място")}: {Number(playerMenu.rank)}</span>}
            {Number.isFinite(Number(playerMenu.points))&&<span>{t("XP","Опит")}: {Number(playerMenu.points).toLocaleString()}</span>}
          </div>
          <div style={{display:"flex",flexWrap:"wrap",gap:8}}>
          <button onClick={showPlayerBase}>{t("View Base","Виж базата")}</button>
          <button disabled={playerMenu.username===sessionStorage.getItem("username")} onClick={()=>{setMessageRecipient(playerMenu.username);setPlayerMenu(null);}}>{t("Message","Съобщение")}</button>
          <button disabled={!playerMenu.ally || playerMenu.username===sessionStorage.getItem("username")} onClick={()=>{setSupportTarget(playerMenu);setShowRankings(false);setShowAlliance(true);setPlayerMenu(null);}}>{t("Support","Подкрепление")}</button>
          <button disabled title={playerMenu.ally?"You cannot attack an ally.":"Player battles are not enabled yet."}>{t("Attack","Атака")}</button>
          <button disabled={!playerMenu.canInvite || inviting} onClick={invitePlayer}>{t("Invite to Alliance","Покани в алианса")}</button>
          {playerNotice&&<p role="status">{localLabel(playerNotice)}</p>}
          </div>
        </div>
      </div>}

      {incomingAlert&&unreadIncoming>0&&<div className="incoming-attack-alert" role="alert"><span className="incoming-attack-lamp" />{t("Incoming attack is on the way. A report will be ready after battle.","Към теб идва атака. Доклад ще има след битката.")}<button aria-label={t("Dismiss","Затвори")} onClick={()=>setIncomingAlert(false)}>×</button></div>}
      {eventNotification&&<div className="event-start-alert" role="alert">
        <span aria-hidden="true">🚨</span>
        <span>{t("The Saturday Alien Invasion has started for your alliance:","Съботната извънземна инвазия започна за алианса:")} <strong>{eventNotification.allianceName}</strong> · {t("First attack arrives in 1 minute.","Първата атака пристига след 1 минута.")}</span>
        <button type="button" onClick={()=>closeEventNotification(true)}>{t("View event","Виж събитието")}</button>
        <button type="button" aria-label={t("Dismiss","Затвори")} onClick={()=>closeEventNotification(false)}>×</button>
      </div>}
      {messageNotifications.length>0&&<div className="message-notification-alert" role="status">
        <span aria-hidden="true">✉️</span>
        <span>{messageNotifications[0].kind==="gathering_return"?t("Your army and resources returned from gathering.","Армията и ресурсите ти се върнаха от добива."):messageNotifications[0].kind==="trade_message"?t("Market trade completed. Check Trade messages.","Сделката на пазара е завършена. Провери съобщенията в Търговия."):messageNotifications[0].kind==="game_message"?t("New system message is available.","Имаш ново системно съобщение."):(messageNotifications[0].allianceName?t("New message from your alliance leadership.","Ново съобщение от ръководството на алианса."):t("You have a new player message.","Имаш ново лично съобщение."))}{messageNotifications[0].kind==="gathering_return"&&messageNotifications[0].allianceName&&" · "+messageNotifications[0].allianceName}</span>
        <button type="button" onClick={()=>openBlueNotification(messageNotifications[0])}>{messageNotifications[0].kind==="gathering_return"?t("View map","Виж картата"):t("View messages","Виж съобщенията")}</button>
        <button type="button" aria-label={t("Dismiss","Затвори")} onClick={()=>markNotificationRead(messageNotifications[0])}>×</button>
      </div>}
      {showReports&&<ReportsPanel onClose={()=>setShowReports(false)} onRead={handleReportsRead}/>}
      {showQuests && (
        <div className="popup">
          <div className="popup-header">
            <span>{t("QUESTS","МИСИИ")}</span>
            <button className="close-button" onClick={() => setShowQuests(false)}>
              X
            </button>
          </div>
          <div className="popup-content">
            <Quests onShowBase={openQuestTarget} onOpenUpgrades={() => setShowUpgradeCenter(true)} onOpenProtocols={() => setShowTalents(true)} onOpenAlliance={() => { setSupportTarget(null); setShowAlliance(true); }} />
          </div>
        </div>
      )}
    </div>
  );
}

export default Game;
