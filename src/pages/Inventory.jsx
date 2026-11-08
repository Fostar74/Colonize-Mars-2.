import React, {useEffect,useState} from "react";
import unitEconomy from "../shared/unitEconomy";

const api=(process.env.REACT_APP_API_URL || (window.location.hostname==="localhost"?"http://localhost:3001":window.location.origin)).replace(new RegExp("/$"),"");
const names=["Gold","Iron","Water","Solar"];

export default function Inventory({onClose}) {
  const [tab,setTab]=useState("resources");
  const [progress,setProgress]=useState(null);
  const [login,setLogin]=useState(null);
  const [error,setError]=useState("");
  useEffect(()=>{
    let mounted=true;
    const userId=sessionStorage.getItem("userId");
    if(!userId){setError("Please log in again.");return;}
    const headers={Authorization:"Bearer "+sessionStorage.getItem("authToken")};
    const refresh=async()=>{
      try {
        const [a,b]=await Promise.all([
          fetch(api+"/get-progress/"+encodeURIComponent(userId),{headers,cache:"no-store"}),
          fetch(api+"/daily-login/"+encodeURIComponent(userId),{headers,cache:"no-store"})
        ]);
        if(!a.ok) throw new Error("Could not load your inventory.");
        const data=await a.json();
        if(mounted){setProgress(data.gameProgress);setError("");}
        if(b.ok){const result=await b.json();if(mounted)setLogin(result);}
      } catch(e){if(mounted)setError(e.message);}
    };
    refresh();
    const timer=setInterval(refresh,5000);
    window.addEventListener("game-progress-updated",refresh);
    return ()=>{mounted=false;clearInterval(timer);window.removeEventListener("game-progress-updated",refresh);};
  },[]);
  const buttonStyle={padding:"9px 16px",background:"#20384d",border:"1px solid #668ba3",borderRadius:6,color:"white",cursor:"pointer"};
  const cardStyle={padding:12,border:"1px solid #4a6c83",background:"#172c40",borderRadius:8};
  const claimed=(login?.days||[]).filter(d=>d.claimed);
  return <div style={{color:"white"}}>
    <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:16}}>
      {[["resources","Resources"],["army","Army"],["boosters","Boosters"]].map(([key,label])=><button key={key} onClick={()=>setTab(key)} style={{...buttonStyle,background:tab===key?"#26765e":"#20384d"}}>{label}</button>)}
    </div>
    {error&&<p role="alert">{error}</p>}
    {!progress&&!error&&<p>Loading inventory...</p>}
    {progress&&tab==="resources"&&<div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(145px,1fr))",gap:10}}>
      {names.map(name=><div key={name} style={cardStyle}><strong>{name}</strong><p style={{fontSize:22,margin:"8px 0"}}>{Number(progress.resources?.[name]||0).toLocaleString()}</p></div>)}
    </div>}
    {progress&&tab==="army"&&<div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(190px,1fr))",gap:10}}>
      {Object.values(unitEconomy.categories).flat().filter(unit=>Number(progress.army?.[unit]||0)>0).map(unit=><div key={unit} style={cardStyle}><strong>{unit}</strong><p>Owned: {Number(progress.army[unit]).toLocaleString()}</p></div>)}
      {!Object.values(unitEconomy.categories).flat().some(unit=>Number(progress.army?.[unit]||0)>0)&&<p>No trained troops yet.</p>}
    </div>}
    {tab==="boosters"&&<div>
      <p>Stored boosters and subscriptions will appear here when these rewards become available. No boosters are currently issued by the game.</p>
      <div style={cardStyle}><strong>Boosters</strong><p>0 available</p><p>Future types: resource production, construction speed, training speed.</p></div>
    </div>}
    {login&&<div style={{marginTop:20}}>
      <h4>Daily login rewards collected: {claimed.length}/30</h4>
      {claimed.length>0?<p>{claimed.map(d=>"Day "+d.day+": "+(d.reward.type==="resources"?d.reward.amount+" of each resource":d.reward.type==="army"?d.reward.amount+" "+d.reward.label:d.reward.label)).join(" · ")}</p>:<p>No daily login rewards collected yet.</p>}
      <p style={{fontSize:12,opacity:.8}}>Claimed resources and troops are added directly to their balances. Cyber Knight equipment is stored in the knight's equipment inventory.</p>
    </div>}
  </div>;
}
