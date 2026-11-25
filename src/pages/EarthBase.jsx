import React from "react";
import {useLanguage} from "../language";
import "./EarthBase.css";

export const structureTypes = {
  Resources: ["Gold Synthesizer", "Iron Driller", "Solar Array", "Water Extractor"],
  Economy: ["Cargo Depot", "Defense Grid", "Upgrade Lab", "Bio-Lab"],
  Military: ["Training Center", "Combat Simulator", "Vehicle Bay", "Drone Factory"],
  Order: ["Order"]
};
const buildings = [
  ["Gold Synthesizer", "Au", "#edb34b"], ["Iron Driller", "Fe", "#b6bec9"],
  ["Solar Array", "☀", "#7bbeff"], ["Water Extractor", "≈", "#63d8e8"],
  ["Cargo Depot", "▣", "#e1a588"], ["Upgrade Lab", "⌬", "#cbabf5"],
  ["Bio-Lab", "✚", "#8bdd91"], ["Training Center", "⋀", "#f4b87e"],
  ["Combat Simulator", "◎", "#dca8ed"], ["Vehicle Bay", "▰", "#a1c29e"],
  ["Drone Factory", "◇", "#91c2e5"], ["Order", "✦", "#d6ce85"],
];
const tier = level => Math.min(5, Math.ceil(level / 6));

export default function EarthBase({progress, hospitalEntries=[], onBuilding, onHospital}) {
  const {t,label}=useLanguage();
  const levels=progress?.structures||{};
  const defense=Number(levels["Defense Grid"]||0);
  const active=name=>{
    if (progress?.buildingJob?.name===name) return t("Under construction","В строеж");
    if (name==="Training Center" && Object.values(progress?.trainingQueues||{}).some(queue=>queue.length)) return t("Training","Обучение");
    if (name==="Upgrade Lab" && progress?.upgradeJobs?.some(job=>job?.endsAt)) return t("Upgrading troops","Подобряване на войски");
    return "";
  };
  return <main className="earth-base">
    <header><h1>{t("Earth Base","База на Земята")}</h1><span>{t("Mars Expedition · Preparations","Експедиция до Марс · Подготовка")}</span></header>
    {!progress ? <p role="status">{t("Loading your base…","Зареждане на твоята база…")}</p> : <>
      <div className="earth-perimeter" data-tier={tier(defense)} style={{"--tier":tier(defense)}}>
        <button className="earth-defense" onClick={()=>onBuilding("Defense Grid")}>
          {t("Defensive Network","Отбранителна мрежа")} · {t("Level","Ниво")} {defense} {active("Defense Grid")}
        </button>
        <div className="earth-buildings" aria-label={t("Base buildings","Сгради в базата")}>
          {buildings.map(([name,mark,color])=>{
            const level=Number(levels[name]||0), status=active(name);
            return <button key={name} type="button" className="earth-building" data-tier={tier(level)}
              style={{"--building-color":color,"--tier":tier(level)}} onClick={()=>onBuilding(name)}>
              <span className="earth-model" aria-hidden="true">{mark}</span>
              <strong>{label(name)}</strong>
              <span>{t("Level","Ниво")} {level}{status && " · "+status}</span>
            </button>;
          })}
        </div>
      </div>
      {hospitalEntries.some(entry=>entry.status==="healing") && <button className="earth-hospital" onClick={onHospital}>{t("Field Hospital · Treatment in progress","Полева болница · Лечението продължава")}</button>}
    </>}
  </main>;
}
