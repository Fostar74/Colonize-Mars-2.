import { useLanguage } from "../language";
import React, { useState, useEffect } from "react";
import "./CyberKnightPanel.css";
import knightImage from "../images/CYBER-KNIGHT-3.png";
import craftingCosts from "../shared/craftingCosts";
import GameProgressManager from "../utils/gameProgress";

function CyberKnightPanel({ onClose }) {
  const { t , label: localLabel} = useLanguage();
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
          <h2>{t("Cyber Knight CONTROL PANEL","УПРАВЛЕНИЕ НА КИБЕРРИЦАРЯ")}</h2>
          <button className="close-button" onClick={onClose}>
            X
          </button>
        </div>

        <div className="cyber-panel-body">
          <div className="cyber-image-container">
            {imageFailed ? <div role="img" aria-label="Cyber Knight" style={{display:"flex",alignItems:"center",justifyContent:"center",height:"100%",minHeight:280,color:"#00f0ff",fontSize:22}}>{t("CYBER KNIGHT","КИБЕРРИЦАР")}</div> : <img src={knightImage} alt="Cyber Knight" className="cyber-image" onError={() => setImageFailed(true)} />}
          </div>

          <div style={{padding:"10px 14px",color:"#e7f8ff",background:"#142e43",borderRadius:8,marginBottom:12}}><strong>{t("Gear Inventory:","Инвентар за екипировка:")} {inventory.length} {t("item(s)","предмета")}</strong><div style={{fontSize:12}}>{t("Click a gear slot below. Wheel prizes are Common rarity unless otherwise stated.","Избери слот. Наградите от кацане са обикновени, освен ако е посочено друго.")}</div>{inventory.slice(-5).map(item=><div key={item.id||item.name} style={{fontSize:12}}>{item.name} · {item.slot} · {item.rarity}</div>)}</div>
          <div className="equipment-slots">
            {gearSlots.map((slot) => (
              <div key={slot} className="gear-slot-wrapper">
                <button className="gear-slot" onClick={() => handleSlotClick(slot)}>
                  {localLabel(slot)}
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
            <h3>{t("View","Виж")} {localLabel(selectedSlot)} {t("Items","Предмети")}</h3>
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
                {localLabel(rarity)}
              </button>
            ))}
          </div>

          <div className="item-grid">
            {!itemsForSlot.length&&<p style={{color:"#d6e7f0"}}>{t("No","Няма")} {rarityTab} {t("items for","предмети за")} {localLabel(selectedSlot)}{t(". Try another rarity or check Gear Inventory above.",". Пробвай друга рядкост или виж инвентара по-горе.")}</p>}
            {itemsForSlot.map((item, index) => (
                <div key={index} className="item-card">
                  <h4>{item.name}</h4>
                  <p>{t("Item Level:","Ниво на предмета:")} {item.level}</p>
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
                      {t("EQUIP","ЕКИПИРАЙ")}
                    </button>
                    <button
                      onClick={() => {
                        setSelectedItem(item);
                        setActiveModal("dismantle");
                      }}
                    >
                      {t("DISMANTLE","РАЗГЛОБИ")}
                    </button>
                    <button
                      onClick={() => {
                        setSelectedItem(item);
                        setCraftMessage("");
                        setActiveModal("craft");
                      }}
                    >
                      {t("CRAFT","ИЗКОВИ")}
                    </button>
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}

      {activeModal === "equip" && selectedItem && (
        <div className="modal-window">
          <h3>{t("Equip","Екипирай")} {selectedItem.name}?</h3>
          <ul>
            {(selectedItem.stats || []).map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ul>
          <button onClick={() => handleEquip(selectedSlot, selectedItem)}>{t("Confirm","Потвърди")}</button>
          <button onClick={handleCloseAll}>{t("Cancel","Отказ")}</button>
        </div>
      )}

      {activeModal === "dismantle" && selectedItem && (
        <div className="modal-window">
          <h3>{t("Dismantle","Разглоби")} {selectedItem.name}?</h3>
          <p>{t("You will receive 5","Ще получиш 5")} {localLabel(selectedSlot)} {t("Crafting Points.","точки за изковаване.")}</p>
          <button onClick={handleCloseAll}>{t("Confirm","Потвърди")}</button>
          <button onClick={() => setActiveModal(null)}>{t("Cancel","Отказ")}</button>
        </div>
      )}

      {craftMessage && <p role="status">{craftMessage}</p>}

      {activeModal === "craft" && selectedItem && (
        <div className="modal-window">
          <h3>{t("Craft Upgrade","Подобри предмет")}</h3>
          <div className="craft-columns">
            <div>
              <h4>{t("Current Item","Текущ предмет")}</h4>
              <p>
                {selectedItem.name} {t("- Level","– Ниво")} {itemLevel}
              </p>
              <ul>
                {(selectedItem.stats || []).map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ul>
            </div>
            <div>
              <h4>{t("Upgraded Item","Подобрен предмет")}</h4>
              <p>
                {selectedItem.name} {t("- Level","– Ниво")} {itemLevel + 1}
              </p>
              <ul>
                {(selectedItem.stats || []).map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ul>
            </div>
          </div>
          <p>{t("Cost:","Цена:")} {craftCost ?? "Unavailable"} {t("Crafting Points","точки за изковаване")}</p>
          <p>{localLabel(selectedSlot)}: {slotPoints} {t("· Universal Forge:","· Универсални точки:")} {universalPoints}</p>
          <button disabled={crafting || itemLevel >= 50 || !craftCost || slotPoints + universalPoints < craftCost} onClick={handleCraft}>
            {itemLevel >= 50 ? localLabel("Max level") : crafting ? localLabel("Crafting…") : localLabel("Craft")}
          </button>
          <button onClick={() => setActiveModal(null)}>{t("Cancel","Отказ")}</button>
        </div>
      )}
    </div>
  );
}

export default CyberKnightPanel;
