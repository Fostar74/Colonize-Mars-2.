import React, { useState } from "react";
import gearData from "../data/gear";

function EquipmentSelector({ slot, onClose, onEquip }) {
  const [activeTab, setActiveTab] = useState("common");

  const rarityTabs = [
    { key: "common", label: "Common (Lv 1–10)", color: "#ccc" },
    { key: "uncommon", label: "Uncommon (Lv 11–15)", color: "#4caf50" },
    { key: "rare", label: "Rare (Lv 16–20)", color: "#2196f3" },
    { key: "epic", label: "Epic (Lv 21–30)", color: "#9c27b0" },
    { key: "legendary", label: "Legendary (Lv 31–50)", color: "#ff9800" },
  ];

  const filteredGear = gearData.filter(
    (item) =>
      item.slot === slot.toUpperCase() &&
      item.rarity === activeTab.toLowerCase()
  );

  return (
    <div className="equipment-panel-overlay">
      <div className="equipment-panel">
        <div className="equipment-header">
          <span>VIEW {slot.toUpperCase()} ITEMS</span>
          <button className="close-button" onClick={onClose}>
            X
          </button>
        </div>

        <div className="rarity-tabs">
          {rarityTabs.map((tab) => (
            <button
              key={tab.key}
              className={`rarity-tab ${
                activeTab === tab.key ? "active-tab" : ""
              }`}
              onClick={() => setActiveTab(tab.key)}
              style={{
                color: tab.color,
                borderBottom:
                  activeTab === tab.key ? `2px solid ${tab.color}` : "none",
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="rarity-content">
          {filteredGear.length === 0 ? (
            <p style={{ color: "#ccc", marginTop: "30px" }}>
              Currently, you don't have items from the selected type. <br />
              Complete Knight missions to obtain more.
            </p>
          ) : (
            <div className="gear-list">
              {filteredGear.map((item) => (
                <div key={item.id} className="gear-item">
                  <div className="gear-name">{item.name}</div>
                  <div className="gear-bonus">{item.bonus}</div>
                  <div className="gear-level">
                    Requires Lv {item.levelRequirement}
                  </div>
                  <button
                    className="equip-button"
                    onClick={() => onEquip(slot, item)}
                  >
                    Equip
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default EquipmentSelector;
