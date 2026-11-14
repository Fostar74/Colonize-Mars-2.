import React from "react";
import {useLanguage} from "../language";
import {explorerTrooper,exoSoldier} from "../shared/unitProfiles";
export default function InformationPanel(){
 const {t,label}=useLanguage(),res=["Gold","Iron","Water","Solar"],atk=["Infantry","Cavalry","Ranged units","Walls","Siege machines"];
 const time=s=>[Math.floor(s/3600),Math.floor(s%3600/60),s%60].map(n=>String(n).padStart(2,"0")).join(":");
 const cost=r=>res.map((k,i)=>label(k)+": "+r.cost[i].toLocaleString()).join(" · ");
 const unit=(u,bg,desc)=>{
  const attacks=Object.entries(u.attack).map(([k,v])=>k+": "+v).join(" · ");
  return <article key={u.name} style={{padding:14,border:"1px solid #54758a",borderRadius:10,marginBottom:14}}>
   <h2>{t(u.name,bg)}</h2><p>{t("Infantry · 1 population · Training Center level "+u.requirement.level,"Пехота · 1 население · Учебен център ниво "+u.requirement.level)} · {t("Speed","Скорост")}: {u.speed} · {t("Cargo","Товар")}: {u.cargo}</p>
   <p>{t(desc[0],desc[1])}</p><p>{t("Affected by skills: Defender, Warrior","Повлиява се от уменията: Защитник, Воин")}</p>
   <p>{t("Base attack:","Базова атака:")} {attacks}</p><p>{t("Health:","Здраве:")} {u.health} · {t("Range:","Обхват:")} {u.range}</p>
   <p>{t("Training cost:","Цена за обучение:")} {res.map(k=>label(k)+": "+u.price[k]).join(" · ")} · {t("Time:","Време:")} {time(u.trainingSeconds)}</p>
   {["attackUpgrades","healthUpgrades"].map((kind)=><section key={kind}><h3>{kind==="attackUpgrades"?t("Attack upgrades","Подобрения на атаката"):t("Health upgrades","Подобрения на здравето")}</h3><div style={{overflowX:"auto"}}><table style={{width:"100%",borderCollapse:"collapse",background:"#172432"}}><thead><tr>{(kind==="attackUpgrades"?[t("Level","Ниво"),...atk,t("Cost","Цена"),t("Time","Време")]:[t("Level","Ниво"),t("Health increase","Увеличение на здравето"),t("Cost","Цена"),t("Time","Време")]).map(x=><th key={x} style={{padding:7,border:"1px solid #54758a"}}>{x}</th>)}</tr></thead><tbody>{u[kind].map((r,i)=><tr key={i}>{(kind==="attackUpgrades"?[i+1,...r.values.map(v=>"+"+v),cost(r),time(r.seconds)]:[i+1,"+"+r.value,cost(r),time(r.seconds)]).map((v,j)=><td key={j} style={{padding:7,border:"1px solid #54758a",whiteSpace:"nowrap"}}>{v}</td>)}</tr>)}</tbody></table></div></section>)}
  </article>
 };
 return <div style={{color:"#f5f0e6",padding:12}}><h2>{t("Unit information","Информация за войниците")}</h2>
 {unit(explorerTrooper,"Explorer Trooper",["Fastest infantry unit. Strongest against mobile and heavy systems. Range 2 allows placement in row 1 or 2.","Най-бързата пехотна единица. Най-силна срещу мобилни и тежки системи. Обхват 2 позволява разполагане на първи или втори ред."])}
 {unit(exoSoldier,"Exo-Soldier",["Infantry unit with equal attack against all unit groups and the highest health among infantry. Best placed in the first row.","Пехотна единица с еднаква атака срещу всички групи и най-много живот сред пехотата. Най-добре се поставя на първи ред."])}
 </div>;
}