import React from "react";
import {useLanguage} from "../language";
import {PlasmaGearIcon} from "../pages/CyberKnightPanel";
import {describeEquipmentEffect} from "./cyberKnightEquipment";
import cyberKnight from "../images/cyber-knight-expanded.jpg";
import "./BattleKnights.css";

const left = ["HELMET","ARMOR","BOOTS"];
const right = ["WEAPON","SHIELD","GLOVES"];
const slots = {
  HELMET:["Helmet","Шлем"], ARMOR:["Armor","Броня"], BOOTS:["Boots","Ботуши"],
  WEAPON:["Weapon","Оръжие"], SHIELD:["Shield","Щит"], GLOVES:["Gloves","Ръкавици"],
};
const names = {cyber:"Cyber Knight",inferno:"Inferno Knight",emperor:"Emperor Inferno Overlord"};

export default function BattleKnights({knights}) {
  const {t,label,language} = useLanguage();
  if (!knights) return <p>{t("Knight equipment was not recorded for this battle.","За тази битка няма запис на екипировката на рицарите.")}</p>;
  const column = (position, knight) => <div className="battle-knight-slots">
    {position.map(slot => {
      const item = knight.equipped?.[slot];
      const slotName = t(...slots[slot]);
      if (!item) return <div className="battle-knight-slot" key={slot}><PlasmaGearIcon slot={slot} /><span>{slotName}</span><small>{t("Empty","Празен слот")}</small></div>;
      const details = [
        label(item.rarity),
        t("Level","Ниво")+" "+(item.level??item.levelRequirement??"—"),
        "★".repeat(Math.min(5,Number(item.stars)||0)),
        ...((item.effects||[]).length ? item.effects.map(effect=>label(describeEquipmentEffect(effect,language))) : (item.stats||[]).map(label)),
      ].filter(Boolean);
      return <details className={"battle-knight-slot rarity-"+String(item.rarity||"").toLowerCase()} key={slot}>
        <summary title={details.join(" · ")}><PlasmaGearIcon slot={slot} /><span>{slotName}</span></summary>
        <small>{details.join(" · ")}</small>
      </details>;
    })}
  </div>;
  return <div className="battle-knights">
    {Object.entries(knights).map(([side,knight]) => knight && <section key={side}>
      <h4>{side==="attacker"?t("Attacking knight","Нападащ рицар"):t("Defending knight","Защитаващ рицар")} · {names[knight.kind]} · {t("Level","Ниво")} {knight.level}</h4>
      <div className="battle-knight-layout">
        {column(left,knight)}
        {knight.kind==="cyber" ? <img src={cyberKnight} alt={names[knight.kind]} /> : <p>{t("Portrait unavailable","Портретът не е наличен")}</p>}
        {column(right,knight)}
      </div>
    </section>)}
  </div>;
}
