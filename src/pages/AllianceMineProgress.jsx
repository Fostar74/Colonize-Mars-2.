import React, {useEffect, useMemo, useState} from "react";
import {useLanguage} from "../language";

const hour=3600000;

export default function AllianceMineProgress({mine, goal, march}) {
  const {t,language}=useLanguage();
  const [clock,setClock]=useState(()=>performance.now());
  const reference=useMemo(()=>({server:mine.measuredAt,received:performance.now()}),[mine.measuredAt]);
  useEffect(()=>{
    const timer=window.setInterval(()=>setClock(performance.now()),1000);
    return ()=>window.clearInterval(timer);
  },[]);
  const now=reference.server+Math.max(0,clock-reference.received);
  let points=mine.constructionPoints+(now-mine.measuredAt)*mine.arrivedPopulation/hour;
  let population=mine.arrivedPopulation;
  const arrivals=mine.incomingBuilders||[];
  for(const builder of arrivals){
    if(builder.arrivesAt<=now){
      population+=builder.population;
      points+=(now-builder.arrivesAt)*builder.population/hour;
    }
  }
  points=Math.min(goal,points);
  let remaining=goal-points, cursor=now, speed=population;
  for(const builder of arrivals){
    if(builder.arrivesAt<=now)continue;
    const beforeArrival=(builder.arrivesAt-cursor)*speed/hour;
    if(beforeArrival>=remaining)break;
    remaining-=beforeArrival;
    cursor=builder.arrivesAt;
    speed+=builder.population;
  }
  const seconds=points>=goal?0:speed>0?Math.max(0,Math.ceil((cursor-now+remaining*hour/speed)/1000)):0;
  const eta=[Math.floor(seconds/3600),Math.floor(seconds/60)%60,seconds%60].map(value=>String(value).padStart(2,"0")).join(":");
  const personal=points<goal&&march?.mode==="construction"&&march.mineId===mine.id&&march.arrives_at<=now?march.population:0;
  const format=value=>value.toLocaleString(language,{maximumFractionDigits:2});
  const label=t("Construction points","Строителни точки");
  return <div>
    <p>{label} {format(points)} / {format(goal)}</p>
    <progress aria-label={label} max={goal} value={points} style={{width:"100%"}} />
    <p>{t("Arrived population","Пристигнала популация")} {format(population)} · {format(population)} {t("points/hour","точки/час")}</p>
    <p>{t("Your contribution","Твоят принос")} {format(personal)} {t("points/hour","точки/час")} · {format(personal/100)} {t("AP/hour","ТА/час")}</p>
    <p>{t("Construction ETA","Оставащо време за строеж")} · {population>0||points>=goal?eta:t("Paused: no builders have arrived","На пауза: няма пристигнали строители")}</p>
  </div>;
}
