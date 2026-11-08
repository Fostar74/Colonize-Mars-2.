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

function StructurePanel() {
  const [activeTab, setActiveTab] = useState("structures");
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

  const renderStructures = () => (
    <>
      <h2 style={{ textAlign: "center" }}>Structures</h2>
      {Object.entries(structureTypes).map(([section, buildings]) => (
        <div key={section}>
          <h3>{section}</h3>
          <div className="building-grid">
            {buildings.map((name) => (
              <div key={name} className="building">
                <h4>{name}</h4>
                <p style={{ opacity: 0.6 }}>Upgrade system coming soon</p>
              </div>
            ))}
          </div>
        </div>
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
      <div className="subtab-buttons">
        <button onClick={() => setActiveTab("structures")}>Structures</button>
        <button onClick={() => setActiveTab("units")}>Units</button>
        <button onClick={() => setActiveTab("upgrades")}>Upgrades</button>
      </div>
      <div className="building-tab">
        {activeTab === "structures" && renderStructures()}
        {activeTab === "units" && renderUnits()}
        {activeTab === "upgrades" && renderUpgrades()}
      </div>
    </div>
  );
}

export default StructurePanel;
