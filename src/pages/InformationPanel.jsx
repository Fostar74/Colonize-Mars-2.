import React,{useState} from "react";
import {useLanguage} from "../language";
import {explorerTrooper,nanoShieldman,exoSoldier,plasmaBladesman} from "../shared/unitProfiles";

const homeSections=[
 {id:"faq",en:"FAQ",bg:"FAQ",image:"faq.jpg"},
 {id:"more",en:"More",bg:"Още",image:"misc.jpg"},
 {id:"buildings",en:"Buildings",bg:"Сгради",image:"buildings.jpg"},
 {id:"units",en:"Units and Upgrades",bg:"Единици и Подобрения",image:"unitsandupgrades.jpg"},
 {id:"skills",en:"Commander Protocols",bg:"Протоколи на командира",image:"skills.jpg"},
 {id:"alliances",en:"Alliances",bg:"Алианси",image:"guilds.jpg"},
 {id:"knight",en:"Cyber Knight",bg:"Кибер Рицар",image:"knights.jpg"},
 {id:"campaigns",en:"Campaigns",bg:"Кампании",image:"campaigns.jpg"}
];
const infantryCategories=[
 {id:"ground",en:"Ground",bg:"Сухопътни"},
 {id:"ranged",en:"Ranged",bg:"Стрелкови"},
 {id:"mobile",en:"Mobile",bg:"Мобилни"},
 {id:"heavy",en:"Heavy Systems",bg:"Тежки системи"},
 {id:"elite",en:"Elite",bg:"Елитни"}
];
const helpImage=name=>"https://static.khanwarsx.com/game8.1/dist/img/help/main/"+name;

export default function InformationPanel(){
 const {t,label}=useLanguage();
 const [page,setPage]=useState("home");
 const res=["Gold","Iron","Water","Solar"],atk=["Infantry","Cavalry","Ranged units","Walls","Siege machines"];
 const time=s=>[Math.floor(s/3600),Math.floor(s%3600/60),s%60].map(n=>String(n).padStart(2,"0")).join(":");
 const cost=r=>res.map((k,i)=>label(k)+": "+r.cost[i].toLocaleString()).join(" · ");
 const unit=(u,bg,desc)=>{
  const attacks=Object.entries(u.attack).map(([k,v])=>k+": "+v).join(" · ");
  return <article key={u.name} style={{padding:14,border:"1px solid #54758a",borderRadius:10,marginBottom:14}}>
   <h2>{t(u.name,bg)}</h2><p>{t("Infantry · 1 population · Training Center level "+u.requirement.level,"Пехота · 1 население · Учебен център ниво "+u.requirement.level)} · {t("Speed","Скорост")}: {u.speed} · {t("Cargo","Товар")}: {u.cargo}</p>
   <p>{t(desc[0],desc[1])}</p><p>{t("Affected by skills: Defender, Warrior","Повлиява се от уменията: Защитник, Воин")}</p>
   <p>{t("Base attack:","Базова атака:")} {attacks}</p><p>{t("Health:","Здраве:")} {u.health} · {t("Range:","Обхват:")} {u.range}</p>
   <p>{t("Training cost:","Цена за обучение:")} {res.map(k=>label(k)+": "+u.price[k]).join(" · ")} · {t("Time:","Време:")} {time(u.trainingSeconds)}</p>
   {["attackUpgrades","healthUpgrades"].map(kind=><section key={kind}><h3>{kind==="attackUpgrades"?t("Attack upgrades","Подобрения на атаката"):t("Health upgrades","Подобрения на здравето")}</h3><div style={{overflowX:"auto"}}><table style={{width:"100%",borderCollapse:"collapse",background:"#172432"}}><thead><tr>{(kind==="attackUpgrades"?[t("Level","Ниво"),...atk,t("Cost","Цена"),t("Time","Време")]:[t("Level","Ниво"),t("Health increase","Увеличение на здравето"),t("Cost","Цена"),t("Time","Време")]).map(x=><th key={x} style={{padding:7,border:"1px solid #54758a"}}>{x}</th>)}</tr></thead><tbody>{u[kind].map((r,i)=><tr key={i}>{(kind==="attackUpgrades"?[i+1,...r.values.map(v=>"+"+v),cost(r),time(r.seconds)]:[i+1,"+"+r.value,cost(r),time(r.seconds)]).map((v,j)=><td key={j} style={{padding:7,border:"1px solid #54758a",whiteSpace:"nowrap"}}>{v}</td>)}</tr>)}</tbody></table></div></section>)}
  </article>;
 };
 const home=page==="home";
 const section=homeSections.find(s=>s.id===page);
 const category=infantryCategories.find(c=>c.id===page);
 let crumbs=[{id:"home",en:"Home",bg:"Начало"}];
 if(section)crumbs.push({id:section.id,en:section.en,bg:section.bg});
 if(["infantry",...infantryCategories.map(x=>x.id)].includes(page)){
  crumbs.push({id:"units",en:"Units and Upgrades",bg:"Единици и Подобрения"});
  if(page!=="units")crumbs.push({id:"infantry",en:"Infantry",bg:"Пехота"});
  if(category)crumbs.push(category);
 }
 const breadcrumb=(crumb,index)=><React.Fragment key={crumb.id}>{index>0&&<span aria-hidden="true" style={{opacity:.65,padding:"0 7px"}}>/</span>}<button onClick={()=>setPage(crumb.id)} style={{background:"none",border:0,color:"#bcd9e8",padding:"4px 0",cursor:"pointer",fontSize:14}}>{t(crumb.en,crumb.bg)}</button></React.Fragment>;
 const cardGrid={display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(150px,1fr))",gap:12};
 const card={display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:9,minHeight:140,padding:14,textAlign:"center",background:"#172432",border:"1px solid #54758a",borderRadius:10,color:"#f5f0e6",cursor:"pointer"};
 return <div style={{color:"#f5f0e6",padding:12}}>
  <nav aria-label={t("Help navigation","Навигация в помощта")} style={{display:"flex",flexWrap:"wrap",alignItems:"center",marginBottom:14}}>{crumbs.map(breadcrumb)}</nav>
  {home&&<>
   <h2>{t("Home","Начало")}</h2>
   <div style={cardGrid}>{homeSections.map(item=><button key={item.id} onClick={()=>setPage(item.id)} style={card}>
    <img src={helpImage(item.image)} alt="" style={{width:72,height:72,objectFit:"contain"}}/>
    <span>{t(item.en,item.bg)}</span>
   </button>)}</div>
  </>}
  {section?.id==="units"&&<>
   <h2>{t("Units and Upgrades","Единици и Подобрения")}</h2>
   <div style={cardGrid}><button onClick={()=>setPage("infantry")} style={card}><span style={{fontSize:44}} aria-hidden="true">⚔</span><span>{t("Infantry","Пехота")}</span></button></div>
  </>}
  {page==="infantry"&&<>
   <h2>{t("Infantry","Пехота")}</h2>
   <div style={cardGrid}>{infantryCategories.map(item=><button key={item.id} onClick={()=>setPage(item.id)} style={card}>
    <span style={{fontSize:38}} aria-hidden="true">{item.id==="ground"?"🛡":item.id==="ranged"?"⌖":item.id==="mobile"?"🚀":item.id==="heavy"?"⚙":"✦"}</span>
    <span>{t(item.en,item.bg)}</span>
   </button>)}</div>
  </>}
  {page==="ground"&&<>
   <h2>{t("Ground Infantry","Сухопътни")}</h2>
   {unit(explorerTrooper,"Войник изследовател",["Infantry unit with the strongest attack against ground and ranged units. Best placed in the first row.","Пехотна единица с най-силна атака срещу сухопътни и стрелкови единици. Най-добре се поставя на първи ред."])}
   {unit(nanoShieldman,"Нано щитоносец",["Fastest infantry unit. Strongest against mobile and heavy systems. Range 2 allows placement in row 1 or 2.","Най-бързата пехотна единица. Най-силна срещу мобилни и тежки системи. Обхват 2 позволява разполагане на първи или втори ред."])}
   {unit(exoSoldier,"Екзовойник",["Infantry unit with equal attack against all unit groups and the highest health among infantry. Best placed in the first row.","Пехотна единица с еднаква атака срещу всички групи и най-много живот сред пехотата. Най-добре се поставя на първи ред."])}
   {unit(plasmaBladesman,"Плазмен мечоносец",["Infantry unit with the strongest attack against heavy systems. Best placed in the first row.","Пехотна единица с най-силна атака срещу тежки системи. Най-добре се поставя на първи ред."])}
  </>}
  {category&&page!=="ground"&&<><h2>{t(category.en,category.bg)}</h2><p style={{padding:14,background:"#172432",border:"1px solid #54758a",borderRadius:10}}>{t("Information for this troop category will be added later.","Информацията за тази категория войски ще бъде добавена по-късно.")}</p></>}
  {section&&section.id!=="units"&&<><h2>{t(section.en,section.bg)}</h2><p style={{padding:14,background:"#172432",border:"1px solid #54758a",borderRadius:10}}>{section.id==="knight"?t("Cyber Knight information will be added later.","Информацията за Кибер Рицаря ще бъде добавена по-късно."):section.id==="campaigns"?t("Campaign types and details will be added here later.","Тук по-късно ще добавим видовете кампании и подробности за тях."):t("Information for this section will be added later.","Информацията за този раздел ще бъде добавена по-късно.")}</p></>}
 </div>;
}
