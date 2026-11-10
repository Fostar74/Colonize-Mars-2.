import { useLanguage } from "../language";
import React,{useEffect,useState,useCallback,useRef} from "react";
const api=(process.env.REACT_APP_API_URL||(window.location.hostname==="localhost"?"http://localhost:3001":window.location.origin)).replace(/\/$/,"");
const getUserId=()=>sessionStorage.getItem("userId");
const headers=()=>({"Content-Type":"application/json",Authorization:"Bearer "+sessionStorage.getItem("authToken")});
const craters=Array.from({length:12},(_,i)=>({x:13+(i%4)*24+(Math.floor(i/4)%2)*4,y:24+Math.floor(i/4)*28}));
const duration=9000;
export default function ActivityWheel(){
  const { t } = useLanguage();
 const [state,setState]=useState(null),[serverOffset,setServerOffset]=useState(0),[now,setNow]=useState(Date.now()),[busy,setBusy]=useState(false),[notice,setNotice]=useState(""),[last,setLast]=useState(null),[target,setTarget]=useState(null),[phase,setPhase]=useState("idle");
 const timer=useRef(null),run=useRef(0);
 const refresh=useCallback(async()=>{try{const r=await fetch(api+"/wheel/"+encodeURIComponent(getUserId()),{headers:headers(),cache:"no-store"});if(!r.ok){const body=await r.json().catch(()=>({}));throw Error(body.message||"Mars Landing unavailable (HTTP "+r.status+").");}const d=await r.json();setServerOffset(Number(d.serverTime||Date.now())-Date.now());setState(d);}catch(e){setNotice("Landing status: "+e.message);}},[]);
 useEffect(()=>{refresh();const tick=setInterval(()=>setNow(Date.now()),1000);const sync=setInterval(refresh,30000);const visible=()=>{if(!document.hidden)refresh();};document.addEventListener("visibilitychange",visible);return()=>{clearInterval(tick);clearInterval(sync);document.removeEventListener("visibilitychange",visible);};},[refresh]);
 useEffect(()=>()=>{clearTimeout(timer.current);run.current++;},[]);
 const finish=(prize,id)=>{if(run.current!==id)return;clearTimeout(timer.current);setPhase("landed");setLast(prize);setBusy(false);setNotice("Landing complete. "+prize.label+" awarded by the server.");window.dispatchEvent(new Event("game-progress-updated"));};
 const land=async paid=>{
  if(busy||!state)return;setBusy(true);setPhase("launch");setTarget(null);setLast(null);setNotice("");
  const id=++run.current;
  try{
   const r=await fetch(api+"/wheel/spin",{method:"POST",headers:headers(),body:JSON.stringify({userId:getUserId(),paid})});
   const d=await r.json().catch(()=>({}));if(!r.ok)throw Error(d.message||(r.status===401?"Session expired. Log in again.":"Landing failed (HTTP "+r.status+")."));
   if(id!==run.current)return;
   setServerOffset(Number(d.wheel.serverTime||Date.now())-Date.now());setState(d.wheel);
   setTarget(d.index);setPhase("flight");
   timer.current=setTimeout(()=>finish(d.prize,id),duration);
  }catch(e){if(id===run.current){setNotice("Landing error: "+e.message);setBusy(false);setPhase("idle");refresh();}}
 };
 const remaining=state?Math.max(0,(state.freeAvailableAt||0)-(now+serverOffset)):0;
 const clock=remaining?String(Math.floor(remaining/3600000)).padStart(2,"0")+":"+String(Math.floor(remaining%3600000/60000)).padStart(2,"0")+":"+String(Math.floor(remaining%60000/1000)).padStart(2,"0"):"READY";
 const position=target==null?{x:50,y:8}:craters[target];
 return <div style={{color:"#eef7ff",padding:12,maxWidth:1100,margin:"auto"}}>
  <style>{`@keyframes marsFly{0%{left:50%;top:4%;transform:translate(-50%,-50%) scale(.8) rotate(0deg)}20%{left:45%;top:16%;transform:translate(-50%,-50%) scale(1.2) rotate(-9deg)}55%{left:70%;top:38%;transform:translate(-50%,-50%) scale(1.1) rotate(9deg)}85%{transform:translate(-50%,-50%) scale(.95) rotate(0deg)}100%{left:var(--landing-x);top:var(--landing-y);transform:translate(-50%,-50%) scale(.7) rotate(0deg)}}@keyframes hoverCraft{0%,100%{transform:translate(-50%,-50%) translateY(0)}50%{transform:translate(-50%,-50%) translateY(-9px)}}@keyframes craterPulse{0%,100%{box-shadow:0 0 0 2px #f6c276}50%{box-shadow:0 0 0 12px #f6c27655}}`}</style>
  <h2 style={{margin:"0 0 8px"}}>{t("🚀 Mars Landing","🚀 Кацане на Марс")}</h2>
  <p>{t("Launch your VTOL craft across the Martian crater field. One free landing every hour; additional landings cost 50 Tokens. The server determines the reward before flight. Rewards are stored in Inventory or Cyber Knight crafting.","Прелети над марсианските кратери. Едно безплатно кацане на час. Допълнително кацане струва 50 жетона. Сървърът определя наградата преди полета. Наградите отиват в инвентара или при Киберрицаря.")}</p>
  <div style={{display:"flex",gap:20,flexWrap:"wrap",alignItems:"flex-start"}}>
   <div style={{position:"relative",width:"min(620px,100%)",aspectRatio:"1.35",flex:"1 1 360px",overflow:"hidden",borderRadius:16,border:"2px solid #c17d55",background:"radial-gradient(ellipse at 22% 25%,#c8754d 0%,#873e2d 45%,#47252c 100%)",boxShadow:"inset 0 0 65px #210f17,0 8px 30px #0007"}}>
    <div style={{position:"absolute",inset:0,background:"repeating-linear-gradient(12deg,transparent 0px,transparent 55px,#efb3810c 58px,transparent 95px)",pointerEvents:"none"}}/>
    {craters.map((p,i)=><div key={i} title={"Crater "+(i+1)} style={{position:"absolute",left:p.x+"%",top:p.y+"%",width:"12%",aspectRatio:"1",transform:"translate(-50%,-50%)",borderRadius:"50%",background:"radial-gradient(ellipse at 35% 30%,#63322c 0%,#43232a 45%,#b96a46 65%,#e09a64 77%,#6d382d 100%)",boxShadow:"inset 3px 5px 13px #2b141b,2px 4px 9px #29151d",outline:phase==="landed"&&target===i?"3px solid #fbe0a1":"none",animation:phase==="landed"&&target===i?"craterPulse 1.4s infinite":"none",display:"grid",placeItems:"center",fontSize:12,fontWeight:800,color:"#ffdbab"}}>{i+1}</div>)}
    <div aria-label="VTOL landing craft" style={{position:"absolute",left:(phase==="flight"?position.x:phase==="landed"?position.x:50)+"%",top:(phase==="flight"?position.y:phase==="landed"?position.y:8)+"%",transform:"translate(-50%,-50%)",fontSize:"clamp(32px,6vw,58px)",zIndex:5,filter:"drop-shadow(0 7px 5px #221219)",animation:phase==="flight"?"marsFly 9s ease-in-out forwards":phase==="idle"?"hoverCraft 2.2s ease-in-out infinite":"none",["--landing-x"]:position.x+"%",["--landing-y"]:position.y+"%"}}>🛸</div>
    <div style={{position:"absolute",left:12,bottom:12,padding:"7px 10px",background:"#1b1c28c9",borderRadius:6,fontSize:12}}>{phase==="flight"?"VTOL IN FLIGHT · TARGET LOCKED":phase==="landed"?"LANDING COMPLETE":phase==="launch"?"CONTACTING MARS CONTROL":"MARS LANDING ZONE · 12 CRATERS"}</div>
   </div>
   <div style={{minWidth:210,flex:"1 1 220px",display:"grid",gap:12}}>
    <section style={{padding:16,background:"#18354b",border:"1px solid #5a8299",borderRadius:10}}><strong>{t("Next free landing","Следващо безплатно кацане")}</strong><div style={{fontSize:25,fontWeight:800,margin:"8px 0"}}>{clock}</div><button disabled={busy||!state||remaining>0} onClick={()=>land(false)} style={{padding:12,background:remaining>0?"#536575":"#218766",color:"white",border:0,borderRadius:7,width:"100%"}}>{busy?"LANDING IN PROGRESS":remaining>0?"FREE IN "+clock:"🚀 FREE LANDING"}</button></section>
    <section style={{padding:16,background:"#18354b",border:"1px solid #5a8299",borderRadius:10}}><strong>{t("Tokens:","Жетони:")} {state?.tokens??"…"}</strong><button disabled={busy||!state||state.tokens<50} onClick={()=>land(true)} style={{padding:12,marginTop:12,background:"#62468c",color:"white",border:0,borderRadius:7,width:"100%"}}>{t("🚀 LAND · 50 TOKENS","🚀 КАЦАНЕ · 50 ЖЕТОНА")}</button></section>
    {busy&&target!=null&&<button onClick={()=>finish((state.prizes||[])[target],run.current)} style={{padding:11,borderRadius:8,border:"1px solid #c8b38e",background:"#294458",color:"white"}}>{t("Skip animation → Reveal reward","Пропусни анимацията → Покажи наградата")}</button>}
   </div>
  </div>
  {notice&&<p role="status" style={{padding:12,background:"#173b4e",borderRadius:8}}>{notice}</p>}
  {last&&<div role="status" style={{padding:16,border:"2px solid #75c8a4",borderRadius:10,background:"#133d3a",fontSize:19,textAlign:"center"}}><strong>{t("🎉 YOU FOUND:","🎉 НАМЕРИ:")} {last.label}</strong><div style={{fontSize:13,marginTop:6}}>{t("Reward confirmed and awarded by the server.","Сървърът потвърди и начисли наградата.")}</div></div>}
  {!!state?.recent?.length&&<section style={{marginTop:16,padding:12,background:"#172f44",borderRadius:8}}><strong>{t("Recent landings (saved on server)","Последни кацания")}</strong>{state.recent.map((spin,i)=><div key={spin.spun_at+"-"+i} style={{fontSize:13,padding:"5px 0",borderBottom:"1px solid #3b5264"}}>{new Date(spin.spun_at).toLocaleString()} · {state.prizes?.[spin.reward_id]?.label||"Prize"} · {spin.free?"Free":"50 Tokens"}</div>)}</section>}
 </div>;
}
