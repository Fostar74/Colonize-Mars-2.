import { useLanguage } from "../language";

// Colonize Mars Map.jsx with full formatting, mines, and alien bases

import React, { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import hqIconFile from "../images/hq-icon.png";
import goldMineImg from "../images/mine-gold.png";
import ironMineImg from "../images/mine-iron.png";
import solarMineImg from "../images/mine-solar.png";
import waterMineImg from "../images/mine-water.png";
import alienBaseImg from "../images/alien-base.png";
import unitEconomy from "../shared/unitEconomy";
import formations from "../shared/formations";
import alienBases from "../shared/alienBases";
const {units, marchLimit, cellsPerRow, defaultFormation, normalizeFormation}=formations;

const formationTypes = {
  Ground: ["Ground", "Наземни", 1],
  Ranged: ["Ranger", "Далекобойни", 4],
  Mobile: ["Mobile", "Мобилни", 1],
  "Heavy Systems": ["Heavy System", "Тежки системи", 5],
  Elite: ["Elite", "Елитни", 2]
};
const formationUnitTypes = Object.fromEntries(Object.entries(unitEconomy.categories)
  .flatMap(([category, names]) => names.map(name => [name, formationTypes[category]])));

function FormationBoard({ rows, setRows }) {
  const { t, label } = useLanguage();
  const [selected, setSelected] = useState(null);
  const board = normalizeFormation(rows);
  const place = (unit, row, column) => {
    if (!units.includes(unit)) return;
    setRows(previous => {
      const next = normalizeFormation(previous);
      const occupant = units.find(name => next[name] === row && next.columns[name] === column);
      if (occupant === unit) return previous;
      if (occupant && next[unit]) {
        next[occupant] = next[unit];
        next.columns[occupant] = next.columns[unit];
      } else if (occupant) {
        delete next[occupant];
        delete next.columns[occupant];
      }
      next[unit] = row;
      next.columns[unit] = column;
      return next;
    });
    setSelected(null);
  };
  const tile = (unit) => {
    const [type, translatedType, range] = formationUnitTypes[unit];
    return <button key={unit} type="button" draggable
      aria-pressed={selected === unit}
      onClick={event => { event.stopPropagation(); setSelected(unit); }}
      onDragStart={event => event.dataTransfer.setData("text/plain", unit)}
      style={{ flex: "0 0 115px", overflowWrap: "anywhere", minHeight: 65, background: selected === unit ? "#29677f" : "#20384d", color: "#edf6ff", border: "1px solid #69a5c2", borderRadius: 5 }}>
      <strong>{label(unit)}</strong><br />
      <small>{t(type, translatedType)} · {t("Range","Обхват")} {range}</small>
    </button>;
  };

  return <div style={{ display: "grid", gap: 6, margin: "14px 0" }}>
    <div style={{ textAlign: "center", padding: 10, border: "2px solid #75e9ff", background: "repeating-linear-gradient(110deg,#103442 0 22px,#1c657a 22px 26px,#145068 26px 50px)" }}>
      <strong>{t("Plasma Wall","Плазмена стена")}</strong>
    </div>
    <div style={{ overflowX: "auto" }}>
      <div style={{ minWidth: 640, display: "grid", gridTemplateColumns: "64px repeat(7,minmax(0,1fr))", gap: 6, alignItems: "stretch" }}>
        {[1, 2, 3, 4].map(row => <React.Fragment key={row}>
          <strong style={{ alignSelf: "center" }}>{t("Row","Ред")} {row}</strong>
          {Array.from({ length: cellsPerRow }, (_, column) => {
            const unit = units.find(name => board[name] === row && board.columns[name] === column);
            return <div key={column} onDragOver={event => event.preventDefault()}
              onDrop={event => { event.preventDefault(); place(event.dataTransfer.getData("text/plain"), row, column); }}
              style={{ display: "grid", minHeight: 66, background: "#162a3a", border: "1px solid #65859a", borderRadius: 5 }}>
              {selected && selected !== unit
                ? <button type="button" onClick={() => place(selected, row, column)}
                    aria-label={t("Place in row","Постави на ред") + " " + row + ", " + t("cell","клетка") + " " + (column + 1)}>
                    {unit ? label(unit) : "+"}
                  </button>
                : unit ? tile(unit) : null}
            </div>;
          })}
        </React.Fragment>)}
      </div>
    </div>
    <p style={{ margin: "4px 0" }}>{t("Drag a unit into a cell, or select a unit and click a cell.","Плъзни войник в клетка или избери войник и натисни клетка.")}</p>
    <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 6 }}>{units.filter(unit => !board[unit]).map(tile)}</div>
  </div>;
}

function Map() {
  const { t , label: localLabel} = useLanguage();
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
  const [marchHistoryOpen, setMarchHistoryOpen] = useState(() => new URLSearchParams(window.location.hash.split("?")[1]).has("campaign"));
  const [campaignTab, setCampaignTab] = useState("active");
  const [presetSlot,setPresetSlot]=useState(1);
  const [presetRows,setPresetRows]=useState({});
  const [formationMessage,setFormationMessage]=useState("");
  const [formationBusy,setFormationBusy]=useState(false);
  const [clock,setClock]=useState(Date.now);
  const [campaign, setCampaign] = useState({highestDefeated:0,nextLevel:1});
  const { search } = useLocation();
  const reconShortcut = new URLSearchParams(search).has("recon");
  const scoutMarches = (campaign.scoutMissions || []).filter(mission =>
    campaignTab === "active" ? !mission.returned_at : mission.report || mission.returned_at);
  const alienMarches = (campaign.missions || []).filter(mission =>
    campaignTab === "active" ? !mission.returned_at : mission.result || mission.returned_at);
  const hasRoutes=(campaign.scoutMissions||[]).some(m=>!m.returned_at) || (campaign.missions||[]).some(m=>m.target&&!m.returned_at) || !!campaign.supportRoutes?.length;
  useEffect(()=>{
    if(!marchHistoryOpen&&!hasRoutes)return;
    setClock(Date.now());
    const timer=setInterval(()=>setClock(Date.now()),250);
    return ()=>clearInterval(timer);
  },[marchHistoryOpen,hasRoutes]);
  const [castles, setCastles] = useState([]);
  const [mapError, setMapError] = useState("");
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
  const mapPlayerTarget = useRef(sessionStorage.getItem("mapPlayerTarget"));
  useEffect(() => {
    if (reconShortcut) {
      mapPlayerTarget.current = null;
      sessionStorage.removeItem("mapPlayerTarget");
      return;
    }
    const username = mapPlayerTarget.current;
    const base = castles.find(c => c.username === username);
    if (base) {
      if (!sessionStorage.getItem("mapPlayerTarget")) return;
      sessionStorage.removeItem("mapPlayerTarget");
      setViewCenter({x:base.x,y:base.y});
    }
  }, [castles, reconShortcut]);
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

      if (reconShortcut) {
        const distance = base => Math.hypot(base.x - savedCastle.x, base.y - savedCastle.y);
        const nearest = alienBases.filter(base => base.level === 1)
          .reduce((best, base) => !best || distance(base) < distance(best) ? base : best, null);
        if (nearest) {
          setViewCenter({ x: nearest.x, y: nearest.y });
          setSelectedAlien(nearest);
          setSelectedTarget({ type: "alien", ...nearest });
          setMarchDraft(null);
        }
      } else if (!mapPlayerTarget.current) {
        setViewCenter({ x: savedCastle.x, y: savedCastle.y });
      }
    } catch {
      alert("Invalid castle data. Please log in again.");
      window.location.href = "/#/";
    }
  }, [reconShortcut]);

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
      setFormationRows(defaultFormation());
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
    if(selectedTroops>marchLimit){setMarchNotice("Cyber Knight can command at most 50,000 troops.");return;}
    if(!knightAdded){setMarchNotice("Add Cyber Knight before launching the attack.");return;}
    const selected=Object.fromEntries(Object.entries(marchUnits).filter(([,n])=>n>0));
    if(!Object.keys(selected).length){setMarchNotice("Choose at least one unit.");return;}
    if(marchDraft?.target?.type!=="alien"){setMarchNotice("Player marches are not yet enabled.");return;}
    try{
      setMarchLoading(true);
      const base=(process.env.REACT_APP_API_URL||window.location.origin).replace(/\/$/,"");
      const formation=Object.entries(selected).map(([unit,count])=>({unit,count,row:formationRows[unit]}));
      const response=await fetch(base+"/alien-campaign/attack",{method:"POST",headers:{"Content-Type":"application/json",Authorization:"Bearer "+sessionStorage.getItem("authToken")},body:JSON.stringify({userId:sessionStorage.getItem("userId"),level:marchDraft.target.level,army:selected,formation,includeCyberKnight:knightAdded,target:{x:marchDraft.target.x,y:marchDraft.target.y}})});
      const data=await response.json();
      if(!response.ok)throw Error(data.message||"Mission failed.");
      setCampaign(old=>({...old,remaining:data.remaining,knightBusy:true,missions:[{
        id:data.missionId,level:data.level,arrives_at:data.arrivesAt,launched_at:data.launchedAt,target:data.target,origin:data.origin,units:selected,formation,cyberKnightLevel:old.knightLevel||1
      },...(old.missions||[]).filter(m=>m.id!==data.missionId)]}));
      setSelectedTarget(null);
      setMapError("Mission dispatched. Check CAMPAIGNS for results.");
      setMarchDraft(null);
    }catch(e){setMarchNotice(e.message);}finally{setMarchLoading(false);}
  };
  const selectedTroops=Object.values(marchUnits).reduce((total,count)=>total+count,0);
  const presets=campaign.formations?.presets || {};
  const saveFormation=async payload=>{
    setFormationBusy(true);
    setFormationMessage("");
    try{
      const api=(process.env.REACT_APP_API_URL||window.location.origin).replace(/\/$/,"");
      const response=await fetch(api+"/alien-campaign/formations",{
        method:"POST",headers:{"Content-Type":"application/json",Authorization:"Bearer "+sessionStorage.getItem("authToken")},
        body:JSON.stringify({userId:sessionStorage.getItem("userId"),...payload})
      });
      const result=await response.json();
      if(!response.ok)throw new Error(result.message || "Unable to save formation.");
      setCampaign(old=>({...old,formations:result}));
      setFormationMessage("Formation settings saved.");
    }catch(error){setFormationMessage(error.message);}
    finally{setFormationBusy(false);}
  };

  const goToCoordinates = () => {
    const x = Number(document.getElementById("xCoord").value);
    const y = Number(document.getElementById("yCoord").value);

    if (Number.isInteger(x) && Number.isInteger(y) && x >= 1 && x <= 100 && y >= 1 && y <= 100) {
      centerMapOn(x, y);
    } else {
      setMapError(t("Enter whole coordinates between 1 and 100.","Въведи цели координати между 1 и 100."));
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

  const attackRoutes=(campaign.missions||[]).filter(m=>m.target&&m.origin&&!m.returned_at).map(m=>({
    id:"attack-"+m.id,color:"#ff5252",from:m.result?m.target:m.origin,to:m.result?m.origin:m.target,
    start:m.result?m.resolved_at:m.launched_at,end:m.result?m.returns_at:m.arrives_at,
  }));
  const supportRoutes=(campaign.supportRoutes||[]).flatMap(m=>{
    const sender=castles.find(base=>base.username===m.sender);
    const recipient=castles.find(base=>base.username===m.recipient);
    if(!sender||!recipient)return [];
    const duration=m.arrives_at-m.launched_at;
    const recallStart=m.recall_at-duration;
    if(m.recall_at){
      const fraction=Math.max(0,Math.min(1,(recallStart-m.launched_at)/duration));
      return [{id:"support-"+m.id,color:"#54b8ff",from:{x:sender.x+(recipient.x-sender.x)*fraction,y:sender.y+(recipient.y-sender.y)*fraction},
        to:sender,start:recallStart,end:m.recall_at}];
    }
    return [{id:"support-"+m.id,color:"#54b8ff",from:sender,to:recipient,start:m.launched_at,end:m.arrives_at}];
  });
  const scoutRoutes=(campaign.scoutMissions||[]).filter(m=>!m.returned_at).map(m=>({
    id:"scout-"+m.id,color:"#f7d34e",from:clock<m.arrives_at?m.origin:m.target,to:clock<m.arrives_at?m.target:m.origin,
    start:clock<m.arrives_at?m.launched_at:m.arrives_at,end:clock<m.arrives_at?m.arrives_at:m.returns_at,
  }));
  const routes=[...attackRoutes,...supportRoutes,...scoutRoutes].filter(route=>route.end>clock);
  const screenPoint=point=>({x:(point.x-.5)*tileSize+offset.x,y:(point.y-.5)*tileSize+offset.y});

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

      {!!routes.length && <svg aria-hidden="true" width="100%" height="100%" viewBox={`0 0 ${viewport.width} ${viewport.height}`}
        preserveAspectRatio="none" style={{position:"absolute",inset:0,pointerEvents:"none"}}>
        {routes.map(route=>{
          const from=screenPoint(route.from),to=screenPoint(route.to);
          const progress=Math.max(0,Math.min(1,(clock-route.start)/Math.max(1,route.end-route.start)));
          const x=from.x+(to.x-from.x)*progress,y=from.y+(to.y-from.y)*progress;
          return <g key={route.id}>
            <line x1={from.x} y1={from.y} x2={to.x} y2={to.y} stroke={route.color} strokeWidth="3" strokeDasharray={route.id.startsWith("scout-")?"7 5":undefined}/>
            <circle cx={x} cy={y} r="6" fill={route.color} stroke="white" strokeWidth="2"/>
          </g>;
        })}
      </svg>}

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
          <button type="button" aria-label={mapMenuOpen?localLabel("Hide map menu"):localLabel("Show map menu")} aria-expanded={mapMenuOpen}
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
        {t("GO BACK","НАЗАД")}
      </button>
        </div>
        <div id="map-menu-controls" hidden={!mapMenuOpen}>
        <div>{t("Alien campaign: defeated level","Извънземна кампания: победено ниво")} {campaign.highestDefeated}{t("/20 · Next: level","/20 · Следващо ниво")} {campaign.nextLevel} {t("· Attacks left:","· Оставащи атаки:")} {campaign.remaining??"—"}{t("/20 · Cyber Knight Lv","/20 · Киберрицар ниво")} {campaign.knightLevel||1}</div>
        <div style={{fontSize:12}}>{t("Mission travel: 60 seconds · Daily reset: 00:00 UTC","Пътуване: 60 секунди · Нулиране в 00:00 UTC")}</div>
        {(campaign.sideQuests||[]).filter(q=>q.completed&&!q.claimed).map(q=><button key={q.level} onClick={async()=>{
          const base=(process.env.REACT_APP_API_URL||window.location.origin).replace(/\/$/,"");
          const r=await fetch(base+"/alien-campaign/side-quest",{method:"POST",headers:{"Content-Type":"application/json",Authorization:"Bearer "+sessionStorage.getItem("authToken")},body:JSON.stringify({userId:sessionStorage.getItem("userId"),milestone:q.level})});
          const d=await r.json();setMapError(r.ok?"Side quest claimed! "+d.amount+" of each resource added to Inventory.":d.message);
          if(r.ok)setCampaign(old=>({...old,sideQuests:old.sideQuests.map(x=>x.level===q.level?{...x,claimed:true}:x)}));
        }}>{t("Side Quest: claim Level","Странична мисия: вземи наградата за ниво")} {q.level} {t("reward"," ")}</button>)}
        <div style={{margin:"8px 0"}}>{t("Zoom","Мащаб")} <button onClick={()=>setZoom(z=>Math.max(.065,Number((z/1.6).toFixed(4))))}>−</button> <span>{Math.round(zoom*100)}%</span> <button onClick={()=>setZoom(z=>Math.min(3,Number((z*1.6).toFixed(4))))}>+</button> <button onClick={()=>{setZoom(.065);centerMapOn(50.5,50.5);}}>{t("Full map 100×100","Цяла карта 100×100")}</button> <button onClick={()=>setZoom(1)}>100%</button></div>
        {mapError && <div role="alert">{localLabel(mapError)}</div>}
        <div>{t("Coordinates:","Координати:")} {cursorCoord ? `${cursorCoord.x}:${cursorCoord.y}` : localLabel("Move cursor over map")}</div>
        <input type="text" id="usernameInput" placeholder={localLabel("Search Username")} />
        <button onClick={searchByUsername}>{t("Search","Търси")}</button>
        <div style={{marginTop:6}}>
          <input type="number" id="xCoord" placeholder="X (1–100)" style={{width:90}} />
          <input type="number" id="yCoord" placeholder="Y (1–100)" style={{width:90}} />
          <button onClick={goToCoordinates}>{t("Go to Coordinates","Към координатите")}</button>
        </div>
        <div style={{marginTop:6}}>
          <label>{t("Alien Base level","Ниво на извънземна база")}{" "}
            <select value={alienSearchLevel} onChange={event=>setAlienSearchLevel(event.target.value)}>
              <option value="">{t("Select level","Избери ниво")}</option>
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
            <h2 style={{margin:0,color:"#9cdbff"}}>{marchDraft?localLabel("MARCH CONTROL"):localLabel("TARGET COMMAND")}</h2>
            <button onClick={()=>{setSelectedTarget(null);setMarchDraft(null);setMarchNotice("");}}>{t("✕ Close","✕ Затвори")}</button>
          </div>
          <p style={{color:"#c0d2e3"}}>{selectedTarget?.type==="alien"?t("Alien Stronghold · Level ","Извънземна крепост · Ниво ")+selectedTarget.level:selectedTarget?.type==="castle"?"Player Base · "+selectedTarget.username:localLabel("Open Sector")} {t("· Coordinates","· Координати")} {selectedTarget?.x}:{selectedTarget?.y}</p>
          {selectedTarget?.type==="alien" && <div style={{padding:12,background:"#243449",border:"1px solid #58758e",borderRadius:8}}>
            <strong>{t("Alien garrison · Level","Извънземен гарнизон · Ниво")} {selectedTarget.level}</strong>
            {campaign.garrisons?.[selectedTarget.level] ? <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))",gap:6,marginTop:8}}>
              {Object.entries(campaign.garrisons[selectedTarget.level]).map(([unit,count])=><div key={unit}>{localLabel(unit)}: <strong>{count.toLocaleString()}</strong></div>)}
              <div style={{gridColumn:"1 / -1",marginTop:6,fontWeight:"bold"}}>{t("Total defenders:","Общо защитници:")} {Object.values(campaign.garrisons[selectedTarget.level]).reduce((sum,n)=>sum+n,0).toLocaleString()}</div>
            </div> : <p>{t("Loading fixed garrison data...","Зареждане на гарнизона…")}</p>}
            <p style={{fontSize:12}}>{t("Higher-level alien strongholds have larger and more advanced garrisons. The level 20 fortress has an Alien Overlord.","По-високите нива имат по-големи и по-силни гарнизони. Крепостта на ниво 20 има извънземен владетел.")}</p>
          </div>}
          {!marchDraft && <div>
            <p>{t("Choose mission type:","Избери вид мисия:")}</p>
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
                  {type==="Attack"?"⚔ ":type==="Espionage"?"◈ ":type==="Support"?"🛡 ":""}{localLabel(type)}
                </button>;
              })}
            </div>
            {targetIsOwn && <p>{t("This is your own base. Choose another destination.","Това е твоята база. Избери друга цел.")}</p>}
            {selectedTarget?.type==="alien" ? <p style={{fontSize:12,color:"#b2c8d8"}}>{t("Select Attack to launch a combat mission.","Избери „Атака“, за да започнеш бойна мисия.")}</p> : <p style={{fontSize:12,color:"#b2c8d8"}}>{t("Unavailable mission types require their own gameplay systems. Select an available type to continue to troop selection from your only base.","Наличните мисии позволяват избор на войски от базата ти.")}</p>}
          </div>}
          {marchLoading && <p>{t("Loading your army...","Зареждане на армията…")}</p>}
          {marchDraft && <div>
            <h3>{marchDraft.type}: {marchDraft.origin.username} ({marchDraft.origin.x}:{marchDraft.origin.y}) → ({marchDraft.target.x}:{marchDraft.target.y})</h3>
            {marchDraft.type === "Attack" && marchDraft.target.type === "alien" && <>
            <p>{t("Commander: Cyber Knight Lv","Командир: Киберрицар ниво")} {campaign.knightLevel || 1} {t("(required)","(задължителен)")}</p>
            <button type="button" disabled={marchLoading || campaign.knightBusy} aria-pressed={knightAdded} onClick={()=>setKnightAdded(added=>!added)}>
              {knightAdded ? localLabel("Remove Cyber Knight") : localLabel("Add Cyber Knight")}
            </button>
            {campaign.knightBusy && <p>{t("Cyber Knight is on a mission and must return before launching another attack.","Киберрицарят трябва да се върне от текущата си мисия преди нова атака.")}</p>}
            </>}
            <p>{t("Select troops from your base army ·","Избери войски от базата ·")} {selectedTroops.toLocaleString()} / {marchLimit.toLocaleString()}</p>
            <label>{t("Load formation","Зареди формация")} <select defaultValue="" onChange={event=>{
              setFormationRows(event.target.value==="default" ? defaultFormation() : presets[event.target.value]);
              event.target.value="";
            }}>
              <option value="" disabled>{t("Choose formation","Избери формация")}</option>
              <option value="default">{t("Default Attack","Стандартна атака")}</option>
              {Object.keys(presets).map(slot=><option key={slot} value={slot}>{t("Formation","Формация")} {slot}</option>)}
            </select></label>
            <p><label>{t("Save current rows to","Запази текущите редове в")} <select value={presetSlot} onChange={event=>setPresetSlot(Number(event.target.value))}>
              {[1,2,3,4,5].map(slot=><option key={slot} value={slot}>{t("Slot","Слот")} {slot}</option>)}
            </select></label>{" "}
            <button disabled={formationBusy} onClick={()=>saveFormation({slot:presetSlot,rows:formationRows})}>{t("Save Formation","Запази формацията")}</button></p>
            {formationMessage&&<p role="status">{localLabel(formationMessage)}</p>}
            {!units.some(unit=>Number(availableArmy[unit]||0)>0) && <p>{t("No trained troops available. Train units at your base before preparing a march.","Няма обучени войски. Обучи единици в базата преди поход.")}</p>}
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(190px,1fr))",gap:10}}>
              {units.map(unit=><label key={unit} style={{background:"#20384d",border:"1px solid #46637a",padding:10,borderRadius:8,display:"flex",flexDirection:"column",gap:6,opacity:Number(availableArmy[unit]||0)>0?1:.5}}>
                <strong>{localLabel(unit)}</strong>
                <span>{t("Available:","Налични:")} {Number(availableArmy[unit]||0)}</span>
                <input type="number" min="0" max={Number(availableArmy[unit]||0)} disabled={!Number(availableArmy[unit]||0)} value={marchUnits[unit]||0}
                  onChange={e=>setMarchUnits(old=>({...old,[unit]:Math.max(0,Math.min(Number(availableArmy[unit]||0),Math.floor(Number(e.target.value)||0)))}))}/>
                <button disabled={!Number(availableArmy[unit]||0)} onClick={()=>setMarchUnits(old=>({...old,[unit]:Number(availableArmy[unit]||0)}))}>{t("MAX","МАКС.")}</button>
                <span>{t("Formation row (1 front / 4 rear)","Ред във формацията (1 отпред / 4 отзад)")}</span>
                <select value={formationRows[unit]} onChange={e=>setFormationRows(old=>({...old,[unit]:Number(e.target.value)}))}>
                  {[1,2,3,4].map(row=><option key={row} value={row}>{t("Row","Ред")} {row}</option>)}
                </select>
              </label>)}
            </div>
            <div style={{marginTop:14,display:"flex",gap:8,flexWrap:"wrap"}}>
              <button onClick={()=>{
                let remaining=marchLimit;
                const selection={};
                for(const unit of units){
                  selection[unit]=Math.min(remaining,Number(availableArmy[unit])||0);
                  remaining-=selection[unit];
                }
                setMarchUnits(selection);
              }}>{t("Select up to 50,000","Избери до 50 000")}</button>
              <button onClick={()=>setMarchUnits({})}>{t("Clear","Изчисти")}</button>
              <button disabled={marchLoading || campaign.knightBusy || !knightAdded || !selectedTroops || selectedTroops>marchLimit} onClick={prepareMarch} style={{background:"#26765e",color:"white",padding:"10px 22px"}}>{t("Launch attack (60 sec)","Започни атака (60 сек.)")}</button>
              <button onClick={()=>setMarchDraft(null)}>{t("← Back to mission types","← Към видовете мисии")}</button>
            </div>
            {selectedTroops>marchLimit && <p role="alert">{t("Cyber Knight can command at most 50,000 troops.","Киберрицарят може да води най-много 50 000 войници.")}</p>}
            <p style={{fontSize:12,color:"#b5c7d9"}}>{t("Alien attacks reserve selected troops immediately; survivors return after the battle.","Избраните войски тръгват веднага. Оцелелите се връщат след битката.")}</p>
          </div>}
          {marchNotice && <p role="status" style={{color:"#ffdc9c"}}>{localLabel(marchNotice)}</p>}
        </div>
      </div>}
      <button onClick={()=>{setCampaignTab("active");setMarchHistoryOpen(true);}} style={{position:"absolute",right:18,bottom:22,zIndex:12,background:"#142b39",color:"#ccecff",border:"1px solid #64a9c9",padding:"12px 20px",borderRadius:8,cursor:"pointer"}}>{t("🚀 CAMPAIGNS","🚀 КАМПАНИИ")}</button>
      {marchHistoryOpen && <div style={{position:"absolute",inset:0,zIndex:40,background:"rgba(0,0,0,.76)",display:"grid",placeItems:"center",padding:16}}>
        <div style={{width:"min(850px,95vw)",maxHeight:"85vh",overflowY:"auto",padding:24,background:"#122334",color:"#edf6ff",border:"1px solid #69a5c2",borderRadius:12}}>
          <div style={{display:"flex",justifyContent:"space-between"}}><h2 style={{margin:0}}>{t("🚀 CAMPAIGNS","🚀 КАМПАНИИ")}</h2><button onClick={()=>setMarchHistoryOpen(false)}>{t("✕ Close","✕ Затвори")}</button></div>
          <nav aria-label={t("Campaign sections","Раздели на кампаниите")} style={{display:"flex",flexWrap:"wrap",gap:8,margin:"16px 0"}}>
            {[
              ["active",t("Active Marches","Активни походи")],
              ["reports",t("Reports","Доклади")],
              ["formations",t("Formations","Формации")]
            ].map(([tab,label]) => <button key={tab} type="button" aria-pressed={campaignTab===tab}
              style={{padding:"8px 14px",border:"1px solid #69a5c2",borderRadius:6,color:"#edf6ff",background:campaignTab===tab?"#27657e":"#20384d"}}
              onClick={()=>{
                if (tab==="formations" && campaignTab!==tab) setPresetRows(presets[presetSlot] || {});
                setCampaignTab(tab);
              }}>{label}</button>)}
          </nav>
          {campaignTab==="formations" ? <section>
            <label>{t("Edit slot","Редактирай слот")} <select value={presetSlot} onChange={event=>{
              const slot=Number(event.target.value);
              setPresetSlot(slot);setPresetRows(presets[slot] || {});
            }}>
              {[1,2,3,4,5].map(slot=><option key={slot} value={slot}>{t("Formation","Формация")} {slot}{presets[slot]?"":localLabel(" (empty)")}</option>)}
            </select></label>{" "}
            <button onClick={()=>setPresetRows(defaultFormation())}>{t("Load Default Attack","Зареди стандартна атака")}</button>{" "}
            <button onClick={()=>setPresetRows(defaultFormation(true))}>{t("Load Default Defense","Зареди стандартна защита")}</button>
            <FormationBoard key={presetSlot} rows={presetRows} setRows={setPresetRows} />
            <div style={{position:"sticky",bottom:0,zIndex:5,display:"flex",alignItems:"center",justifyContent:"space-between",gap:12,flexWrap:"wrap",padding:"12px 8px",background:"#122334",borderTop:"1px solid #69a5c2"}}>
              <strong>{units.filter(unit => presetRows[unit]).length} / {units.length} {t("troops placed","войници подредени")}</strong>
              <button type="button" disabled={formationBusy || !units.every(unit => presetRows[unit])}
                onClick={()=>saveFormation({slot:presetSlot,rows:presetRows})}
                style={{padding:"10px 20px",fontWeight:"bold",background:"#26765e",color:"white",border:"1px solid #8fe0a5",borderRadius:6,opacity:formationBusy || !units.every(unit => presetRows[unit]) ? .7 : 1}}>
                {formationBusy ? t("Saving…","Запазване…") : t("Save Formation","Запази формацията")}
              </button>
            </div>
            {!units.every(unit => presetRows[unit]) && <p>{t("Place every troop in one of the 28 cells to save this formation.","Постави всички войници в някоя от 28-те клетки, за да запазиш формацията.")}</p>}
            <p><label>{t("Active defense formation","Активна отбранителна формация")}{" "}
              <select disabled={formationBusy} value={campaign.formations?.defenseSlot || 0} onChange={event=>saveFormation({defenseSlot:Number(event.target.value)})}>
                <option value={0}>{t("Default Defense","Стандартна защита")}</option>
                {Object.keys(presets).map(slot=><option key={slot} value={slot}>{t("Formation","Формация")} {slot}</option>)}
              </select>
            </label></p>
            <p>{t("Defense formation is saved for future player battles.","Отбранителната формация се пази за бъдещи битки между играчи.")}</p>
            {formationMessage&&<p role="status">{localLabel(formationMessage)}</p>}
          </section> : <>
          {campaignTab==="active" && !scoutMarches.length && !alienMarches.length &&
            <p>{t("No active marches. Close this panel and select a target on the map to start a march.","Няма активни походи. Затвори панела и избери цел на картата, за да започнеш поход.")}</p>}
          {(campaignTab==="reports" || scoutMarches.length>0) && <h3>{t("Reconnaissance","Разузнаване")}</h3>}
          {scoutMarches.map(mission=>{
            const returning=clock>=mission.arrives_at;
            const remaining=Math.max(0,Math.ceil(((returning?mission.returns_at:mission.arrives_at)-clock)/1000));
            return <details key={mission.id}>
              <summary>{t("Scout mission","Разузнавателен поход")} #{mission.id} · {mission.target.x}:{mission.target.y} · {mission.quantity} × {localLabel("Rover Scout")} · {
                mission.returned_at ? t("Returned","Върнали се") : remaining===0 ? t("Updating…","Обновяване…") : `${returning?localLabel("Returning"):localLabel("Travelling")} · ${remaining} ${t("sec.","сек.")}`
              }</summary>
              {mission.report ? <ul>{Object.entries(mission.report).map(([unit,count])=><li key={unit}>{localLabel(unit)}: {count}</li>)}</ul>
                : <p>{t("Report available on arrival.","Докладът ще е достъпен при пристигане.")}</p>}
            </details>;
          })}
          {campaignTab==="reports" && !scoutMarches.length && <p>{t("No scout missions yet.","Все още няма разузнавателни походи.")}</p>}
          {(campaignTab==="reports" || alienMarches.length>0) && <h3>{campaignTab==="reports" ? t("Alien Mission Reports","Доклади от извънземни мисии") : t("Alien Attacks","Атаки срещу извънземни")}</h3>}
        {alienMarches.map(m=><details key={m.id} style={{marginBottom:10,borderBottom:"1px solid #536c80",paddingBottom:8}}>
          <summary>{t("Mission #","Мисия №")}{m.id} {t("· Alien Lv","· Извънземна база ниво")} {m.level} · {m.result ? (m.result.victory?localLabel("VICTORY"):localLabel("DEFEAT")) : localLabel("Travelling")}{!m.returned_at && ` · ${m.result ? localLabel("Returning") : localLabel("Arrival")} · ${Math.max(0,Math.ceil(((m.result ? m.returns_at : m.arrives_at)-clock)/1000))}s` }</summary>
          {m.cyberKnightLevel && <p>{t("Commander: Cyber Knight Lv","Командир: Киберрицар ниво")} {m.cyberKnightLevel}</p>}
          {m.formation?.length ? <ul>{m.formation.map(({unit,count,row},index)=><li key={index}>{count.toLocaleString()} {localLabel(unit)} {t("· Row","· Ред")} {row}</li>)}</ul>
            : m.units && <p>{t("Dispatched:","Изпратени:")} {Object.entries(m.units).map(([unit,count])=>`${count} ${localLabel(unit)}`).join(", ")}</p>}
          {m.result&&<div><p>{t("Rounds:","Рундове:")} {m.result.rounds} {t("· Remaining alien defenders:","· Оставащи извънземни защитници:")} {m.result.defendersRemaining}</p>
          <p>{t("Reward:","Награда:")} {m.result.reward?.item?.name || (m.result.reward?.type==="crafting" ? `${m.result.reward.amount} ${t("Universal Forge points","универсални точки за изковаване")}` : m.result.reward?.type==="resources" ? `${m.result.reward.amount} ${t("of each resource","от всеки ресурс")}` : m.result.reward?.type==="army" ? `${m.result.reward.amount} ${localLabel(m.result.reward.unit)}` : "None")}</p>
          <p>{t("Survivors:","Оцелели:")} {Object.entries(m.result.survivors||{}).map(([u,n])=>localLabel(u)+": "+n).join(", ") || "None"}</p>
          {(m.result.report||[]).map(round=><details key={round.round}><summary>{t("Round","Рунд")} {round.round}</summary>
            {round.events.map((e,i)=><p key={i} style={{fontSize:12}}>{e.restored > 0 ? `Nano Regeneration: ${e.restored} ${localLabel(e.unit)} restored` : <>{localLabel(e.attacker)}: {e.units} {localLabel(e.unit)} → {localLabel(e.target)} · {e.damage} {t("damage","щети")}{Number.isInteger(e.kills) ? ` · ${e.kills} ${t("defeated","убити")}` : ""}{e.dodged ? t(" · Evaded"," · Избегнат удар") : ""}</>}</p>)}
          </details>)}</div>}
        </details>)}
        {campaignTab==="reports" && !alienMarches.length&&<p>{t("No alien missions yet.","Все още няма извънземни мисии.")}</p>}
          </>}
        </div>
      </div>}
    </div>
  );
}

export default Map;
