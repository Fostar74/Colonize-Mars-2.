import React,{useEffect,useState} from "react";
import {useLanguage} from "../language";
import formations from "../shared/formations";
import unitEconomy from "../shared/unitEconomy";

const units=Object.values(unitEconomy.categories).flat();
const {marchLimit,defaultFormation,normalizeFormation}=formations;

export default function BattleSimulator(){
  const {t,label}=useLanguage();
  const api=(process.env.REACT_APP_API_URL||(window.location.hostname==="localhost"?"http://localhost:3001":window.location.origin)).replace(/\/$/,"");
  const userId=sessionStorage.getItem("userId");
  const headers=()=>({"Content-Type":"application/json",Authorization:"Bearer "+sessionStorage.getItem("authToken")});
  const [army,setArmy]=useState({});
  const [structures,setStructures]=useState({});
  const [campaign,setCampaign]=useState(null);
  const [level,setLevel]=useState(1);
  const [selected,setSelected]=useState({});
  const [formationSlot,setFormationSlot]=useState("default");
  const [busy,setBusy]=useState(false);
  const [notice,setNotice]=useState("");
  const [result,setResult]=useState(null);
  const [simulationInfo,setSimulationInfo]=useState(null);

  useEffect(()=>{
    let active=true;
    Promise.all([
      fetch(api+"/get-progress/"+encodeURIComponent(userId),{headers:headers(),cache:"no-store"}),
      fetch(api+"/alien-campaign/"+encodeURIComponent(userId),{headers:headers(),cache:"no-store"})
    ]).then(async([progressResponse,campaignResponse])=>{
      const progress=await progressResponse.json();
      const data=await campaignResponse.json();
      if(!progressResponse.ok)throw Error(progress.message||"Could not load your army.");
      if(!campaignResponse.ok)throw Error(data.message||"Could not load alien bases.");
      if(!active)return;
      setArmy(progress.gameProgress?.army||{});
      setStructures(progress.gameProgress?.structures||{});
      setCampaign(data);
      const saved=data.formations?.attackPresets||data.formations?.presets||{};
      const first=Object.keys(saved)[0];
      if(first)setFormationSlot(String(first));
    }).catch(error=>{if(active)setNotice(error.message);});
    return()=>{active=false;};
  },[]);

  const saved=campaign?.formations?.attackPresets||campaign?.formations?.presets||{};
  const names=campaign?.formations?.attackNames||campaign?.formations?.names||{};
  const rows=normalizeFormation(saved[formationSlot]||defaultFormation());
  const total=Object.values(selected).reduce((sum,count)=>sum+(Number(count)||0),0);
  const garrison=campaign?.garrisons?.[level]||{};
  const previewBoard=[4,3,2,1].map(row=>({
    row,
    units:Array.from({length:7},(_,column)=>{
      const unit=units.find(name=>rows[name]===row&&rows.columns[name]===column);
      return unit&&Number(selected[unit]||0)>0?{unit,count:Number(selected[unit])}:null;
    })
  }));

  const setQuantity=(unit,value)=>{
    const max=Number(army[unit]||0);
    setSelected(previous=>{
      const currentTotal=Object.values(previous).reduce((sum,count)=>sum+(Number(count)||0),0);
      const allowed=Math.max(0,marchLimit-currentTotal+(Number(previous[unit])||0));
      return {...previous,[unit]:Math.max(0,Math.min(max,allowed,Math.floor(Number(value)||0)))};
    });
  };
  const selectUpToLimit=()=>{
    let remaining=marchLimit;
    const next={};
    for(const unit of units){next[unit]=Math.min(remaining,Number(army[unit]||0));remaining-=next[unit];}
    setSelected(next);
  };
  const runSimulation=async()=>{
    setBusy(true);setNotice("");setResult(null);
    try{
      const formation=units.filter(unit=>Number(selected[unit]||0)>0).map(unit=>({unit,count:Number(selected[unit]),row:rows[unit]||1}));
      const response=await fetch(api+"/battle-simulator/simulate",{method:"POST",headers:headers(),body:JSON.stringify({userId,level:Number(level),army:selected,formation})});
      const data=await response.json();
      if(!response.ok)throw Error(data.message||"Simulation failed.");
      setResult(data.result);
      setSimulationInfo(data);
      window.dispatchEvent(new Event("game-progress-updated"));
    }catch(error){setNotice(error.message);}
    finally{setBusy(false);}
  };

  return <div style={{color:"#edf6ff",padding:12}}>
    <h2 style={{marginTop:0}}>{t("Tactical Battle Simulator","Тактически боен симулатор")}</h2>
    <p>{t("Choose an alien base, troops and a saved attack formation. Simulations never consume troops or grant battle rewards.","Избери извънземна база, войници и запазена атакуваща формация. Симулацията не отнема войници и не дава бойни награди.")}</p>
    {notice&&<p role="alert" style={{color:"#ffbd9b"}}>{label(notice)}</p>}
    {!campaign?<p>{t("Loading simulator...","Зареждане на симулатора…")}</p>:<>
      <div style={{display:"flex",gap:12,flexWrap:"wrap",alignItems:"center",margin:"12px 0"}}>
        <label>{t("Alien base level","Ниво на извънземната база")}{" "}
          <select value={level} onChange={event=>{setLevel(Number(event.target.value));setResult(null);}}>
            {Array.from({length:20},(_,index)=>index+1).map(item=><option key={item} value={item}>{t("Level","Ниво")} {item}</option>)}
          </select>
        </label>
        <label>{t("Attack formation","Формация за атака")}{" "}
          <select value={formationSlot} onChange={event=>setFormationSlot(event.target.value)}>
            <option value="default">{t("Default attack","Стандартна атака")}</option>
            {Object.keys(saved).map(slot=><option key={slot} value={slot}>{names[slot]||t("Attack formation","Формация за атака")+" "+slot}</option>)}
          </select>
        </label>
      </div>
      <section style={{padding:10,marginBottom:12,border:"1px solid #52758b",borderRadius:8,background:"#172a3a"}}>
        <strong>{t("Alien garrison","Извънземен гарнизон")} · {t("Level","Ниво")} {level}</strong>
        <div style={{display:"flex",gap:12,flexWrap:"wrap",marginTop:6}}>
          {Object.entries(garrison).map(([unit,count])=><span key={unit}>{label(unit)}: {Number(count).toLocaleString()}</span>)}
          <strong>{t("Total","Общо")}: {Object.values(garrison).reduce((sum,count)=>sum+Number(count||0),0).toLocaleString()}</strong>
        </div>
      </section>
      <p>{t("Selected troops:","Избрани войници:")} {total.toLocaleString()} / {marchLimit.toLocaleString()}</p>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(185px,1fr))",gap:8}}>
        {units.filter(unit=>Number(army[unit]||0)>0).map(unit=><label key={unit} style={{display:"grid",gap:5,padding:9,background:"#20384d",border:"1px solid #46637a",borderRadius:6}}>
          <strong>{label(unit)}</strong>
          <small>{t("Available:","Налични:")} {Number(army[unit]).toLocaleString()}</small>
          <input type="number" min="0" max={Number(army[unit])} value={selected[unit]||0} disabled={busy}
            onChange={event=>setQuantity(unit,event.target.value)}/>
        </label>)}
      </div>
      <div style={{display:"flex",gap:8,flexWrap:"wrap",margin:"12px 0"}}>
        <button type="button" disabled={busy} onClick={selectUpToLimit}>{t("Select up to 50,000","Избери до 50 000")}</button>
        <button type="button" disabled={busy} onClick={()=>setSelected({})}>{t("Clear","Изчисти")}</button>
      </div>
      <h3>{t("Formation preview · Row 4 is the rear","Преглед на формацията · ред 4 е най-отзад")}</h3>
      <div style={{overflowX:"auto"}}><div style={{minWidth:620,display:"grid",gridTemplateColumns:"52px repeat(7,minmax(0,1fr))",gap:5}}>
        {previewBoard.map(({row,units:rowUnits})=><React.Fragment key={row}><strong style={{alignSelf:"center",textAlign:"center"}}>{row}<br/>{t("ROW","РЕД")}</strong>
          {rowUnits.map((entry,column)=><div key={column} style={{minHeight:62,padding:5,background:"#e9dfc5",color:"#211c16",border:"1px solid #897b60",borderRadius:4,textAlign:"center",fontSize:12}}>
            {entry&&<><strong>{label(entry.unit)}</strong><br/><b>{entry.count.toLocaleString()}</b></>}
          </div>)}
        </React.Fragment>)}
      </div></div>
      <div style={{margin:"10px 0",padding:8,textAlign:"center",fontWeight:"bold",background:"#25465a"}}>{t("Plasma Wall / Target","Плазмена стена / цел")}</div>
      <button type="button" disabled={busy||!total||total>marchLimit||Number(structures["Combat Simulator"]||0)<1} onClick={runSimulation}
        style={{padding:"10px 18px",background:"#28734f",color:"#fff",fontWeight:"bold",borderRadius:6}}>
        {busy?t("Simulating…","Симулация…"):t("Run simulation","Проведи симулация")}
      </button>
      {Number(structures["Combat Simulator"]||0)<1&&<p>{t("Build the Combat Simulator to level 1 in Base Management first.","Първо построй Бойния симулатор до ниво 1 в Управление на базата.")}</p>}
      {simulationInfo&&<p role="status">{t("Simulation complete. Your troops were returned unchanged.","Симулацията приключи. Войниците са запазени без промяна.")} · {t("Simulation","Симулация")} #{simulationInfo.simulationId}</p>}
      {result&&<section style={{padding:12,marginTop:12,border:"1px solid #4f7991",borderRadius:8,background:"#102333"}}>
        <h3>{result.victory?t("Estimated victory","Прогнозна победа"):t("Estimated defeat","Прогнозно поражение")} · {t("Rounds","Рундове")} {result.rounds}</h3>
        <p>{t("Your surviving troops in this simulation:","Твои оцелели войници в симулацията:")} {Object.values(result.survivors||{}).reduce((sum,count)=>sum+Number(count||0),0).toLocaleString()} · {t("Alien defenders remaining:","Оставащи извънземни защитници:")} {result.defendersRemaining}</p>
        {(result.report||[]).map(round=><details key={round.round}><summary>{t("Round","Рунд")} {round.round}</summary>
          {round.events.map((event,index)=><p key={index} style={{fontSize:12}}>{label(event.attacker)+": "+event.units+" "+label(event.unit)+" → "+label(event.target)+" · "+event.damage+" "+t("damage","щети")+(Number.isInteger(event.kills)?" · "+event.kills+" "+t("defeated","победени"):"")}</p>)}
        </details>)}
      </section>}
    </>}
  </div>;
}
