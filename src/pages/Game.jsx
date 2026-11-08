import React, { useEffect, useState } from "react";
import StructurePanel from "./StructurePanel";
import CyberKnightPanel from "./CyberKnightPanel";
import Quests from "./Quests";
import "./Game.css";

function Game() {
  const [showPopup, setShowPopup] = useState(false);
  const [activeTab, setActiveTab] = useState("structures");
  const [castleName, setCastleName] = useState("Headquarter");
  const [resources, setResources] = useState(null);
  const [optionsVisible, setOptionsVisible] = useState(false);
  const [showCyberKnight, setShowCyberKnight] = useState(false);
  const [showQuests, setShowQuests] = useState(false);

  useEffect(() => {
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
        backgroundImage: 'url("/images/mars-background.jpg")',
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
          <div className="popup-tabs">
            <button onClick={() => showTab("structures")}>Structures</button>
            <button onClick={() => showTab("units")}>Units</button>
            <button onClick={() => showTab("upgrades")}>Upgrades</button>
          </div>
          <div className="popup-content">
            {activeTab === "structures" && (
              <div className="popup-section active">
                <button className="back-button" onClick={() => setShowPopup(false)}>
                  ← Back
                </button>
                <StructurePanel />
              </div>
            )}
            {activeTab === "units" && (
              <div className="popup-section active">
                <button className="back-button" onClick={() => showTab("structures")}>
                  ← Back
                </button>
                <div className="units-tab" style={{ padding: "20px" }}>
                  <h3>Army Units</h3>
                  <p>Manage your troops and their training schedule.</p>
                  <ul>
                    <li>Cyber Guards — Level 1 Infantry Unit</li>
                    <li>Rail Snipers — Long-range tactical shooters</li>
                    <li>Hover Raiders — Fast moving front-line units</li>
                    <li>Orbital Mechs — Heavy assault siege walkers</li>
                  </ul>
                </div>
              </div>
            )}
            {activeTab === "upgrades" && (
              <div className="popup-section active">
                <button className="back-button" onClick={() => showTab("structures")}>
                  ← Back
                </button>
                <div className="upgrades-tab" style={{ padding: "20px" }}>
                  <h3>Upgrade Center</h3>
                  <p>Enhance your units, unlock tech bonuses, and optimize efficiency.</p>
                  <ul>
                    <li>Unlock Tier II Weapons — Boost unit damage by 15%</li>
                    <li>Upgrade Defensive Matrix — Improve wall durability</li>
                    <li>Enhance March Capacity — +20% troop size</li>
                  </ul>
                </div>
              </div>
            )}
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
