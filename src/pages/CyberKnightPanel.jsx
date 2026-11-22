import { useLanguage } from "../language";
import React, { useState, useEffect } from "react";
import "./CyberKnightPanel.css";
import craftingCosts from "../shared/craftingCosts";
import {rarityUnlockLevel,protocolLabels} from "../shared/cyberKnightEquipment";
import GameProgressManager from "../utils/gameProgress";
import cyberKnightImage from "../images/cyber-knight-expanded.jpg";

function PlasmaGearIcon({slot}) {
  const common={fill:"none",stroke:"currentColor",strokeWidth:2.4,strokeLinecap:"round",strokeLinejoin:"round"};
  const shapes={
    HELMET:<><path d="M14 31a18 18 0 0 1 36 0v8H14z"/><path d="M18 29h28l-5 8H23z"/><path d="M20 43h24M25 15l7-5 7 5"/></>,
    ARMOR:<><path d="m19 15 13-6 13 6 7 6-5 11-4 23H19l-4-23-5-11z"/><path d="m23 17 9 7 9-7M22 37h20M25 47h14"/><path d="m32 25 4 5-4 5-4-5z"/></>,
    BOOTS:<><path d="M12 13h13v19l7 5v8H12zM39 13h13v19l7 5v8H39z"/><path d="M14 51h18M41 51h17M17 19h7M44 19h7"/><path d="m17 45-3 6m32-6-3 6"/></>,
    WEAPON:<><path d="m14 47 22-22 7 7-22 22z"/><path d="m31 24 8-8 11 11-8 8M40 15l5-5 10 10-5 5"/><path d="m13 48-4 9 9-4"/><path d="M47 30h10"/></>,
    SHIELD:<><path d="M32 9 51 17v14c0 12-8 21-19 27-11-6-19-15-19-27V17z"/><path d="m19 21 13-5 13 5v10c0 8-5 14-13 19-8-5-13-11-13-19z"/><path d="M25 29h14M32 22v20"/></>,
    GLOVES:<><path d="M19 53 14 37l2-5 5 4-2-17a3 3 0 0 1 6 0l2 12-1-19a3 3 0 0 1 6 0l1 18 1-14a3 3 0 0 1 6 0l-1 16 3-9a3 3 0 0 1 6 2l-4 20-8 10z"/><path d="m25 39 13 2M28 47h16"/></>
  };
  return <svg className="plasma-gear-icon" viewBox="0 0 64 64" aria-hidden="true" style={common}>{shapes[slot]}</svg>;
}

function CyberKnightPanel({ onClose }) {
  const { t , label: localLabel, language} = useLanguage();
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [equippedItems, setEquippedItems] = useState({});
  const [rarityTab, setRarityTab] = useState("Common");
  const [activeModal, setActiveModal] = useState(null);
  const [selectedItem, setSelectedItem] = useState(null);
  const [crafting, setCrafting] = useState(false);
  const [craftMessage, setCraftMessage] = useState("");
  const [equipmentNotice, setEquipmentNotice] = useState("");

  const progressManager = new GameProgressManager();

  const gearColumns = [
    {side:"benefit",title:"Your bonuses",titleBg:"Твоите бонуси",slots:["HELMET","ARMOR","BOOTS"]},
    {side:"debuff",title:"Enemy reductions",titleBg:"Отслабване на противника",slots:["WEAPON","SHIELD","GLOVES"]}
  ];
  const rarityClasses={Common:"common",Uncommon:"uncommon",Rare:"rare",Epic:"epic",Legendary:"legendary"};
  const effectText=effect=>{
    const target=protocolLabels[effect.target]?.[language==="bg"?1:0]||localLabel(effect.target),value=Number(effect.value)||0;
    if(effect.kind==="unitAttack")return t("Attack of","Атака на")+" "+target+": +"+value+"%";
    if(effect.kind==="unitHealth")return t("Health of","Живот на")+" "+target+": +"+value+"%";
    if(effect.kind==="enemyUnitAttack")return t("Enemy attack of","Атака на противниковия")+" "+target+": −"+value+"%";
    if(effect.kind==="enemyUnitHealth")return t("Enemy health of","Живот на противниковия")+" "+target+": −"+value+"%";
    if(effect.kind==="protocolBoost")return t("Combat protocol","Боен протокол")+" "+target+": +"+value+"%";
    if(effect.kind==="enemyProtocol")return t("Opponent combat protocol","Противников боен протокол")+" "+target+": −"+value+"%";
    return effect.target+": "+value+"%";
  };
  const itemEffects=item=>(item?.effects||[]).length?item.effects.map(effectText):(item?.stats||[]);

  const [inventory, setInventory] = useState([]);
  const [craftingPoints, setCraftingPoints] = useState({});
  const [knightLevel, setKnightLevel] = useState(1);
  const [prestige, setPrestige] = useState(0);
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
        setKnightLevel(Number(equipmentData.knightLevel)||1);
        setPrestige(Number(equipmentData.prestige)||0);
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
    if(Number(item.level??item.levelRequirement??1)>knightLevel){setEquipmentNotice(t("Item level exceeds Cyber Knight level.","Нивото на предмета надвишава нивото на Cyber Knight."));return;}
    const nextEquipped = {...equippedItems,[slot]:item};
    progressManager.setUserInfo(sessionStorage.getItem("userId"), sessionStorage.getItem("username"));
    const saved=await progressManager.saveEquipment(nextEquipped);
    if(!saved){alert("Could not save equipment. Please retry.");return;}
    setEquippedItems(nextEquipped);
    setEquipmentNotice(t("Equipped","Екипирано")+": "+localLabel(slot)+" · "+item.rarity+" · Lv "+(Number(item.level)||0));
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
          <h2>{t("Cyber Knight CONTROL PANEL","УПРАВЛЕНИЕ НА CYBER KNIGHT")}</h2>
          <button className="close-button" onClick={onClose}>
            X
          </button>
        </div>

        <div className="cyber-panel-body">
          <div className="equipment-status"><strong>{t("Cyber Knight level:","Ниво на Cyber Knight:")} {knightLevel}/50 <span>·</span> {t("Prestige:","Престиж:")} {knightLevel>=50?20:prestige%20}/20 {knightLevel<50&&<>{t("to level","до ниво")} {knightLevel+1}</>}</strong><div>{t("Gear inventory:","Екипировка:")} {inventory.length} <span>·</span> {t("Equipped:","Облечени:")} {Object.values(equippedItems).filter(Boolean).length}/6</div><div>{t("Unlocks: Uncommon 10 · Rare 20 · Epic 30 · Legendary 40","Отключване: необикновена 10 · рядка 20 · епична 30 · легендарна 40")}</div>{equipmentNotice&&<div className="equipment-confirmation" role="status">✓ {equipmentNotice}</div>}</div>
          <div className="equipment-layout">
            {gearColumns.map(column=><section key={column.side} className={`equipment-column ${column.side}`}>
              <h3>{t(column.title,column.titleBg)}</h3>
              {column.slots.map(slot=>{const currentItem=equippedItems[slot],slotCount=inventory.filter(item=>(item.slot||item.type||"").toUpperCase()===slot).length;return <button key={slot} className={`gear-slot ${currentItem?"is-equipped":""}`} onClick={()=>handleSlotClick(slot)} aria-pressed={!!currentItem}>
                <span className="gear-icon-frame"><PlasmaGearIcon slot={slot}/></span>
                <span className="gear-slot-text"><strong>{localLabel(slot)}</strong><small>{currentItem?t("Equipped","Екипирано")+" · "+currentItem.rarity+" · Lv "+(Number(currentItem.level)||0):t("Not equipped","Не е екипирано")}</small><small>{slotCount} {t("in inventory","в инвентара")}</small></span>
                {currentItem&&<span className={`equipped-rarity rarity-${rarityClasses[currentItem.rarity]||"common"}`}>✓</span>}
              </button>})}
            </section>)} 
            <div className="cyber-image-container"><img className="cyber-image" src={cyberKnightImage} alt="Cyber Knight in Martian armor" /></div>
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
                className={`rarity-${rarityClasses[rarity]} ${rarityTab === rarity ? "active" : ""}`}
                onClick={() => setRarityTab(rarity)}
              >
                {localLabel(rarity)}
              </button>
            ))}
          </div>

          <div className="item-grid">
            {!itemsForSlot.length&&<p style={{color:"#d6e7f0"}}>{t("No","Няма")} {rarityTab} {t("items for","предмети за")} {localLabel(selectedSlot)}{t(". Try another rarity or check Gear Inventory above.",". Пробвай друга рядкост или виж инвентара по-горе.")}</p>}
            {itemsForSlot.map((item, index) => (
                <div key={item.id||index} className={`item-card rarity-${rarityClasses[item.rarity]||"common"}`}>
                  <div className="item-card-title"><span className="gear-icon-frame"><PlasmaGearIcon slot={item.slot||item.type}/></span><div><span className="rarity-label">{localLabel(item.rarity)}</span><h4>{localLabel(item.slot||item.type)} · {t("Plasma gear","Плазмена екипировка")}</h4></div></div>
                  <p>{t("Item Level:","Ниво на предмета:")} {item.level}</p>
                  <p>{"★".repeat(Number(item.stars)||({Common:1,Uncommon:2,Rare:3,Epic:4,Legendary:5}[item.rarity]||1))} · {t("Bonus slots:","Слотове за бонуси:")} {item.bonusSlots||1}</p>
                  <p>{t("Rarity bonus:","Бонус според рядкостта:")} {item.rarityBonus??({Common:1,Uncommon:10,Rare:20,Epic:30,Legendary:40}[item.rarity]||1)}% · {t("Maximum:","Максимум:")} {item.maximumBonus||50}%</p>
                  {knightLevel<(rarityUnlockLevel[item.rarity]||1)&&<p role="status">{t("Unlocks at Cyber Knight level","Отключва се на ниво на Киберрицаря")} {rarityUnlockLevel[item.rarity]}</p>}
                  {Number(item.level??item.levelRequirement??1)>knightLevel&&<p role="status">{t("Requires Cyber Knight level","Изисква Cyber Knight ниво")} {Number(item.level??item.levelRequirement??1)}</p>}
                  <ul>
                    {itemEffects(item).map((s, i) => (
                      <li key={i}>{s}</li>
                    ))}
                  </ul>
                  <div className="item-buttons">
                    <button
                      disabled={knightLevel<(rarityUnlockLevel[item.rarity]||1)||Number(item.level??item.levelRequirement??1)>knightLevel||equippedItems[selectedSlot]?.id===item.id}
                      onClick={() => {
                        setSelectedItem(item);
                        setActiveModal("equip");
                      }}
                    >
                      {equippedItems[selectedSlot]?.id===item.id?t("EQUIPPED","ОБЛЕЧЕНО"):t("EQUIP","ЕКИПИРАЙ")}
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
            {itemEffects(selectedItem).map((s, i) => (
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
                {itemEffects(selectedItem).map((s, i) => (
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
                {itemEffects(selectedItem).map((s, i) => (
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
