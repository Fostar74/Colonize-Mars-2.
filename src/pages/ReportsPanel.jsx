import React, { useEffect, useState } from "react";
import { useLanguage } from "../language";

const api=(process.env.REACT_APP_API_URL||(window.location.hostname==="localhost"?"http://localhost:3001":window.location.origin)).replace(/\/$/,"");
const auth=()=>({Authorization:"Bearer "+sessionStorage.getItem("authToken")});
const reportReadStorageKey=userId=>`colonize-mars-read-battle-reports:${userId}`;
const countUnits=units=>Object.values(units||{}).reduce((total,count)=>total+(Number(count)||0),0);
const diff=(initial,remaining)=>Object.fromEntries(Object.entries(initial||{}).map(([unit,count])=>[unit,Math.max(0,(Number(count)||0)-(Number(remaining?.[unit])||0))]).filter(([,count])=>count>0));
const list=units=>Object.entries(units||{}).filter(([,count])=>Number(count)>0).map(([unit,count])=>unit+": "+Number(count).toLocaleString()).join(", ")||"0";

export default function ReportsPanel({onClose,onRead}) {
  const {t}=useLanguage();
  const userId=sessionStorage.getItem("userId");
  const [data,setData]=useState(null);
  const [error,setError]=useState("");
  const [newReportIds,setNewReportIds]=useState([]);
  useEffect(()=>{
    let active=true;
    (async()=>{
      try{
        const response=await fetch(api+"/reports/"+encodeURIComponent(userId),{headers:auth(),cache:"no-store"});
        const body=await response.json();if(!response.ok)throw Error(body.message||"Reports unavailable.");
        if(active){
          let seen=[];try{seen=JSON.parse(localStorage.getItem(reportReadStorageKey(userId))||"[]");}catch{}
          const read=new Set(Array.isArray(seen)?seen:[]);
          const unreadIds=[...(body.missions||[]).filter(m=>m.result&&!read.has("alien:"+m.id)).map(m=>"alien:"+m.id),...(body.playerMissions||[]).filter(m=>m.result&&!m.incoming&&!read.has("player:"+m.id)).map(m=>"player:"+m.id)];
          setNewReportIds(unreadIds);setData(body);
        }
        await fetch(api+"/reports/read",{method:"POST",headers:{"Content-Type":"application/json",...auth()},body:JSON.stringify({userId})});
        onRead?.();
      }catch(e){if(active)setError(e.message);}
    })();
    return()=>{active=false;};
  },[userId,onRead]);
  const allPlayer=(data?.playerMissions||[]).filter(m=>m.result);
  const activeIncoming=(data?.playerMissions||[]).filter(m=>m.incoming&&!m.result&&!m.returned_at);
  const unreadIds=new Set(newReportIds);
  const newPlayer=allPlayer.filter(m=>m.unread||unreadIds.has("player:"+m.id));
  const previousPlayer=allPlayer.filter(m=>!newPlayer.includes(m));
  const alien=(data?.missions||[]).filter(m=>m.result);
  const newAlien=alien.filter(m=>unreadIds.has("alien:"+m.id));
  const army=(title,units)=> <div><strong>{title}:</strong> {units===null?t("Not recorded","Не е записано"):list(units)}</div>;
  const playerReport=m=>{
    const ownInitial=m.incoming?(m.result.defenderInitial||{}):(m.units||{});
    const ownRemaining=m.incoming?(m.result.defenderSurvivors||{}):(m.result.survivors||{});
    const ownInitialRecorded=!m.incoming||Object.prototype.hasOwnProperty.call(m.result,"defenderInitial");
    const didLose=m.incoming?!!m.result.victory:!m.result.victory;
    const noWitness=!m.result.recalled&&!m.result.shielded&&didLose&&Number(m.result.rounds||0)<=1&&countUnits(ownRemaining)===0;
    const title=m.incoming?t("Incoming attack from","Атака от")+" "+m.attacker_name:t("Attack on","Атака срещу")+" "+m.defender_name;
    const outcome=m.result.recalled?t("Attack recalled before arrival","Атаката е върната преди пристигане"):m.result.shielded?t("Blocked by protection","Спряна от протекция"):m.incoming?(m.result.victory?t("Base lost","Базата е превзета"):t("Defense held","Защитата устоя")):(m.result.victory?t("Victory","Победа"):t("Defeat","Поражение"));
    if(noWitness)return <article key={"player-"+m.id} style={card}><h3>{title} · {m.target?.x}:{m.target?.y}</h3><p>{t("The battle ended too quickly. No survivors remained to report what happened.","Битката се състоя твърде бързо и няма оцелели, които да докладват какво се е случило.")}</p></article>;
    const enemyInitial=m.incoming?(m.units||{}):null;
    const enemyRemaining=m.incoming?(m.result.survivors||{}):null;
    return <article key={"player-"+m.id} style={card}>
      <h3>{title} · {m.target?.x}:{m.target?.y}</h3>
      <p>{outcome}{!m.result.recalled&&" · "+t("Rounds","Рундове")+": "+(m.result.rounds??"—")}</p>
      {army(t("Your starting army","Твоята начална армия"),ownInitialRecorded?ownInitial:null)}
      {army(t("Your losses","Твоите загуби"),diff(ownInitial,ownRemaining))}
      {army(t("Your survivors","Твоите оцелели"),ownRemaining)}
      {m.incoming&&Object.keys(enemyInitial||{}).length>0&&<details><summary>{t("Attacking force","Нападателна армия")}</summary>{army(t("Starting army","Начална армия"),enemyInitial)}{army(t("Losses","Загуби"),diff(enemyInitial,enemyRemaining))}{army(t("Survivors","Оцелели"),enemyRemaining)}</details>}
      {m.result.recalled&&<p>{t("No battle took place; the attacking army returned unchanged.","Битка не е имало; нападателната армия се е върнала непокътната.")}</p>}
      {m.result.error&&<p>{m.result.error}</p>}
    </article>;
  };
  const alienReport=m=><article key={"alien-"+m.id} style={card}>
    <h3>{t("Alien mission","Извънземна мисия")} #{m.id} · {t("Base level","Ниво на базата")} {m.level} · {m.result.victory?t("Victory","Победа"):t("Defeat","Поражение")}</h3>
    <p>{t("Rounds","Рундове")}: {m.result.rounds??"—"}{m.result.reward?" · "+t("Reward","Награда")+": "+m.result.reward:""}</p>
    {army(t("Starting army","Начална армия"),m.units)}{army(t("Losses","Загуби"),diff(m.units,m.result.survivors||{}))}{army(t("Survivors","Оцелели"),m.result.survivors||{})}
  </article>;
  const incomingMarch=m=><article key={"march-"+m.id} style={card}>
    <h3>{t("Attack in progress from","Идваща атака от")} {m.attacker_name} · {m.target?.x}:{m.target?.y}</h3>
    <p>{t("The attack is on the way. No battle report exists yet.","Походът е в движение. Все още няма боен доклад.")}</p>
    <p>{t("Expected arrival","Очаквано пристигане")}: {new Date(m.arrives_at).toLocaleTimeString()}</p>
  </article>;
  return <div style={overlay} onClick={onClose}><section style={panel} onClick={e=>e.stopPropagation()}>
    <header style={header}><span>{t("BATTLE REPORTS","БОЙНИ ДОКЛАДИ")}</span><button onClick={onClose} style={close}>×</button></header>
    <div style={{padding:20,overflowY:"auto",maxHeight:"calc(90vh - 70px)"}}>
      {error&&<p role="alert">{error}</p>}{!data&&!error&&<p>{t("Loading reports…","Зареждане на докладите…")}</p>}
      {data&&<>{activeIncoming.length>0&&<><h2>{t("Attacks in progress","Походи към теб")}</h2>{activeIncoming.map(incomingMarch)}</>}
        {newPlayer.length>0?<><h2>{t("New battle reports","Нови бойни доклади")}</h2>{newPlayer.map(playerReport)}</>:newAlien.length===0&&<p>{activeIncoming.length?t("No new report yet. It will appear after the battle.","Още няма нов доклад. Ще се появи след битката."):t("No new reports.","Няма нови доклади.")}</p>}
        {alien.length>0&&<><h2>{t("Alien mission reports","Доклади от извънземни мисии")}{newAlien.length?" · "+t("New","Нови")+": "+newAlien.length:""}</h2>{alien.map(alienReport)}</>}{previousPlayer.length>0&&<details style={{marginTop:20}}><summary>{t("Previous player reports","Предишни доклади от битки с играчи")}</summary>{previousPlayer.map(playerReport)}</details>}
      </>}
    </div></section></div>;
}
const overlay={position:"fixed",inset:0,zIndex:10000,background:"rgba(0,0,0,.8)",display:"grid",placeItems:"center",padding:12};
const panel={width:"min(100%,1050px)",maxHeight:"90vh",background:"#111",border:"3px solid #777",color:"#eef5ff",overflow:"hidden",boxShadow:"0 10px 40px #000"};
const header={position:"sticky",top:0,display:"flex",alignItems:"center",justifyContent:"space-between",background:"#333",padding:"14px 20px",fontSize:22};
const close={background:"red",color:"white",border:0,fontSize:28,fontWeight:"bold",width:44,height:44,cursor:"pointer"};
const card={border:"1px solid #64839a",borderRadius:10,background:"#182c3e",padding:"12px 16px",marginBottom:12,lineHeight:1.7};
