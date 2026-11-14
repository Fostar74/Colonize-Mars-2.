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
const commanderProtocols=[
 {en:"Hyperdrive Navigation",bg:"Хипердвигателна навигация",effectEn:"Army speed",effectBg:"Скорост на армията",khanEn:"Scout",khanBg:"Скаут",values:[15,35,60]},
 {en:"Quantum Logistics",bg:"Квантова логистика",effectEn:"Resource production",effectBg:"Производство на ресурси",khanEn:"Finance",khanBg:"Финанси",values:[10,25,45]},
 {en:"Deep Core Extraction",bg:"Дълбочинен добив",effectEn:"Mine production",effectBg:"Производство на мините",khanEn:"Miner",khanBg:"Миньор",values:[20,50,100]},
 {en:"Precision Targeting",bg:"Прецизно прицелване",effectEn:"Ranged unit attack",effectBg:"Атака на стрелковите единици",khanEn:"Archer",khanBg:"Стрелец",values:[15,35,60]},
 {en:"Nano Armor Systems",bg:"Системи за наноброня",effectEn:"Unit health",effectBg:"Здраве на единиците",khanEn:"Defender",khanBg:"Защитник",values:[10,25,45]},
 {en:"Combat Augmentation",bg:"Бойно усилване",effectEn:"Infantry attack and health",effectBg:"Атака и здраве на пехотата",khanEn:"Warrior (infantry attack)",khanBg:"Воин (атака на пехотата)",values:[10,25,45]},
 {en:"Neural Command",bg:"Невронно командване",effectEn:"Army attack (command)",effectBg:"Атака на армията (командване)",khanEn:"Leadership",khanBg:"Лидерство",values:[6,16,30]},
 {en:"Probability Matrix",bg:"Матрица на вероятностите",effectEn:"Evasion",effectBg:"Избягване",khanEn:"Luck",khanBg:"Късмет",values:[3,8,15]},
 {en:"Nano Regeneration",bg:"Нанорегенерация",effectEn:"Recovery",effectBg:"Възстановяване",khanEn:"Healer",khanBg:"Лечител",values:[3,8,15]},
 {en:"Assault Mobility",bg:"Щурмова мобилност",effectEn:"Mobile unit attack",effectBg:"Атака на мобилните единици",khanEn:"Cavalryman",khanBg:"Кавалерист",values:[10,25,45]},
 {en:"Siege Engineering",bg:"Обсадно инженерство",effectEn:"Siege unit attack",effectBg:"Атака на обсадните единици",khanEn:"Siege",khanBg:"Обсада",values:[10,25,45]},
 {en:"Neural Learning Matrix",bg:"Невронна матрица за обучение",effectEn:"Experience gain",effectBg:"Опит",khanEn:"Education",khanBg:"Образование",values:[10,25,45]},
 {en:"Accelerated Training",bg:"Ускорено обучение",effectEn:"Training speed",effectBg:"Скорост на обучение",khanEn:"Overseer",khanBg:"Надзирател",values:[10,25,45]}
];

export default function InformationPanel(){
 const {t,label}=useLanguage();
 const [page,setPage]=useState("home");
 const [selectedProtocol,setSelectedProtocol]=useState(null);
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
 const neuralCommand=selectedProtocol==="Neural Command";
 let crumbs=[{id:"home",en:"Home",bg:"Начало"}];
 if(section)crumbs.push({id:section.id,en:section.en,bg:section.bg});
 if(neuralCommand)crumbs.push({id:"neural-command",en:"Neural Command",bg:"Невронно командване"});
 if(page==="infantry"||category){
  crumbs.push({id:"units",en:"Units and Upgrades",bg:"Единици и Подобрения"});
  if(page==="infantry")crumbs.push({id:"infantry",en:"Infantry",bg:"Пехота"});
  if(category)crumbs.push(category);
 }
 const breadcrumb=(crumb,index)=><React.Fragment key={crumb.id}>{index>0&&<span aria-hidden="true" style={{opacity:.65,padding:"0 7px"}}>/</span>}<button onClick={()=>{if(crumb.id==="neural-command"){setPage("skills");setSelectedProtocol("Neural Command");}else{setSelectedProtocol(null);setPage(crumb.id);}}} style={{background:"none",border:0,color:"#bcd9e8",padding:"4px 0",cursor:"pointer",fontSize:14}}>{t(crumb.en,crumb.bg)}</button></React.Fragment>;
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
   <div style={cardGrid}>
    <button onClick={()=>setPage("infantry")} style={card}><span style={{fontSize:44}} aria-hidden="true">⚔</span><span>{t("Infantry","Пехота")}</span></button>
    {infantryCategories.map(item=><button key={item.id} onClick={()=>setPage(item.id)} style={card}>
     <span style={{fontSize:38}} aria-hidden="true">{item.id==="ground"?"🛡":item.id==="ranged"?"⌖":item.id==="mobile"?"🚀":item.id==="heavy"?"⚙":"✦"}</span>
     <span>{t(item.en,item.bg)}</span>
    </button>)}
   </div>
  </>}
  {page==="infantry"&&<>
   <h2>{t("Infantry","Пехота")}</h2>
   {unit(explorerTrooper,"Войник изследовател",["Infantry unit with the strongest attack against ground and ranged units. Best placed in the first row.","Пехотна единица с най-силна атака срещу сухопътни и стрелкови единици. Най-добре се поставя на първи ред."])}
   {unit(nanoShieldman,"Нано щитоносец",["Fastest infantry unit. Strongest against mobile and heavy systems. Range 2 allows placement in row 1 or 2.","Най-бързата пехотна единица. Най-силна срещу мобилни и тежки системи. Обхват 2 позволява разполагане на първи или втори ред."])}
   {unit(exoSoldier,"Екзовойник",["Infantry unit with equal attack against all unit groups and the highest health among infantry. Best placed in the first row.","Пехотна единица с еднаква атака срещу всички групи и най-много живот сред пехотата. Най-добре се поставя на първи ред."])}
   {unit(plasmaBladesman,"Плазмен мечоносец",["Infantry unit with the strongest attack against heavy systems. Best placed in the first row.","Пехотна единица с най-силна атака срещу тежки системи. Най-добре се поставя на първи ред."])}
  </>}
  {category&&<><h2>{t(category.en,category.bg)}</h2><p style={{padding:14,background:"#172432",border:"1px solid #54758a",borderRadius:10}}>{t("Information for this troop category will be added later.","Информацията за тази категория войски ще бъде добавена по-късно.")}</p></>}
  {section?.id==="skills"&&(neuralCommand?<><h2>{t("Neural Command","Невронно командване")}</h2>
   <p>{t("Neural Command increases your army's morale. Before each battle, some of the army with lower morale may flee and will not take part. These units do not disappear permanently; they remain alive and can be used after the battle. Their absence on the battlefield can decide the outcome, especially when the armies are evenly matched.","Невронно командване увеличава морала на армията ви. Преди всяка битка част от армията с по-нисък морал може да избяга и да не участва в нея. Тези единици не изчезват завинаги — остават живи и могат да се използват след битката. Отсъствието им на бойното поле може да реши изхода, особено при равностойни армии.")}</p>
   <p>{t("The number of units that flee depends on both players' Neural Command levels. Subtract the lower percentage from the higher one. Then 20–30% of the difference is calculated; this is the final percentage of population that flees.","Броят на единиците, които ще избягат, зависи от нивото на Невронно командване на двамата играчи. По-ниският процент се изважда от по-високия. След това се изчисляват между 20 и 30% от разликата; това е крайният процент население, което ще избяга.")}</p>
   <p>{t("Example: Player A has 30% Neural Command and Player B has 10%. The difference is 20%. Between 20% and 30% of that difference gives 4–6% of Player B's population fleeing.","Пример: Играч А има 30% Невронно командване, а Играч Б — 10%. Разликата е 20%. Между 20% и 30% от нея означава, че ще избягат 4–6% от населението на Играч Б.")}</p>
   <p>{t("If Player B has a population of 10,000, then 400–600 population will not take part in the battle. The unit types that flee are chosen at random.","Ако населението на Играч Б е 10 000, между 400 и 600 население няма да участва в битката. Видовете единици, които ще избягат, се избират на случаен принцип.")}</p>
   <h3>{t("Protocol bonuses","Бонуси на протокола")}</h3><ul><li>{t("Initiate: 6%","Начална: 6%")}</li><li>{t("Advanced: 16%","Напреднала: 16%")}</li><li>{t("Elite: 30%","Елитна: 30%")}</li></ul>
  </>:<><h2>{t(section.en,section.bg)}</h2><p style={{padding:14,background:"#172432",border:"1px solid #54758a",borderRadius:10}}>{t("Allocate Protocol Points (PP) to improve commander protocols. Each protocol has three tiers: Initiate, Advanced and Elite. Their bonuses are listed below in tier order.","Разпределяй точки за протоколи (ТП), за да подобряваш протоколите на командира. Всеки протокол има три степени: начална, напреднала и елитна. Бонусите по-долу са подредени по степени.")}<br/>{t("Upgrade costs: Initiate 1 PP · Advanced 2 PP · Elite 3 PP.","Цена за подобрение: Начална 1 ТП · Напреднала 2 ТП · Елитна 3 ТП.")}</p><div style={cardGrid}>{commanderProtocols.map(item=><article key={item.en} style={{padding:14,background:"#172432",border:"1px solid #54758a",borderRadius:10}}>{item.en==="Neural Command"?<button onClick={()=>setSelectedProtocol("Neural Command")} style={{display:"block",width:"100%",padding:0,textAlign:"left",color:"inherit",background:"none",border:0,cursor:"pointer"}}><h3 style={{marginTop:0,textDecoration:"underline"}}>{t(item.en,item.bg)}</h3></button>:<h3 style={{marginTop:0}}>{t(item.en,item.bg)}</h3>}<p>{t(item.effectEn,item.effectBg)} · {t("bonus","бонус")}</p><p><strong>{t("Khan Wars skill","Умение в Khan Wars")}:</strong> {t(item.khanEn,item.khanBg)}</p><p><strong>{t("Tier bonuses","Бонуси по степени")}:</strong> {item.values.map(v=>v+"%").join(" / ")}</p><p style={{opacity:.8,fontSize:13}}>{t("Initiate / Advanced / Elite","Начална / Напреднала / Елитна")}</p></article>)}</div></>)}{section&&section.id!=="units"&&section.id!=="skills"&&<><h2>{t(section.en,section.bg)}</h2><p style={{padding:14,background:"#172432",border:"1px solid #54758a",borderRadius:10}}>{section.id==="knight"?t("Cyber Knight information will be added later.","Информацията за Кибер Рицаря ще бъде добавена по-късно."):section.id==="campaigns"?t("Campaign types and details will be added here later.","Тук по-късно ще добавим видовете кампании и подробности за тях."):t("Information for this section will be added later.","Информацията за този раздел ще бъде добавена по-късно.")}</p></>}
 </div>;
}
