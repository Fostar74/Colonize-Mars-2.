import { useLanguage } from "../language";
import React, { useEffect, useState } from "react";
import StructurePanel from "./StructurePanel";
import CyberKnightPanel from "./CyberKnightPanel";
import Quests from "./Quests";
import AlliancePanel from "./AlliancePanel";
import Rankings from "./Rankings";
import MessagePanel from "./MessagePanel";
import PlayerTalents from "./PlayerTalents";
import Inventory from "./Inventory";
import "./Game.css";
import marsBackground from "../images/mars-background.jpg";

function Game() {
  const {language, choose, t} = useLanguage();
  const [showPopup, setShowPopup] = useState(false);
  const [castleName, setCastleName] = useState("Headquarter");
  const [resources, setResources] = useState(null);
  const [optionsVisible, setOptionsVisible] = useState(false);
  const [showCyberKnight, setShowCyberKnight] = useState(false);
  const [showQuests, setShowQuests] = useState(false);
  const [showAlliance,setShowAlliance]=useState(false);
  const [showRankings,setShowRankings]=useState(false);
  const [showTalents,setShowTalents]=useState(false);
  const [showInventory, setShowInventory] = useState(false);
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

  const onProgressChange = data => setResources(data.resources);

  useEffect(() => {
    const openBase = () => { setShowQuests(false); setShowPopup(true); };
    window.addEventListener("open-base-panel", openBase);
    return () => window.removeEventListener("open-base-panel", openBase);
  }, []);

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
        <button className="castle-name-btn" onClick={() => setShowPopup(true)}>
          {castleName}
        </button>
      </div>

      <div className="bottom-bar">
        <button onClick={() => setShowCyberKnight(true)}>{t("Cyber Knight","Киберрицар")}</button>
        <button onClick={()=>setShowTalents(true)}>{t("Player Talents","Таланти")}</button>
        <button onClick={() => setShowQuests(true)}>{t("Quests","Мисии")}</button>
        <button onClick={() => (window.location.href = "/#/map?campaign=1")}>{t("Campaign","Кампании")}</button>
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

      {showPopup && (
        <div className="popup">
          <div className="popup-header">
            <span>{t("BASE CONTROL PANEL","УПРАВЛЕНИЕ НА БАЗАТА")}</span>
            <button className="close-button" onClick={() => setShowPopup(false)}>
              X
            </button>
          </div>
          <div className="popup-content">
            <AlliancePanel constructionHelpOnly />
            <StructurePanel onProgressChange={onProgressChange} />
          </div>
        </div>
      )}

      {showCyberKnight && (
        <CyberKnightPanel onClose={() => setShowCyberKnight(false)} />
      )}

      {showInventory && (
        <div className="popup">
          <div className="popup-header"><span>{t("INVENTORY","ИНВЕНТАР")}</span><button className="close-button" onClick={() => setShowInventory(false)}>X</button></div>
          <div className="popup-content"><Inventory onClose={() => setShowInventory(false)} /></div>
        </div>
      )}

      {showTalents&&<div className="popup"><div className="popup-header"><span>{t("PLAYER TALENTS","ТАЛАНТИ")}</span><button className="close-button" onClick={()=>setShowTalents(false)}>X</button></div><div className="popup-content"><PlayerTalents/></div></div>}
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
          {playerNotice&&<p role="status">{playerNotice}</p>}
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
            <Quests />
          </div>
        </div>
      )}
    </div>
  );
}

export default Game;
