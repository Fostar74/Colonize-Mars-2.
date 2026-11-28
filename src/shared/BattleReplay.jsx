import React, {useState} from "react";
import {useLanguage} from "../language";
import {battleEventText} from "./localizedMessages";
import "./BattleKnights.css";

const protocolNames = {
  rangedAttack:"Precision Targeting", allHealth:"Nano Armor Systems",
  infantryAttack:"Combat Augmentation", infantryHealth:"Combat Augmentation",
  desertion:"Neural Command", dodge:"Probability Matrix", revive:"Nano Regeneration",
  mobileAttack:"Assault Mobility", artilleryAttack:"Siege Engineering",
};

export default function BattleReplay({result}) {
  const {t,label,locale} = useLanguage();
  const [selected,setSelected] = useState(0);
  const [analyse,setAnalyse] = useState(false);
  const round = result.traceVersion===1 && result.report?.[selected];
  if (!round?.start) return <p>{t("Round replay was not recorded for this battle.","За тази битка няма запис по рундове.")}</p>;
  const sideName = side => side===0?t("Attackers","Нападатели"):t("Defenders","Защитници");
  const coordinate = group => group?.column==null
    ? t("Row","Ред")+" "+(group?.row??"—")
    : t("Row","Ред")+" "+group.row+" · "+t("Cell","Клетка")+" "+(group.column+1);
  const count = number => Number(number).toLocaleString(locale);
  const groupCell = (side,group) => <div key={group.id}>
    {label(group.unit)}<br />{count(group.count)}
    {round.losses[side][group.id]>0 && <strong className="battle-replay-loss"> (−{count(round.losses[side][group.id])})</strong>}
  </div>;
  const formation = side => {
    const groups = round.start[side].filter(group=>group.count>0);
    const rows = side===0?[4,3,2,1]:[1,2,3,4];
    const unpositioned = groups.filter(group=>group.column==null);
    return <section>
      <h4>{sideName(side)}</h4>
      <div className="battle-replay-scroll">
        <div className="battle-replay-grid">
          {rows.map(row=>Array.from({length:7},(_,column)=><div className="battle-replay-cell" key={row+":"+column} aria-label={coordinate({row,column})}>
            {groups.filter(group=>group.row===row&&group.column===column).map(group=>groupCell(side,group))}
          </div>))}
        </div>
      </div>
      {unpositioned.length>0&&<details><summary>{t("Stacks without recorded columns","Групи без записана колона")}</summary>
        {unpositioned.map(group=><div key={group.id}>{coordinate(group)} {groupCell(side,group)}</div>)}
      </details>}
    </section>;
  };
  const recoveries = round.events.filter(event=>event.restored>0);
  return <section className="battle-replay">
    <label>{t("Round","Рунд")} <select value={selected} onChange={event=>{setSelected(Number(event.target.value));setAnalyse(false);}}>
      {result.report.map((entry,index)=><option value={index} key={entry.round}>{entry.round}</option>)}
    </select></label>
    <h4>{t("Effective protocols at round start","Ефективни протоколи в началото на рунда")}</h4>
    {round.protocols.map((army,side)=><div key={side}><strong>{sideName(side)}</strong>
      {army.map(({contingentId,values})=><p key={contingentId??"main"}>
        {contingentId!=null&&t("Reinforcement","Подкрепление")+" #"+contingentId+" · "}
        {[...new Set(Object.entries(values).map(([key,value])=>label(protocolNames[key])+" "+count(value)+"%"))].join(" · ")||"—"}
      </p>)}
    </div>)}
    {formation(0)}
    {round.grid?.startHealth>0&&<div className="battle-replay-grid-barrier">
      {label("Defense Grid")} · {t("Level","Ниво")} {round.grid.level} · {count(round.grid.startHealth)} HP
      {" → "}{round.grid.endHealth>0?count(round.grid.endHealth)+" HP":t("Destroyed","Разрушена")}
    </div>}
    {formation(1)}
    <h4>{t("Units restored at round end","Възстановени единици в края на рунда")}</h4>
    {recoveries.length ? recoveries.map((event,index)=><p key={index}>{sideName(event.sourceSide)} · {battleEventText(event,label,t)} ({count(event.rate)}%)</p>) : <p>—</p>}
    <button type="button" aria-expanded={analyse} onClick={()=>setAnalyse(!analyse)}>{analyse?t("Hide round analysis","Скрий анализа на рунда"):t("Show round analysis","Покажи анализа на рунда")}</button>
    {analyse&&<ol>{round.events.map((event,index)=><li key={index}>
      {event.kind==="grid-attack"
        ? <>{sideName(0)} · {coordinate(round.start[0][event.sourceGroup])} · {count(event.units)} {label(event.unit)}
          {" → "}{label("Defense Grid")} · {t("Damage","Щети")} {count(event.appliedDamage)}
          {event.destroyed&&" · "+t("Destroyed","Разрушена")}</>
        : event.kind==="grid-shot"
        ? <>{label("Defense Grid")} #{event.turret} · {count(event.baseDamage)} {t("base damage","базови щети")}
          {" → "}{coordinate(round.start[0][event.targetGroup])} · {battleEventText(event,label,t)}</>
        : event.kind==="grid-no-target"
        ? <>{label("Defense Grid")} #{event.turret} · {t("No eligible target","Няма допустима цел")}</>
        : event.kind==="no-target"
        ? <>{sideName(event.sourceSide)} · {coordinate(round.start[event.sourceSide][event.sourceGroup])} · {count(event.units)} {label(event.unit)} · {t("No eligible target","Няма допустима цел")}</>
        : event.sourceGroup!=null&&event.targetGroup!=null
        ? <>{sideName(event.sourceSide)} · {coordinate(round.start[event.sourceSide][event.sourceGroup])} · {count(event.units)} {label(event.unit)}
          {" → "}{sideName(event.targetSide)} · {coordinate(round.start[event.targetSide][event.targetGroup])} · {label(event.target)}
          {" · "}{t("Damage","Щети")} {count(event.appliedDamage)} · {t("Target losses","Загуби на целта")} {count(event.targetLoss??event.phaseTargetLoss)}
          {event.dodged&&" · "+t("Evaded","Избегнат удар")+" "+event.evadedPercent+"%"}
          {event.segments>1&&" · "+t("Subgroup","Подгрупа")+" "+event.segment+"/"+event.segments}
          {event.eligibleTargets>1&&" · "+t("Random target","Случайна цел")+" "+(event.targetIndex+1)+"/"+event.eligibleTargets}</>
        : battleEventText(event,label,t)}
    </li>)}</ol>}
  </section>;
}
