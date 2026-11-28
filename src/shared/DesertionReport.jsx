import React from "react";
import {useLanguage} from "../language";
import {battleEventText} from "./localizedMessages";

export default function DesertionReport({report}) {
  const {label, t} = useLanguage();
  const rounds = (report || []).flatMap(({round,events}) => {
    const desertions = events.filter(event => event.deserted > 0);
    return desertions.length ? [{round,desertions}] : [];
  });
  if (!rounds.length) return null;
  return <details>
    <summary>{t("Desertion by round","Дезертьорство по рундове")}</summary>
    {rounds.map(({round,desertions}) => <div key={round}>
      <strong>{t("Round","Рунд")} {round}</strong>
      <ul>{desertions.map(event => <li key={event.side+":"+event.contingentId+":"+event.unit}>
        {battleEventText(event,label,t)}
      </li>)}</ul>
    </div>)}
  </details>;
}
