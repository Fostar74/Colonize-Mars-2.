import React, {useState} from "react";
import {useLanguage} from "../language";
import BattleKnights from "./BattleKnights";
import BattleReplay from "./BattleReplay";

export default function SharedBattleReport({messageId,api}) {
  const {t}=useLanguage();
  const [state,setState]=useState(null);
  async function load(event) {
    if (!event.currentTarget.open || state?.result || state?.loading) return;
    setState({loading:true});
    try {
      const userId=encodeURIComponent(sessionStorage.getItem("userId"));
      const response=await fetch(api+"/reports/shared/"+userId+"/"+messageId,{
        headers:{Authorization:"Bearer "+sessionStorage.getItem("authToken")},cache:"no-store",
      });
      if (!response.ok) throw new Error("Report unavailable");
      setState({result:await response.json()});
    } catch {
      setState({error:true});
    }
  }
  return <details onToggle={load}>
    <summary>{t("Full report","Пълен доклад")}</summary>
    {state?.loading&&<p role="status">{t("Loading report…","Зареждане на доклада…")}</p>}
    {state?.error&&<p role="alert">{t("Report unavailable.","Докладът не е наличен.")}</p>}
    {state?.result&&<><BattleKnights knights={state.result.knights} /><BattleReplay result={state.result} /></>}
  </details>;
}
