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
 {en:"Hyperdrive Navigation",bg:"Хипердвигателна навигация",effectEn:"Army speed",effectBg:"Скорост на армията",khanEn:"Scout",khanBg:"Скаут",values:[20,40,60]},
 {en:"Quantum Logistics",bg:"Квантова логистика",effectEn:"Resource production",effectBg:"Производство на ресурси",khanEn:"Finance",khanBg:"Финанси",values:[10,20,30]},
 {en:"Deep Core Extraction",bg:"Дълбочинен добив",effectEn:"Mine production",effectBg:"Производство на мините",khanEn:"Miner",khanBg:"Миньор",values:[20,50,100]},
 {en:"Precision Targeting",bg:"Прецизно прицелване",effectEn:"Ranged unit attack",effectBg:"Атака на стрелковите единици",khanEn:"Archer",khanBg:"Стрелец",values:[20,40,60]},
 {en:"Nano Armor Systems",bg:"Системи за наноброня",effectEn:"Unit health",effectBg:"Здраве на единиците",khanEn:"Defender",khanBg:"Защитник",values:[10,20,30]},
 {en:"Combat Augmentation",bg:"Бойно усилване",effectEn:"Infantry attack and health",effectBg:"Атака и здраве на пехотата",khanEn:"Warrior (infantry attack)",khanBg:"Воин (атака на пехотата)",values:[10,25,40]},
 {en:"Neural Command",bg:"Невронно командване",effectEn:"Army attack (command)",effectBg:"Атака на армията (командване)",khanEn:"Leadership",khanBg:"Лидерство",values:[10,20,30]},
 {en:"Probability Matrix",bg:"Матрица на вероятностите",effectEn:"Evasion",effectBg:"Избягване",khanEn:"Luck",khanBg:"Късмет",values:[3,8,15]},
 {en:"Nano Regeneration",bg:"Нанорегенерация",effectEn:"Recovery",effectBg:"Възстановяване",khanEn:"Healer",khanBg:"Лечител",values:[5,10,15]},
 {en:"Assault Mobility",bg:"Щурмова мобилност",effectEn:"Mobile unit attack",effectBg:"Атака на мобилните единици",khanEn:"Cavalryman",khanBg:"Кавалерист",values:[10,25,40]},
 {en:"Siege Engineering",bg:"Обсадно инженерство",effectEn:"Siege unit attack",effectBg:"Атака на обсадните единици",khanEn:"Siege",khanBg:"Обсада",values:[10,20,30]},
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
 const combatAugmentation=selectedProtocol==="Combat Augmentation";
 const precisionTargeting=selectedProtocol==="Precision Targeting";
 const assaultMobility=selectedProtocol==="Assault Mobility";
 const hyperdriveNavigation=selectedProtocol==="Hyperdrive Navigation";
 const quantumLogistics=selectedProtocol==="Quantum Logistics";
 const nanoRegeneration=selectedProtocol==="Nano Regeneration";
 const siegeEngineering=selectedProtocol==="Siege Engineering";
 const nanoArmorSystems=selectedProtocol==="Nano Armor Systems";
 let crumbs=[{id:"home",en:"Home",bg:"Начало"}];
 if(section)crumbs.push({id:section.id,en:section.en,bg:section.bg});
 if(selectedProtocol){const selected=commanderProtocols.find(item=>item.en===selectedProtocol);crumbs.push({id:"protocol-detail",en:selected?.en||selectedProtocol,bg:selected?.bg||selectedProtocol});}
 if(page==="infantry"||category){
  crumbs.push({id:"units",en:"Units and Upgrades",bg:"Единици и Подобрения"});
  if(page==="infantry")crumbs.push({id:"infantry",en:"Infantry",bg:"Пехота"});
  if(category)crumbs.push(category);
 }
 const breadcrumb=(crumb,index)=><React.Fragment key={crumb.id}>{index>0&&<span aria-hidden="true" style={{opacity:.65,padding:"0 7px"}}>/</span>}<button onClick={()=>{if(crumb.id==="protocol-detail"){setPage("skills");}else{setSelectedProtocol(null);setPage(crumb.id);}}} style={{background:"none",border:0,color:"#bcd9e8",padding:"4px 0",cursor:"pointer",fontSize:14}}>{t(crumb.en,crumb.bg)}</button></React.Fragment>;
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
    <button onClick={()=>setPage("ground")} style={card}><span style={{fontSize:44}} aria-hidden="true">⚔</span><span>{t("Ground","Сухопътни")}</span></button>
    {infantryCategories.filter(item=>item.id!=="ground").map(item=><button key={item.id} onClick={()=>setPage(item.id)} style={card}>
     <span style={{fontSize:38}} aria-hidden="true">{item.id==="ground"?"🛡":item.id==="ranged"?"⌖":item.id==="mobile"?"🚀":item.id==="heavy"?"⚙":"✦"}</span>
     <span>{t(item.en,item.bg)}</span>
    </button>)}
   </div>
  </>}
  {page==="ground"&&<>
   <h2>{t("Ground","Сухопътни")}</h2>
   {unit(explorerTrooper,"Войник изследовател",["Infantry unit with the strongest attack against ground and ranged units. Best placed in the first row.","Пехотна единица с най-силна атака срещу сухопътни и стрелкови единици. Най-добре се поставя на първи ред."])}
   {unit(nanoShieldman,"Нано щитоносец",["Fastest infantry unit. Strongest against mobile and heavy systems. Range 2 allows placement in row 1 or 2.","Най-бързата пехотна единица. Най-силна срещу мобилни и тежки системи. Обхват 2 позволява разполагане на първи или втори ред."])}
   {unit(exoSoldier,"Екзовойник",["Infantry unit with equal attack against all unit groups and the highest health among infantry. Best placed in the first row.","Пехотна единица с еднаква атака срещу всички групи и най-много живот сред пехотата. Най-добре се поставя на първи ред."])}
   {unit(plasmaBladesman,"Плазмен мечоносец",["Infantry unit with the strongest attack against heavy systems. Best placed in the first row.","Пехотна единица с най-силна атака срещу тежки системи. Най-добре се поставя на първи ред."])}
  </>}
  {category&&page!=="ground"&&<><h2>{t(category.en,category.bg)}</h2><p style={{padding:14,background:"#172432",border:"1px solid #54758a",borderRadius:10}}>{t("Information for this troop category will be added later.","Информацията за тази категория войски ще бъде добавена по-късно.")}</p></>}
  {section?.id==="skills"&&(nanoArmorSystems?<>
   <h2>{t("Nano Armor Systems","Системи за наноброня")}</h2>
   <p>{t("Longer-lasting units have a better chance to hold the battlefield and help secure victory. Nano Armor Systems strengthens the durability of your entire force.", "Колкото по-дълго единиците ви издържат на бойното поле, толкова по-голям е шансът да победите. Системите за наноброня повишават издръжливостта на цялата ви армия.")}</p>
   <p>{t("The protocol adds its percentage bonus to the health of every unit, across all groups.", "Протоколът добавя процентния си бонус към здравето на всички ваши единици от всички групи.")}</p>
   <p>{t("Example: a Hover Drone Rider has 420 base health. At Elite level, Nano Armor Systems adds 30%, raising its health to 546 (420 + 30% × 420).", "Пример: Пилотът на ховърдрон има базово здраве 420. При елитно ниво Системи за наноброня добавя 30% и го повишава до 546 (420 + 30% × 420).")}</p>
   <h3>{t("Protocol bonuses","Бонуси на протокола")}</h3><ul><li>{t("Initiate: 10%","Начална: 10%")}</li><li>{t("Advanced: 20%","Напреднала: 20%")}</li><li>{t("Elite: 30%","Елитна: 30%")}</li></ul>
  </>:hyperdriveNavigation?<>
   <h2>{t("Hyperdrive Navigation","Хипердвигателна навигация")}</h2>
   <p>{t("Time is a key factor in every campaign. Hyperdrive Navigation increases army movement speed, helping units reach destinations sooner and improving your response time.","Времето е решаващ фактор във всяка кампания. Хипердвигателната навигация увеличава скоростта на придвижване на армията и помага на единиците да достигат целите си по-бързо и да реагират навреме.")}</p>
   <p>{t("The protocol increases movement speed for all units. Travel time is calculated from the improved speed: a one-minute trip takes 37.5 seconds with the Elite 60% speed bonus.","Протоколът увеличава скоростта на всички единици. Времето за път се изчислява според подобрената скорост: пътуване от една минута отнема 37,5 секунди при елитния бонус от 60%.")}</p>
   <h3>{t("Protocol bonuses","Бонуси на протокола")}</h3><ul><li>{t("Initiate: 20%","Начална: 20%")}</li><li>{t("Advanced: 40%","Напреднала: 40%")}</li><li>{t("Elite: 60%","Елитна: 60%")}</li></ul>
  </>:quantumLogistics?<>
   <h2>{t("Quantum Logistics","Квантова логистика")}</h2>
   <p>{t("A strong army and a growing base depend on a reliable economy. Resources are needed to construct buildings, upgrade units and train troops. Quantum Logistics is especially useful early in the game, when every resource helps.","Силната армия и развиващата се база зависят от надеждна икономика. Ресурсите са нужни за строеж на сгради, подобрения и обучение на войски. Квантовата логистика е особено полезна в началото, когато всеки ресурс помага.")}</p>
   <p>{t("The protocol increases production from every resource building: Gold Synthesizer, Iron Driller, Water Extractor and Solar Array. For example, 1,000 resources per hour become 1,300 with the Elite 30% bonus.","Протоколът увеличава добива от всички ресурсни сгради: Златен синтезатор, Железен сондаж, Водоизвличащ модул и Слънчев масив. Например добив от 1 000 ресурса на час става 1 300 при елитния бонус от 30%.")}</p>
   <h3>{t("Protocol bonuses","Бонуси на протокола")}</h3><ul><li>{t("Initiate: 10%","Начална: 10%")}</li><li>{t("Advanced: 20%","Напреднала: 20%")}</li><li>{t("Elite: 30%","Елитна: 30%")}</li></ul>
  </>:nanoRegeneration?<>
   <h2>{t("Nano Regeneration","Нанорегенерация")}</h2>
   <p>{t("Battles can last for several rounds. Nano Regeneration restores some units lost during each round, helping your army remain in the fight longer.","Битките могат да продължат няколко рунда. Нанорегенерацията възстановява част от единиците, загубени през всеки рунд, и помага на армията да се задържи по-дълго в боя.")}</p>
   <p>{t("After each round, the protocol restores its tier percentage of the units lost in that round. For example, if 1,000 units are lost in a round, Elite Nano Regeneration restores 150.","След всеки рунд протоколът възстановява процента за съответната степен от загубените през него единици. Например, ако в рунда са загубени 1 000 единици, елитната Нанорегенерация възстановява 150.")}</p>
   <h3>{t("Protocol bonuses","Бонуси на протокола")}</h3><ul><li>{t("Initiate: 5%","Начална: 5%")}</li><li>{t("Advanced: 10%","Напреднала: 10%")}</li><li>{t("Elite: 15%","Елитна: 15%")}</li></ul>
  </>:siegeEngineering?<>
   <h2>{t("Siege Engineering","Обсадно инженерство")}</h2>
   <p>{t("Siege forces deliver powerful attacks against fortified positions and support your army from a distance. Their slower movement makes careful planning important.","Обсадните сили нанасят мощни удари по укрепени позиции и подкрепят армията от разстояние. По-бавното им придвижване прави доброто планиране важно.")}</p>
   <p>{t("Siege Engineering increases the attack of every unit in the Siege group against all unit types. For example, a siege unit with 180 base attack gains 30% at Elite level, raising its attack to 234 (180 + 30% × 180).","Обсадното инженерство увеличава атаката на всички единици от група Обсада срещу всички видове единици. Например обсадна единица с базова атака 180 получава 30% при елитно ниво и атаката ѝ става 234 (180 + 30% × 180).")}</p>
   <h3>{t("Protocol bonuses","Бонуси на протокола")}</h3><ul><li>{t("Initiate: 10%","Начална: 10%")}</li><li>{t("Advanced: 20%","Напреднала: 20%")}</li><li>{t("Elite: 30%","Елитна: 30%")}</li></ul>
  </>:assaultMobility?<>
   <h2>{t("Assault Mobility","Щурмова мобилност")}</h2>
   <p>{t("Mobile units are fast and durable, making them effective at breaking through enemy lines and reaching vulnerable targets. Assault Mobility is useful for commanders who rely on mobile forces.","Мобилните единици са бързи и издръжливи. Те могат бързо да пробият вражеската линия и да достигнат уязвимите цели. Щурмовата мобилност е полезна за командири, които разчитат на мобилни сили.")}</p>
   <p>{t("Assault Mobility increases the attack of all units in the Mobile group: Rover Scout, Hoverbike Rider, Mech Walker and Hover Drone Rider.","Щурмовата мобилност увеличава атаката на всички единици от група Мобилни: Разузнавателен роувър, Пилот на ховърбайк, Боен мех и Пилот на ховърдрон.")}</p>
   <p>{t("The protocol adds its percentage bonus to each mobile unit’s base attack against every unit type. For example, a Mech Walker with 86 base attack gains 40% at Elite level, raising its attack to 120.4 (86 + 40% × 86).","Протоколът добавя бонуса си към базовата атака на всяка мобилна единица срещу всички видове единици. Например Боен мех с базова атака 86 получава 40% при елитно ниво и атаката му става 120,4 (86 + 40% × 86).")}</p>
   <h3>{t("Protocol bonuses","Бонуси на протокола")}</h3><ul><li>{t("Initiate: 10%","Начална: 10%")}</li><li>{t("Advanced: 25%","Напреднала: 25%")}</li><li>{t("Elite: 40%","Елитна: 40%")}</li></ul>
  </>:precisionTargeting?<>
   <h2>{t("Precision Targeting","Прецизно прицелване")}</h2>
   <p>{t("Ranged units are an important part of a balanced army. They can strike enemies from a distance before they reach your lines. Keep them behind Ground and Mobile units so they are protected from enemy attacks.","Стрелковите единици са важна част от балансираната армия. Те могат да атакуват врага от разстояние, преди да достигне редиците ви. Дръжте ги зад сухопътните и мобилните единици, за да бъдат защитени от противниковите атаки.")}</p>
   <p>{t("Precision Targeting increases the attack of all units in the Ranged group. The listed percentage is added to each unit’s base attack against every unit type.","Прецизно прицелване увеличава атаката на всички единици от група Стрелкови. Посоченият процент се добавя към базовата им атака срещу всички видове единици.")}</p>
   <p>{t("Example: if a ranged unit has 45 base attack against Ground units, Elite Precision Targeting adds 60%, increasing it to 72 (45 + 60% × 45). The same bonus applies to its attack against every other unit type.","Пример: ако стрелкова единица има базова атака 45 срещу сухопътни единици, елитното Прецизно прицелване добавя 60% и я повишава до 72 (45 + 60% × 45). Същият бонус важи и за атаката ѝ срещу всички останали видове единици.")}</p>
   <h3>{t("Protocol bonuses","Бонуси на протокола")}</h3><ul><li>{t("Initiate: 20%","Начална: 20%")}</li><li>{t("Advanced: 40%","Напреднала: 40%")}</li><li>{t("Elite: 60%","Елитна: 60%")}</li></ul>
  </>:combatAugmentation?<><h2>{t("Combat Augmentation","Бойно усилване")}</h2>
   <p>{t("Infantry is the backbone of an army. These fighters combine solid attack and health with low population cost, and can be decisive in battle. Place them in the front rows to keep aggressive enemies away from your ranged units. Combat Augmentation is especially useful if you rely on infantry.","Пехотата е гръбнакът на армията. Тези бойци съчетават добра атака и здраве с ниска цена на население и могат да бъдат решаващи в битка. Поставяйте ги на предните редове, за да държат агресивните противници далеч от стрелковите ви единици. Бойно усилване е особено полезно, ако разчитате на пехота.")}</p>
   <p>{t("The protocol adds the listed percentage to both the attack and health of all your infantry units. In the current game, it applies to all units in the Infantry group.","Протоколът добавя посочения процент към атаката и здравето на всички ваши пехотни единици. В текущата версия на играта той важи за всички единици от група Пехота.")}</p>
   <p>{t("Example: Exo-Soldier has 80 base health. At Elite level, Combat Augmentation adds 40%, raising its health to 112 (80 + 40% × 80). Its base attack against cavalry is 40; the same bonus raises it to 56 (40 + 40% × 40).","Пример: Базовото здраве на Екзовойника е 80. При елитно ниво Бойно усилване добавя 40% и повишава здравето му до 112 (80 + 40% × 80). Базовата атака на Екзовойника срещу мобилни единици е 40; същият бонус я повишава до 56 (40 + 40% × 40).")}</p>
   <p>{t("Some special units in Colonize Mars also receive this protocol bonus. Those units are not part of the current roster.","В Colonize Mars някои специални единици също получават бонус от този протокол. Те не са част от текущия набор от войски.")}</p>
   <h3>{t("Protocol bonuses","Бонуси на протокола")}</h3><ul><li>{t("Initiate: 10%","Начална: 10%")}</li><li>{t("Advanced: 25%","Напреднала: 25%")}</li><li>{t("Elite: 40%","Елитна: 40%")}</li></ul>
  </>:neuralCommand?<><h2>{t("Neural Command","Невронно командване")}</h2>
   <p>{t("Neural Command increases your army's morale. Before each battle, some of the army with lower morale may flee and will not take part. These units do not disappear permanently; they remain alive and can be used after the battle. Their absence on the battlefield can decide the outcome, especially when the armies are evenly matched.","Невронно командване увеличава морала на армията ви. Преди всяка битка част от армията с по-нисък морал може да избяга и да не участва в нея. Тези единици не изчезват завинаги — остават живи и могат да се използват след битката. Отсъствието им на бойното поле може да реши изхода, особено при равностойни армии.")}</p>
   <p>{t("The number of units that flee depends on both players' Neural Command levels. Subtract the lower percentage from the higher one. Then 20–30% of the difference is calculated; this is the final percentage of population that flees.","Броят на единиците, които ще избягат, зависи от нивото на Невронно командване на двамата играчи. По-ниският процент се изважда от по-високия. След това се изчисляват между 20 и 30% от разликата; това е крайният процент население, което ще избяга.")}</p>
   <p>{t("Example: Player A has 30% Neural Command and Player B has 10%. The difference is 20%. Between 20% and 30% of that difference gives 4–6% of Player B's population fleeing.","Пример: Играч А има 30% Невронно командване, а Играч Б — 10%. Разликата е 20%. Между 20% и 30% от нея означава, че ще избягат 4–6% от населението на Играч Б.")}</p>
   <p>{t("If Player B has a population of 10,000, then 400–600 population will not take part in the battle. The unit types that flee are chosen at random.","Ако населението на Играч Б е 10 000, между 400 и 600 население няма да участва в битката. Видовете единици, които ще избягат, се избират на случаен принцип.")}</p>
   <h3>{t("Protocol bonuses","Бонуси на протокола")}</h3><ul><li>{t("Initiate: 10%","Начална: 10%")}</li><li>{t("Advanced: 20%","Напреднала: 20%")}</li><li>{t("Elite: 30%","Елитна: 30%")}</li></ul>
  </>:<><h2>{t(section.en,section.bg)}</h2><p style={{padding:14,background:"#172432",border:"1px solid #54758a",borderRadius:10}}>{t("Allocate Protocol Points (PP) to improve commander protocols. Each protocol has three tiers: Initiate, Advanced and Elite. Their bonuses are listed below in tier order.","Разпределяй точки за протоколи (ТП), за да подобряваш протоколите на командира. Всеки протокол има три степени: начална, напреднала и елитна. Бонусите по-долу са подредени по степени.")}<br/>{t("Upgrade costs: Initiate 1 PP · Advanced 2 PP · Elite 3 PP.","Цена за подобрение: Начална 1 ТП · Напреднала 2 ТП · Елитна 3 ТП.")}</p><div style={cardGrid}>{commanderProtocols.map(item=><article key={item.en} style={{padding:14,background:"#172432",border:"1px solid #54758a",borderRadius:10}}>{["Neural Command","Combat Augmentation","Precision Targeting","Assault Mobility","Nano Armor Systems","Hyperdrive Navigation","Quantum Logistics","Nano Regeneration","Siege Engineering"].includes(item.en)?<button onClick={()=>setSelectedProtocol(item.en)} style={{display:"block",width:"100%",padding:0,textAlign:"left",color:"inherit",background:"none",border:0,cursor:"pointer"}}><h3 style={{marginTop:0,textDecoration:"underline"}}>{t(item.en,item.bg)}</h3></button>:<h3 style={{marginTop:0}}>{t(item.en,item.bg)}</h3>}<p>{t(item.effectEn,item.effectBg)} · {t("bonus","бонус")}</p><p><strong>{t("Colonize Mars skill","Умение в Colonize Mars")}:</strong> {t(item.khanEn,item.khanBg)}</p><p><strong>{t("Tier bonuses","Бонуси по степени")}:</strong> {item.values.map(v=>v+"%").join(" / ")}</p><p style={{opacity:.8,fontSize:13}}>{t("Initiate / Advanced / Elite","Начална / Напреднала / Елитна")}</p></article>)}</div></>)}{section&&section.id!=="units"&&section.id!=="skills"&&<><h2>{t(section.en,section.bg)}</h2><p style={{padding:14,background:"#172432",border:"1px solid #54758a",borderRadius:10}}>{section.id==="knight"?t("Cyber Knight information will be added later.","Информацията за Кибер Рицаря ще бъде добавена по-късно."):section.id==="campaigns"?t("Campaign types and details will be added here later.","Тук по-късно ще добавим видовете кампании и подробности за тях."):t("Information for this section will be added later.","Информацията за този раздел ще бъде добавена по-късно.")}</p></>}
 </div>;
}
