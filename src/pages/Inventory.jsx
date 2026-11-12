import { useLanguage } from "../language";
import React,{useEffect,useState,useCallback} from "react";
import unitEconomy from "../shared/unitEconomy";
import goldIcon from "../images/gold.png";
import ironIcon from "../images/iron.png";
import waterIcon from "../images/water.png";
import solarIcon from "../images/solar.png";
import marketItemIcon from "../images/hq-icon.png";
const api=(process.env.REACT_APP_API_URL||(window.location.hostname==="localhost"?"http://localhost:3001":window.location.origin)).replace(/\/$/,"");
const names=["Gold","Iron","Water","Solar"];
const resourceIcons={Gold:goldIcon,Iron:ironIcon,Water:waterIcon,Solar:solarIcon};
const marketItems=[
  {id:"landing",label:"Mars Landing Token",description:"Adds one Mars Landing Token to your account.",bulgarianLabel:"Жетон за кацане на Марс",bulgarianDescription:"Добавя жетон за кацане на Марс към акаунта ти.",icon:marketItemIcon},
  {id:"attack",label:"Army Attack +10% (1h)",description:"Increases army attack for one hour.",bulgarianLabel:"Атака на армията +10% (1 ч.)",bulgarianDescription:"Увеличава атаката на армията за един час.",icon:marketItemIcon},
  {id:"health",label:"Army Health +10% (1h)",description:"Increases army health for one hour.",bulgarianLabel:"Здраве на армията +10% (1 ч.)",bulgarianDescription:"Увеличава здравето на армията за един час.",icon:marketItemIcon},
  {id:"protection",label:"Plasma Shield (24h)",description:"Surrounds your base with a protective plasma bubble for 24 hours.",bulgarianLabel:"Плазмен щит (24 ч.)",bulgarianDescription:"Обгръща базата ти със защитен плазмен балон за 24 часа.",icon:marketItemIcon}
];
export default function Inventory(){
  const { t , label: localLabel} = useLanguage();
  const [tab,setTab]=useState("resources");
  const [reserve,setReserve]=useState(null);
  const [progress,setProgress]=useState(null);
  const [amounts,setAmounts]=useState({});
  const [message,setMessage]=useState("");
  const [busy,setBusy]=useState(false);
  const [selectedItem,setSelectedItem]=useState(null);
  const [itemAmount,setItemAmount]=useState("1");
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
  const useItem=async(item,amount)=>{
    setBusy(true);setMessage("");
    try{
      const r=await fetch(api+"/inventory/use-item",{method:"POST",headers:{...headers,"Content-Type":"application/json"},body:JSON.stringify({userId,item,amount})});
      const d=await r.json();if(!r.ok)throw Error(d.message||"Item could not be used.");
      setReserve(d.inventory);setSelectedItem(null);setItemAmount("1");setMessage(t(amount===1?"1 item activated.":amount+" items activated.",amount===1?"Предметът е активиран.":amount+" предмета са активирани."));
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
        return <div key={name} style={card}><img src={resourceIcons[name]} alt="" width="42" height="42" style={{objectFit:"contain",verticalAlign:"middle",marginRight:8}}/><strong>{localLabel(name)}</strong>
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
    {reserve&&tab==="items"&&<div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(190px,1fr))",gap:10}}>
        {marketItems.map(item=>{const count=Number(reserve.items?.[item.id]||0),selected=selectedItem===item.id;return <div role="button" tabIndex={0} key={item.id} onClick={()=>{setSelectedItem(item.id);setItemAmount("1");}} onKeyDown={event=>{if(event.key==="Enter"||event.key===" "){event.preventDefault();setSelectedItem(item.id);setItemAmount("1");}}} aria-pressed={selected} style={{...card,textAlign:"left",color:"white",cursor:"pointer",border:selected?"2px solid #83e6ff":"1px solid #4a6c83",opacity:count?1:.65}}>
          <img src={item.icon} alt="" width="64" height="64" style={{objectFit:"contain",display:"block",margin:"0 auto 8px"}}/>
          <strong>{t(item.label,item.bulgarianLabel)}</strong>
          <p style={{marginBottom:0}}>{t("In inventory:","В инвентара:")} <b>{count.toLocaleString()}</b></p>
        </div>})}
      </div>
      {!Object.values(reserve.items||{}).some(count=>count>0)&&<p>{t("No alliance market items in inventory.","Нямаш предмети от алиансния пазар в инвентара.")}</p>}
      {selectedItem&&(()=>{const item=marketItems.find(entry=>entry.id===selectedItem),count=Number(reserve.items?.[selectedItem]||0);if(!item||count<1)return null;const amount=Number(itemAmount);return <section style={{...card,marginTop:14,border:"1px solid #83e6ff"}}>
        <div style={{display:"flex",alignItems:"center",gap:12}}>
          <img src={item.icon} alt="" width="72" height="72" style={{objectFit:"contain"}}/>
          <div><h3 style={{margin:"0 0 6px"}}>{t(item.label,item.bulgarianLabel)}</h3><div>{t(item.description,item.bulgarianDescription)}</div></div>
        </div>
        <label style={{display:"block",marginTop:14}}>{t("How many items do you want to activate?","Колко предмета искаш да активираш?")}
          <input type="number" min="1" max={count} step="1" value={itemAmount} onChange={event=>setItemAmount(event.target.value)} style={{display:"block",width:130,padding:8,marginTop:6}}/>
        </label>
        <p>{t("Available:","Налични:")} {count.toLocaleString()}</p>
        <button type="button" disabled={busy||!Number.isSafeInteger(amount)||amount<1||amount>count} style={button} onClick={()=>useItem(selectedItem,amount)}>{t("Confirm and activate","Потвърди и активирай")}</button>
      </section>})()}
    </div>}
    {reserve&&tab==="boosters"&&<div style={card}>
      <strong>{t("Universal Forge","Универсални точки за изковаване")}</strong>
      <p>{t("In inventory:","В инвентара:")} <b>{Number(reserve.boosters?.universalForge || 0).toLocaleString()}</b></p>
      <p>{t("Use these points to upgrade any equipment slot in Cyber Knight. Slot points are spent first.","Използвай ги за подобрения на екипировката на Киберрицаря. Първо се харчат точките за слота.")}</p>
    </div>}
  </div>;
}
