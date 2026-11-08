// Final StructurePanel.jsx with internal tab buttons restored
import React, { useEffect, useState } from "react";
import "./StructurePanel.css";
import goldIcon from "../images/gold.png";
import ironIcon from "../images/iron.png";
import waterIcon from "../images/water.png";
import solarIcon from "../images/solar.png";

const structureTypes = {
  Resources: ["Gold Synthesizer", "Iron Driller", "Solar Array", "Water Extractor"],
  Economy: ["Cargo Depot", "Defense Grid", "Upgrade Lab", "Bio-Lab"],
  Military: ["Training Center", "Combat Simulator", "Vehicle Bay", "Drone Factory"]
};

const unitCategories = {
  Ground: ["Explorer Trooper", "Exo-Soldier", "Plasma Bladesman", "Nano Shieldman"],
  Ranged: ["Railgunner", "Pulse Sniper", "Drone Operator"],
  Mobile: ["Rover Scout", "Hoverbike Rider", "Mech Walker", "Hover Drone Rider"],
  "Heavy Systems": ["Demolition Bot", "Missile Carrier", "Particle Blaster", "Orbital Strike Beacon"],
  Elite: ["Martian Noble", "AI General", "Gene Warrior"]
};

function StructurePanel({ showNavigation = true, onProgressChange }) {
  const [activeTab, setActiveTab] = useState("structures");
  const [structures, setStructures] = useState(() => { try { return JSON.parse(sessionStorage.getItem("structures") || "{}"); } catch { return {}; } });
  const [resources, setResources] = useState(() => { try { return JSON.parse(sessionStorage.getItem("resources") || "{}"); } catch { return {}; } });
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const upgrade = async name => {
    setBusy(name);
    setError("");
    try {
      const base = (process.env.REACT_APP_API_URL || (window.location.hostname === "localhost" ? "http://localhost:3001" : window.location.origin)).replace(/\\/$/, "");
      const response = await fetch(base + "/upgrade-building", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer " + sessionStorage.getItem("authToken") },
        body: JSON.stringify({ userId: sessionStorage.getItem("userId"), name })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Upgrade failed");
      setStructures(data.structures);
      setResources(data.resources);
      sessionStorage.setItem("structures", JSON.stringify(data.structures));
      sessionStorage.setItem("resources", JSON.stringify(data.resources));
      if (onProgressChange) onProgressChange(data);
    } catch (e) { setError(e.message); }
    finally { setBusy(""); }
  };
  const [unitTab, setUnitTab] = useState("Ground");
  const [upgradeSlot, setUpgradeSlot] = useState(null);
  const [upgradeCategory, setUpgradeCategory] = useState("Ground");
  const [trainAmounts, setTrainAmounts] = useState({});

  const unitCost = {
    Gold: 100,
    Iron: 80,
    Water: 60,
    Solar: 40
  };
  const baseTrainTime = 30;

  const formatTime = (seconds) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  const calculateMaxTrainable = () => {
    const limits = Object.entries(unitCost).map(([res, cost]) => 999);
    return Math.max(0, Math.min(...limits));
  };

  const handlePresetClick = (unit, fraction) => {
    const max = calculateMaxTrainable();
    setTrainAmounts((prev) => ({
      ...prev,
      [unit]: Math.floor(max * fraction)
    }));
  };

  const [expandedSections, setExpandedSections] = useState({ Resources: true });
  const buildingImages = { "Gold Synthesizer": goldIcon, "Iron Driller": ironIcon, "Solar Array": solarIcon, "Water Extractor": waterIcon };
  const renderStructures = () => (
    <>
      <h2 style={{ textAlign: "center" }}>Structures</h2>
      {error && <p role="alert" style={{color:"#ff7777"}}>{error}</p>}
      <p style={{textAlign:"center",opacity:.8}}>Build your resource facilities first. Upgrade all four to level 3.</p>
      {Object.entries(structureTypes).map(([section, buildings]) => (
        <section key={section} style={{marginBottom:16}}>
          <button type="button" onClick={() => setExpandedSections(prev => ({...prev,[section]:!prev[section]}))}
            style={{width:"100%",textAlign:"left",padding:"12px 16px",background:"#333",color:"#fff",border:"1px solid #555",cursor:"pointer",fontWeight:"bold"}}>
            {expandedSections[section] ? "▾" : "▸"} {section} {section === "Resources" ? "— start here" : ""}
          </button>
          {expandedSections[section] && <div className="building-grid">
            {buildings.map(name => {
              const level = Number(structures[name] || 0);
              const next = level + 1;
              const cost = { Gold:100*next, Iron:80*next, Water:60*next, Solar:40*next };
              const affordable = Object.entries(cost).every(([key,amount]) => Number(resources[key] || 0) >= amount);
              return <div key={name} className="building" style={{padding:14}}>
                {buildingImages[name] && <img src={buildingImages[name]} alt="" style={{width:44,height:44,objectFit:"contain"}} />}
                <h4 style={{margin:"6px 0"}}>{name}</h4>
                <div>Level {level} / 20</div>
                <p style={{fontSize:13,opacity:.85,margin:"8px 0"}}>Next: {cost.Gold} Gold · {cost.Iron} Iron · {cost.Water} Water · {cost.Solar} Solar</p>
                <button className="upgrade-btn" disabled={!!busy || level >= 20 || !affordable} onClick={() => upgrade(name)}>
                  {busy === name ? "Building..." : level >= 20 ? "Max level" : !affordable ? "Not enough resources" : level === 0 ? "Build" : "Upgrade"}
                </button>
              </div>;
            })}
          </div>}
        </section>
      ))}
    </>
  );

  const renderUnits = () => (
    <>
      <h2 style={{ textAlign: "center" }}>Army Units</h2>
      <div className="subtab-buttons">
        {Object.keys(unitCategories).map((cat) => (
          <button key={cat} onClick={() => setUnitTab(cat)}>{cat}</button>
        ))}
      </div>
      <div className="unit-grid">
        {unitCategories[unitTab].map((unit) => {
          const qty = Number(trainAmounts[unit]) || 0;
          const totalTime = baseTrainTime * qty;
          const timeDisplay = formatTime(totalTime);

          return (
            <div key={unit} className="unit-card">
              <h4>{unit}</h4>
              <div className="train-slider">
                <button onClick={() => handlePresetClick(unit, 0)}>–</button>
                <button onClick={() => handlePresetClick(unit, 0.25)}>1/4</button>
                <button onClick={() => handlePresetClick(unit, 0.5)}>1/2</button>
                <button onClick={() => handlePresetClick(unit, 0.75)}>3/4</button>
                <button onClick={() => handlePresetClick(unit, 1)}>+ MAX</button>
              </div>
              <p>Train Time: {timeDisplay}</p>
              <div className="resource-row">
                <div className="resource-cost"><img src={goldIcon} alt="Gold" /><span>{unitCost.Gold}</span></div>
                <div className="resource-cost"><img src={ironIcon} alt="Iron" /><span>{unitCost.Iron}</span></div>
                <div className="resource-cost"><img src={waterIcon} alt="Water" /><span>{unitCost.Water}</span></div>
                <div className="resource-cost"><img src={solarIcon} alt="Solar" /><span>{unitCost.Solar}</span></div>
              </div>
              <button style={{ marginTop: 10 }}>Train</button>
            </div>
          );
        })}
      </div>
    </>
  );

  const renderUpgrades = () => (
    <>
      <h2 style={{ textAlign: "center" }}>Upgrade Center</h2>
      <div className="upgrade-slots">
        {[0, 1].map((slot) => (
          <button key={slot} className="upgrade-slot" onClick={() => setUpgradeSlot(slot)}>
            {upgradeSlot === slot ? "Slot Opened" : `Slot ${slot + 1}`}
          </button>
        ))}
      </div>

      {upgradeSlot !== null && (
        <div className="upgrade-window">
          <h4>Choose Unit Category</h4>
          <div className="subtab-buttons">
            {Object.keys(unitCategories).map((cat) => (
              <button key={cat} onClick={() => setUpgradeCategory(cat)}>{cat}</button>
            ))}
          </div>
          <div className="unit-grid">
            {unitCategories[upgradeCategory].map((unit) => (
              <div key={unit} className="unit-card">
                <h4>{unit}</h4>
                <p>Attack Level: 3</p>
                <p>Defense Level: 2</p>
                <button>Upgrade</button>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );

  return (
    <div style={{ color: "white", padding: "10px" }}>
      {showNavigation && <div className="subtab-buttons">
        <button onClick={() => setActiveTab("structures")}>Structures</button>
        <button onClick={() => setActiveTab("units")}>Units</button>
        <button onClick={() => setActiveTab("upgrades")}>Upgrades</button>
      </div>}
      <div className="building-tab">
        {activeTab === "structures" && renderStructures()}
        {activeTab === "units" && renderUnits()}
        {activeTab === "upgrades" && renderUpgrades()}
      </div>
    </div>
  );
}

export default StructurePanel;
