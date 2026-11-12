import { useLanguage } from "../language";
import React, { useEffect, useState } from "react";
import StructurePanel from "./StructurePanel";
import BattleSimulator from "./BattleSimulator";
import CyberKnightPanel from "./CyberKnightPanel";
import Quests from "./Quests";
import AlliancePanel from "./AlliancePanel";
import Rankings from "./Rankings";
import MessagePanel from "./MessagePanel";
import PlayerTalents from "./PlayerTalents";
import Inventory from "./Inventory";
import "./Game.css";
import marsBackground from "../images/mars-background.jpg";

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

function MothershipHospitalPanel() {
  const {t,label}=useLanguage();
  const [entries,setEntries]=useState([]);
  const [notice,setNotice]=useState("");
  const [busy,setBusy]=useState(false);
  const [tick,setTick]=useState(Date.now());
  const userId=sessionStorage.getItem("userId");
  const api=(process.env.REACT_APP_API_URL||window.location.origin).replace(/\/$/,"");
  const headers={"Content-Type":"application/json",Authorization:"Bearer "+sessionStorage.getItem("authToken")};
  const refresh=async()=>{
    const r=await fetch(api+"/mothership/hospital/"+encodeURIComponent(userId),{headers,cache:"no-store"});
    const d=await r.json();if(!r.ok)throw Error(d.message||"Hospital unavailable.");setEntries(d.entries||[]);
  };
  useEffect(()=>{refresh().catch(e=>setNotice(e.message));const timer=setInterval(()=>{setTick(Date.now());refresh().catch(()=>{});},5000);return()=>clearInterval(timer);},[]);
  const start=async()=>{
    setBusy(true);setNotice("");
    try{
      const r=await fetch(api+"/mothership/hospital/heal",{method:"POST",headers,body:JSON.stringify({userId})});
      const d=await r.json();if(!r.ok)throw Error(d.message||"Could not start treatment.");
      await refresh();setNotice(t("Treatment started. Your troops will be ready in about one minute.","Лечението започна. Войниците ще са готови след около минута."));
      window.dispatchEvent(new Event("game-progress-updated"));
    }catch(e){setNotice(e.message);}finally{setBusy(false);}
  };
  const waiting=entries.find(e=>e.status==="waiting"),active=entries.find(e=>e.status==="healing");
  const fmt=o=>Object.entries(o||{}).filter(([,n])=>Number(n)>0).map(([k,n])=>Number(n).toLocaleString()+" "+label(k)).join(" · ")||"0";
  return <div style={{color:"#f5f0e6"}}>
    <p>{t("Units from Mother Ship attacks are wounded, never lost. Hospital treatment costs resources and takes 60 seconds.","Войниците от атаките срещу Майчиния кораб се раняват, но не се губят. Лечението в болницата струва ресурси и трае 60 секунди.")}</p>
    {!entries.length&&<p>{t("No wounded troops.","Няма ранени войници.")}</p>}
    {entries.map(entry=><article key={entry.id} style={{margin:"10px 0",padding:12,background:"#20384d",border:"1px solid #668196",borderRadius:8}}>
      <strong>{entry.status==="healing"?t("In treatment","В лечение"):t("Waiting for treatment","Чакат лечение")}</strong>
      <div>{t("Wounded units:","Ранени войници:")} {fmt(entry.wounded)}</div>
      <div>{t("Treatment cost:","Цена на лечението:")} {fmt(entry.healingCost)}</div>
      {entry.status==="healing"&&<div>{t("Time remaining:","Оставащо време:")} {Math.max(0,Math.ceil((Number(entry.heals_at)-tick)/1000))} {t("seconds","секунди")}</div>}
    </article>)}
    {waiting&&<button type="button" disabled={busy||!!active} onClick={start}>{busy?t("Starting…","Започване…"):t("Treat wounded · 1 minute","Лекувай ранените · 1 минута")}</button>}
    {notice&&<p role="status">{notice}</p>}
  </div>;
}

function EventsPanel() {
  const {language,t}=useLanguage();
  const [data,setData]=useState(null);
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
  };
  useEffect(()=>{refresh().catch(error=>setNotice(error.message));const timer=setInterval(()=>refresh().catch(()=>{}),10000);return()=>clearInterval(timer);},[]);
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
  if(!data)return <div><p>{notice||t("Loading events…","Зареждане на събитията…")}</p></div>;
  return <div style={{color:"#eef6ff",padding:12,minWidth:320}}>
    <h2>{t("Saturday Alien Invasion","Съботна извънземна инвазия")}</h2>
    <p>{data.active?t("Event is active","Събитието е активно"):data.settled?t("Event results are final","Класирането е окончателно"):t("Scheduled for","Насрочено за")} {date(data.startsAt)} – {date(data.endsAt)}</p>
    <p>{t("Each alliance leader can start one run on Saturday. Alien waves arrive every 30 seconds and grow stronger. Eliminated players receive no more attacks.","Лидерът на всеки алианс може да стартира едно участие в събота. Извънземните вълни пристигат през 30 секунди и стават по-силни. Елиминираните играчи повече не са атакувани.")}</p>
    {data.alliance&&<div style={{border:"1px solid #789",borderRadius:8,padding:10,marginBottom:12}}>
      <strong>{data.alliance.name}</strong>
      {data.alliance.run&&<span> · {data.alliance.run.status==="active"?t("Participating","Участва"):t("Run complete","Участието приключи")}</span>}
      {data.alliance.canStart&&<div style={{marginTop:8}}><button type="button" disabled={busy} onClick={start}>{busy?t("Starting…","Стартиране…"):t("Start for my alliance","Стартирай за алианса")}</button></div>}
      {data.myResult&&<p>{t("Your rank","Твоето място")}: #{data.myResult.rank} · {t("points","точки")}: {Number(data.myResult.score||0).toLocaleString()} · {data.myResult.eliminated?t("Eliminated","Елиминиран"):t("Still defending","Продължаваш защитата")}</p>}
      {!data.alliance&&<p>{t("Join an alliance to participate.","Присъедини се към алианс, за да участваш.")}</p>}
      {data.alliance&&!data.alliance.run&&!data.alliance.canStart&&<p>{t("Only the alliance leader can start the event, and only during Saturday UTC.","Само лидерът на алианса може да стартира събитието в събота по UTC.")}</p>}
    </div>}
    <h3>{t("Alliance standings","Класиране на алиансите")}</h3>
    {data.alliances.length?<div style={{overflowX:"auto"}}><table><thead><tr><th>#</th><th>{t("Alliance","Алианс")}</th><th>{t("Points","Точки")}</th><th>{t("Status","Статус")}</th></tr></thead><tbody>{data.alliances.map(row=><tr key={row.id}><td>{row.rank}</td><td>{row.name}</td><td>{Number(row.score||0).toLocaleString()}</td><td>{row.status==="active"?t("Active","Активен"):t("Complete","Приключил")}</td></tr>)}</tbody></table></div>:<p>{t("No alliances have started yet.","Все още няма стартирали алианси.")}</p>}
    <h3>{t("Individual standings","Индивидуално класиране")}</h3>
    {data.players.length?<div style={{overflowX:"auto"}}><table><thead><tr><th>#</th><th>{t("Player","Играч")}</th><th>{t("Alliance","Алианс")}</th><th>{t("Points","Точки")}</th><th>{t("Status","Статус")}</th></tr></thead><tbody>{data.players.slice(0,20).map(row=><tr key={row.userId}><td>{row.rank}</td><td>{row.username}</td><td>{row.alliance}</td><td>{Number(row.score||0).toLocaleString()}</td><td>{row.eliminated?t("Eliminated","Елиминиран"):t("Active","Активен")}</td></tr>)}</tbody></table></div>:<p>{t("No scores yet.","Все още няма точки.")}</p>}
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
  const [showCyberKnight, setShowCyberKnight] = useState(false);
  const [showQuests, setShowQuests] = useState(false);
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

  const api=(process.env.REACT_APP_API_URL || (window.location.hostname==="localhost"?"http://localhost:3001":window.location.origin)).replace(/\/$/,"");
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
      const selected=data.players.find(entry=>entry.username===player.username);
      const own=data.players.find(entry=>String(entry.id)===id);
      if(selected)setPlayerMenu(current=>current===player ? {
        ...selected,
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
    const saved = sessionStorage.getItem("castle");
    if (saved) {
      const castle = JSON.parse(saved);
      setCastleName(`Headquarter (${castle.x}:${castle.y})`);
    }
  }, []);

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
        <button onClick={()=>setShowHospital(true)}>{t("Hospital","Болница")}</button>
        <button onClick={() => (window.location.href = "/#/map")}>{t("Map","Карта")}</button>
        <button onClick={()=>{setSupportTarget(null);setShowAlliance(true);}}>{t("Alliance","Алианс")}</button>
        <button onClick={()=>setShowRankings(true)}>{t("Rankings","Класиране")}</button>
        <button onClick={()=>setMessageRecipient("")}>{t("Messages","Съобщения")}</button>
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
          <button onClick={logout}>{t("Log Out","Изход")}</button>
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

      {showBattleSimulator&&<div className="popup" style={{zIndex:1004}}>
        <div className="popup-header"><span>{t("COMBAT SIMULATOR","БОЕН СИМУЛАТОР")}</span><button className="close-button" onClick={()=>setShowBattleSimulator(false)}>X</button></div>
        <div className="popup-content"><BattleSimulator/></div>
      </div>}
      {showCyberKnight && (
        <CyberKnightPanel onClose={() => setShowCyberKnight(false)} />
      )}

      {showHospital&&<div className="popup" style={{zIndex:1006}}><div className="popup-header"><span>{t("HOSPITAL","БОЛНИЦА")}</span><button className="close-button" onClick={()=>setShowHospital(false)}>X</button></div><div className="popup-content"><MothershipHospitalPanel/></div></div>}
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
        <div className="popup-content" style={{display:"flex",flexWrap:"wrap",gap:8,alignContent:"flex-start"}}>
          <button onClick={showPlayerBase}>{t("View Base","Виж базата")}</button>
          <button disabled={playerMenu.username===sessionStorage.getItem("username")} onClick={()=>{setMessageRecipient(playerMenu.username);setPlayerMenu(null);}}>{t("Message","Съобщение")}</button>
          <button disabled={!playerMenu.ally || playerMenu.username===sessionStorage.getItem("username")} onClick={()=>{setSupportTarget(playerMenu);setShowRankings(false);setShowAlliance(true);setPlayerMenu(null);}}>{t("Support","Подкрепление")}</button>
          <button disabled title={playerMenu.ally?"You cannot attack an ally.":"Player battles are not enabled yet."}>{t("Attack","Атака")}</button>
          <button disabled={!playerMenu.canInvite || inviting} onClick={invitePlayer}>{t("Invite to Alliance","Покани в алианса")}</button>
          {playerNotice&&<p role="status">{localLabel(playerNotice)}</p>}
        </div>
      </div>}

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
