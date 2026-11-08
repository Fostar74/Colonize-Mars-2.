import React, { useState, useEffect } from "react";
import gearData from "../data/gear";
import GameProgressManager from "../utils/gameProgress";
import "./CyberKnightPanel.css";

function EquipmentSelector({ slot, onClose, onEquip }) {
  const [activeTab, setActiveTab] = useState("common");
  const [inventory, setInventory] = useState([]);
  const [craftingPoints, setCraftingPoints] = useState({});
  const [equippedItems, setEquippedItems] = useState({});
  const [isLoading, setIsLoading] = useState(true);

  const progressManager = new GameProgressManager();

  const rarityTabs = [
    { key: "common", label: "Common", color: "#ccc" },
    { key: "uncommon", label: "Uncommon", color: "#4caf50" },
    { key: "rare", label: "Rare", color: "#2196f3" },
    { key: "epic", label: "Epic", color: "#9c27b0" },
    { key: "legendary", label: "Legendary", color: "#ff9800" },
  ];

  const craftingCosts = {
    common: 5,
    uncommon: 10,
    rare: 15,
    epic: 20,
    legendary: 30,
  };

  useEffect(() => {
    loadEquipmentData();
  }, []);

  const loadEquipmentData = async () => {
    try {
      const userId = sessionStorage.getItem("userId");
      if (!userId) {
        console.error("User ID not found");
        return;
      }

      progressManager.setUserInfo(userId, sessionStorage.getItem("username"));

      const equipmentData = await progressManager.loadEquipment();
      if (equipmentData) {
        setEquippedItems(equipmentData.equippedItems || {});
        setInventory(equipmentData.gearInventory || []);
        setCraftingPoints(equipmentData.craftingPoints || {});
      } else {
        const savedEquipped = sessionStorage.getItem("equippedItems");
        const savedInventory = sessionStorage.getItem("gearInventory");
        const savedCrafting = sessionStorage.getItem("craftingPoints");

        if (savedEquipped) setEquippedItems(JSON.parse(savedEquipped));
        if (savedInventory) setInventory(JSON.parse(savedInventory));
        if (savedCrafting) setCraftingPoints(JSON.parse(savedCrafting));
      }
    } catch (error) {
      console.error("Error loading equipment data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const saveEquipmentData = async () => {
    try {
      const userId = sessionStorage.getItem("userId");
      if (!userId) return;

      sessionStorage.setItem("equippedItems", JSON.stringify(equippedItems));
      sessionStorage.setItem("gearInventory", JSON.stringify(inventory));
      sessionStorage.setItem("craftingPoints", JSON.stringify(craftingPoints));

      await progressManager.saveEquipment(equippedItems, inventory, craftingPoints);
    } catch (error) {
      console.error("Error saving equipment data:", error);
    }
  };

  useEffect(() => {
    if (!isLoading) {
      saveEquipmentData();
    }
  }, [inventory, craftingPoints, equippedItems, isLoading]);

  const filteredGear = inventory.filter(
    (item) => item.slot === slot.toUpperCase() && item.rarity === activeTab.toLowerCase()
  );

  const handleDismantle = (item) => {
    if (!window.confirm(`Dismantle ${item.name}?`)) return;
    setInventory((prev) => prev.filter((g) => g.id !== item.id));
    const current = craftingPoints[slot] || 0;
    const added = craftingCosts[item.rarity] || 0;
    setCraftingPoints((prev) => ({
      ...prev,
      [slot]: current + added,
    }));
  };

  const handleCraft = (item) => {
    const cost = craftingCosts[item.rarity] || 0;
    const current = craftingPoints[slot] || 0;
    if (item.level >= 50 || current < cost) return;

    const updated = inventory.map((g) => (g.id === item.id ? { ...g, level: g.level + 1 } : g));
    setInventory(updated);
    setCraftingPoints((prev) => ({
      ...prev,
      [slot]: current - cost,
    }));
  };

  const handleEquip = (item) => {
    setEquippedItems((prev) => {
      const updated = { ...prev, [slot]: item };
      return updated;
    });
    onEquip(slot, item);
  };

  const handleUnequip = () => {
    setEquippedItems((prev) => {
      const updated = { ...prev };
      delete updated[slot];
      return updated;
    });
  };

  const equipped = equippedItems[slot]?.id;

  return (
    <div className="equipment-panel-overlay">
      <div className="equipment-panel expanded">
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
              className={`rarity-tab ${activeTab === tab.key ? "active-tab" : ""}`}
              onClick={() => setActiveTab(tab.key)}
              style={{ color: tab.color }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="rarity-content">
          <div className="crafting-points">
            Crafting Points ({slot}): {craftingPoints[slot] || 0}
            {equipped && (
              <button className="unequip-button" onClick={handleUnequip}>
                Unequip
              </button>
            )}
          </div>

          {filteredGear.length === 0 ? (
            <p className="no-items">
              Currently, you don't have items from the selected type. <br />
              Complete Knight missions to obtain more.
            </p>
          ) : (
            <div className="gear-grid">
              {filteredGear.map((item) => (
                <div key={item.id} className={`gear-card ${equipped === item.id ? "equipped" : ""}`}>
                  <div className="gear-name">{item.name}</div>
                  <div className="gear-bonus">{item.bonus}</div>
                  <div className="gear-level">Level {item.level || item.levelRequirement} / 50</div>
                  <div className="gear-actions">
                    <button onClick={() => handleEquip(item)}>Equip</button>
                    <button onClick={() => handleDismantle(item)}>Dismantle</button>
                    <button
                      onClick={() => handleCraft(item)}
                      disabled={
                        (item.level || item.levelRequirement) >= 50 ||
                        (craftingPoints[slot] || 0) < (craftingCosts[item.rarity] || 0)
                      }
                    >
                      Craft
                    </button>
                  </div>
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
