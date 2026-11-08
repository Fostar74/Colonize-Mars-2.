import React, { useEffect, useState } from "react";
import StructurePanel from "./StructurePanel";
import CyberKnightPanel from "./CyberKnightPanel";
import Quests from "./Quests";
import "./Game.css";
import marsBackground from "../images/mars-background.jpg";

function Game() {
  const [showPopup, setShowPopup] = useState(false);
  const [activeTab, setActiveTab] = useState("structures");
  const [castleName, setCastleName] = useState("Headquarter");
  const [resources, setResources] = useState(null);
  const [optionsVisible, setOptionsVisible] = useState(false);
  const [showCyberKnight, setShowCyberKnight] = useState(false);
  const [showQuests, setShowQuests] = useState(false);
  const onProgressChange = data => setResources(data.resources);

  useEffect(() => {
    const openBase = () => { setShowQuests(false); setActiveTab("structures"); setShowPopup(true); };
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

  const logout = () => {
    sessionStorage.clear();
    window.location.href = "/";
  };

  const showTab = (tabId) => {
    setActiveTab(tabId);
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
