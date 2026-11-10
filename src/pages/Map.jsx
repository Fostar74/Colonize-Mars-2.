
// Colonize Mars Map.jsx with full formatting, mines, and alien bases

import React, { useEffect, useRef, useState } from "react";
import hqIconFile from "../images/hq-icon.png";
import goldMineImg from "../images/mine-gold.png";
import ironMineImg from "../images/mine-iron.png";
import solarMineImg from "../images/mine-solar.png";
import waterMineImg from "../images/mine-water.png";
import alienBaseImg from "../images/alien-base.png";
import unitEconomy from "../shared/unitEconomy";

function Map() {
  const canvasRef = useRef(null);
  const dragRef = useRef(null);
  const suppressClickRef = useRef(false);
  const [zoom, setZoom] = useState(1);
  const tileSize = 60 * zoom;
  const mapSize = 100;

  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [selectedTarget, setSelectedTarget] = useState(null);
  const [marchDraft, setMarchDraft] = useState(null);
  const [availableArmy, setAvailableArmy] = useState({});
  const [marchUnits, setMarchUnits] = useState({});
  const [knightAdded,setKnightAdded]=useState(false);
  const [formationRows,setFormationRows]=useState({});
  const [marchLoading, setMarchLoading] = useState(false);
  const [marchNotice, setMarchNotice] = useState("");
  const [marchHistoryOpen, setMarchHistoryOpen] = useState(false);
  const [castles, setCastles] = useState([]);
  const [mapError, setMapError] = useState("");
  const [campaign, setCampaign] = useState({highestDefeated:0,nextLevel:1});
  const [selectedAlien, setSelectedAlien] = useState(null);
  const [viewCenter, setViewCenter] = useState({x:50,y:50});
  const [viewport, setViewport] = useState({width:1200,height:800});
  useEffect(()=>{
    const resize=()=>setViewport({width:Math.max(320,window.innerWidth),height:Math.max(320,window.innerHeight)});
    resize();window.addEventListener("resize",resize);return()=>window.removeEventListener("resize",resize);
  },[]);
  useEffect(() => {
    let cancelled = false;
    const loadBases = async () => {
      try {
        const base = (process.env.REACT_APP_API_URL || (window.location.hostname === "localhost" ? "http://localhost:3001" : window.location.origin)).replace(/\/$/, "");
        const response = await fetch(base + "/map/bases", { headers: { Authorization: "Bearer " + sessionStorage.getItem("authToken") } });
        if (!response.ok) throw new Error(response.status === 401 ? "Session expired. Please log in again." : "Could not load player bases.");
        const data = await response.json();
        if (!cancelled) {
          const own = JSON.parse(sessionStorage.getItem("castle") || "null");
          const bases = Array.isArray(data.bases) ? data.bases : [];
          setCastles(own && !bases.some(b => b.username === own.username) ? [...bases, own] : bases);
          setMapError("");
        }
      } catch (error) { if (!cancelled) setMapError(error.message); }
    };
    loadBases();
    fetch((process.env.REACT_APP_API_URL || window.location.origin).replace(/\/$/,"") + "/alien-campaign/" + sessionStorage.getItem("userId"), {headers:{Authorization:"Bearer "+sessionStorage.getItem("authToken")}}).then(r=>r.ok?r.json():null).then(d=>{if(d && !cancelled)setCampaign(d)}).catch(()=>{});
    const timer = setInterval(()=>{loadBases();fetch((process.env.REACT_APP_API_URL||window.location.origin).replace(/\/$/,"")+"/alien-campaign/"+sessionStorage.getItem("userId"),{headers:{Authorization:"Bearer "+sessionStorage.getItem("authToken")}}).then(r=>r.ok?r.json():null).then(d=>{if(d&&!cancelled)setCampaign(d)}).catch(()=>{});},10000);
    return () => { cancelled = true; clearInterval(timer); };
  }, []);
  const [hqIcon, setHqIcon] = useState(null);
  const [hoveredTitle, setHoveredTitle] = useState("");
  const [cursorCoord, setCursorCoord] = useState(null);
  const [mineIcons, setMineIcons] = useState({});
  const [alienIcon, setAlienIcon] = useState(null);
  const [mapMenuOpen, setMapMenuOpen] = useState(true);
  const [alienSearchLevel, setAlienSearchLevel] = useState("");

  // World coordinates are 1–100; each tile has a stable geographic location.
  const mineData = [
    ...["gold","iron","solar","water"].flatMap((type,row)=>
      Array.from({length:9},(_,i)=>({x:5+i*10,y:10+row*22,type})))
  ];
  // Exactly 69 alien bases, with stronger levels closer to the center.
  const alienBases = Array.from({length:20},(_,index)=>{
    const level=index+1;
    const count=level===20?1:level>=16?2:level>=11?3:level>=6?4:5;
    const radius=level===20?0:3+(20-level)*2.25;
    return Array.from({length:count},(_,j)=>{
      const angle=2*Math.PI*(j/count+(level*0.61803398875)%1);
      return {x:Math.max(1,Math.min(100,Math.round(50+radius*Math.cos(angle)))),
              y:Math.max(1,Math.min(100,Math.round(50+radius*Math.sin(angle)))),level};
    });
  }).flat();

  useEffect(() => {
    const gold = new Image();
    const iron = new Image();
    const solar = new Image();
    const water = new Image();
    const alien = new Image();

    gold.src = goldMineImg;
    iron.src = ironMineImg;
    solar.src = solarMineImg;
    water.src = waterMineImg;
    alien.src = alienBaseImg;

    const onLoad = () => {
      setMineIcons({
        gold: gold,
        iron: iron,
        solar: solar,
        water: water,
      });

      setAlienIcon(alien);
    };

    gold.onload = onLoad;
  }, []);

  useEffect(() => {
    const img = new Image();
    img.src = hqIconFile;

    img.onload = () => {
      setHqIcon(img);
    };
  }, []);

  useEffect(() => {
    const savedCastleRaw = sessionStorage.getItem("castle");
    const username = sessionStorage.getItem("username");

    if (!username || !savedCastleRaw) {
      alert("You are not logged in. Please login first.");
      window.location.href = "/#/";
      return;
    }

    try {
      const savedCastle = JSON.parse(savedCastleRaw);

      if (!savedCastle || !savedCastle.x || !savedCastle.y) throw new Error();

      setCastles(previous => previous.length ? previous : [savedCastle]);

      if (hqIcon) {
        centerMapOn(savedCastle.x, savedCastle.y);
      }
    } catch {
      alert("Invalid castle data. Please log in again.");
      window.location.href = "/#/";
    }
  }, [hqIcon]);

  useEffect(() => {
    if (
      !hqIcon ||
      castles.length === 0 ||
      Object.keys(mineIcons).length === 0 ||
      !alienIcon
    )
      return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Mars surface: layered rust regolith, ridges, impact craters and dust deposits.
    ctx.save();
    ctx.beginPath();
    ctx.rect(Math.max(0,offset.x),Math.max(0,offset.y),mapSize*tileSize,mapSize*tileSize);
    ctx.clip();
    ctx.fillStyle="#6d3429";
    ctx.fillRect(offset.x,offset.y,mapSize*tileSize,mapSize*tileSize);
    const terrain=(x,y)=>({x:offset.x+x*tileSize,y:offset.y+y*tileSize});
    // Stable terrain features anchored to world coordinates.
    for(let i=0;i<450;i++){
      const x=(i*37.731+13.3)%100,y=(i*61.317+7.1)%100;
      const p=terrain(x,y);
      const radius=(.3+(i%11)*.27)*tileSize;
      ctx.beginPath();ctx.ellipse(p.x,p.y,radius*2.4,radius*.85,i*.71,0,Math.PI*2);
      ctx.fillStyle=["#874638","#a15b3e","#4d2929","#bb7951","#784a3b"][i%5];ctx.globalAlpha=.23+(i%4)*.08;ctx.fill();
    }
    ctx.globalAlpha=1;
    // Canyon and fault lines, no Earth-like rivers or grass.
    for(let ridge=0;ridge<7;ridge++){
      ctx.beginPath();
      for(let step=0;step<=100;step++){
        const x=step,y=(ridge*17+13+6*Math.sin(step*.095+ridge*2)+2*Math.sin(step*.27+ridge))%100;
        const p=terrain(x,y);if(step===0)ctx.moveTo(p.x,p.y);else ctx.lineTo(p.x,p.y);
      }
      ctx.lineWidth=Math.max(1,tileSize*(.2+ridge%3*.11));ctx.strokeStyle="#39252b";ctx.globalAlpha=.4;ctx.stroke();
      ctx.lineWidth=Math.max(1,tileSize*.09);ctx.strokeStyle="#cf8558";ctx.globalAlpha=.45;ctx.stroke();
    }
    ctx.globalAlpha=1;
    for(let i=0;i<210;i++){
      const x=(i*41.83+9.7)%100,y=(i*73.19+5.4)%100,p=terrain(x,y);
      const radius=(.19+i%7*.14)*tileSize;
      if(radius<1)continue;
      ctx.beginPath();ctx.ellipse(p.x,p.y,radius*1.4,radius,0,0,Math.PI*2);
      ctx.fillStyle="#3b2729";ctx.globalAlpha=.4;ctx.fill();
      ctx.beginPath();ctx.ellipse(p.x-radius*.15,p.y-radius*.15,radius*.85,radius*.68,0,0,Math.PI*2);
      ctx.fillStyle="#472c2b";ctx.globalAlpha=.65;ctx.fill();
      ctx.beginPath();ctx.arc(p.x,p.y,radius,Math.PI*1.06,Math.PI*1.85);
      ctx.strokeStyle="#d79a6e";ctx.lineWidth=Math.max(.7,radius*.21);ctx.globalAlpha=.72;ctx.stroke();
    }
    ctx.globalAlpha=1;
    // Subtle coordinate lattice, visible mainly when zoomed in.
    if(tileSize>=16){
      ctx.strokeStyle="rgba(238,177,126,.14)";ctx.lineWidth=.7;
      for(let n=0;n<=100;n++){
        const x=offset.x+n*tileSize,y=offset.y+n*tileSize;
        if(x>=0&&x<=canvas.width){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,canvas.height);ctx.stroke();}
        if(y>=0&&y<=canvas.height){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(canvas.width,y);ctx.stroke();}
      }
    }
    ctx.restore();

    mineData.forEach((mine) => {
      const px = (mine.x-1) * tileSize + offset.x;
      const py = (mine.y-1) * tileSize + offset.y;
      const icon = mineIcons[mine.type];

      if (
        icon &&
        px + tileSize >= 0 &&
        py + tileSize >= 0 &&
        px < canvas.width &&
        py < canvas.height
      ) {
        ctx.drawImage(icon, px, py, tileSize, tileSize);
      }
    });

    alienBases.forEach((base) => {
      const px = (base.x-1) * tileSize + offset.x;
      const py = (base.y-1) * tileSize + offset.y;

      if (
        px + tileSize >= 0 &&
        py + tileSize >= 0 &&
        px < canvas.width &&
        py < canvas.height
      ) {
        ctx.drawImage(alienIcon, px, py, tileSize, tileSize);
        ctx.fillStyle = "white";
        ctx.font = "bold 14px Arial";
        ctx.fillText(`Lv${base.level}`, px + 5, py + 15);
      }
    });

    castles.forEach((c) => {
      const px = (c.x-1) * tileSize + offset.x;
      const py = (c.y-1) * tileSize + offset.y;

      if (
        px + tileSize >= 0 &&
        py + tileSize >= 0 &&
        px < canvas.width &&
        py < canvas.height
      ) {
        ctx.drawImage(hqIcon, px, py, tileSize, tileSize);
        ctx.fillStyle = "white";
        ctx.font = "12px Arial";
        ctx.fillText(`${c.username} (${c.x}:${c.y})`, px + 2, py + tileSize - 5);
      }
    });
  }, [offset, castles, hqIcon, mineIcons, alienIcon, zoom]);

  // All markers and the grid share one fixed world coordinate system.
  // The map is not draggable; only zoom and explicit coordinate navigation change the view.
  const centerMapOn = (x, y) => setViewCenter({x,y});
  useEffect(() => {
    setOffset({x:viewport.width/2-(viewCenter.x-.5)*tileSize,y:viewport.height/2-(viewCenter.y-.5)*tileSize});
  }, [viewCenter, zoom, tileSize, viewport.width, viewport.height]);
  const startDrag=e=>{dragRef.current={x:e.clientX,y:e.clientY,moved:false};e.currentTarget.setPointerCapture(e.pointerId);};
  const moveDrag=e=>{
    const d=dragRef.current;if(!d)return;
    const dx=e.clientX-d.x,dy=e.clientY-d.y;
    if(Math.abs(dx)+Math.abs(dy)>2){d.moved=true;setOffset(o=>({x:o.x+dx,y:o.y+dy}));}
    d.x=e.clientX;d.y=e.clientY;
  };
  const endDrag=()=>{if(dragRef.current?.moved)suppressClickRef.current=true;dragRef.current=null;};

  const handleMouseMove = e => {
    const canvas=canvasRef.current;
    const rect=canvas.getBoundingClientRect();
    const mouseX=(e.clientX-rect.left)*canvas.width/rect.width;
    const mouseY=(e.clientY-rect.top)*canvas.height/rect.height;
    const x=Math.floor((mouseX-offset.x)/tileSize)+1;
    const y=Math.floor((mouseY-offset.y)/tileSize)+1;
    setCursorCoord(x>=1&&x<=100&&y>=1&&y<=100?{x,y}:null);
    const hovered=castles.find(c=>c.x===x&&c.y===y);
    setHoveredTitle(hovered?`${hovered.username} – Headquarter (${x}:${y})`:"");
  };

  const handleMapClick = e => {
    if(suppressClickRef.current){suppressClickRef.current=false;return;}
    const canvas=canvasRef.current;
    const rect=canvas.getBoundingClientRect();
    const px=(e.clientX-rect.left)*canvas.width/rect.width;
    const py=(e.clientY-rect.top)*canvas.height/rect.height;
    const x=Math.floor((px-offset.x)/tileSize);
    const y=Math.floor((py-offset.y)/tileSize);
    if(x<0||x>=100||y<0||y>=100){setSelectedTarget(null);setSelectedAlien(null);return;}
    // At low zoom icons are tiny: use nearest marker within a visible hit radius.
    const hitRadius=Math.max(13,tileSize*.8);
    const nearest=(items)=>items.map(item=>({
      item,dist:Math.hypot((Number(item.x)-.5)*tileSize+offset.x-px,(Number(item.y)-.5)*tileSize+offset.y-py)
    })).filter(hit=>hit.dist<=hitRadius).sort((a,b)=>a.dist-b.dist)[0]?.item;
    const castle=nearest(castles);
    const alien=castle?null:nearest(alienBases);
    setSelectedAlien(castle?null:alien||null);
    setMarchDraft(null);
    setSelectedTarget(castle?{type:"castle",...castle}:alien?{type:"alien",...alien}:{type:"field",x:x+1,y:y+1});
    setMarchNotice("");
  };
  const ownUsername=sessionStorage.getItem("username");
  const targetIsOwn=selectedTarget?.type==="castle"&&selectedTarget.username===ownUsername;
  // Clan diplomacy is not yet backed by a server-side alliance system.
  // Never offer support to an unverified player.
  const canSupport=false;
  const openMarch = async (type, target, origin) => {
    setMarchNotice("");
    setMarchLoading(true);
    try {
      const base=(process.env.REACT_APP_API_URL || window.location.origin).replace(/\/$/,"");
      const response=await fetch(base+"/get-progress/"+sessionStorage.getItem("userId"),{headers:{Authorization:"Bearer "+sessionStorage.getItem("authToken")}});
      if(!response.ok) throw new Error("Could not load your army. Please log in again.");
      const data=await response.json();
      setAvailableArmy(data.gameProgress?.army || {});
      setMarchUnits({});
      setFormationRows({});
      setKnightAdded(false);
      setMarchDraft({type,target,origin});
      } catch(err){setMarchNotice(err.message);} finally{setMarchLoading(false);}
  };
  const chooseAction = (type) => {
    if (!selectedTarget) return;
    setMarchNotice("");
    setMarchDraft(null);
    setMarchHistoryOpen(false);
    const home = castles.find(c => c.username === ownUsername);
    if (!home) {
      setMarchNotice("Your base could not be found. Refresh the map and try again.");
      return;
    }
    openMarch(type, selectedTarget, home);
  };
  const prepareMarch = async () => {
    if(!knightAdded){setMarchNotice("Add Cyber Knight before launching the attack.");return;}
    const selected=Object.fromEntries(Object.entries(marchUnits).filter(([,n])=>n>0));
    if(!Object.keys(selected).length){setMarchNotice("Choose at least one unit.");return;}
    if(marchDraft?.target?.type!=="alien"){setMarchNotice("Player marches are not yet enabled.");return;}
    try{
      setMarchLoading(true);
      const base=(process.env.REACT_APP_API_URL||window.location.origin).replace(/\/$/,"");
      const formation=Object.entries(selected).map(([unit,count])=>({unit,count,row:Number(formationRows[unit]||(["Railgunner","Pulse Sniper","Drone Operator","Demolition Bot","Missile Carrier","Particle Blaster","Orbital Strike Beacon"].includes(unit)?4:1))}));
      const response=await fetch(base+"/alien-campaign/attack",{method:"POST",headers:{"Content-Type":"application/json",Authorization:"Bearer "+sessionStorage.getItem("authToken")},body:JSON.stringify({userId:sessionStorage.getItem("userId"),level:marchDraft.target.level,army:selected,formation,includeCyberKnight:knightAdded})});
      const data=await response.json();
      if(!response.ok)throw Error(data.message||"Mission failed.");
      setCampaign(old=>({...old,remaining:data.remaining,knightBusy:true}));
      setMarchNotice("Mission dispatched! Battle in 60 seconds. Check CAMPAIGNS for results.");
      setMarchDraft(null);
    }catch(e){setMarchNotice(e.message);}finally{setMarchLoading(false);}
  };
  const goToCoordinates = () => {
    const x = parseInt(document.getElementById("xCoord").value);
    const y = parseInt(document.getElementById("yCoord").value);

    if (!isNaN(x) && !isNaN(y) && x >= 1 && x <= 100 && y >= 1 && y <= 100) {
      centerMapOn(x, y);
    } else {
      alert("Invalid coordinates");
    }
  };

  const searchByUsername = () => {
    const input = document.getElementById("usernameInput").value.trim();

    const found = castles.find(
      (c) => c.username.toLowerCase() === input.toLowerCase()
    );

    if (found) {
      centerMapOn(found.x, found.y);
    } else {
      alert("Player not found.");
    }
  };

  return (
    <div
      style={{
        height: "100vh",
        backgroundColor: "#2d2d2d",
        overflow: "hidden",
        position: "relative",
      }}
    >
      <canvas
        ref={canvasRef}
        width={viewport.width}
        height={viewport.height}
        style={{
          display: "block",
          cursor: dragRef.current ? "grabbing" : "grab",
          width:"100%",height:"100%",touchAction:"none",
          backgroundColor: "#6d3429",
        }}
        onPointerDown={startDrag}
        onPointerMove={moveDrag}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onClick={handleMapClick}
        onMouseMove={handleMouseMove}
        title={hoveredTitle}
      />

      <div
        style={{
          position: "absolute",
          top: 20,
          left: 20,
          maxWidth: "calc(100% - 40px)",
          boxSizing: "border-box",
          maxHeight: "75%",
          overflowY: "auto",
          backgroundColor: "rgba(0,0,0,0.7)",
          padding: 12,
          borderRadius: 8,
          color: "white",
          zIndex: 10,
        }}
      >
        <div style={{display:"flex",justifyContent:"space-between",gap:8,marginBottom:mapMenuOpen?8:0}}>
          <button type="button" aria-label={mapMenuOpen?"Hide map menu":"Show map menu"} aria-expanded={mapMenuOpen}
            aria-controls="map-menu-controls" onClick={()=>setMapMenuOpen(open=>!open)} style={{minWidth:44,minHeight:44}}>
            {mapMenuOpen ? "▲" : "▼"}
          </button>
      <button
        onClick={() => (window.location.href = "/#/game")}
        style={{
          padding: "10px 14px",
          backgroundColor: "#444",
          color: "white",
          fontWeight: "bold",
          border: "none",
          borderRadius: "5px",
          cursor: "pointer",
        }}
      >
        GO BACK
      </button>
        </div>
        <div id="map-menu-controls" hidden={!mapMenuOpen}>
        <div>Alien campaign: defeated level {campaign.highestDefeated}/20 · Next: level {campaign.nextLevel} · Attacks left: {campaign.remaining??"—"}/20 · Cyber Knight Lv {campaign.knightLevel||1}</div>
        <div style={{fontSize:12}}>Mission travel: 60 seconds · Daily reset: 00:00 UTC</div>
        {(campaign.sideQuests||[]).filter(q=>q.completed&&!q.claimed).map(q=><button key={q.level} onClick={async()=>{
          const base=(process.env.REACT_APP_API_URL||window.location.origin).replace(/\/$/,"");
          const r=await fetch(base+"/alien-campaign/side-quest",{method:"POST",headers:{"Content-Type":"application/json",Authorization:"Bearer "+sessionStorage.getItem("authToken")},body:JSON.stringify({userId:sessionStorage.getItem("userId"),milestone:q.level})});
          const d=await r.json();setMapError(r.ok?"Side quest claimed! "+d.amount+" of each resource added to Inventory.":d.message);
          if(r.ok)setCampaign(old=>({...old,sideQuests:old.sideQuests.map(x=>x.level===q.level?{...x,claimed:true}:x)}));
        }}>Side Quest: claim Level {q.level} reward</button>)}
        <div style={{margin:"8px 0"}}>Zoom <button onClick={()=>setZoom(z=>Math.max(.065,Number((z/1.6).toFixed(4))))}>−</button> <span>{Math.round(zoom*100)}%</span> <button onClick={()=>setZoom(z=>Math.min(3,Number((z*1.6).toFixed(4))))}>+</button> <button onClick={()=>{setZoom(.065);centerMapOn(50.5,50.5);}}>Full map 100×100</button> <button onClick={()=>setZoom(1)}>100%</button></div>
        {mapError && <div role="alert">{mapError}</div>}
        <div>Coordinates: {cursorCoord ? `${cursorCoord.x}:${cursorCoord.y}` : "Move cursor over map"}</div>
        <input type="text" id="usernameInput" placeholder="Search Username" />
        <button onClick={searchByUsername}>Search</button>
        <div style={{marginTop:6}}>
          <input type="number" id="xCoord" placeholder="X (1–100)" style={{width:90}} />
          <input type="number" id="yCoord" placeholder="Y (1–100)" style={{width:90}} />
          <button onClick={goToCoordinates}>Go to Coordinates</button>
        </div>
        <div style={{marginTop:6}}>
          <label>Alien Base level{" "}
            <select value={alienSearchLevel} onChange={event=>setAlienSearchLevel(event.target.value)}>
              <option value="">Select level</option>
              {Array.from({length:20},(_,index)=>index+1).map(level=><option key={level} value={level}>{level}</option>)}
            </select>
          </label>
          {alienSearchLevel && <div>
            {alienBases.filter(base=>base.level===Number(alienSearchLevel)).map(({x,y})=>(
              <button key={`${x}:${y}`} onClick={()=>centerMapOn(x,y)} aria-label={`Go to Alien Base level ${alienSearchLevel} at ${x}:${y}`}>
                {x}:{y}
              </button>
            ))}
          </div>}
        </div>
        </div>
      </div>
      {(selectedTarget || marchDraft) && <div style={{position:"absolute",inset:0,zIndex:25,background:"rgba(3,8,19,.72)",display:"flex",alignItems:"center",justifyContent:"center",padding:16}}>
        <div style={{background:"linear-gradient(135deg,#182c40,#0c1424)",border:"1px solid #5d8ca7",boxShadow:"0 16px 60px #000",borderRadius:12,color:"#f0f7ff",width:"min(920px,96vw)",maxHeight:"86vh",overflowY:"auto",padding:22}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:12}}>
            <h2 style={{margin:0,color:"#9cdbff"}}>{marchDraft?"MARCH CONTROL":"TARGET COMMAND"}</h2>
            <button onClick={()=>{setSelectedTarget(null);setMarchDraft(null);setMarchNotice("");}}>✕ Close</button>
          </div>
          <p style={{color:"#c0d2e3"}}>{selectedTarget?.type==="alien"?"Alien Stronghold · Level "+selectedTarget.level:selectedTarget?.type==="castle"?"Player Base · "+selectedTarget.username:"Open Sector"} · Coordinates {selectedTarget?.x}:{selectedTarget?.y}</p>
          {selectedTarget?.type==="alien" && <div style={{padding:12,background:"#243449",border:"1px solid #58758e",borderRadius:8}}>
            <strong>Alien garrison · Level {selectedTarget.level}</strong>
            {campaign.garrisons?.[selectedTarget.level] ? <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))",gap:6,marginTop:8}}>
              {Object.entries(campaign.garrisons[selectedTarget.level]).map(([unit,count])=><div key={unit}>{unit}: <strong>{count.toLocaleString()}</strong></div>)}
              <div style={{gridColumn:"1 / -1",marginTop:6,fontWeight:"bold"}}>Total defenders: {Object.values(campaign.garrisons[selectedTarget.level]).reduce((sum,n)=>sum+n,0).toLocaleString()}</div>
            </div> : <p>Loading fixed garrison data...</p>}
            <p style={{fontSize:12}}>Higher-level alien strongholds have larger and more advanced garrisons. The level 20 fortress has an Alien Overlord.</p>
            <p style={{fontSize:12}}>Rover Scout reconnaissance costs 1000 Solar before Quantum Intelligence discounts (10% / 30% / 50%). At least one available Rover Scout is required; it is not consumed.</p>
            <button onClick={async()=>{
              try{
                const base=(process.env.REACT_APP_API_URL||window.location.origin).replace(/\/$/,"");
                const userId=sessionStorage.getItem("userId");
                const headers={"Content-Type":"application/json",Authorization:"Bearer "+sessionStorage.getItem("authToken")};
                const response=await fetch(base+"/alien-campaign/scout",{method:"POST",headers,body:JSON.stringify({userId,level:selectedTarget.level})});
                const data=await response.json();
                if(!response.ok)throw Error(data.message||"Reconnaissance failed.");
                setMapError("Rover Scout reconnaissance complete at alien level "+data.level+". Solar spent: "+data.cost+". Mission 7 progress updated.");
                const updated=await fetch(base+"/alien-campaign/"+userId,{headers});
                if(updated.ok)setCampaign(await updated.json());
              }catch(e){setMapError(e.message);}
            }}>◈ Send Rover Scout</button>
            {(campaign.scoutedLevels||[]).includes(selectedTarget.level)&&<p style={{color:"#9be8b7"}}>Reconnaissance completed for this stronghold.</p>}
          </div>}
          {!marchDraft && <div>
            <p>Choose mission type:</p>
            <div style={{display:"flex",gap:10,flexWrap:"wrap",margin:"18px 0"}}>
              {(selectedTarget?.type==="alien"?["Attack"]:["Attack","Support","Espionage","Patrol","Gather","Trade","Relocation"]).map(type=>{
                const field=selectedTarget?.type==="field",own=targetIsOwn,alien=selectedTarget?.type==="alien";
                const allowed=type==="Attack"?!own: type==="Support"?!field&&!alien&&!own&&canSupport:
                  type==="Espionage"?!field&&!own:
                  type==="Patrol"?field:
                  type==="Gather"?field:
                  type==="Trade"?!field&&!alien&&!own:
                  type==="Relocation"?field:false;
                return <button key={type} disabled={!allowed} onClick={()=>chooseAction(type)}
                  style={{padding:"12px 18px",background:allowed?(type==="Attack"?"#9e4437":"#205c78"):"#253441",color:allowed?"white":"#788796",border:"1px solid #50718b",borderRadius:7,cursor:allowed?"pointer":"not-allowed"}}>
                  {type==="Attack"?"⚔ ":type==="Espionage"?"◈ ":type==="Support"?"🛡 ":""}{type}
                </button>;
              })}
            </div>
            {targetIsOwn && <p>This is your own base. Choose another destination.</p>}
            {selectedTarget?.type==="alien" ? <p style={{fontSize:12,color:"#b2c8d8"}}>Use Send Rover Scout above to complete reconnaissance, or Attack to launch a combat mission.</p> : <p style={{fontSize:12,color:"#b2c8d8"}}>Unavailable mission types require their own gameplay systems. Select an available type to continue to troop selection from your only base.</p>}
          </div>}
          {marchLoading && <p>Loading your army...</p>}
          {marchDraft && <div>
            <h3>{marchDraft.type}: {marchDraft.origin.username} ({marchDraft.origin.x}:{marchDraft.origin.y}) → ({marchDraft.target.x}:{marchDraft.target.y})</h3>
            <p>Commander: Cyber Knight Lv {campaign.knightLevel || 1} (required)</p>
            <button type="button" disabled={marchLoading || campaign.knightBusy} aria-pressed={knightAdded} onClick={()=>setKnightAdded(added=>!added)}>
              {knightAdded ? "Remove Cyber Knight" : "Add Cyber Knight"}
            </button>
            {campaign.knightBusy && <p>Cyber Knight is on a mission and must return before launching another attack.</p>}
            <p>Select troops from your base army:</p>
            {!Object.values(unitEconomy.categories).flat().some(unit=>Number(availableArmy[unit]||0)>0) && <p>No trained troops available. Train units at your base before preparing a march.</p>}
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(190px,1fr))",gap:10}}>
              {Object.values(unitEconomy.categories).flat().filter(unit=>Number(availableArmy[unit]||0)>0).map(unit=><label key={unit} style={{background:"#20384d",border:"1px solid #46637a",padding:10,borderRadius:8,display:"flex",flexDirection:"column",gap:6,opacity:Number(availableArmy[unit]||0)>0?1:.5}}>
                <strong>{unit}</strong>
                <span>Available: {Number(availableArmy[unit]||0)}</span>
                <input type="number" min="0" max={Number(availableArmy[unit]||0)} disabled={!Number(availableArmy[unit]||0)} value={marchUnits[unit]||0}
                  onChange={e=>setMarchUnits(old=>({...old,[unit]:Math.max(0,Math.min(Number(availableArmy[unit]||0),Math.floor(Number(e.target.value)||0)))}))}/>
                <button disabled={!Number(availableArmy[unit]||0)} onClick={()=>setMarchUnits(old=>({...old,[unit]:Number(availableArmy[unit]||0)}))}>MAX</button>
                <span>Formation row (1 front / 4 rear)</span>
                <select value={formationRows[unit]||(["Railgunner","Pulse Sniper","Drone Operator","Demolition Bot","Missile Carrier","Particle Blaster","Orbital Strike Beacon"].includes(unit)?4:1)} onChange={e=>setFormationRows(old=>({...old,[unit]:Number(e.target.value)}))}>
                  {[1,2,3,4].map(row=><option key={row} value={row}>Row {row}</option>)}
                </select>
              </label>)}
            </div>
            <div style={{marginTop:14,display:"flex",gap:8,flexWrap:"wrap"}}>
              <button onClick={()=>setMarchUnits(Object.fromEntries(Object.entries(availableArmy).map(([k,v])=>[k,Number(v)||0])))}>Select all</button>
              <button onClick={()=>setMarchUnits({})}>Clear</button>
              <button disabled={marchLoading || campaign.knightBusy || !knightAdded} onClick={prepareMarch} style={{background:"#26765e",color:"white",padding:"10px 22px"}}>Launch attack (60 sec)</button>
              <button onClick={()=>setMarchDraft(null)}>← Back to mission types</button>
            </div>
            <p style={{fontSize:12,color:"#b5c7d9"}}>Alien attacks reserve selected troops immediately; survivors return after the battle.</p>
          </div>}
          {marchNotice && <p role="status" style={{color:"#ffdc9c"}}>{marchNotice}</p>}
        </div>
      </div>}
      <button onClick={()=>setMarchHistoryOpen(true)} style={{position:"absolute",right:18,bottom:22,zIndex:12,background:"#142b39",color:"#ccecff",border:"1px solid #64a9c9",padding:"12px 20px",borderRadius:8,cursor:"pointer"}}>🚀 CAMPAIGNS</button>
      {marchHistoryOpen && <div style={{position:"absolute",inset:0,zIndex:40,background:"rgba(0,0,0,.76)",display:"grid",placeItems:"center",padding:16}}>
        <div style={{width:"min(850px,95vw)",maxHeight:"85vh",overflowY:"auto",padding:24,background:"#122334",color:"#edf6ff",border:"1px solid #69a5c2",borderRadius:12}}>
          <div style={{display:"flex",justifyContent:"space-between"}}><h2 style={{margin:0}}>🚀 CAMPAIGNS</h2><button onClick={()=>setMarchHistoryOpen(false)}>✕ Close</button></div>
          <h3>Alien Mission Reports</h3>
        {(campaign.missions||[]).map(m=><details key={m.id} style={{marginBottom:10,borderBottom:"1px solid #536c80",paddingBottom:8}}>
          <summary>Mission #{m.id} · Alien Lv {m.level} · {m.result?(m.result.victory?"VICTORY":"DEFEAT"):"Travelling / awaiting battle"}</summary>
          {m.result&&<div>{m.result.cyberKnightLevel && <p>Commander: Cyber Knight Lv {m.result.cyberKnightLevel}</p>}<p>Rounds: {m.result.rounds} · Remaining alien defenders: {m.result.defendersRemaining}</p>
          <p>Reward: {m.result.reward?.item?.name || (m.result.reward?.type==="crafting" ? `${m.result.reward.amount} Universal Forge points` : m.result.reward?.type==="resources" ? `${m.result.reward.amount} of each resource` : m.result.reward?.type==="army" ? `${m.result.reward.amount} ${m.result.reward.unit}` : "None")}</p>
          <p>Survivors: {Object.entries(m.result.survivors||{}).map(([u,n])=>u+": "+n).join(", ") || "None"}</p>
          {(m.result.report||[]).map(round=><details key={round.round}><summary>Round {round.round}</summary>
            {round.events.map((e,i)=><p key={i} style={{fontSize:12}}>{e.restored > 0 ? `Nano Regeneration: ${e.restored} ${e.unit} restored` : <>{e.attacker}: {e.units} {e.unit} → {e.target} · {e.damage} damage{Number.isInteger(e.kills) ? ` · ${e.kills} defeated` : ""}{e.dodged ? " · Evaded" : ""}</>}</p>)}
          </details>)}</div>}
        </details>)}
        {!(campaign.missions||[]).length&&<p>No alien missions yet.</p>}
        </div>
      </div>}
    </div>
  );
}

export default Map;
