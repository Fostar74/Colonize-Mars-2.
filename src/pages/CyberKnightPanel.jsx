import React, { useState, useEffect } from "react";
import "./CyberKnightPanel.css";
import knightImage from "../images/CYBER-KNIGHT-3.png";
import GameProgressManager from "../utils/gameProgress";

function CyberKnightPanel({ onClose }) {
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [equippedItems, setEquippedItems] = useState({});
  const [rarityTab, setRarityTab] = useState("Epic");
  const [activeModal, setActiveModal] = useState(null);
  const [selectedItem, setSelectedItem] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [imageFailed, setImageFailed] = useState(false);

  const progressManager = new GameProgressManager();

  const gearSlots = ["HELMET", "SHIELD", "BOOTS", "WEAPON", "ARMOR", "GLOVES"];

  const [inventory, setInventory] = useState([]);
  const [craftingPoints, setCraftingPoints] = useState({});
  const itemsForSlot = inventory.filter(item =>
    (item.slot || item.type || "").toUpperCase() === selectedSlot && item.rarity === rarityTab
  );

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
        const saved = sessionStorage.getItem("equippedItems");
        if (saved) {
          setEquippedItems(JSON.parse(saved));
        }
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

      await progressManager.saveEquipment(equippedItems, inventory, craftingPoints);
    } catch (error) {
      console.error("Error saving equipment data:", error);
    }
  };

  useEffect(() => {
    if (!isLoading) {
      saveEquipmentData();
    }
  }, [equippedItems, isLoading]);

  const handleSlotClick = (slotName) => {
    setSelectedSlot(slotName);
    setRarityTab("Epic");
  };

  const handleEquip = (slot, item) => {
    if ((item.slot || item.type || "").toUpperCase() !== slot) return;
    setEquippedItems((prev) => ({
      ...prev,
      [slot]: item,
    }));
    setActiveModal(null);
    setSelectedItem(null);
  };

  const handleCloseAll = () => {
    setSelectedSlot(null);
    setSelectedItem(null);
    setActiveModal(null);
  };

  return (
    <div className="cyber-panel-overlay">
      <div className="cyber-panel">
        <div className="cyber-panel-header">
          <h2>Cyber Knight CONTROL PANEL</h2>
          <button className="close-button" onClick={onClose}>
            X
          </button>
        </div>

        <div className="cyber-panel-body">
          <div className="cyber-image-container">
            {imageFailed ? <div role="img" aria-label="Cyber Knight" style={{display:"flex",alignItems:"center",justifyContent:"center",height:"100%",minHeight:280,color:"#00f0ff",fontSize:22}}>CYBER KNIGHT</div> : <img src={knightImage} alt="Cyber Knight" className="cyber-image" onError={() => setImageFailed(true)} />}
          </div>

          <div className="equipment-slots">
            {gearSlots.map((slot) => (
              <div key={slot} className="gear-slot-wrapper">
                <button className="gear-slot" onClick={() => handleSlotClick(slot)}>
                  {slot}
                </button>
                {equippedItems[slot] && <div className="equipped-label">{equippedItems[slot].name}</div>}
              </div>
            ))}
          </div>
        </div>
      </div>

      {selectedSlot && (
        <div className="equipment-popup">
          <div className="equipment-header">
            <h3>View {selectedSlot} Items</h3>
            <button onClick={handleCloseAll} className="close-button">
              X
            </button>
          </div>

          <div className="rarity-tabs">
            {["Common", "Uncommon", "Rare", "Epic", "Legendary"].map((rarity) => (
              <button
                key={rarity}
                className={rarityTab === rarity ? "active" : ""}
                onClick={() => setRarityTab(rarity)}
              >
                {rarity}
              </button>
            ))}
          </div>

          <div className="item-grid">
            {mockItems
              .filter((item) => item.rarity === rarityTab)
              .map((item, index) => (
                <div key={index} className="item-card">
                  <h4>{item.name}</h4>
                  <p>Item Level: {item.level}</p>
                  <ul>
                    {(item.stats || []).map((s, i) => (
                      <li key={i}>{s}</li>
                    ))}
                  </ul>
                  <div className="item-buttons">
                    <button
                      onClick={() => {
                        setSelectedItem(item);
                        setActiveModal("equip");
                      }}
                    >
                      EQUIP
                    </button>
                    <button
                      onClick={() => {
                        setSelectedItem(item);
                        setActiveModal("dismantle");
                      }}
                    >
                      DISMANTLE
                    </button>
                    <button
                      onClick={() => {
                        setSelectedItem(item);
                        setActiveModal("craft");
                      }}
                    >
                      CRAFT
                    </button>
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}

      {activeModal === "equip" && selectedItem && (
        <div className="modal-window">
          <h3>Equip {selectedItem.name}?</h3>
          <ul>
            {selectedItem.stats.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ul>
          <button onClick={() => handleEquip(selectedSlot, selectedItem)}>Confirm</button>
          <button onClick={handleCloseAll}>Cancel</button>
        </div>
      )}

      {activeModal === "dismantle" && selectedItem && (
        <div className="modal-window">
          <h3>Dismantle {selectedItem.name}?</h3>
          <p>You will receive 5 {selectedSlot} Crafting Points.</p>
          <button onClick={handleCloseAll}>Confirm</button>
          <button onClick={() => setActiveModal(null)}>Cancel</button>
        </div>
      )}

      {activeModal === "craft" && selectedItem && (
        <div className="modal-window">
          <h3>Craft Upgrade</h3>
          <div className="craft-columns">
            <div>
              <h4>Current Item</h4>
              <p>
                {selectedItem.name} - Level {selectedItem.level}
              </p>
              <ul>
                {selectedItem.stats.map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ul>
            </div>
            <div>
              <h4>Upgraded Item</h4>
              <p>
                {selectedItem.name} - Level {selectedItem.level + 1}
              </p>
              <ul>
                {selectedItem.stats.map((s, i) => (
                  <li key={i}>{s.replace(/\d+(\.\d+)?/, (match) => (+match + 3).toFixed(1))}</li>
                ))}
              </ul>
            </div>
          </div>
          <p>Required {selectedSlot} Crafting Points: 66</p>
          <button onClick={handleCloseAll}>Craft</button>
          <button onClick={() => setActiveModal(null)}>Cancel</button>
        </div>
      )}
    </div>
  );
}

export default CyberKnightPanel;
