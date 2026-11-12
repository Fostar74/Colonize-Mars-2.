import { useLanguage } from "../language";
import React,{useEffect,useState,useCallback} from "react";
import unitEconomy from "../shared/unitEconomy";
const api=(process.env.REACT_APP_API_URL||(window.location.hostname==="localhost"?"http://localhost:3001":window.location.origin)).replace(/\/$/,"");
const names=["Gold","Iron","Water","Solar"];
export default function Inventory(){
  const { t , label: localLabel} = useLanguage();
  const [tab,setTab]=useState("resources");
  const [reserve,setReserve]=useState(null);
  const [progress,setProgress]=useState(null);
  const [amounts,setAmounts]=useState({});
  const [message,setMessage]=useState("");
  const [busy,setBusy]=useState(false);
  const userId=sessionStorage.getItem("userId");
  const headers={Authorization:"Bearer "+sessionStorage.getItem("authToken")};
  const refresh=useCallback(async()=>{
    if(!userId)return;
    try{
      const [a,b]=await Promise.all([fetch(api+"/inventory/"+encodeURIComponent(userId),{headers,cache:"no-store"}),fetch(api+"/get-progress/"+encodeURIComponent(userId),{headers,cache:"no-store"})]);
      if(!a.ok||!b.ok)throw Error("Unable to load inventory.");
      setReserve(await a.json());setProgress((await b.json()).gameProgress);
    }catch(e){setMessage(e.message);}
  },[userId]);
  useEffect(()=>{refresh();window.addEventListener("game-progress-updated",refresh);return()=>window.removeEventListener("game-progress-updated",refresh);},[refresh]);
  const withdraw=async(kind,name,available)=>{
    const amount=Number(amounts[kind+name]||0);
    if(!Number.isSafeInteger(amount)||amount<1||amount>available){setMessage("Enter a valid amount within your reserve.");return;}
    setBusy(true);setMessage("");
    try{
      const r=await fetch(api+"/inventory/withdraw",{method:"POST",headers:{...headers,"Content-Type":"application/json"},body:JSON.stringify({userId,kind,name,amount})});
      const d=await r.json();if(!r.ok)throw Error(d.message||"Withdrawal failed.");
      setReserve(d.inventory);setProgress(p=>({...p,resources:d.resources,army:d.army}));
      sessionStorage.setItem("resources",JSON.stringify(d.resources));
      window.dispatchEvent(new Event("game-progress-updated"));
      setAmounts(p=>({...p,[kind+name]:""}));setMessage(amount+" "+name+" transferred to your base.");
    }catch(e){setMessage(e.message);}finally{setBusy(false);}
  };
  const useItem=async(item)=>{
    setBusy(true);setMessage("");
    try{
      const r=await fetch(api+"/inventory/use-item",{method:"POST",headers:{...headers,"Content-Type":"application/json"},body:JSON.stringify({userId,item})});
      const d=await r.json();if(!r.ok)throw Error(d.message||"Item could not be used.");
      setReserve(d.inventory);setMessage(item==="landing"?"Mars Landing Token added to your account.":item==="protection"?"Plasma Shield activated for 24 hours.":item==="attack"?"Army Attack boost activated for 1 hour.":"Army Health boost activated for 1 hour.");
      window.dispatchEvent(new Event("game-progress-updated"));
    }catch(e){setMessage(e.message);}finally{setBusy(false);}
  };
  const card={padding:12,border:"1px solid #4a6c83",background:"#172c40",borderRadius:8};
  const button={padding:"8px 12px",background:"#205c78",border:"1px solid #668ba3",borderRadius:6,color:"white",cursor:"pointer"};
  const rows=tab==="resources"?names:Object.values(unitEconomy.categories).flat().filter(n=>Number(reserve?.army?.[n]||0)>0);
  return <div style={{color:"white"}}>
    <p>{t("Inventory is your separate emergency reserve. Building, training and combat use only resources and troops already in your base.","Инвентарът е отделен резерв. Строежът, обучението и битките използват само ресурсите и войските в базата.")}</p>
    <div style={{display:"flex",gap:8,marginBottom:16}}>
      {["resources","army","items","boosters"].map(t=><button key={t} style={{...button,background:tab===t?"#26765e":"#20384d"}} onClick={()=>setTab(t)}>{t==="resources"?localLabel("Resources"):t==="army"?localLabel("Army"):t==="items"?t("Market Items","Предмети от пазара"):localLabel("Boosters")}</button>)}
    </div>
    {message&&<p role="status">{localLabel(message)}</p>}
    {!reserve&&<p>{t("Loading inventory...","Зареждане на инвентара…")}</p>}
    {reserve&&(tab==="resources"||tab==="army")&&<div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(200px,1fr))",gap:10}}>
      {rows.map(name=>{
        const kind=tab;const count=Number(reserve[kind]?.[name]||0);
        return <div key={name} style={card}><strong>{localLabel(name)}</strong>
          <p>{t("In inventory:","В инвентара:")} <b>{count.toLocaleString()}</b></p>
          <p>{t("In base:","В базата:")} {Number((kind==="resources"?progress?.resources:progress?.army)?.[name]||0).toLocaleString()}</p>
          <div style={{display:"flex",gap:6}}>
            <input aria-label={"Withdraw "+name} type="number" min="1" max={count} value={amounts[kind+name]||""} onChange={e=>setAmounts(v=>({...v,[kind+name]:e.target.value}))} style={{width:85}}/>
            <button disabled={busy||count<1} style={button} onClick={()=>withdraw(kind,name,count)}>{t("Withdraw","Изтегли")}</button>
            <button disabled={busy||count<1} style={button} onClick={()=>setAmounts(v=>({...v,[kind+name]:String(count)}))}>{t("Max","Макс.")}</button>
          </div>
        </div>;
      })}
      {!rows.length&&<p>{t("No reserve troops. Troops earned as rewards will appear here.","Няма резервни войски. Тук се появяват войските от награди.")}</p>}
    </div>}
    {reserve&&tab==="items"&&<div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(220px,1fr))",gap:10}}>
      {[
        ["landing","Mars Landing Token","Adds one Mars Landing Token to your account."],
        ["attack","Army Attack +10% (1h)","Increases army attack for one hour."],
        ["health","Army Health +10% (1h)","Increases army health for one hour."],
        ["protection","Plasma Shield (24h)","Surrounds your base with a protective plasma bubble for 24 hours."]
      ].map(([item,label,description])=>{const count=Number(reserve.items?.[item]||0);return <div key={item} style={card}>
        <strong>{t(label,({landing:"Жетон за кацане на Марс",attack:"Атака на армията +10% (1 ч.)",health:"Живот на армията +10% (1 ч.)",protection:"Плазмен щит (24 ч.)"})[item])}</strong>
        <p>{t("In inventory:","В инвентара:")} <b>{count}</b></p>
        <p>{t(description,({landing:"Добавя един жетон за кацане на Марс към акаунта ти.",attack:"Увеличава атаката на армията за един час.",health:"Увеличава живота на армията за един час.",protection:"Обгръща базата ти със защитен плазмен балон за 24 часа."})[item])}</p>
        <button disabled={busy||count<1} style={button} onClick={()=>useItem(item)}>{t("Use","Използвай")}</button>
      </div>})}
      {!Object.values(reserve.items||{}).some(count=>count>0)&&<p>{t("No alliance market items in inventory.","Нямаш предмети от алиансния пазар в инвентара.")}</p>}
    </div>}
    {reserve&&tab==="boosters"&&<div style={card}>
      <strong>{t("Universal Forge","Универсални точки за изковаване")}</strong>
      <p>{t("In inventory:","В инвентара:")} <b>{Number(reserve.boosters?.universalForge || 0).toLocaleString()}</b></p>
      <p>{t("Use these points to upgrade any equipment slot in Cyber Knight. Slot points are spent first.","Използвай ги за подобрения на екипировката на Киберрицаря. Първо се харчат точките за слота.")}</p>
    </div>}
  </div>;
}
