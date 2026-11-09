import React,{useEffect,useState,useCallback} from "react";
const api=(process.env.REACT_APP_API_URL||(window.location.hostname==="localhost"?"http://localhost:3001":window.location.origin)).replace(/\/$/,"");
const userId=sessionStorage.getItem("userId");
const headers=()=>({"Content-Type":"application/json",Authorization:"Bearer "+sessionStorage.getItem("authToken")});
const icons=["🟡","🔩","💧","☀️","🟡","🔩","🪖","🎯","🚀","⚒️","🛡️","💰"];
const colors=["#194f6c","#2a5773","#1b5c67","#2b657b","#17415c","#315b78","#254764","#226079","#23526d","#315d70","#164e6d","#316478"];
export default function ActivityWheel(){
 const [state,setState]=useState(null),[serverOffset,setServerOffset]=useState(0),[now,setNow]=useState(Date.now()),[busy,setBusy]=useState(false),[rotation,setRotation]=useState(0),[notice,setNotice]=useState(""),[last,setLast]=useState(null);
 const refresh=useCallback(async()=>{try{const r=await fetch(api+"/wheel/"+encodeURIComponent(userId),{headers:headers(),cache:"no-store"});if(!r.ok)throw Error("Wheel unavailable");const d=await r.json();setServerOffset(Number(d.serverTime||Date.now())-Date.now());setState(d);}catch(e){setNotice(e.message);}},[]);
 useEffect(()=>{refresh();const t=setInterval(()=>{setNow(Date.now());},1000);return()=>clearInterval(t);},[refresh]);
 const spin=async(paid)=>{
  if(busy)return;setBusy(true);setNotice("");setLast(null);
  try{
   const r=await fetch(api+"/wheel/spin",{method:"POST",headers:headers(),body:JSON.stringify({userId,paid})});
   const d=await r.json();if(!r.ok)throw Error(d.message||"Spin failed");
   setServerOffset(Number(d.wheel.serverTime||Date.now())-Date.now());setState(d.wheel);
   // The wheel rotates clockwise; the prize center stops at the 12 o'clock pointer.
   setRotation(old=>old+1800+((12-d.index)%12)*30-(old%360));
   setTimeout(()=>{setLast(d.prize);setNotice("You won: "+d.prize.label+"! Reward sent to Inventory.");setBusy(false);window.dispatchEvent(new Event("game-progress-updated"));},4200);
  }catch(e){setNotice(e.message);setBusy(false);refresh();}
 };
 const remaining=state?Math.max(0,(state.freeAvailableAt||0)-(now+serverOffset)):0;
 const clock=remaining?String(Math.floor(remaining/3600000)).padStart(2,"0")+":"+String(Math.floor(remaining%3600000/60000)).padStart(2,"0")+":"+String(Math.floor(remaining%60000/1000)).padStart(2,"0"):"READY";
 const gradient="conic-gradient("+colors.map((c,i)=>c+" "+(i*30)+"deg "+((i+1)*30)+"deg").join(",")+")";
 return <div style={{color:"#eef7ff",padding:12}}>
  <h3 style={{margin:"0 0 8px"}}>🎯 Martian Rewards Wheel</h3>
  <p>One free spin every hour. Additional spins cost 50 tokens. All prizes go to Inventory.</p>
  <div style={{display:"flex",flexWrap:"wrap",gap:22,alignItems:"center",justifyContent:"center"}}>
   <div style={{width:"min(440px,85vw)",aspectRatio:"1",position:"relative",flexShrink:0}}>
    <div style={{position:"absolute",top:-12,left:"50%",transform:"translateX(-50%)",zIndex:3,fontSize:34,textShadow:"0 2px 5px #000"}}>▼</div>
    <div style={{width:"100%",height:"100%",border:"9px solid #79b9d7",borderRadius:"50%",boxSizing:"border-box",background:gradient,boxShadow:"0 0 28px #3980a666, inset 0 0 25px #0008",position:"relative",transform:"rotate("+rotation+"deg)",transition:busy?"transform 4.1s cubic-bezier(.12,.78,.15,1)":"none"}}>
     {(state?.prizes||Array.from({length:12},(_,i)=>({label:"Prize "+(i+1)}))).map((prize,i)=><div key={i} style={{position:"absolute",top:"50%",left:"50%",width:"27%",height:55,transform:"translate(-50%,-50%) rotate("+(i*30+15)+"deg) translateY(-143%)",transformOrigin:"center center",textAlign:"center",fontSize:"clamp(9px,1.4vw,12px)",fontWeight:700,textShadow:"0 1px 3px black",lineHeight:1.2}}>
      <div style={{fontSize:22}}>{icons[i]}</div>{prize.label}
     </div>)}
     <div style={{position:"absolute",top:"50%",left:"50%",transform:"translate(-50%,-50%)",borderRadius:"50%",width:58,height:58,background:"#0b2337",border:"4px solid #b6e9f8",display:"grid",placeItems:"center",fontSize:29}}>🚀</div>
    </div>
   </div>
   <div style={{minWidth:205,display:"grid",gap:12}}>
    <div style={{padding:16,background:"#18354b",border:"1px solid #5a8299",borderRadius:10}}><strong>Next free spin</strong><div style={{fontSize:26,fontWeight:800,margin:"8px 0"}}>{clock}</div>
     <button disabled={busy||!state||remaining>0} onClick={()=>spin(false)} style={{padding:12,background:remaining>0?"#536575":"#218766",color:"white",border:0,borderRadius:7,width:"100%"}}>🎁 FREE SPIN</button>
    </div>
    <div style={{padding:16,background:"#18354b",border:"1px solid #5a8299",borderRadius:10}}><strong>Tokens: {state?.tokens??"…"}</strong>
     <button disabled={busy||!state||state.tokens<50} onClick={()=>spin(true)} style={{padding:12,marginTop:12,background:"#62468c",color:"white",border:0,borderRadius:7,width:"100%"}}>🎯 SPIN · 50 TOKENS</button>
    </div>
   </div>
  </div>
  {notice&&<p role="status" style={{padding:12,background:"#173b4e",borderRadius:8}}>{notice}</p>}
  {last&&<p><strong>Collected:</strong> {last.label}</p>}
 </div>;
}
