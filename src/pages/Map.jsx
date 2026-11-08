
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
  const [zoom, setZoom] = useState(1);
  const tileSize = 60 * zoom;
  const mapSize = 100;

  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [selectedTarget, setSelectedTarget] = useState(null);
  const [marchDraft, setMarchDraft] = useState(null);
  const [availableArmy, setAvailableArmy] = useState({});
  const [marchUnits, setMarchUnits] = useState({});
  const [marchLoading, setMarchLoading] = useState(false);
  const [marchNotice, setMarchNotice] = useState("");
  const [castles, setCastles] = useState([]);
  const [mapError, setMapError] = useState("");
  const [campaign, setCampaign] = useState({highestDefeated:0,nextLevel:1});
  const [selectedAlien, setSelectedAlien] = useState(null);
  const [viewCenter, setViewCenter] = useState({x:50,y:50});
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
    const timer = setInterval(loadBases, 30000);
    return () => { cancelled = true; clearInterval(timer); };
  }, []);
  const [hqIcon, setHqIcon] = useState(null);
  const [hoveredTitle, setHoveredTitle] = useState("");
  const [cursorCoord, setCursorCoord] = useState(null);
  const [mineIcons, setMineIcons] = useState({});
  const [alienIcon, setAlienIcon] = useState(null);

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

    // Deterministic geographic terrain: plains, forests, lakes, hills and winding rivers.
    ctx.save();
    ctx.beginPath();
    ctx.rect(Math.max(0,offset.x),Math.max(0,offset.y),mapSize*tileSize,mapSize*tileSize);
    ctx.clip();
    ctx.fillStyle="#c5b78a";
    ctx.fillRect(offset.x,offset.y,mapSize*tileSize,mapSize*tileSize);
    const terrain=(x,y)=>({x:offset.x+x*tileSize,y:offset.y+y*tileSize});
    for(let i=0;i<190;i++){
      const x=((i*37.7+13)%100),y=((i*61.3+7)%100);
      const p=terrain(x,y);
      ctx.fillStyle=i%5===0?"#9c9473":i%3===0?"#7c9669":"#6b8559";
      ctx.beginPath();
      ctx.ellipse(p.x,p.y,(2+(i%7))*tileSize,(1.2+(i%5))*tileSize,i*.73,0,Math.PI*2);
      ctx.fill();
    }
    for(let i=0;i<9;i++){
      const p=terrain((i*29+17)%95+2,(i*43+11)%94+3);
      ctx.fillStyle="#558e9e";ctx.beginPath();
      ctx.ellipse(p.x,p.y,(1.5+i%4)*tileSize,(1+i%3)*tileSize,i*.45,0,Math.PI*2);ctx.fill();
    }
    for(let river=0;river<3;river++){
      ctx.beginPath();
      for(let step=0;step<=100;step++){
        const x=step,y=18+river*30+8*Math.sin(step*.095+river*1.7)+3*Math.sin(step*.24+river);
        const p=terrain(x,y);
        if(step===0)ctx.moveTo(p.x,p.y);else ctx.lineTo(p.x,p.y);
      }
      ctx.strokeStyle="#568f9d";ctx.lineWidth=Math.max(1,1.6*tileSize);ctx.stroke();
      ctx.strokeStyle="#83b6bb";ctx.lineWidth=Math.max(1,.65*tileSize);ctx.stroke();
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
    const canvas = canvasRef.current;
    if (!canvas) return;
    setOffset({x:canvas.width/2-(viewCenter.x-.5)*tileSize,y:canvas.height/2-(viewCenter.y-.5)*tileSize});
  }, [viewCenter, zoom, tileSize]);

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
    const canvas=canvasRef.current;
    const rect=canvas.getBoundingClientRect();
    const px=(e.clientX-rect.left)*canvas.width/rect.width;
    const py=(e.clientY-rect.top)*canvas.height/rect.height;
    const x=Math.floor((px-offset.x)/tileSize);
    const y=Math.floor((py-offset.y)/tileSize);
    if(x<0||x>=100||y<0||y>=100){setSelectedTarget(null);setSelectedAlien(null);return;}
    const castle=castles.find(c=>Number(c.x)===x+1&&Number(c.y)===y+1);
    const alien=alienBases.find(b=>b.x===x+1&&b.y===y+1);
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
  const openMarch = async (type, target) => {
    setMarchNotice("");
    setMarchLoading(true);
    try {
      const base=(process.env.REACT_APP_API_URL || window.location.origin).replace(/\/$/,"");
      const response=await fetch(base+"/get-progress/"+sessionStorage.getItem("userId"),{headers:{Authorization:"Bearer "+sessionStorage.getItem("authToken")}});
      if(!response.ok) throw new Error("Could not load your army. Please log in again.");
      const data=await response.json();
      setAvailableArmy(data.gameProgress?.army || {});
      setMarchUnits({});
      setMarchDraft({type,target});
    } catch(err){setMarchNotice(err.message);} finally{setMarchLoading(false);}
  };
  const prepareMarch = () => {
    const selected=Object.entries(marchUnits).filter(([,n])=>n>0);
    if(!selected.length){setMarchNotice("Choose at least one unit.");return;}
    setMarchNotice("Army selection ready. Actual dispatch is not yet enabled; no troops were moved.");
  };

  const attackAlien = async () => {
    if (!selectedAlien) return;
    try {
      const base=(process.env.REACT_APP_API_URL || window.location.origin).replace(/\/$/,"");
      const response=await fetch(base+"/alien-campaign/attack",{
        method:"POST",headers:{"Content-Type":"application/json",Authorization:"Bearer "+sessionStorage.getItem("authToken")},
        body:JSON.stringify({userId:sessionStorage.getItem("userId"),level:selectedAlien.level})
      });
      const data=await response.json();
      if(!response.ok) throw new Error(data.message || "Attack failed");
      setCampaign({highestDefeated:data.highestDefeated,nextLevel:data.nextLevel});
      sessionStorage.setItem("resources",JSON.stringify(data.resources));
      window.dispatchEvent(new Event("game-progress-updated"));
      setMapError("Alien base level "+data.level+" defeated. Reward: "+data.reward+" of each resource.");
    } catch(error) {setMapError(error.message);}
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
        width={1200}
        height={800}
        style={{
          display: "block",
          cursor: "crosshair",
          backgroundColor: "#c5b78a",
        }}
        onClick={handleMapClick}
        onMouseMove={handleMouseMove}
        title={hoveredTitle}
      />

      <div
        style={{
          position: "absolute",
          top: 20,
          left: 20,
          backgroundColor: "rgba(0,0,0,0.7)",
          padding: 12,
          borderRadius: 8,
          color: "white",
          zIndex: 10,
        }}
      >
        <div>Alien campaign: defeated level {campaign.highestDefeated}/20 · Next: level {campaign.nextLevel}</div>
        <div style={{margin:"8px 0"}}>Zoom <button onClick={()=>setZoom(z=>Math.max(.065,Number((z/1.6).toFixed(4))))}>−</button> <span>{Math.round(zoom*100)}%</span> <button onClick={()=>setZoom(z=>Math.min(3,Number((z*1.6).toFixed(4))))}>+</button> <button onClick={()=>{setZoom(.065);centerMapOn(50.5,50.5);}}>Full map 100×100</button> <button onClick={()=>setZoom(1)}>100%</button></div>
        {selectedTarget && <div style={{padding:8,border:"1px solid #777",marginBottom:8}}>
          <strong>{selectedTarget.type==="alien"?"Alien base level "+selectedTarget.level:selectedTarget.type==="castle"?"Castle: "+selectedTarget.username:"Empty field"} ({selectedTarget.x}:{selectedTarget.y})</strong>
          <div style={{marginTop:6}}>
            {selectedTarget.type==="alien" && <button disabled={selectedTarget.level!==campaign.nextLevel} onClick={()=>openMarch("Attack",selectedTarget)}>Attack</button>}
            {selectedTarget.type==="castle" && !targetIsOwn && <button onClick={()=>openMarch("Attack",selectedTarget)}>Attack</button>}
            {selectedTarget.type==="castle" && !targetIsOwn && canSupport && <button onClick={()=>openMarch("Support",selectedTarget)}>Support</button>}
            {selectedTarget.type==="castle" && !targetIsOwn && !canSupport && <span style={{opacity:.75,marginLeft:8}}>Support requires a verified allied or peaceful clan</span>}
            {selectedTarget.type==="field" && <button onClick={()=>openMarch("Patrol",selectedTarget)}>Patrol</button>}
            {targetIsOwn && <span>Your castle</span>}
          </div>
        </div>}
        {marchLoading && <div>Loading your army...</div>}
        {marchDraft && <div style={{marginTop:10,padding:10,border:"1px solid #66aacc",background:"#172735",maxHeight:"38vh",overflowY:"auto"}}>
          <strong>Marches — {marchDraft.type} to ({marchDraft.target.x}:{marchDraft.target.y})</strong>
          <div>Select troops from your available army:</div>
          {Object.values(unitEconomy.categories).flat().filter(unit=>Number(availableArmy[unit]||0)>0).map(unit=><label key={unit} style={{display:"flex",justifyContent:"space-between",gap:8,margin:"5px 0"}}>
            <span>{unit} (available: {availableArmy[unit]})</span>
            <input type="number" min="0" max={availableArmy[unit]} style={{width:70}} value={marchUnits[unit]||0}
              onChange={e=>setMarchUnits(old=>({...old,[unit]:Math.max(0,Math.min(Number(availableArmy[unit]||0),Math.floor(Number(e.target.value)||0)))}))}/>
          </label>)}
          {!Object.values(availableArmy).some(n=>Number(n)>0) && <div>No trained units available.</div>}
          <div style={{marginTop:8}}><button onClick={prepareMarch}>Prepare march</button> <button onClick={()=>setMarchDraft(null)}>Cancel</button></div>
          <small>Dispatch and troop travel are not active yet. Preparing does not send an army.</small>
        </div>}
        {marchNotice && <div role="status">{marchNotice}</div>}
        {mapError && <div role="alert">{mapError}</div>}
        <div>Coordinates: {cursorCoord ? `${cursorCoord.x}:${cursorCoord.y}` : "Move cursor over map"}</div>
        <input type="text" id="usernameInput" placeholder="Search Username" />
        <button onClick={searchByUsername}>Search</button>
        <br />
        <input type="number" id="xCoord" placeholder="X (1–100)" />
        <input type="number" id="yCoord" placeholder="Y (1–200)" />
        <button onClick={goToCoordinates}>Go to Coordinates</button>
      </div>

      <button
        onClick={() => (window.location.href = "/#/game")}
        style={{
          position: "absolute",
          top: 20,
          right: 20,
          padding: "10px 14px",
          backgroundColor: "#444",
          color: "white",
          fontWeight: "bold",
          border: "none",
          borderRadius: "5px",
          cursor: "pointer",
          zIndex: 10,
        }}
      >
        GO BACK
      </button>
    </div>
  );
}

export default Map;
