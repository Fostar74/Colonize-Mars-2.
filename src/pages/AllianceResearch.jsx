import React, { useState } from "react";
import { useLanguage } from "../language";
import research from "../shared/allianceResearch";
import gold from "../images/gold.png";
import iron from "../images/iron.png";
import water from "../images/water.png";
import solar from "../images/solar.png";
import "./AllianceResearch.css";

const icons = { Gold: gold, Iron: iron, Water: water, Solar: solar };
const tabs = [["attack", "Attack", "Атака"], ["health", "Defense", "Защита"], ["development", "Development", "Развитие"]];

export default function AllianceResearch({ economy, role, busy, start }) {
  const { t, label } = useLanguage();
  const [branch, setBranch] = useState("attack");
  const bonuses = economy?.bonuses || {};
  const job = economy?.researchJob;
  const canStart = ["Leader", "Co-Leader"].includes(role);
  const rows = branch === "development"
    ? [research.development.slice(0, 1), research.development.slice(1)]
    : research.combatRows.map(names => names.map(unit => ({ unit, kind: research.combatKey(branch, unit) })));

  function title(entry) {
    return entry.unit ? label(entry.unit) : t(entry.en, entry.bg);
  }

  const activeEntry = job && [...research.development, ...research.units.flatMap(unit => ["attack", "health"].map(stat => ({ unit, kind: research.combatKey(stat, unit) })))].find(entry => entry.kind === job.kind);

  return <section className="alliance-research">
    <h3>{t("Alliance Research", "Изследвания на алианса")}</h3>
    <div className="alliance-research-tabs">
      {tabs.map(([key, en, bg]) => <button key={key} type="button" aria-pressed={key === branch} onClick={() => setBranch(key)}>{t(en, bg)}</button>)}
    </div>
    <p>{t("Treasury", "Хазна")} · {Object.keys(icons).map(resource => <span key={resource} className="alliance-research-cost">
      <img src={icons[resource]} alt={label(resource)} /> {economy?.treasury?.[resource] || 0}
    </span>)}</p>
    {job && <p role="status">{t("Research in progress until", "Изследване до")} {new Date(job.endsAt).toLocaleString()} · {(activeEntry ? title(activeEntry) : job.kind)} · {t("Level", "Ниво")} {job.level}</p>}
    <div className="alliance-research-tree" data-branch={branch}>
      {rows.map((entries, index) => <div className="alliance-research-row" key={entries[0].kind}>
        {entries.map((entry, column) => {
          const { kind } = entry;
          const item = research.catalog[kind];
          const level = bonuses[kind] || 0;
          const complete = level >= research.maxLevel;
          const locked = item.parent && (bonuses[item.parent] || 0) < research.prerequisiteLevel;
          const { price, durationMs } = research.nextResearch(item, level);
          const parent = rows[index - 1]?.find(candidate => candidate.kind === item.parent);
          const previous = rows[index - 1];
          const offset = parent ? previous.indexOf(parent) - (previous.length - 1) / 2 - column + (entries.length - 1) / 2 : 0;
          const angle = Math.atan(offset * 11.75 / 2);
          return <article className="alliance-research-node" key={kind} style={parent ? { "--parent-angle": `${-angle}rad` } : undefined}>
            <h4><span aria-hidden="true">{branch === "attack" ? "⚔" : branch === "health" ? "🛡" : "⚙"} </span>{title(entry)}</h4>
            {entry.unit ? ["attack", "health"].map(stat => {
              const statLevel = bonuses[research.combatKey(stat, entry.unit)] || 0;
              return <p key={stat}>{stat === "attack" ? t("Attack", "Атака") : t("Health", "Здраве")} +{statLevel * research.bonusPerLevel}% · {statLevel}/{research.maxLevel}</p>;
            }) : <p>+{level * research.bonusPerLevel}% · {t("Level", "Ниво")} {level}/{research.maxLevel}</p>}
            {locked && parent && <p>🔒 {title(parent)} · {t("Level", "Ниво")} {research.prerequisiteLevel}</p>}
            {!complete && <p className="alliance-research-cost"><img src={icons[item.resource]} alt={label(item.resource)} /> {price} · {durationMs / 3600000} {t("h", "ч.")}</p>}
            {!complete && canStart && <button type="button" disabled={busy || !!job || !!locked || (economy?.treasury?.[item.resource] || 0) < price} onClick={() => start(kind)}>{t("Research", "Изследвай")}</button>}
          </article>;
        })}
      </div>)}
    </div>
  </section>;
}
