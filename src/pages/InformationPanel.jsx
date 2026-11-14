import React from "react";
import {useLanguage} from "../language";
import {explorerTrooper} from "../shared/unitProfiles";
export default function InformationPanel(){
 const {t,label}=useLanguage(), res=["Gold","Iron","Water","Solar"], atk=["Infantry","Cavalry","Ranged units","Walls","Siege machines"];
 const cost=(row)=>res.map((r,i)=>label(r)+": "+row.cost[i].toLocaleString()).join(" · ");
 const time=s=>[Math.floor(s/3600),Math.floor(s%3600/60),s%60].map(n=>String(n).padStart(2,"0")).join(":");
 return <div style={{color:"#f5f0e6",padding:12}}>
  <article style={{padding:14,border:"1px solid #54758a",borderRadius:10,marginBottom:14}}>
   <h2>{t("Explorer Trooper","Войник изследовател")}</h2>
   <p>{t("Infantry · 1 population · Training Center level 16","Пехота · 1 население · Учебен център ниво 16")}</p>
   <p>{t("Fastest infantry unit. Strongest against cavalry and siege units. Range 2 allows placement in row 1 or 2.","Най-бързата пехотна единица. Най-силна срещу кавалерия и обсадни машини. Обхват 2 позволява разполагане на първи или втори ред.")}</p>
   <p>{t("Affected by skills: Defender, Warrior","Повлиява се от уменията: Защитник, Воин")}</p>
   <p>{t("Base attack:","Базова атака:")} {t("Infantry 10 · Cavalry 70 · Ranged 10 · Wall 0 · Siege 70","Пехота 10 · Кавалерия 70 · Стрелци 10 · Стена 0 · Обсада 70")}</p>
   <p>{t("Health:","Здраве:")} 60 · {t("Range:","Обхват:")} 2 · {t("Population:","Население:")} 1</p>
   <p>{t("Training cost:","Цена за обучение:")} Gold 45 · Iron 30 · Water 60 · Solar 35 · {t("Time:","Време:")} 00:06:30</p>
  </article>
  <h3>{t("Attack upgrades","Подобрения на атаката")}</h3>
  <div style={{overflowX:"auto"}}><table style={{width:"100%",borderCollapse:"collapse",background:"#172432"}}><thead><tr>{[t("Level","Ниво"),...atk,t("Cost","Цена"),t("Time","Време")].map(x=><th key={x} style={{padding:7,border:"1px solid #54758a"}}>{x}</th>)}</tr></thead><tbody>{explorerTrooper.attackUpgrades.map((r,i)=><tr key={i}>{[i+1,...r.values.map(v=>"+"+v),cost(r),time(r.seconds)].map((v,j)=><td key={j} style={{padding:7,border:"1px solid #54758a",whiteSpace:"nowrap"}}>{v}</td>)}</tr>)}</tbody></table></div>
  <h3>{t("Health upgrades","Подобрения на здравето")}</h3>
  <div style={{overflowX:"auto"}}><table style={{width:"100%",borderCollapse:"collapse",background:"#172432"}}><thead><tr>{[t("Level","Ниво"),t("Health increase","Увеличение на здравето"),t("Cost","Цена"),t("Time","Време")].map(x=><th key={x} style={{padding:7,border:"1px solid #54758a"}}>{x}</th>)}</tr></thead><tbody>{explorerTrooper.healthUpgrades.map((r,i)=><tr key={i}><td style={{padding:7,border:"1px solid #54758a"}}>{i+1}</td><td style={{padding:7,border:"1px solid #54758a"}}>+{r.value}</td><td style={{padding:7,border:"1px solid #54758a"}}>{cost(r)}</td><td style={{padding:7,border:"1px solid #54758a"}}>{time(r.seconds)}</td></tr>)}</tbody></table></div>
 </div>;
}
