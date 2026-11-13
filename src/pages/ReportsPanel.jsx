import React, { useEffect, useState } from "react";
import { useLanguage } from "../language";

const api=(process.env.REACT_APP_API_URL||(window.location.hostname==="localhost"?"http://localhost:3001":window.location.origin)).replace(/\/$/,"");
const auth=()=>({Authorization:"Bearer "+sessionStorage.getItem("authToken")});
const diff=(initial,remaining)=>Object.fromEntries(Object.entries(initial||{}).map(([unit,count])=>[unit,Math.max(0,(Number(count)||0)-(Number(remaining?.[unit])||0))]).filter(([,count])=>count>0));
const list=units=>Object.entries(units||{}).filter(([,count])=>Number(count)>0).map(([unit,count])=>label(unit)+": "+Number(count).toLocaleString()).join(", ")||"—";

export default function ReportsPanel({onClose,onRead}) {
  const {t,label}=useLanguage();
  const userId=sessionStorage.getItem("userId");
  const [data,setData]=useState(null);
  const [error,setError]=useState("");
  useEffect(()=>{
    let active=true;
    (async()=>{
      try{
        const response=await fetch(api+"/reports/"+encodeURIComponent(userId),{headers:auth(),cache:"no-store"});
        const body=await response.json();if(!response.ok)throw Error(body.message||"Reports unavailable.");
        if(active)setData(body);
        await fetch(api+"/reports/read",{method:"POST",headers:{"Content-Type":"application/json",...auth()},body:JSON.stringify({userId})});
        onRead?.();
      }catch(e){if(active)setError(e.message);}
    })();
    return()=>{active=false;};
  },[userId,onRead]);
  const player=(data?.playerMissions||[]).filter(m=>m.result);
  const alien=(data?.missions||[]).filter(m=>m.result);
  const army=(title,units)=><div><strong>{title}:</strong> {list(units)}</div>;
  const playerReport=m=>{
    const ownInitial=m.incoming?(m.result.defenderInitial||{}):(m.units||{});
    const ownRemaining=m.incoming?(m.result.defenderSurvivors||{}):(m.result.survivors||{});
    const enemyInitial=m.incoming?(m.units||{}):(m.result.defenderInitial||{});
    const enemyRemaining=m.incoming?(m.result.survivors||{}):(m.result.defenderSurvivors||{});
    return <article key={"player-"+m.id} style={card}>
      <h3>{m.incoming?t("Incoming attack from","Атака от")+" "+m.attacker_name:t("Attack on","Атака срещу")+" "+m.defender_name} · {m.target?.x}:{m.target?.y}</h3>
      <p>{m.result.recalled?t("Attack recalled before arrival","Атаката е върната преди пристигане"):m.result.shielded?t("Blocked by protection","Спряна от протекция"):m.result.victory?t("Victory","Победа"):t("Defeat","Загуба")} · {t("Rounds","Рундове")}: {m.result.rounds??"—"}</p>
      {army(t("Your starting army","Твоята начална армия"),ownInitial)}
      {army(t("Your losses","Твоите загуби"),diff(ownInitial,ownRemaining))}
      {army(t("Your survivors","Твоите оцелели"),ownRemaining)}
      {Object.keys(enemyInitial).length>0&&<details><summary>{t("Opponent details","Данни за противника")}</summary>{army(t("Starting army","Начална армия"),enemyInitial)}{army(t("Losses","Загуби"),diff(enemyInitial,enemyRemaining))}{army(t("Survivors","Оцелели"),enemyRemaining)}</details>}
      {m.result.error&&<p>{m.result.error}</p>}
    </article>;
  };
  const alienReport=m=><article key={"alien-"+m.id} style={card}>
    <h3>{t("Alien mission","Извънземна мисия")} #{m.id} · {t("Base level","Ниво на базата")} {m.level} · {m.result.victory?t("Victory","Победа"):t("Defeat","Загуба")}</h3>
    <p>{t("Rounds","Рундове")}: {m.result.rounds??"—"}{m.result.reward?" · "+t("Reward","Награда")+": "+m.result.reward:""}</p>
    {army(t("Starting army","Начална армия"),m.units)}
    {army(t("Losses","Загуби"),diff(m.units,m.result.survivors||{}))}
    {army(t("Survivors","Оцелели"),m.result.survivors||{})}
  </article>;
  return <div style={overlay} onClick={onClose}><section style={panel} onClick={e=>e.stopPropagation()}>
    <header style={header}><span>{t("BATTLE REPORTS","БОЙНИ ДОКЛАДИ")}</span><button onClick={onClose} style={close}>×</button></header>
    <div style={{padding:20,overflowY:"auto",maxHeight:"calc(90vh - 70px)"}}>
      {error&&<p role="alert">{error}</p>}{!data&&!error&&<p>{t("Loading reports…","Зареждане на докладите…")}</p>}
      {data&&<><h2>{t("Player battles","Битки с играчи")}</h2>{player.length?player.map(playerReport):<p>{t("No player battle reports.","Няма доклади от битки с играчи.")}</p>}<h2>{t("Alien missions","Извънземни мисии")}</h2>{alien.length?alien.map(alienReport):<p>{t("No alien mission reports.","Няма доклади от извънземни мисии.")}</p>}</>}
    </div></section></div>;
}
const overlay={position:"fixed",inset:0,zIndex:10000,background:"rgba(0,0,0,.8)",display:"grid",placeItems:"center",padding:12};
const panel={width:"min(100%,1050px)",maxHeight:"90vh",background:"#111",border:"3px solid #777",color:"#eef5ff",overflow:"hidden",boxShadow:"0 10px 40px #000"};
const header={position:"sticky",top:0,display:"flex",alignItems:"center",justifyContent:"space-between",background:"#333",padding:"14px 20px",fontSize:22};
const close={background:"red",color:"white",border:0,fontSize:28,fontWeight:"bold",width:44,height:44,cursor:"pointer"};
const card={border:"1px solid #64839a",borderRadius:10,background:"#182c3e",padding:"12px 16px",marginBottom:12,lineHeight:1.7};
