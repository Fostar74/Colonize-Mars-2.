import React, { useEffect, useState } from "react";
import StructurePanel from "./StructurePanel";
import CyberKnightPanel from "./CyberKnightPanel";
import Quests from "./Quests";
import "./Game.css";
import marsBackground from "../images/mars-background.jpg";

function Game() {
  const [showPopup, setShowPopup] = useState(false);
  const [castleName, setCastleName] = useState("Headquarter");
  const [resources, setResources] = useState(null);
  const [optionsVisible, setOptionsVisible] = useState(false);
  const [showCyberKnight, setShowCyberKnight] = useState(false);
  const [showQuests, setShowQuests] = useState(false);
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
    const base = (process.env.REACT_APP_API_URL || (window.location.hostname === "localhost" ? "http://localhost:3001" : window.location.origin)).replace(/\\/$/, "");
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
        <div>Gold: {resources?.Gold ?? resources?.gold ?? "—"}</div>
        <div>Iron: {resources?.Iron ?? resources?.iron ?? "—"}</div>
        <div>Water: {resources?.Water ?? resources?.water ?? "—"}</div>
        <div>Solar: {resources?.Solar ?? resources?.solar ?? "—"}</div>
      </div>

      <div className="castle-top-bar">
        <button className="castle-name-btn" onClick={() => setShowPopup(true)}>
          {castleName}
        </button>
      </div>

      <div className="bottom-bar">
        <button onClick={() => setShowCyberKnight(true)}>Cyber Knight</button>
        <button onClick={() => setShowQuests(true)}>Quests</button>
        <button>Campaign</button>
        <button onClick={() => (window.location.href = "/#/map")}>Map</button>
        <button>Alliance</button>
        <button>Messages</button>
        <button>Inventory</button>
        <button onClick={() => setOptionsVisible(!optionsVisible)}>Options</button>
      </div>

      {optionsVisible && (
        <div id="optionsMenu">
          <button onClick={logout}>Log Out</button>
        </div>
      )}

      {showPopup && (
        <div className="popup">
          <div className="popup-header">
            <span>BASE CONTROL PANEL</span>
            <button className="close-button" onClick={() => setShowPopup(false)}>
              X
            </button>
          </div>
          <div className="popup-content">
            <StructurePanel onProgressChange={onProgressChange} />
          </div>
        </div>
      )}

      {showCyberKnight && (
        <CyberKnightPanel onClose={() => setShowCyberKnight(false)} />
      )}

      {showQuests && (
        <div className="popup">
          <div className="popup-header">
            <span>QUESTS</span>
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
