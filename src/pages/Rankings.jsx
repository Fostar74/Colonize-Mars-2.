import { useLanguage } from "../language";
import React,{useEffect,useState,useCallback} from "react";
const api=(process.env.REACT_APP_API_URL||(window.location.hostname==="localhost"?"http://localhost:3001":window.location.origin)).replace(/\/$/,"");
const headers=()=>({"Content-Type":"application/json",Authorization:"Bearer "+sessionStorage.getItem("authToken")});
const id=()=>sessionStorage.getItem("userId");
export default function Rankings({playerAction}){
  const { t , label: localLabel} = useLanguage();
 const [tab,setTab]=useState("players"),[data,setData]=useState(null),[error,setError]=useState(""),[busy,setBusy]=useState(false),[message,setMessage]=useState("");
 const refresh=useCallback(async()=>{try{const r=await fetch(api+"/rankings/"+encodeURIComponent(id()),{headers:headers(),cache:"no-store"});const d=await r.json();if(!r.ok)throw Error(d.message||"Rankings unavailable.");setData(d);setError("");}catch(e){setError(e.message)}},[]);
 useEffect(()=>{refresh();const t=setInterval(refresh,15000);return()=>clearInterval(t)},[refresh]);
 const apply=async(a)=>{setBusy(true);setMessage("");try{const r=await fetch(api+"/alliance/join",{method:"POST",headers:headers(),body:JSON.stringify({userId:id(),name:a.name})});const d=await r.json();if(!r.ok)throw Error(d.message||"Application failed.");setMessage(d.message||"Application sent.");await refresh();}catch(e){setMessage(e.message)}finally{setBusy(false)}};
 return <div style={{padding:15,color:"#eef6ff"}}>
  <h2>{t("🏆 Rankings","🏆 Класиране")}</h2><p>{t("Rankings use total player XP. Resource spending grants 1× XP for construction, 2× for completed troop upgrades, and 3× for trained troops when mobilized.","Класирането е по общ опит. Похарчените ресурси дават 1× опит за строеж, 2× за завършени подобрения на войски и 3× за обучени войски при мобилизация.")}</p>
  <div style={{display:"flex",gap:8,marginBottom:14}}>{["players","alliances"].map(t=><button key={t} onClick={()=>setTab(t)} style={{background:tab===t?"#257f8e":"#20384d",color:"white",padding:10,borderRadius:7}}>{t==="players"?localLabel("Players"):localLabel("Alliances")}</button>)}</div>
  {error&&<p role="alert">{localLabel(error)} <button onClick={refresh}>{t("Retry","Опитай пак")}</button></p>}
  {message&&<p role="status">{localLabel(message)}</p>}
  {!data&&!error&&<p>{t("Loading rankings…","Зареждане на класирането…")}</p>}
  {data&&<div style={{overflowX:"auto"}}><table style={{width:"100%",borderCollapse:"collapse",textAlign:"left"}}>
   <thead>{tab==="players"?<tr><th>{t("Rank","Място")}</th><th>{t("Player","Играч")}</th><th>{t("Alliance","Алианс")}</th><th>{t("XP","Опит")}</th></tr>:<tr><th>{t("Rank","Място")}</th><th>{t("Alliance","Алианс")}</th><th>{t("Leader","Лидер")}</th><th>{t("Members","Членове")}</th><th>{t("XP","Опит")}</th><th>{t("Action","Действие")}</th></tr>}</thead>
   <tbody>{tab==="players"?(data.players||[]).map((p,i)=><tr key={p.id} style={{borderTop:"1px solid #416177"}}><td style={{padding:9}}>{i+1}</td><td>{playerAction({...p,ally:!!p.alliance && p.alliance===data.players.find(player=>String(player.id)===id())?.alliance,canInvite:data.canInvite&&!p.alliance&&String(p.id)!==id()})}{String(p.id)===id()?localLabel(" (You)"):""}</td><td>{p.alliance||"—"}</td><td>{Number(p.points).toLocaleString()}</td></tr>):(data.alliances||[]).map((a,i)=><tr key={a.id} style={{borderTop:"1px solid #416177"}}><td style={{padding:9}}>{i+1}</td><td>🛡 {a.name}</td><td>{playerAction({username:a.leader,ally:a.name===data.players.find(player=>String(player.id)===id())?.alliance})}</td><td>{a.memberCount}</td><td>{Number(a.points).toLocaleString()}</td><td><button disabled={busy||a.pending||a.joined} onClick={()=>apply(a)}>{a.pending?localLabel("Application Pending"):a.joined?localLabel("Already in an alliance"):localLabel("Apply to Join")}</button></td></tr>)}</tbody>
  </table>{tab==="alliances"&&!(data.alliances||[]).length&&<p>{t("No alliances created yet. Open Alliance to create one.","Все още няма алианси. Отвори меню „Алианс“, за да създадеш един.")}</p>}</div>}
 </div>;
}
