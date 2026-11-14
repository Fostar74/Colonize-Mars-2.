import { useLanguage } from "../language";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import AVATARS from "../shared/avatarCatalog";

const reportReadStorageKey = userId => `colonize-mars-read-battle-reports:${userId}`;
const resolvedBattleReportIds = data => [
  ...(data?.missions || []).filter(mission => mission.result).map(mission => `alien:${mission.id}`),
  ...(data?.playerMissions || []).filter(mission => mission.result && !mission.incoming).map(mission => `player:${mission.id}`)
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
      await refresh();setNotice(t("Trade completed. Both players have been notified in Messages.","Сделката приключи. И двамата играчи получиха съобщение."));
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
      await refresh();setNotice(t("Treatment started. Wounded units will be ready in one minute.","Лечението започна. Ранените ще са готови след една минута."));
      window.dispatchEvent(new Event("game-progress-updated"));
    }catch(error){setNotice(error.message);}finally{setBusy(false);}
  };
  const waiting=entries.filter(entry=>entry.status==="waiting"&&entry.source==="player-defense");
  const active=entries.find(entry=>entry.status==="healing");
  const total=entries.reduce((sum,entry)=>sum+Object.values(entry.wounded||{}).reduce((subtotal,count)=>subtotal+Number(count||0),0),0);
  const fmt=army=>Object.entries(army||{}).filter(([,count])=>Number(count)>0).map(([unit,count])=>Number(count).toLocaleString()+" "+label(unit)).join(" · ")||"0";
  const sourceName=source=>source==="player-defense"?t("Base Defense","Защита на базата"):source==="mothership"?t("Mother Ship Hunt","Лов на Майчиния кораб"):t("Saturday Alien Invasion","Съботна извънземна инвазия");
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
      {entry.status==="waiting"&&entry.source==="player-defense"&&<div style={{marginTop:6}}>
        <div>{t("Treatment cost:","Цена на лечението:")} {fmt(entry.healingCost)}</div>
        <div>{t("Treatment time: one minute","Време за лечение: една минута")}</div>
      </div>}
      {entry.status==="healing"&&<div>{t("Time remaining:","Оставащо време:")} {Math.max(0,Math.ceil((Number(entry.heals_at)-tick)/1000))} {t("seconds","секунди")}</div>}
      {entry.status==="event"&&entry.recoveryAt&&<div>{t("Returns to the garrison after:","Войниците се връщат в гарнизона след:")} {new Date(entry.recoveryAt).toLocaleString()}</div>}
    </article>)}
    {!entries.length&&<div style={card}>{t("No wounded troops. Your garrison is ready.","Няма ранени войници. Гарнизонът е в готовност.")}</div>}
    {!!waiting.length&&<button type="button" disabled={busy||!!active} onClick={treat} style={{padding:"11px 18px",border:0,borderRadius:7,color:"white",fontWeight:"bold",background:"#26853a",cursor:"pointer"}}>
      {busy?t("Starting treatment…","Лечението започва…"):t("Treat base-defense wounded","Лекувай ранените защитници")}
    </button>}
    <p style={{fontSize:12,marginBottom:0}}>{t("Only 10% of troops lost while defending a player base are sent here. Event casualties return automatically after the event; they use no healing resources.","В болницата отиват 10% от войниците, загубени при защита на базата от играч. Ранените от събития се връщат автоматично след края им и не изискват ресурси.")}</p>
  </div>;
}

function EventsPanel() {
  const {language,t}=useLanguage();
  const [data,setData]=useState(null);
  const [motherShip,setMotherShip]=useState(null);
  const [labyrinth,setLabyrinth]=useState(null);
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
  };
  useEffect(()=>{refresh().catch(error=>setNotice(error.message));const timer=setInterval(()=>refresh().catch(()=>{}),10000);const tick=setInterval(()=>setLabyrinthTick(Date.now()),1000);return()=>{clearInterval(timer);clearInterval(tick);};},[]);
  const start=async()=>{
    setBusy(true);setNotice("");
    try{
      const response=await fetch(api+"/events/saturday-invasion/start",{method:"POST",headers,body:JSON.stringify({userId:Number(userId)})});
      const result=await response.json();
      if(!response.ok)throw Error(result.message||"Could not start the event.");
      setNotice(t("Event started for your alliance.","Събитието е стартирано за алианса."));
      await refresh();
    }catch(error){setNotice(error.message);}
    finally{setBusy(false);}
  };
  const date=value=>value?new Date(value).toLocaleString(language==="bg"?"bg-BG":"en-US",{dateStyle:"medium",timeStyle:"short",timeZone:"UTC"})+" UTC":"—";
  const crystalLabel={yellow:t("yellow","жълт"),blue:t("blue","син"),orange:t("orange","оранжев"),purple:t("purple","лилав")};
  const runLabyrinthMission=async()=>{
    setLabyrinthBusy(true);setLabyrinthNotice("");
    try{const response=await fetch(api+"/events/labyrinth/mission",{method:"POST",headers,body:JSON.stringify({userId:Number(userId)})});const result=await response.json();if(!response.ok)throw Error(result.message||"Labyrinth mission failed.");setLabyrinth(result.status);setLabyrinthNotice(result.crystal?t("You found "+crystalLabel[result.crystal]+" crystal and "+result.item.name+".","Намери "+crystalLabel[result.crystal]+" кристал и "+result.item.name+"."):t("Equipment found: "+result.item.name+".","Намерена екипировка: "+result.item.name+"."));}
    catch(error){setLabyrinthNotice(error.message);}
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
    <h2>{t("Saturday Alien Invasion","Съботна извънземна инвазия")}</h2>
    <p>{data.active?t("Event is active","Събитието е активно"):data.settled?t("Event results are final","Класирането е окончателно"):t("Scheduled for","Насрочено за")} {date(data.startsAt)} – {date(data.endsAt)}</p>
    <p>{t("The first alien wave attacks as soon as the leader starts the run. Stronger waves attack every minute until all troops are eliminated or wave 20 is completed. Eliminated players receive no more attacks.","Първата извънземна вълна атакува веднага щом лидерът стартира участието. По-силни вълни атакуват през една минута, докато войските не бъдат елиминирани или не бъде завършена вълна 20. Елиминираните играчи повече не са атакувани.")}</p>
    {data.alliance&&<div style={{border:"1px solid #789",borderRadius:8,padding:10,marginBottom:12}}>
      <strong>{data.alliance.name}</strong>
      {data.alliance.run&&<span> · {data.alliance.run.status==="active"?t("Participating","Участва"):t("Run complete","Участието приключи")}</span>}
      {data.alliance.canStart&&<div style={{marginTop:8}}><button type="button" disabled={busy} onClick={start}>{busy?t("Starting…","Стартиране…"):t("Start for my alliance","Стартирай за алианса")}</button></div>}
      {data.myResult&&<div style={{marginTop:8,padding:10,borderRadius:8,background:"rgba(30,50,70,.7)"}}>
        <p style={{margin:"0 0 6px"}}>{t("Your rank","Твоето място")}: #{data.myResult.rank} · {t("points","точки")}: {Number(data.myResult.score||0).toLocaleString()} · {data.myResult.eliminated?t("Eliminated","Елиминиран"):t("Still defending","Продължаваш защитата")}</p>
        <p style={{margin:"0 0 6px"}}>{t("Waves survived","Издържани вълни")}: {Number(data.myResult.waves||0)} / 20</p>
        {data.myResult.lastBattle&&<p style={{margin:"0 0 6px"}}>{t("Last attack","Последна атака")} · {t("Alien base level","Ниво на извънземната база")} {data.myResult.lastBattle.level}: {Number(data.myResult.lastBattle.alienCasualties||0).toLocaleString()} {t("aliens eliminated","извънземни елиминирани")} · {Number(data.myResult.lastBattle.remaining||0).toLocaleString()} {t("troops remaining","войници остават")}</p>}
        {data.alliance.run?.status==="active"&&!data.myResult.eliminated&&<p style={{margin:0}}>{t("Next wave in","Следваща вълна след")}: {Math.max(0,Math.ceil((Number(data.myResult.nextAttackAt||labyrinthTick)-labyrinthTick)/1000))} {t("seconds","секунди")}</p>}
      </div>}
      {}
      {data.alliance&&!data.alliance.run&&!data.alliance.canStart&&<p>{t("Only the alliance leader can start the event, and only during Saturday UTC.","Само лидерът на алианса може да стартира събитието в събота по UTC.")}</p>}
    </div>}
    {motherShip&&<div style={{border:"1px solid #789",borderRadius:8,padding:10,marginBottom:12}}>
      <h2>{t("Mother Ship Hunt","Лов на кораба майка")}</h2>
      <p>{motherShip.active?t("Event is active","Събитието е активно"):motherShip.settled?t("Results are final","Класирането е окончателно"):t("Scheduled weekly event","Седмично събитие")}: {date(motherShip.startsAt)} – {date(motherShip.endsAt)}</p>
      <p>{t("Attacks remaining","Оставащи атаки")}: {motherShip.attacksRemaining} · {t("Mother Ship health","Живот на кораба майка")}: {Number(motherShip.hp||0).toLocaleString()}</p>
      {motherShip.rankings?.length>0&&<div style={{overflowX:"auto"}}><table><thead><tr><th>#</th><th>{t("Player","Играч")}</th><th>{t("Damage","Щети")}</th><th>{t("Attacks","Атаки")}</th></tr></thead><tbody>{motherShip.rankings.slice(0,10).map((row,index)=><tr key={row.user_id}><td>{index+1}</td><td>{row.username}</td><td>{Number(row.damage||0).toLocaleString()}</td><td>{row.attacks}</td></tr>)}</tbody></table></div>}
      <button type="button" onClick={()=>{window.location.href="/#/map?campaign=1";}}>{t("Open campaigns","Отвори кампаниите")}</button>
    </div>}
    <section style={{border:"1px solid #896da9",borderRadius:10,padding:12,marginTop:18,background:"linear-gradient(145deg,#171321,#211b2c)",color:"#f5edff"}}>
      <h2 style={{color:"#e1bbff"}}>🧭 {t("The Labyrinth","Лабиринт")}</h2>
      <p>{t("Enter the underground maze with your Cyber Knight. Find equipment, collect four crystal colors to open new squares, and reach Nova’s pink medicine vial at the far end.","Влез в подземния лабиринт с Киберрицаря. Откривай екипировка, събирай четирите цвята кристали, за да отваряш нови квадратчета, и стигни до розовото шишенце с лекарството за Nova.")}</p>
      {!labyrinth?<p>{t("Loading Labyrinth…","Зареждане на Лабиринта…")}</p>:!labyrinth.unlocked?<p>{t("Unlocks at Cyber Knight level 10.","Отключва се на ниво 10 на Киберрицаря.")} · {t("Your level","Твоето ниво")}: {labyrinth.knightLevel} / 10</p>:<>
        <p>{t("Daily missions","Дневни мисии")}: {labyrinth.missionsToday} / {labyrinth.missionsPerDay} · {t("Each mission takes one second and grants random equipment. One of the 10 missions each day also gives one random-colored crystal.","Всяка мисия трае една секунда и дава случайна екипировка. Една от десетте мисии за деня дава и един кристал със случаен цвят.")}</p>
        <div style={{display:"flex",gap:8,flexWrap:"wrap",margin:"10px 0"}}>
          {[["yellow","🟡",t("Yellow","Жълт")],["blue","🔵",t("Blue","Син")],["orange","🟠",t("Orange","Оранжев")],["purple","🟣",t("Purple","Лилав")]].map(([key,icon,label])=><span key={key} style={{padding:"5px 9px",background:"#30283d",borderRadius:7}}>{icon} {label}: {Number(labyrinth.crystals?.[key]||0)}</span>)}
        </div>
        {labyrinth.missionsToday<labyrinth.missionsPerDay&&<button type="button" disabled={labyrinthBusy||Number(labyrinth.nextMissionAt||0)>labyrinthTick} onClick={runLabyrinthMission}>{labyrinthBusy?t("Working…","Изпълнява се…"):t("Run next mission","Изпълни следващата мисия")} · {labyrinth.missionsToday+1}/10</button>}
        {labyrinth.missionsToday>=labyrinth.missionsPerDay&&<p>{t("Your Labyrinth missions reset at 00:00 UTC.","Мисиите в Лабиринта се обновяват в 00:00 UTC.")}</p>}
        {labyrinth.medicineFound?<p style={{color:"#ffb6e6",fontWeight:"bold"}}>🧪 {t("Medicine found! Nova can be revived.","Лекарството е намерено! Nova може да бъде съживена.")}</p>:<div style={{border:"1px solid #564567",borderRadius:8,padding:10,marginTop:12}}>
          <strong>{t("Dark underground map","Затъмнена подземна карта")}</strong> · {t("Current square","Текущо квадратче")}: {labyrinth.currentRoom} · {t("Depth","Дълбочина")}: {labyrinth.currentDepth}/10
          <p>{t("Squares you have explored","Посетени квадратчета")}: {labyrinth.roomsOpened} · {t("Furthest depth","Най-голяма дълбочина")}: {labyrinth.deepestDepth}/10</p>
          <div style={{display:"flex",gap:6,flexWrap:"wrap",margin:"8px 0"}}>{(labyrinth.visitedRooms||[]).map(room=><button type="button" key={room.id} disabled={labyrinthBusy||room.current} onClick={()=>labyrinthAction("/events/labyrinth/backtrack",{roomId:room.id},t("Returned to a visited square.","Върна се на посетено квадратче."))} style={{background:room.current?"#8054a8":"#30283d",color:"white",border:"1px solid #9c78bd",borderRadius:6,padding:"6px 9px"}}>{room.goal?"🧪": "◈"} {room.id} · {room.depth}</button>)}</div>
          {(labyrinth.exits||[]).length>0?<div><p>{t("Choose one of the hidden neighboring squares. Each costs one of all four crystals.","Избери едно от скритите съседни квадратчета. Всяко струва по един кристал от четирите цвята.")}</p><div style={{display:"flex",gap:8,flexWrap:"wrap"}}>{labyrinth.exits.map(exit=><button type="button" key={exit.id} disabled={labyrinthBusy||!["yellow","blue","orange","purple"].every(color=>Number(labyrinth.crystals?.[color]||0)>0)} onClick={()=>labyrinthAction("/events/labyrinth/move",{roomId:exit.id},t("Square opened.","Квадратчето е отключено."))}>{t(exit.direction,exit.direction==="North"?"Север":exit.direction==="East"?"Изток":"Юг")} · ?</button>)}</div></div>:<p>{t("Dead end. Return to any explored square to continue.","Задънена улица. Върни се на произволно посетено квадратче, за да продължиш.")}</p>}
          <p style={{color:"#cdb8dd"}}>{t("Collected crystals are spent when a new square is opened. Your explored path and remaining crystals are saved.","Събраните кристали се изразходват при отваряне на ново квадратче. Посетеният път и останалите кристали се запазват.")}</p>
        </div>}
        {labyrinthNotice&&<p role="status">{labyrinthNotice}</p>}
      </>}
      <h3>{t("Labyrinth standings","Класиране в Лабиринта")}</h3>
      {(labyrinth?.rankings||[]).length?<div style={{overflowX:"auto"}}><table><thead><tr><th>#</th><th>{t("Player","Играч")}</th><th>{t("Furthest depth","Най-голяма дълбочина")}</th><th>{t("Squares","Квадратчета")}</th><th>{t("Medicine","Лекарство")}</th></tr></thead><tbody>{labyrinth.rankings.slice(0,20).map(row=><tr key={row.user_id}><td>{row.rank}</td><td>{row.username}</td><td>{row.deepest_depth}/10</td><td>{row.rooms_opened}</td><td>{row.medicine_found?t("Found","Намерено"):"—"}</td></tr>)}</tbody></table></div>:<p>{t("No Cyber Knights have entered yet.","Все още няма влезли Киберрицари.")}</p>}
    </section>
        {notice&&<p role="status">{notice}</p>}
    <h3>{t("Alliance standings","Класиране на алиансите")}</h3>
    {data.alliances.length?<div style={{overflowX:"auto"}}><table><thead><tr><th>#</th><th>{t("Alliance","Алианс")}</th><th>{t("Points","Точки")}</th><th>{t("Status","Статус")}</th></tr></thead><tbody>{data.alliances.map(row=><tr key={row.id}><td>{row.rank}</td><td>{row.name}</td><td>{Number(row.score||0).toLocaleString()}</td><td>{row.status==="active"?t("Active","Активен"):t("Complete","Приключил")}</td></tr>)}</tbody></table></div>:<p>{t("No alliances have started yet.","Все още няма стартирали алианси.")}</p>}
    <h3>{t("Individual standings","Индивидуално класиране")}</h3>
    {data.players.length?<div style={{overflowX:"auto"}}><table><thead><tr><th>#</th><th>{t("Player","Играч")}</th><th>{t("Alliance","Алианс")}</th><th>{t("Points","Точки")}</th><th>{t("Status","Статус")}</th></tr></thead><tbody>{data.players.slice(0,20).map(row=><tr key={row.userId}><td>{row.rank}</td><td>{row.username}</td><td>{row.alliance}</td><td>{Number(row.score||0).toLocaleString()}</td><td>{row.eliminated?t("Eliminated","Елиминиран"):row.runStatus==="active"?t("Active","Активен"):t("Survived","Оцеля")}</td></tr>)}</tbody></table></div>:<p>{t("No scores yet.","Все още няма точки.")}</p>}
    <p>{t("Top three alliances receive resources for each participating member:","Първите три алианса получават ресурси за всеки участвал член:")} 1) 50,000 · 2) 30,000 · 3) 15,000 {t("of each resource.","от всеки ресурс.")}</p>
    {notice&&<p role="status">{notice}</p>}
  </div>;
}

function Game() {
  const {language, choose, t, label: localLabel} = useLanguage();
  const [showUpgradeCenter, setShowUpgradeCenter] = useState(false);
  const [showBattleSimulator,setShowBattleSimulator]=useState(false);
  const [showPopup, setShowPopup] = useState(false);
  const [castleName, setCastleName] = useState("Headquarter");
  const [resources, setResources] = useState(null);
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
  const [incomingAlert,setIncomingAlert]=useState(false);
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
        const response=await fetch(api+`/hospital/`+encodeURIComponent(userId),{headers:{Authorization:`Bearer `+sessionStorage.getItem(`authToken`)},cache:`no-store`});
        if(!response.ok)return;
        const data=await response.json();
        if(!active)return;
        const count=(data.entries||[]).reduce((total,entry)=>total+Object.values(entry.wounded||{}).reduce((subtotal,value)=>subtotal+Math.max(0,Number(value)||0),0),0);
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
    window.location.href="/#/map";
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

  return (
    <div
      className="game-container"
      style={{
        backgroundImage: `url(${marsBackground})`,
        backgroundSize: "cover",
        backgroundRepeat: "no-repeat",
        backgroundPosition: "center top",
        minHeight: "100vh",
      }}
    >
      <div className="top-resource-bar">
        <div>{t("Gold","Злато")}: {resources?.Gold ?? resources?.gold ?? "—"}</div>
        <div>{t("Iron","Желязо")}: {resources?.Iron ?? resources?.iron ?? "—"}</div>
        <div>{t("Water","Вода")}: {resources?.Water ?? resources?.water ?? "—"}</div>
        <div>{t("Solar","Слънчева енергия")}: {resources?.Solar ?? resources?.solar ?? "—"}</div>
      </div>

      <div className="castle-top-bar">
        <button className="castle-name-btn" onClick={() => {setQuestTarget(null);setShowPopup(true);}}>
          {language === "bg" ? castleName.replace("Headquarter","Щаб") : castleName}
        </button>
      </div>

      <div className="bottom-bar">
        <button onClick={() => setShowCyberKnight(true)}>{t("Cyber Knight","Киберрицар")}</button>
        <button onClick={()=>setShowTalents(true)}>{t("Commander Protocols","Протоколи на командира")}</button>
        <button onClick={() => setShowQuests(true)}>{t("Quests","Мисии")}</button>
        <button onClick={() => (window.location.href = "/#/map?campaign=1")}>{t("Campaign","Кампании")}</button>
        <button onClick={()=>setShowEvents(true)}>{t("Events","Събития")}</button>
        <button onClick={()=>setShowMarket(true)}>{t("Market","Пазар")}</button>
        <button className={hospitalWoundedCount>0?"reports-nav-button reports-unread":""} onClick={()=>setShowHospital(true)}>{t("Hospital","Болница")}{hospitalWoundedCount>0&&<span className="reports-badge">{hospitalWoundedCount}</span>}</button>
        <button onClick={() => (window.location.href = "/#/map")}>{t("Map","Карта")}</button>
        <button onClick={()=>{setSupportTarget(null);setShowAlliance(true);}}>{t("Alliance","Алианс")}</button>
        <button onClick={()=>setShowRankings(true)}>{t("Rankings","Класиране")}</button>
        <button onClick={()=>setMessageRecipient("")}>{t("Messages","Съобщения")}</button>
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

      {showInformation&&<div className="popup" style={{zIndex:1007}}><div className="popup-header" style={{gap:16}}><span>{t("UNIT INFORMATION","ИНФОРМАЦИЯ ЗА ВОЙСКИТЕ")}</span><button className="close-button" aria-label={t("Close","Затвори")} onClick={()=>setShowInformation(false)}>X</button></div><div className="popup-content"><InformationPanel/></div></div>}
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
