import BattleArmySummary from "../shared/BattleArmySummary";
import BattleReportHeader from "../shared/BattleReportHeader";
import BattleReplay from "../shared/BattleReplay";
import DesertionReport from "../shared/DesertionReport";
import React, { useEffect, useState } from "react";
import { useLanguage } from "../language";
import { useNavigate } from "react-router-dom";
import BattleKnights from "../shared/BattleKnights";

const api=(process.env.REACT_APP_API_URL||(window.location.hostname==="localhost"?"http://localhost:3001":window.location.origin)).replace(/\/$/,"");
const auth=()=>({Authorization:"Bearer "+sessionStorage.getItem("authToken")});
const reportReadStorageKey=userId=>`colonize-mars-read-battle-reports:${userId}`;
const countUnits=units=>Object.values(units||{}).reduce((total,count)=>total+(Number(count)||0),0);
const diff=(initial,remaining)=>Object.fromEntries(Object.entries(initial||{}).map(([unit,count])=>[unit,Math.max(0,(Number(count)||0)-(Number(remaining?.[unit])||0))]).filter(([,count])=>count>0));


function FullBattleReport({result}) {
  const {t}=useLanguage();
  const [open,setOpen]=useState(false);
  return <details onToggle={event=>setOpen(event.currentTarget.open)}>
    <summary>{t("Full report","Пълен доклад")}</summary>
    {open&&<><BattleReportHeader result={result} /><BattleKnights knights={result.knights} /><BattleReplay result={result.replay||result} /></>}
  </details>;
}


export default function ReportsPanel({onClose,onRead,initialTab="military"}) {
  const {locale,t,label:localLabel}=useLanguage();
  const list=units=>Object.entries(units||{}).filter(([,count])=>Number(count)>0).map(([unit,count])=>localLabel(unit)+": "+Number(count).toLocaleString(locale)).join(", ")||"0";
  const navigate=useNavigate();
  const coordinateLink=(x,y)=>Number.isInteger(Number(x))&&Number.isInteger(Number(y))&&Number(x)>=1&&Number(x)<=100&&Number(y)>=1&&Number(y)<=100?<button type="button" title={t("Show on map","Покажи на картата")} onClick={()=>{sessionStorage.setItem("mapReportTarget",JSON.stringify({x:Number(x),y:Number(y)}));onClose?.();navigate("/map");}} style={{border:0,background:"transparent",color:"#78d7ff",textDecoration:"underline",cursor:"pointer",font:"inherit",padding:0}}>{x}:{y}</button>:<span>{x??"?"}:{y??"?"}</span>;
  const userId=sessionStorage.getItem("userId");
  const [data,setData]=useState(null);
  const [activeTab,setActiveTab]=useState(initialTab);
  const [militaryTab,setMilitaryTab]=useState("player");
  const [page,setPage]=useState(1);
  useEffect(()=>{setPage(1);},[activeTab,militaryTab]);
  const [error,setError]=useState("");
  
  const [clock,setClock]=useState(Date.now);
  const [sharing,setSharing]=useState(null);
  const [shareScope,setShareScope]=useState("alliance");
  const [recipientQuery,setRecipientQuery]=useState("");
  const [selectedRecipient,setSelectedRecipient]=useState("");
  const [recipientMatches,setRecipientMatches]=useState([]);
  const [shareBusy,setShareBusy]=useState(false);
  const [shareNotice,setShareNotice]=useState("");
  useEffect(()=>{
    if(!sharing||shareScope!=="private"||recipientQuery.trim().length<3){setRecipientMatches([]);return;}
    let active=true;
    fetch(api+"/reports/recipients/"+encodeURIComponent(userId)+"?q="+encodeURIComponent(recipientQuery.trim()),{headers:auth()})
      .then(r=>r.ok?r.json():{players:[]}).then(data=>{if(active)setRecipientMatches(data.players||[]);}).catch(()=>{if(active)setRecipientMatches([]);});
    return()=>{active=false;};
  },[sharing,shareScope,recipientQuery,userId]);
  const shareControls=(type,id)=><div>
    <button type="button" onClick={()=>{setSharing(sharing?.type===type&&sharing?.id===id?null:{type,id});setShareScope("alliance");setRecipientQuery("");setSelectedRecipient("");setShareNotice("");}}>{type==="player"?t("Forward","Препрати"):t("Share","Сподели")}</button>
    {sharing?.type===type&&sharing?.id===id&&<div style={{padding:10,marginTop:6,border:"1px solid #64839a",borderRadius:8}}>
      <label>{t("Share with","Сподели с")}: <select value={shareScope} onChange={e=>{setShareScope(e.target.value);setRecipientQuery("");setSelectedRecipient("");}}><option value="alliance">{t("Alliance","Алианс")}</option><option value="private">{t("Player","Играч")}</option></select></label>
      {shareScope==="private"&&<div style={{marginTop:8}}>
        <input aria-label={t("Player name","Име на играч")} placeholder={t("At least 3 letters","Поне 3 букви")} value={recipientQuery} onChange={e=>{setRecipientQuery(e.target.value);setSelectedRecipient("");}}/>
        {recipientQuery.trim().length>=3&&!selectedRecipient&&<div style={{display:"flex",flexDirection:"column",alignItems:"flex-start",gap:3}}>
          {recipientMatches.map(p=><button type="button" key={p.id} onClick={()=>{setSelectedRecipient(p.username);setRecipientQuery(p.username);}}>{p.username}</button>)}
        </div>}
        {selectedRecipient&&<p>✓ {selectedRecipient}</p>}
      </div>}
      <button type="button" disabled={shareBusy||(shareScope==="private"&&!selectedRecipient)} onClick={async()=>{
        setShareBusy(true);setShareNotice("");
        try{
          const response=await fetch(api+"/reports/share",{method:"POST",headers:{"Content-Type":"application/json",...auth()},body:JSON.stringify({userId:Number(userId),reportType:type,reportId:id,scope:shareScope,recipient:selectedRecipient})});
          const data=await response.json();if(!response.ok)throw Error(data.message||"Share failed.");
          setShareNotice(t("Report shared successfully.","Докладът е споделен успешно."));
        }catch(error){setShareNotice(error.message);}finally{setShareBusy(false);}
      }}>{shareBusy?t("Sharing...","Изпращане..."):t("Share","Сподели")}</button>
      {shareNotice&&<p role="status">{localLabel(shareNotice)}</p>}
    </div>}
  </div>;

  useEffect(()=>{const timer=window.setInterval(()=>setClock(Date.now()),1000);return()=>window.clearInterval(timer);},[]);
  useEffect(()=>{
    let active=true;
    (async()=>{
      try{
        const response=await fetch(api+"/reports/"+encodeURIComponent(userId),{headers:auth(),cache:"no-store"});
        const body=await response.json();if(!response.ok)throw Error(body.message||"Reports unavailable.");
        if(active){
          let seen=[];try{seen=JSON.parse(localStorage.getItem(reportReadStorageKey(userId))||"[]");}catch{}
          const read=new Set(Array.isArray(seen)?seen:[]);
                  setData(body);
          try{localStorage.setItem(reportReadStorageKey(userId),JSON.stringify([...new Set([...read,...unreadIds])]));}catch{}
        }
        await fetch(api+"/reports/read",{method:"POST",headers:{"Content-Type":"application/json",...auth()},body:JSON.stringify({userId})});
        onRead?.();
      }catch(e){if(active)setError(e.message);}
    })();
    return()=>{active=false;};
  },[userId,onRead]);
  const allPlayer=(data?.playerMissions||[]).filter(m=>m.result);
  const activeIncoming=(data?.playerMissions||[]).filter(m=>m.incoming&&!m.result&&!m.returned_at);
  const alienReports=[
    ...(data?.missions||[]).filter(m=>m.result).map(report=>({type:"alien",report})),
    ...(data?.mothershipReports||[]).map(report=>({type:"mothership",report})),
  ].sort((a,b)=>b.report.resolved_at-a.report.resolved_at||b.report.id-a.report.id);
  const scoutReports=(data?.playerScoutMissions||[]).filter(m=>m.report);
  const gathering=(data?.gatheringReports||[]);
  const army=(title,units)=> <div><strong>{title}:</strong> {units===null?t("Not recorded","Не е записано"):list(units)}</div>;
  const lootSummary=result=>["Gold","Iron","Water","Solar"].map(key=>
    t(key,{Gold:"Злато",Iron:"Желязо",Water:"Вода",Solar:"Слънчева енергия"}[key])+": "+Number(result.loot[key]||0).toLocaleString(locale)
  ).join(" · ")+" · "+t("Total","Общо")+": "+Number(result.totalLoot||0).toLocaleString(locale)
    +" · "+t("Cargo capacity","Товароносимост")+": "+Number(result.cargoCapacity||0).toLocaleString(locale);
  const orangeEmpireReports=data?.orangeEmpireReports||[];
  const playerReport=m=>{
    const ownInitial=m.incoming?(m.result.defenderInitial||{}):(m.units||{});
    const ownRemaining=m.incoming?(m.result.defenderSurvivors||{}):(m.result.survivors||{});
    const ownInitialRecorded=!m.incoming||Object.prototype.hasOwnProperty.call(m.result,"defenderInitial");
    const didLose=m.incoming?!!m.result.victory:!m.result.victory;
    const noWitness=!m.result.recalled&&!m.result.shielded&&didLose&&Number(m.result.rounds||0)<=1&&countUnits(ownRemaining)===0;
    const title=m.incoming?t("Incoming attack from","Атака от")+" "+m.attacker_name:t("Attack on","Атака срещу")+" "+m.defender_name;
    const outcome=m.result.recalled?t("Attack recalled before arrival","Атаката е върната преди пристигане"):m.result.shielded?t("Blocked by protection","Спряна от протекция"):m.incoming?(m.result.victory?t("Base lost","Базата е превзета"):t("Defense held","Защитата устоя")):(m.result.victory?t("Victory","Победа"):t("Defeat","Поражение"));
    // Even a decisive first-round defeat has a report, including surviving defenders.
    if(false&&noWitness)return <article key={"player-"+m.id} style={card}><h3>{title} · {coordinateLink(m.target?.x,m.target?.y)}</h3><p>{t("The battle ended too quickly. No survivors remained to report what happened.","Битката се състоя твърде бързо и няма оцелели, които да докладват какво се е случило.")}</p></article>;
    const enemyInitial=m.incoming?(m.units||{}):null;
    const enemyRemaining=m.incoming?(m.result.survivors||{}):null;
    return <article key={"player-"+m.id} style={card}>
      <h3>{title} · {coordinateLink(m.target?.x,m.target?.y)}</h3>
      {Number.isFinite(m.resolved_at)&&<time dateTime={new Date(m.resolved_at).toISOString()}>{new Date(m.resolved_at).toLocaleString(locale)}</time>}
      {m.result.report?.[0]?.grid&&<p>{t("Defense Grid level","Ниво на Отбранителната мрежа")}: {m.result.report[0].grid.level}</p>}
      <p>{outcome}{!m.result.recalled&&" · "+t("Rounds","Рундове")+": "+(m.result.rounds??"—")}</p>
      {!m.incoming&&m.cyberKnightLevel&&<p>{t("Commander: Cyber Knight level","Командир: Cyber Knight ниво")} {m.cyberKnightLevel}</p>}
      {m.result.loot&&!m.result.recalled&&<p><strong>{m.incoming?t("Resources plundered","Отнети ресурси"):t("Loot","Плячка")}:</strong> {lootSummary(m.result)}</p>}
      {army(t("Your starting army","Твоята начална армия"),ownInitialRecorded?ownInitial:null)}
      {army(t("Your losses","Твоите загуби"),diff(ownInitial,ownRemaining))}
      {army(t("Your survivors","Твоите оцелели"),ownRemaining)}
      {m.incoming&&Object.keys(enemyInitial||{}).length>0&&<details><summary>{t("Attacking force","Нападателна армия")}</summary>{army(t("Starting army","Начална армия"),enemyInitial)}{army(t("Losses","Загуби"),diff(enemyInitial,enemyRemaining))}{army(t("Survivors","Оцелели"),enemyRemaining)}</details>}
      {m.result.recalled&&<p>{t("No battle took place; the attacking army returned unchanged.","Битка не е имало; нападателната армия се е върнала непокътната.")}</p>}
      {!m.incoming&&!m.result.recalled&&m.result.defenderSurvivors&&army(t("Enemy surviving defenders","Оцелели защитници на противника"),m.result.defenderSurvivors)}
      {m.result.error&&<p>{localLabel(m.result.error)}</p>}
      <BattleArmySummary result={m.result} />
    <DesertionReport report={m.result.report} />
      <div className="battle-report-actions">
        {!m.result.recalled&&!m.result.shielded&&<FullBattleReport result={m.result} />}
        {shareControls("player",m.id)}
      </div>}
    </article>;
  };
  const alienReport=m=>{
    const equipment=m.result.equipmentReward||m.result.reward?.item;
    const effectLabel=effect=>{
      const target=localLabel(effect.target),value=Number(effect.value)||0;
      if(effect.kind==="unitAttack")return t("Attack of","Атака на")+" "+target+": +"+value+"%";
      if(effect.kind==="unitHealth")return t("Health of","Живот на")+" "+target+": +"+value+"%";
      if(effect.kind==="enemyUnitAttack")return t("Enemy attack of","Атака на противниковия")+" "+target+": −"+value+"%";
      if(effect.kind==="enemyUnitHealth")return t("Enemy health of","Живот на противниковия")+" "+target+": −"+value+"%";
      if(effect.kind==="protocolBoost")return t("Combat protocol","Боен протокол")+" "+target+": +"+value+"%";
      if(effect.kind==="enemyProtocol")return t("Opponent combat protocol","Противников боен протокол")+" "+target+": −"+value+"%";
      return localLabel(effect.target)+": "+value+"%";
    };
    const reward=m.result.reward;
    const secondary=reward&&typeof reward==="object"&&!reward.item
      ?reward.type==="crafting"?t("Forge points","Точки за изковаване")+": "+reward.amount
      :reward.type==="resources"?t("Resources deposited in Inventory","Ресурси, добавени в Инвентара")+": "+["Gold","Iron","Water","Solar"].map(key=>t(key,{Gold:"Злато",Iron:"Желязо",Water:"Вода",Solar:"Слънчева енергия"}[key])+": "+Number(reward.resources?.[key]??reward.amount??0).toLocaleString(locale)).join(" · ")+" · "+t("Total","Общо")+": "+["Gold","Iron","Water","Solar"].reduce((sum,key)=>sum+Number(reward.resources?.[key]??reward.amount??0),0).toLocaleString(locale)
      :reward.type==="army"?t("Troops","Войници")+": "+Number(reward.amount||0).toLocaleString(locale)+" "+localLabel(reward.unit)
      :""
      :"";
    const gearNames={
      HELMET:t("Plasma Helmet","Плазмен шлем"),ARMOR:t("Plasma Armor","Плазмена броня"),BOOTS:t("Plasma Boots","Плазмени ботуши"),
      WEAPON:t("Plasma Weapon","Плазмено оръжие"),SHIELD:t("Plasma Shield","Плазмен щит"),GLOVES:t("Plasma Gloves","Плазмени ръкавици")
    };
    const returnStatus=m.returned_at?t("Army returned","Армията се прибра"):m.returns_at?`${t("Returning","Връща се")} · ${Math.max(0,Math.ceil((Number(m.returns_at)-clock)/1000))} ${t("sec.","сек.")}`:"";
    return <article key={"alien-"+m.id} style={card}>
    <h3>{t("Attacks against aliens","Атаки срещу извънземни")}{m.target&&<> · {coordinateLink(m.target.x,m.target.y)}</>}</h3>
    {Number.isFinite(m.resolved_at)&&<time dateTime={new Date(m.resolved_at).toISOString()}>{new Date(m.resolved_at).toLocaleString(locale)}</time>}
    <p>{t("Mission #","Мисия №")}{m.id} · {t("Alien Base level","Извънземна база ниво")} {m.level} · {m.result.victory?t("Victory","ПОБЕДА"):t("Defeat","ПОРАЖЕНИЕ")}{returnStatus&&" · "+returnStatus}</p>
    {m.cyberKnightLevel&&<p>{t("Commander: Cyber Knight level","Командир: Cyber Knight ниво")} {m.cyberKnightLevel}</p>}
    <p>{t("Rounds","Рундове")}: {m.result.rounds??"—"} · {t("Remaining alien defenders","Оставащи извънземни защитници")}: {m.result.defendersRemaining??0}</p>
    {equipment&&<><p>🎁 {t("Cyber Knight gear reward","Получена екипировка за Cyber Knight")}: <strong>{gearNames[String(equipment.slot||equipment.type||"").toUpperCase()]||localLabel(equipment.name)}</strong> · {localLabel(equipment.rarity)} · {"★".repeat(Number(equipment.stars)||1)}</p>{(equipment.effects||[]).length>0&&<ul>{equipment.effects.map((effect,index)=><li key={index}>{effectLabel(effect)}</li>)}</ul>}</>}
    {secondary&&<p>🎁 {t("Additional reward","Допълнителна награда")}: {secondary}</p>}
    <p>⭐ <strong>{t("Experience earned (XP)","Получен опит (XP)")}:</strong> {m.result.xpEarned==null?t("Not recorded","Няма запис"):Number(m.result.xpEarned).toLocaleString(locale)}</p>
    {Number(m.result.greenCrystals)>0&&<p>🎁 💚 {t("Green crystals","Зелени кристали")}: {Number(m.result.greenCrystals).toLocaleString(locale)}</p>}
    {Number(m.result.redCrystals)>0&&<p>🎁 🔴 {t("Red crystals","Червени кристали")}: {Number(m.result.redCrystals).toLocaleString(locale)}</p>}
    {m.result.wounded&&Object.keys(m.result.wounded).length>0&&<p>{t("Sent to hospital (30%)","Изпратени в болницата (30%)")}: {list(m.result.wounded)}</p>}
    <DesertionReport report={m.result.report} />
    <div className="battle-report-actions"><FullBattleReport result={m.result} />{shareControls("alien",m.id)}</div>
    {army(t("Starting army","Начална армия"),m.units)}{army(t("Losses","Загуби"),diff(m.units,m.result.survivors||{}))}{army(t("Survivors","Оцелели"),m.result.survivors||{})}
  </article>;
  };
  const mothershipReport=report=><article key={"mothership-"+report.id} style={card}>
    <h3>{t("Attack on the Alien Command Ship","Атака срещу командния кораб на извънземните")} · #{report.id}</h3>
    <p><strong>{t("Damage dealt","Нанесени щети")}:</strong> {Number(report.damage).toLocaleString(locale)} · {Number(report.xp).toLocaleString(locale)} XP</p>
    <p>{new Date(report.resolved_at).toLocaleString(locale)} · {t("Cyber Knight level","Ниво на Cyber Knight")} {report.knight_level}</p>
    {army(t("Deployed army","Изпратена армия"),report.army)}
    <details><summary>{t("Knight equipment","Екипировка на рицаря")}</summary><BattleKnights knights={report.knights} /></details>
    <details><summary>{t("Formation","Формация")}</summary>
      {[...new Set(report.formation.map(group=>group.row))].sort((a,b)=>a-b).map(row=><div key={row}>
        {t("Row","Ред")} {row} · {report.formation.filter(group=>group.row===row).map(group=>localLabel(group.unit)+" × "+Number(group.count).toLocaleString(locale)).join(", ")}
      </div>)}
    </details>
  </article>;
  const gatheringReport=report=>{
    const resource={gold:t("Gold","Злато"),iron:t("Iron","Желязо"),water:t("Water","Вода"),solar:t("Solar","Слънчева енергия")}[String(report.resource).toLowerCase()]||report.resource;
    const title=report.reason==="depleted"?t("Mine depleted · army returned","Мината се изчерпа · армията се прибра"):report.reason==="cargo_full"?t("Cargo full · army returned","Товарът е пълен · армията се прибра"):t("Army recalled from mine","Армията се прибра от мината");
    return <article key={"gathering-"+report.id} style={card}>
      <h3>{title} · {report.source==="alliance"?localLabel("Alliance Mine"):t("Mine","Мина")} #{report.mineId} ({coordinateLink(report.x,report.y)})</h3>
      <p>{t("Resources collected","Източен ресурс")}: {Number(report.amount||0).toLocaleString(locale)} {resource}</p>
      {army(t("Army returned","Върната армия"),report.units)}
      <p>{new Date(report.returnedAt).toLocaleString(locale)}</p>
    </article>;
  };
  const espionageReport=m=><article key={"scout-"+m.id} style={card}>
    <h3>🔎 {t("Espionage against","Шпионаж срещу")} {m.target.username} · {coordinateLink(m.target.x,m.target.y)}</h3>
    <p>{new Date(m.report.scoutedAt||m.arrives_at).toLocaleString(locale)}</p>
    <p><strong>{t("Player last active","Последна активност на играча")}:</strong> {m.report.lastSeenAt?new Date(m.report.lastSeenAt).toLocaleString(locale):t("Unknown","Неизвестна")}</p>
    {m.report.abandoned&&<p style={{color:"#c5c5c5",fontWeight:700}}>{t("Abandoned base — inactive for at least 7 days","Необитаема база — неактивна поне 7 дни")}</p>}
    <p>{t("Sent scouts","Изпратени разузнавачи")}: {m.quantity.toLocaleString(locale)} · {t("Your losses","Твои загуби")}: {Number(m.report.attackerLost||0).toLocaleString(locale)} · {t("Enemy scout losses","Загуби на противниковите разузнавачи")}: {Number(m.report.defenderLost||0).toLocaleString(locale)} · {t("Survivors","Оцелели")}: {Number(m.report.survivors??m.quantity).toLocaleString(locale)}</p>
    {m.report.success===false?<p><strong>{t("All your scouts died during espionage. No survivor returned to report.","При шпионажа всичките ви шпиони загинаха и не се завърна оцелял, за да докладва.")}</strong></p>:<>
      {m.report.resources&&<p><strong>{t("Unprotected resources","Незащитени ресурси")}:</strong> {Object.entries(m.report.resources).map(([name,n])=>localLabel(name)+": "+Number(n).toLocaleString(locale)).join(" · ")}</p>}
      {m.report.resources&&<p>{t("The first 10,000 units of each resource are protected and excluded from this report.","Първите 10 000 единици от всеки ресурс са защитени и не се показват в доклада.")}</p>}
      {m.report.army&&<p><strong>{t("Defending army","Защитна армия")}:</strong> {list(m.report.army)}</p>}
      {m.report.structures&&<div><strong>{t("Buildings and levels","Сгради и нива")}:</strong><ul>{Object.entries(m.report.structures).map(([name,level])=><li key={name}>{localLabel(name)}: {t("Level","Ниво")} {level}</li>)}</ul></div>}
    </>}
    {shareControls("scout",m.id)}
  </article>;
  const incomingMarch=m=><article key={"march-"+m.id} style={card}>
    <h3>{t("Attack in progress from","Идваща атака от")} {m.attacker_name} · {coordinateLink(m.target?.x,m.target?.y)}</h3>
    <p>{t("The attack is on the way. No battle report exists yet.","Походът е в движение. Все още няма боен доклад.")}</p>
    <p>{t("Expected arrival","Очаквано пристигане")}: {new Date(m.arrives_at).toLocaleTimeString(locale)}</p>
  </article>;
  const reportTime=r=>Number(r.resolved_at??r.returnedAt??r.report?.scoutedAt??r.arrives_at)||0;
  const selectedReports=activeTab==="economy"?gathering:activeTab==="espionage"?scoutReports:militaryTab==="player"?allPlayer:militaryTab==="orange"?orangeEmpireReports:alienReports.filter(x=>x.type===militaryTab).map(x=>x.report);
  const orderedReports=[...selectedReports].sort((a,b)=>reportTime(b)-reportTime(a)||Number(b.id)-Number(a.id));
  const pageCount=Math.max(1,Math.ceil(orderedReports.length/5));
  const currentPage=Math.min(page,pageCount);
  const visibleReports=orderedReports.slice((currentPage-1)*5,currentPage*5);
  return <div style={overlay} onClick={onClose}><section style={panel} onClick={e=>e.stopPropagation()}>
    <header style={header}><span>{t("REPORTS","ДОКЛАДИ")}</span><button onClick={onClose} style={close}>×</button></header>
    <div style={{padding:20,overflowY:"auto",maxHeight:"calc(90vh - 70px)"}}>
      {error&&<p role="alert">{localLabel(error)}</p>}{!data&&!error&&<p>{t("Loading reports…","Зареждане на докладите…")}</p>}
      {data&&<div style={{display:"flex",gap:8,marginBottom:16}}>
        <button type="button" onClick={()=>setActiveTab("military")} style={{...tabButton,background:activeTab==="military"?"#24629b":"#293443"}}>{t("Military","Военни")}</button>
        <button type="button" onClick={()=>setActiveTab("espionage")} style={{...tabButton,background:activeTab==="espionage"?"#24629b":"#293443"}}>🔎 {t("Espionage","Шпионажи")}</button>
        <button type="button" onClick={()=>setActiveTab("economy")} style={{...tabButton,background:activeTab==="economy"?"#24629b":"#293443"}}>{t("Economy","Икономика")}</button>
      </div>}
      {data&&activeTab==="military"&&<><div style={{display:"flex",flexWrap:"wrap",gap:8,marginBottom:12}}>
        {[["player",t("Player battles","Битки с играчи")],["alien",t("Alien bases","Извънземни бази")],["mothership",t("Command ship","Команден кораб")],["orange",t("Orange Empire","Оранжева империя")]].map(([key,label])=><button key={key} type="button" style={{...tabButton,background:militaryTab===key?"#24629b":"#293443"}} onClick={()=>{setMilitaryTab(key);setPage(1);}}>{label}</button>)}
      </div>{militaryTab==="player"&&activeIncoming.length>0&&<><h2>{t("Attacks in progress","Походи към теб")}</h2>{activeIncoming.map(incomingMarch)}</>}</>}
      {data&&visibleReports.length===0&&<p>{t("No reports yet.","Все още няма доклади.")}</p>}
      {data&&activeTab==="military"&&militaryTab==="player"&&visibleReports.map(playerReport)}
      {data&&activeTab==="military"&&militaryTab==="alien"&&visibleReports.map(alienReport)}
      {data&&activeTab==="military"&&militaryTab==="mothership"&&visibleReports.map(mothershipReport)}
      {data&&activeTab==="military"&&militaryTab==="orange"&&visibleReports.map(report=><article key={report.id} style={card}>
            <h3>{t("The Orange Empire","Оранжевата империя")} · {report.commander_id===10?t("Emperor","Император"):t("Commander","Командир")+" "+report.commander_id} · {coordinateLink(report.x,report.y)}</h3>
            <p>{new Date(report.arrives_at).toLocaleString(locale)} · {report.result.cancelled?t("Attack cancelled","Нападението е отменено"):report.result.victory?t("Orange Empire victory","Победа за Оранжевата империя"):t("Defense held","Защитата устоя")}</p>
            <BattleArmySummary result={report.result} />
            <DesertionReport report={report.result.report} />
            {!report.result.cancelled&&<FullBattleReport result={report.result} />}
            {report.result.loot&&<p><strong>{t("Resources plundered","Отнети ресурси")}:</strong> {lootSummary(report.result)}</p>}
          </article>)}
      {data&&activeTab==="espionage"&&visibleReports.map(espionageReport)}
      {data&&activeTab==="economy"&&visibleReports.map(gatheringReport)}
      {data&&pageCount>1&&<nav style={{display:"flex",alignItems:"center",justifyContent:"center",gap:12}}><button type="button" disabled={currentPage===1} onClick={()=>setPage(currentPage-1)}>{t("Previous","Предишна")}</button><span>{currentPage} / {pageCount}</span><button type="button" disabled={currentPage===pageCount} onClick={()=>setPage(currentPage+1)}>{t("Next","Следваща")}</button></nav>}
    </div></section></div>;
}
const tabButton={border:"1px solid #64839a",borderRadius:6,color:"white",padding:"9px 14px",cursor:"pointer",fontWeight:"bold"};
const overlay={position:"fixed",inset:0,zIndex:10000,background:"rgba(0,0,0,.8)",display:"grid",gridTemplateColumns:"minmax(0,1fr)",placeItems:"center",padding:12};
const panel={width:"min(100%,1050px)",boxSizing:"border-box",maxHeight:"90vh",background:"#111",border:"3px solid #777",color:"#eef5ff",overflow:"hidden",boxShadow:"0 10px 40px #000"};
const header={position:"sticky",top:0,display:"flex",alignItems:"center",justifyContent:"space-between",background:"#333",padding:"14px 20px",fontSize:22};
const close={background:"red",color:"white",border:0,fontSize:28,fontWeight:"bold",width:44,height:44,cursor:"pointer"};
const card={border:"1px solid #64839a",borderRadius:10,background:"#182c3e",padding:"12px 16px",marginBottom:12,lineHeight:1.7};
