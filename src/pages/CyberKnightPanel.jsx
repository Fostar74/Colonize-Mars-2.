import React, { useState, useEffect } from "react";
import "./CyberKnightPanel.css";
import knightImage from "../images/CYBER-KNIGHT-3.png";
import craftingCosts from "../shared/craftingCosts";
import GameProgressManager from "../utils/gameProgress";

function CyberKnightPanel({ onClose }) {
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [equippedItems, setEquippedItems] = useState({});
  const [rarityTab, setRarityTab] = useState("Common");
  const [activeModal, setActiveModal] = useState(null);
  const [selectedItem, setSelectedItem] = useState(null);
  const [crafting, setCrafting] = useState(false);
  const [craftMessage, setCraftMessage] = useState("");
  const [imageFailed, setImageFailed] = useState(false);

  const progressManager = new GameProgressManager();

  const gearSlots = ["HELMET", "SHIELD", "BOOTS", "WEAPON", "ARMOR", "GLOVES"];

  const [inventory, setInventory] = useState([]);
  const [craftingPoints, setCraftingPoints] = useState({});
  const itemsForSlot = inventory.filter(item =>
    (item.slot || item.type || "").toUpperCase() === selectedSlot && String(item.rarity).toLowerCase() === rarityTab.toLowerCase()
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
    }
  };

  const handleSlotClick = (slotName) => {
    setSelectedSlot(slotName);
    setRarityTab("Common");
  };

  const handleEquip = async (slot, item) => {
    if ((item.slot || item.type || "").toUpperCase() !== slot) return;
    const nextEquipped = {...equippedItems,[slot]:item};
    progressManager.setUserInfo(sessionStorage.getItem("userId"), sessionStorage.getItem("username"));
    const saved=await progressManager.saveEquipment(nextEquipped);
    if(!saved){alert("Could not save equipment. Please retry.");return;}
    setEquippedItems(nextEquipped);
    setActiveModal(null);
    setSelectedItem(null);
  };

  const itemLevel = Number(selectedItem?.level ?? selectedItem?.levelRequirement ?? 0);
  const craftCost = craftingCosts[String(selectedItem?.rarity).toLowerCase()];
  const slotPoints = Number(craftingPoints[selectedSlot]) || 0;
  const universalPoints = Number(craftingPoints.Universal) || 0;

  const handleCraft = async () => {
    setCrafting(true);
    setCraftMessage("");
    try {
      progressManager.setUserInfo(sessionStorage.getItem("userId"), sessionStorage.getItem("username"));
      const equipment = await progressManager.craftEquipment(selectedItem.id, itemLevel);
      setEquippedItems(equipment.equippedItems);
      setInventory(equipment.gearInventory);
      setCraftingPoints(equipment.craftingPoints);
      setActiveModal(null);
      setCraftMessage(`${selectedItem.name} upgraded to level ${itemLevel + 1}.`);
      window.dispatchEvent(new Event("game-progress-updated"));
    } catch (error) {
      setCraftMessage(error.message);
    } finally {
      setCrafting(false);
    }
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

          <div style={{padding:"10px 14px",color:"#e7f8ff",background:"#142e43",borderRadius:8,marginBottom:12}}><strong>Gear Inventory: {inventory.length} item(s)</strong><div style={{fontSize:12}}>Click a gear slot below. Wheel prizes are Common rarity unless otherwise stated.</div>{inventory.slice(-5).map(item=><div key={item.id||item.name} style={{fontSize:12}}>{item.name} · {item.slot} · {item.rarity}</div>)}</div>
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
            {!itemsForSlot.length&&<p style={{color:"#d6e7f0"}}>No {rarityTab} items for {selectedSlot}. Try another rarity or check Gear Inventory above.</p>}
            {itemsForSlot.map((item, index) => (
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
                        setCraftMessage("");
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
            {(selectedItem.stats || []).map((s, i) => (
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

      {craftMessage && <p role="status">{craftMessage}</p>}

      {activeModal === "craft" && selectedItem && (
        <div className="modal-window">
          <h3>Craft Upgrade</h3>
          <div className="craft-columns">
            <div>
              <h4>Current Item</h4>
              <p>
                {selectedItem.name} - Level {itemLevel}
              </p>
              <ul>
                {(selectedItem.stats || []).map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ul>
            </div>
            <div>
              <h4>Upgraded Item</h4>
              <p>
                {selectedItem.name} - Level {itemLevel + 1}
              </p>
              <ul>
                {(selectedItem.stats || []).map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ul>
            </div>
          </div>
          <p>Cost: {craftCost ?? "Unavailable"} Crafting Points</p>
          <p>{selectedSlot}: {slotPoints} · Universal Forge: {universalPoints}</p>
          <button disabled={crafting || itemLevel >= 50 || !craftCost || slotPoints + universalPoints < craftCost} onClick={handleCraft}>
            {itemLevel >= 50 ? "Max level" : crafting ? "Crafting…" : "Craft"}
          </button>
          <button onClick={() => setActiveModal(null)}>Cancel</button>
        </div>
      )}
    </div>
  );
}

export default CyberKnightPanel;
