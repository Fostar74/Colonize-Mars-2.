import { useLanguage } from "../language";
// Final StructurePanel.jsx with internal tab buttons restored
import React, { useState, useEffect, useRef } from "react";
import "./StructurePanel.css";
import unitEconomy from "../shared/unitEconomy";
import goldIcon from "../images/gold.png";
import ironIcon from "../images/iron.png";
import waterIcon from "../images/water.png";
import solarIcon from "../images/solar.png";
const {unitPrice,upgradePrice,upgradeDuration,unitRequirement,buildingPrice} = unitEconomy;

const structureTypes = {
  Resources: ["Gold Synthesizer", "Iron Driller", "Solar Array", "Water Extractor"],
  Economy: ["Cargo Depot", "Defense Grid", "Upgrade Lab", "Bio-Lab"],
  Military: ["Training Center", "Combat Simulator", "Vehicle Bay", "Drone Factory"]
};

const unitCategories = {
  Ground: ["Explorer Trooper", "Exo-Soldier", "Plasma Bladesman", "Nano Shieldman"],
  Ranged: ["Railgunner", "Pulse Sniper", "Drone Operator"],
  Mobile: ["Rover Scout", "Hoverbike Rider", "Mech Walker", "Hover Drone Rider"],
  "Heavy Systems": ["Demolition Bot", "Missile Carrier", "Particle Blaster", "Orbital Strike Beacon"],
  Elite: ["AI General", "Gene Warrior"]
};

function StructurePanel({ upgradesOnly = false, onOpenUpgrades, onOpenSimulator, onProgressChange, questTarget }) {
  const { t , label: localLabel} = useLanguage();
  const questDestination = useRef(null);
  const focusedQuest = useRef(null);
  const [activeTab, setActiveTab] = useState(upgradesOnly ? "upgrades" : "structures");
  const [structures, setStructures] = useState(() => { try { return JSON.parse(sessionStorage.getItem("structures") || "{}"); } catch { return {}; } });
  const [resources, setResources] = useState(() => { try { return JSON.parse(sessionStorage.getItem("resources") || "{}"); } catch { return {}; } });
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [game, setGame] = useState({});
  const [clock, setClock] = useState(Date.now());
  const [allianceHelpMessage,setAllianceHelpMessage]=useState("");
  const [allianceHelpBusy,setAllianceHelpBusy]=useState(false);
  const [allianceHelpRequests,setAllianceHelpRequests]=useState([]);
  const base = (process.env.REACT_APP_API_URL || (window.location.hostname === "localhost" ? "http://localhost:3001" : window.location.origin)).replace(/\/$/, "");
  const userId = sessionStorage.getItem("userId");
  const apply = (data) => {
    const progress = data.gameProgress || data;
    if (progress.resources) {
      setResources(progress.resources);
      sessionStorage.setItem("resources", JSON.stringify(progress.resources));
    }
    if (progress.structures) {
      setStructures(progress.structures);
      sessionStorage.setItem("structures", JSON.stringify(progress.structures));
    }
    setGame(progress);
    window.dispatchEvent(new Event("game-progress-updated"));
    if (onProgressChange) onProgressChange(progress);
  };
  const request = async (path, payload) => {
    const response = await fetch(base + path, {
      method: payload ? "POST" : "GET",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + sessionStorage.getItem("authToken") },
      ...(payload ? { body: JSON.stringify({ userId, ...payload }) } : {})
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || "Action failed");
    return data;
  };
  const refreshAllianceHelp = async () => {
    try {
      const response=await fetch(base+"/alliance/"+encodeURIComponent(userId),{headers:{Authorization:"Bearer "+sessionStorage.getItem("authToken")},cache:"no-store"});
      const data=await response.json();
      if(response.ok)setAllianceHelpRequests(data.requests||[]);
    } catch (_) {}
  };
  const eligibleAllianceHelp=allianceHelpRequests.filter(item=>!item.helped&&String(item.requester_id)!==String(userId));
  const helpAlliance=async()=>{
    if(!eligibleAllianceHelp.length)return;
    setAllianceHelpBusy(true);setAllianceHelpMessage("");
    let helped=0,failed=0;
    for(const item of eligibleAllianceHelp){
      try {
        const response=await fetch(base+"/alliance/help",{method:"POST",headers:{"Content-Type":"application/json",Authorization:"Bearer "+sessionStorage.getItem("authToken")},body:JSON.stringify({userId,requestId:item.id})});
        if(response.ok)helped++;else failed++;
      } catch (_) { failed++; }
    }
    setAllianceHelpMessage(`Helped ${helped} alliance construction(s)${failed?`; ${failed} failed`:""}.`);
    await refreshAllianceHelp();
    setAllianceHelpBusy(false);
  };
  useEffect(() => {
    let active = true;
    const refresh = async () => {
      if (!userId) return;
      try {
        const data = await request("/get-progress/" + encodeURIComponent(userId));
        if (active) apply(data);
        if (active) await refreshAllianceHelp();
      } catch (e) { if (active) setError(e.message); }
    };
    refresh();
    const interval = setInterval(refresh, 5000);
    const ticker = setInterval(() => setClock(Date.now()), 1000);
    return () => { active = false; clearInterval(interval); clearInterval(ticker); };
  // Refresh is scoped to the mounted panel, not each render.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);
  const act = async (path, payload, label) => {
    setBusy(label); setError("");
    try { apply(await request(path, payload)); }
    catch (e) { setError(e.message); }
    finally { setBusy(""); }
  };
  const requestBuildingHelp=async()=>{
    setAllianceHelpBusy(true);setAllianceHelpMessage("");
    try{
      const response=await request("/alliance/request-help",{});
      setAllianceHelpMessage("Help request sent to your alliance. Members can now assist from Alliance → Help Requests.");
      window.dispatchEvent(new Event("alliance-help-updated"));
    }catch(e){setAllianceHelpMessage(e.message);}
    finally{setAllianceHelpBusy(false);}
  };
  const upgrade = name => act("/upgrade-building", { name }, name);
  const remaining = job => job ? Math.max(0, Math.ceil((job.endsAt - clock) / 1000)) : 0;
  const [unitTab, setUnitTab] = useState("Ground");
  const [upgradeSlot, setUpgradeSlot] = useState(null);
  const [upgradeCategory, setUpgradeCategory] = useState("Ground");
  const [trainAmounts, setTrainAmounts] = useState({});

  const baseTrainTime = 30;

  const formatTime = (seconds) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  const calculateMaxTrainable = (unit) => {
    const limits = Object.entries(unitPrice(unit)).map(([key, price]) => Math.floor((Number(resources[key]) || 0) / price));
    return Math.max(0, Math.min(...limits));
  };

  const handlePresetClick = (unit, fraction) => {
    const max = calculateMaxTrainable(unit);
    setTrainAmounts((prev) => ({
      ...prev,
      [unit]: Math.floor(max * fraction)
    }));
  };

  const [expandedSections, setExpandedSections] = useState({ Resources: true });
  const questSection = questTarget?.section ?? Object.keys(structureTypes)
    .find(section => structureTypes[section].includes(questTarget?.building));

  useEffect(() => {
    if (!questTarget) return;
    setActiveTab(questTarget.tab || "structures");
    setExpandedSections(questSection ? { [questSection]: true } : {});
  }, [questTarget, questSection]);

  useEffect(() => {
    if (!questTarget || focusedQuest.current === questTarget || !questDestination.current) return;
    if (activeTab !== (questTarget.tab || "structures")) return;
    if (questSection && !expandedSections[questSection]) return;
    questDestination.current.scrollIntoView({ block: "start" });
    focusedQuest.current = questTarget;
  }, [questTarget, questSection, activeTab, expandedSections]);

  const buildingImages = { "Gold Synthesizer": goldIcon, "Iron Driller": ironIcon, "Solar Array": solarIcon, "Water Extractor": waterIcon };
  const renderStructures = () => (
    <>
      <h2 style={{ textAlign: "center" }}>{t("Structures","Сгради")}</h2>
      {error && <p role="alert" style={{color:"#ff7777"}}>{localLabel(error)}</p>}
      {!questTarget && <p style={{textAlign:"center",opacity:.8}}>{t("Build your resource facilities first. Upgrade all four to level 3.","Първо построй ресурсните съоръжения. Надстрой и четирите до ниво 3.")}</p>}
      <p style={{textAlign:"center"}}>
        {t("Production per hour:","Производство на час:")} {["Gold", "Iron", "Water", "Solar"].map(resource =>
          `${localLabel(resource)} ${(game.productionPerHour?.[resource] ?? 0).toLocaleString("en-US", {maximumFractionDigits: 1})}`
        ).join(" · ")}
      </p>
      <p>{t("Construction:","Строеж:")} {game.buildingJob ? localLabel(game.buildingJob.name) + " (" + formatTime(remaining(game.buildingJob)) + ")" : t("Idle","Няма")} {t("· Queue:","· Опашка:")} {game.queuedBuildingJob ? localLabel(game.queuedBuildingJob.name) + t(" (level "," (ниво ") + game.queuedBuildingJob.level + ")" : t("Empty","Празна")}</p>
      {game.buildingJob&&<div style={{padding:12,margin:"12px 0",border:"1px solid #4b96ac",borderRadius:8,background:"#183449"}}>
        <strong>{t("🤝 Alliance Construction Help","🤝 Строителна помощ от алианса")}</strong>
        <p>{t("Ask your alliance to speed up","Поискай от алианса да ускори")} {localLabel(game.buildingJob.name)} {t("(Level","(Ниво")} {game.buildingJob.level}{t("). Each member can reduce the remaining construction time by 1 minute or 1%, whichever is greater, and earn 1 token.","). Всеки член може да намали оставащото време с 1 минута или 1%, което е повече, и да спечели 1 жетон.")}</p>
        <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
          <button className="upgrade-btn" disabled={allianceHelpBusy} onClick={requestBuildingHelp}>{allianceHelpBusy?localLabel("Sending..."):localLabel("Request Alliance Help")}</button>
          <button type="button" disabled={allianceHelpBusy||!eligibleAllianceHelp.length} onClick={helpAlliance}
            style={{background:eligibleAllianceHelp.length?"#bd3030":"#777",color:"#fff",border:"1px solid "+(eligibleAllianceHelp.length?"#ef7777":"#999"),borderRadius:5,padding:"8px 12px",fontWeight:"bold",cursor:eligibleAllianceHelp.length?"pointer":"not-allowed"}}>
            {allianceHelpBusy?localLabel("Helping..."):t("Help Alliance","Помогни на алианса")}{eligibleAllianceHelp.length?` (${eligibleAllianceHelp.length})`:""}
          </button>
        </div>
        {allianceHelpMessage&&<p role="status">{localLabel(allianceHelpMessage)}</p>}
      </div>}
      {Object.entries(structureTypes).map(([section, buildings]) => (
        <section key={section} ref={questSection === section && !questTarget?.building ? questDestination : null} style={{marginBottom:16}}>
          <button type="button" onClick={() => setExpandedSections(prev => ({...prev,[section]:!prev[section]}))}
            style={{width:"100%",textAlign:"left",padding:"12px 16px",background:"#333",color:"#fff",border:"1px solid #555",cursor:"pointer",fontWeight:"bold"}}>
            {expandedSections[section] ? "▾" : "▸"} {localLabel(section)} {section === "Resources" ? t("— start here","— започни тук") : ""}
          </button>
          {expandedSections[section] && <div className="building-grid">
            {buildings.map(name => {
              const level = Number(structures[name] || 0);
              const next = level + (game.buildingJob?.name === name ? 1 : 0) + 1;
              const cost = buildingPrice(name, next, game.allianceBonuses?.discount) || {Gold:0,Iron:0,Water:0,Solar:0};
              const affordable = Object.entries(cost).every(([key,amount]) => Number(resources[key] || 0) >= amount);
              return <div key={name} ref={questTarget?.building === name ? questDestination : null} className="building" style={{padding:14}}>
                {buildingImages[name] && <img src={buildingImages[name]} alt="" style={{width:44,height:44,objectFit:"contain"}} />}
                <h4 style={{margin:"6px 0"}}>{localLabel(name)}</h4>
                <div>{t("Level","Ниво")} {level} / 20</div>
                {name === "Upgrade Lab" && level > 0 && <button onClick={onOpenUpgrades}>{t("Upgrade Center","Център за подобрения")}</button>}
                {name === "Combat Simulator" && <button type="button" disabled={level < 1} onClick={onOpenSimulator} style={{marginTop:6}}>
                  {level < 1 ? t("Build level 1 to unlock","Построй ниво 1 за отключване") : t("Open Combat Simulator","Отвори бойния симулатор")}
                </button>}
                {game.buildingJob?.name === name && <div>{t("Construction:","Строеж:")} {formatTime(remaining(game.buildingJob))}</div>}
                {game.queuedBuildingJob?.name === name && <div>{t("Queued: Level","На опашката: ниво")} {game.queuedBuildingJob.level}</div>}
                <p style={{fontSize:13,opacity:.85,margin:"8px 0"}}>{t("Next:","Следващо:")} {cost.Gold} {t("Gold ·","злато ·")} {cost.Iron} {t("Iron ·","желязо ·")} {cost.Water} {t("Water ·","вода ·")} {cost.Solar} {t("Solar","слънчева енергия")}</p>
                <button className="upgrade-btn" disabled={!!busy || !!game.queuedBuildingJob || next > 20 || !affordable} onClick={() => upgrade(name)}>
                  {busy === name ? "Starting..." : game.queuedBuildingJob ? localLabel("Queue full") : next > 20 ? localLabel("Max level") : game.buildingJob ? localLabel("Queue as second") : !affordable ? localLabel("Not enough resources") : level === 0 ? localLabel("Build") : localLabel("Upgrade")}
                </button>
              </div>;
            })}
          </div>}
        </section>
      ))}
    </>
  );

  const renderUnits = () => (
    <>
      <h2 style={{ textAlign: "center" }}>{t("Army Units","Военни единици")}</h2>
      <section style={{padding:12,marginBottom:14,border:"1px solid #478da4",borderRadius:8}}>
        <strong>{t("Barracks Reserve — trained troops awaiting mobilization","Казармен резерв · обучени войски, чакащи мобилизация")}</strong>
        <p>{t("Completed training goes to reserve, not directly into your active army.","Обучените войски се прибират в резерва до мобилизация.")}</p>
        {Object.entries(game.barracksReserve||{}).filter(([,n])=>Number(n)>0).map(([unit,n])=><div key={unit} style={{display:"flex",gap:12,alignItems:"center",margin:"6px 0"}}>
          <span>{localLabel(unit)}: {n}</span>
          <button disabled={!!busy} onClick={()=>act("/barracks/mobilize",{unit,amount:n},"mobilize-"+unit)}>{t("Mobilize","Мобилизирай")}</button>
        </div>)}
        {!Object.values(game.barracksReserve||{}).some(n=>Number(n)>0)&&<p>{t("Reserve empty.","Резервът е празен.")}</p>}
        <button disabled={!!busy||!Object.values(game.barracksReserve||{}).some(n=>Number(n)>0)} onClick={()=>act("/barracks/mobilize",{unit:"ALL"},"mobilize-all")}>{t("Mobilize All","Мобилизирай всички")}</button>
      </section>
      {error && <p role="alert" style={{color:"#ff7777"}}>{localLabel(error)}</p>}
      <div className="subtab-buttons">
        {Object.keys(unitCategories).map((cat) => (
          <button key={cat} onClick={() => setUnitTab(cat)}>{localLabel(cat)}</button>
        ))}
      </div>
      <section style={{padding:10,border:"1px solid #587c91",borderRadius:8,marginBottom:12}}>
        <strong>{unitTab} {t("training groups:","групи за обучение:")} {(game.trainingQueues?.[unitTab]||[]).length}/5</strong>
        {(game.trainingQueues?.[unitTab]||[]).map((job,index)=><div key={index}>
          {index+1}. {job.quantity} × {localLabel(job.unit)} — {index===0?localLabel("Training"):localLabel("Queued")} · {index===0?formatTime(remaining(job)):"Starts "+new Date(job.startsAt).toLocaleTimeString()}
        </div>)}
        {!(game.trainingQueues?.[unitTab]||[]).length&&<p>{t("No training groups in this category.","Няма групи в тази категория.")}</p>}
        <p>{t("Each category runs independently. Up to five groups are trained sequentially per category.","Категориите се обучават независимо. Във всяка се редят до пет групи.")}</p>
      </section>
      <div className="unit-grid">
        {unitCategories[unitTab].map((unit) => {
          const qty = Number(trainAmounts[unit]) || 0;
          const totalTime = baseTrainTime * qty;
          const price = unitPrice(unit);
          const requirement = unitRequirement(unit);
          const unlocked = Number(structures[requirement.building] || 0) >= requirement.level;
          const timeDisplay = formatTime(totalTime);

          return (
            <div key={unit} className="unit-card" style={{filter:unlocked?"none":"grayscale(1)",opacity:unlocked?1:0.62,border:unlocked?"1px solid #40a7b9":"1px solid #777",transition:"filter .25s, opacity .25s, border-color .25s"}}>
              <div aria-hidden="true" style={{fontSize:36,filter:unlocked?"none":"grayscale(1)",marginBottom:4}}>{unitTab==="Ground"?"🪖":unitTab==="Ranged"?"🎯":unitTab==="Mobile"?"🚙":unitTab==="Heavy Systems"?"🤖":"⚔️"}</div>
              <h4>{localLabel(unit)}</h4>
              {unlocked && <p style={{color:"#79dfad",fontWeight:"bold"}}>{t("Unlocked · Ready to train","Отключена · готова за обучение")}</p>}
              {!unlocked && <p style={{color:"#ffbb77"}}>{t("Locked: Requires","Заключена: изисква")} {requirement.building} {t("level","ниво")} {requirement.level}</p>}
              <div className="train-slider">
                <button disabled={!unlocked} onClick={() => handlePresetClick(unit, 0)}>–</button>
                <button onClick={() => handlePresetClick(unit, 0.25)}>1/4</button>
                <button onClick={() => handlePresetClick(unit, 0.5)}>1/2</button>
                <button onClick={() => handlePresetClick(unit, 0.75)}>3/4</button>
                <button onClick={() => handlePresetClick(unit, 1)}>{t("+ MAX","+ МАКС.")}</button>
              </div>
              <label>{t("Quantity:","Количество:")} <input type="number" disabled={!unlocked} min="0" max="10000" value={qty} onChange={e => setTrainAmounts(prev => ({...prev, [unit]:Math.max(0,Math.min(10000,Math.floor(Number(e.target.value)||0)))}))} style={{width:90,color:"#111"}} /></label>
              <p>{t("Train Time:","Време за обучение:")} {timeDisplay}</p>
              {(game.trainingQueues?.[unitTab]||[]).filter(job=>job.unit===unit).length>0 && <p>{t("Groups queued:","Групи на опашката:")} {(game.trainingQueues?.[unitTab]||[]).filter(job=>job.unit===unit).length}</p>}
              <p>{t("Owned:","Налични:")} {Number(game.army?.[unit] || 0)}</p>
              <div className="resource-row">
                <div className="resource-cost"><img src={goldIcon} alt="Gold" /><span>{price.Gold}</span></div>
                <div className="resource-cost"><img src={ironIcon} alt="Iron" /><span>{price.Iron}</span></div>
                <div className="resource-cost"><img src={waterIcon} alt="Water" /><span>{price.Water}</span></div>
                <div className="resource-cost"><img src={solarIcon} alt="Solar" /><span>{price.Solar}</span></div>
              </div>
              <button style={{ marginTop: 10 }} disabled={!unlocked || !qty || qty > calculateMaxTrainable(unit) || !!busy || (game.trainingQueues?.[unitTab]||[]).length>=5} onClick={() => act("/train-units", {unit, quantity:qty}, unit)}>
                {!unlocked ? localLabel("Locked") : (game.trainingQueues?.[unitTab]||[]).length>=5 ? "Category queue full" : "Train"}
              </button>
            </div>
          );
        })}
      </div>
    </>
  );

  const renderUpgrades = () => (
    <>
      {error && <p role="alert" style={{color:"#ff7777"}}>{localLabel(error)}</p>}
      <div className="upgrade-slots">
        {[0,1].map(slot=>{
          const job = game.upgradeJobs?.[slot];
          const selectable = !job && (slot === 0 || !!game.upgradeJobs?.[0]);
          const status = job
            ? `${localLabel(job.unit)} · ${job.stat === "attack" ? localLabel("Attack") : localLabel("Health / Defense")} · ${t("Level","Ниво")} ${job.level} · ${job.endsAt == null ? t("Queued","На опашка") : formatTime(remaining(job))}`
            : t("Empty","Свободен");
          return <button key={slot} className="upgrade-slot" disabled={!selectable}
            aria-pressed={upgradeSlot === slot && selectable} onClick={()=>setUpgradeSlot(slot)}>
            {t("Slot","Слот")} {slot+1} · {status}
          </button>;
        })}
      </div>
      {upgradeSlot === (game.upgradeJobs?.[0] ? 1 : 0) && !game.upgradeJobs?.[upgradeSlot] && <div className="upgrade-window">
        <h4>{t("Choose Unit Category","Избери категория войски")}</h4>
        <div className="subtab-buttons">
          {Object.keys(unitCategories).map(cat=><button key={cat} onClick={()=>setUpgradeCategory(cat)}>{localLabel(cat)}</button>)}
        </div>
        <div className="unit-grid">
          {unitCategories[upgradeCategory].map(unit=>(
            <div key={unit} className="unit-card">
              <h4>{localLabel(unit)}</h4>
              {["attack","defense"].map(stat=>{
                const level=Number(game.unitUpgrades?.[unit]?.[stat] ?? 1);
                const cost=upgradePrice(level, game.allianceBonuses?.discount);
                const affordable=Object.entries(cost).every(([key,value])=>Number(resources[key]||0)>=value);
                return <div key={stat} style={{marginBottom:12}}>
                  <p>{stat==="attack"?localLabel("Attack"):localLabel("Health / Defense")} {t("Level:","Ниво:")} {level}</p>
                  <p>{t("Next level","Следващо ниво")} {Math.min(20,level+1)}: {cost.Gold.toLocaleString()} {t("Gold +","злато +")} {cost.Iron.toLocaleString()} {t("Iron ·","желязо ·")} {formatTime(Math.ceil(upgradeDuration(level, game.allianceBonuses?.speed)/1000))}</p>
                  <button disabled={!!busy || level>=20 || !affordable || !!game.upgradeJobs?.[upgradeSlot] || (game.upgradeJobs||[]).some(j=>j?.unit===unit&&j?.stat===stat)}
                    onClick={()=>act("/upgrade-unit",{unit,stat,slot:upgradeSlot},unit+" "+stat)}>
                    {level>=20?localLabel("MAX LEVEL"):stat==="attack"?localLabel("Upgrade Attack"):localLabel("Upgrade Health / Defense")}
                  </button>
                </div>;
              })}
            </div>
          ))}
        </div>
      </div>}
    </>
  );

  return (
    <div style={{ color: "white", padding: "10px" }}>
      {!upgradesOnly && <div className="subtab-buttons">
        <button onClick={() => setActiveTab("structures")}>{t("Structures","Сгради")}</button>
        <button onClick={() => setActiveTab("units")}>{t("Units","Войски")}</button>
        <button onClick={onOpenUpgrades}>{t("Upgrades","Подобрения")}</button>
      </div>}
      <div className="building-tab" ref={questTarget?.tab === "units" ? questDestination : null}>
        {activeTab === "structures" && renderStructures()}
        {activeTab === "units" && renderUnits()}
        {activeTab === "upgrades" && renderUpgrades()}
      </div>
    </div>
  );
}

export default StructurePanel;
