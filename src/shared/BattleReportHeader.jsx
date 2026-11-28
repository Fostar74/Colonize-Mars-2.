import React from "react";
import {useLanguage} from "../language";
import {protocolLabels} from "./cyberKnightEquipment";

export default function BattleReportHeader({result}) {
  const {t,label,locale,language}=useLanguage();
  const participants=result.participants;
  const winner=result.victory===true?t("Attackers won","Нападателите победиха"):
    result.victory===false?t("Defense held","Защитата устоя"):null;
  const xp=result.combatXp||{attacker:result.xpEarned};
  return <header className="battle-report-header">
    {winner&&<h4>{winner}</h4>}
    <div className="battle-knights">
      {["attacker","defender"].map(side=>{
        const player=participants?.[side];
        const name=player?.name||(player?.kind==="alien"?t("Alien Base","Извънземна база"):
          player?.kind==="orange"?(player.commanderId===10?t("Emperor","Император"):t("Commander","Командир")+" "+player.commanderId):null);
        const coords=player?.coordinates;
        return <section key={side}>
          <strong>{side==="attacker"?t("Attackers","Нападатели"):t("Defenders","Защитници")}</strong>
          {name&&<p>{name} · {t("Level","Ниво")} {player.level}
            {player.alliance&&" · "+player.alliance}{Number.isInteger(coords?.x)&&Number.isInteger(coords?.y)&&" · "+coords.x+":"+coords.y}</p>}
          <p>{t("XP awarded","Присъден опит")}: {xp[side]==null?t("Not recorded","Няма запис"):Number(xp[side]).toLocaleString(locale)}</p>
          {Object.entries(player?.protocolTiers||{}).filter(([key,tier])=>protocolLabels[key]&&tier>0).map(([key,tier])=>
            <span className="battle-protocol-tier" key={key}>{protocolLabels[key][language==="bg"?1:0]} · {t("Tier","Степен")} {tier}</span>)}
        </section>;
      })}
    </div>
    {result.loot&&<p>{t("Loot","Плячка")}: {Object.entries(result.loot).map(([resource,count])=>
      label(resource)+" "+Number(count).toLocaleString(locale)).join(" · ")}</p>}
  </header>;
}
