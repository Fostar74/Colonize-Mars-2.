import React from "react";
import {useLanguage} from "../language";

export default function BattleArmySummary({result}) {
  const {t,label,locale}=useLanguage();
  const rounds=(result.replay||result).report;
  const formations=rounds?.[0]?.start;
  if(!formations)return null;
  const number=value=>Number(value).toLocaleString(locale);
  return <div className="battle-knights">
    {formations.map((formation,side)=>{
      const army={};
      for(const group of formation)(army[group.unit]??={initial:0,losses:0}).initial+=group.count;
      for(const round of rounds){
        for(const group of round.start[side]){
          army[group.unit].losses+=(round.losses[side][group.id]||0);
        }
        for(const event of round.events){
          if(event.sourceSide===side&&event.restored>0)army[event.unit].losses-=event.restored;
        }
      }
      return <section key={side}>
        <strong>{side===0?t("Attacking army","Нападаща армия"):t("Defending army","Защитаваща армия")}</strong>
        <ul>{Object.entries(army).map(([unit,counts])=><li key={unit}>
          {label(unit)} · {number(counts.initial)} {t("initial","начални")}
          {counts.losses>0&&<span className="battle-replay-loss"> ({t("Losses","Загуби")}: {number(counts.losses)})</span>}
        </li>)}</ul>
      </section>;
    })}
  </div>;
}
