import { useLanguage } from "../language";

// Colonize Mars Map.jsx with full formatting, mines, and alien bases

import React, { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import hqIconFile from "../images/hq-icon.png";
import goldMineImg from "../images/mine-gold.png";
import ironMineImg from "../images/mine-iron.png";
import solarMineImg from "../images/mine-solar.png";
import waterMineImg from "../images/mine-water.png";
import goldIcon from "../images/gold.png";
import ironIcon from "../images/iron.png";
import solarIcon from "../images/solar.png";
import waterIcon from "../images/water.png";
import alienBaseImg from "../images/alien-base.png";
import unitEconomy from "../shared/unitEconomy";
import formations from "../shared/formations";
import alienBases from "../shared/alienBases";
import spaceStations from "../shared/spaceStations";
const {units, marchLimit, cellsPerRow, defaultFormation, normalizeFormation}=formations;
const EMPTY_MINES=[];
const MINE_RESOURCE_ICONS={Gold:goldIcon,Iron:ironIcon,Solar:solarIcon,Water:waterIcon};

const formationTypes = {
  Ground: ["Ground", "Наземни", 1],
  Ranged: ["Ranger", "Далекобойни", 4],
  Mobile: ["Mobile", "Мобилни", 1],
  "Heavy Systems": ["Heavy System", "Тежки системи", 5],
  Elite: ["Elite", "Елитни", 2]
};
const formationUnitTypes = Object.fromEntries(Object.entries(unitEconomy.categories)
  .flatMap(([category, names]) => names.map(name => [name, [...formationTypes[category]]])));
formationUnitTypes["Mech Walker"][2] = 4;

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
  const [availableResources,setAvailableResources]=useState({});
  const [tradeAmounts,setTradeAmounts]=useState({Gold:0,Iron:0,Water:0,Solar:0});
  const [marchUnits, setMarchUnits] = useState({});
  const [knightAdded,setKnightAdded]=useState(false);
  const [formationRows,setFormationRows]=useState({});
  const [marchLoading, setMarchLoading] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [marchSuccess, setMarchSuccess] = useState("");
  const [marchNotice, setMarchNotice] = useState("");
  const [stationBusy,setStationBusy]=useState(false);
  const [stationNotice,setStationNotice]=useState("");
  const [stationDonationKind,setStationDonationKind]=useState("green");
  const [stationDonationAmount,setStationDonationAmount]=useState("");
  const [marchHistoryOpen, setMarchHistoryOpen] = useState(() => new URLSearchParams(window.location.hash.split("?")[1]).has("campaign"));
  const [campaignTab, setCampaignTab] = useState(() => {
    const requestedTab = new URLSearchParams(window.location.hash.split("?")[1]).get("campaignTab");
    return ["active", "reports", "formations"].includes(requestedTab) ? requestedTab : "active";
  });
  const [presetSlot,setPresetSlot]=useState(1);
  const [formationMode,setFormationMode]=useState("attack");
  const [marchFormationSlot,setMarchFormationSlot]=useState("");
  const [presetRows,setPresetRows]=useState({});
  const [presetName,setPresetName]=useState("");
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
  const playerMarches = (campaign.playerMissions || []).filter(mission =>
    campaignTab === "active" ? !mission.returned_at : mission.result || mission.returned_at);
  const resourceMarches=(campaign.resourceMines?.missions||[]).filter(mission=>
    campaignTab==="active"?mission.status!=="completed":mission.status==="completed");
  const hasRoutes=(campaign.scoutMissions||[]).some(m=>!m.returned_at) || (campaign.missions||[]).some(m=>m.target&&!m.returned_at) || (campaign.playerMissions||[]).some(m=>!m.returned_at) || (campaign.resourceMines?.missions||[]).some(m=>m.status!=="completed") || !!campaign.supportRoutes?.length;
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

  // Independent resource mines are supplied by the server and respawn on a four-hour cycle.
  const mineData = campaign.resourceMines?.mines || EMPTY_MINES;


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
      const icon = mineIcons[String(mine.resource||mine.type).toLowerCase()];

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

    (campaign.stations?.stations||spaceStations).forEach(station=>{
      const sx=(station.x-1)*tileSize+offset.x+tileSize/2;
      const sy=(station.y-1)*tileSize+offset.y+tileSize/2;
      if(sx+tileSize<0||sy+tileSize<0||sx-tileSize>canvas.width||sy-tileSize>canvas.height)return;
      const unlocked=!station.locked;
      ctx.save();
      ctx.strokeStyle=unlocked?"#7cffd2":"#9bb1c3";ctx.fillStyle=unlocked?"rgba(57,220,171,.22)":"rgba(150,177,198,.16)";
      ctx.lineWidth=Math.max(2,tileSize*.045);ctx.shadowColor=unlocked?"#54ffc3":"#a6c4d4";ctx.shadowBlur=tileSize*.18;
      ctx.beginPath();ctx.arc(sx,sy,tileSize*.42,0,Math.PI*2);ctx.fill();ctx.stroke();
      ctx.beginPath();ctx.moveTo(sx,sy-tileSize*.28);ctx.lineTo(sx+tileSize*.28,sy);ctx.lineTo(sx,sy+tileSize*.28);ctx.lineTo(sx-tileSize*.28,sy);ctx.closePath();
      ctx.fillStyle=unlocked?"#7affd1":"#a9c0d0";ctx.fill();ctx.stroke();
      ctx.shadowBlur=0;ctx.fillStyle="#f3ffe8";ctx.font="bold 10px Arial";ctx.textAlign="center";
      ctx.fillText(unlocked?"СТАНЦИЯ "+station.id:"🔒 "+station.id,sx,sy+tileSize*.67);
      ctx.restore();
    });

    const event=campaign.mothershipEvent;
    if(event?.active){
      const sx=(event.coordinates.x-1)*tileSize+offset.x+tileSize/2;
      const sy=(event.coordinates.y-1)*tileSize+offset.y+tileSize/2;
      ctx.save();ctx.strokeStyle="#ff5f44";ctx.lineWidth=Math.max(2,tileSize*.08);ctx.globalAlpha=.75;
      for(const attack of event.attacks||[]){
        const ax=(attack.origin_x-1)*tileSize+offset.x+tileSize/2;
        const ay=(attack.origin_y-1)*tileSize+offset.y+tileSize/2;
        ctx.beginPath();ctx.moveTo(ax,ay);ctx.lineTo(sx,sy);ctx.stroke();
      }
      ctx.globalAlpha=1;ctx.beginPath();ctx.arc(sx,sy,tileSize*.85,0,Math.PI*2);
      ctx.fillStyle="rgba(220,66,44,.35)";ctx.fill();ctx.strokeStyle="#ff6347";ctx.lineWidth=3;ctx.stroke();
      ctx.drawImage(alienIcon,sx-tileSize*.58,sy-tileSize*.58,tileSize*1.16,tileSize*1.16);
      ctx.fillStyle="#fff2c9";ctx.font="bold 13px Arial";ctx.textAlign="center";
      ctx.fillText("МАЙЧИН КОРАБ",sx,sy+tileSize*1.05);ctx.restore();
    }

    castles.forEach((c) => {
      const px = (c.x-1) * tileSize + offset.x;
      const py = (c.y-1) * tileSize + offset.y;

      if (
        px + tileSize >= 0 &&
        py + tileSize >= 0 &&
        px < canvas.width &&
        py < canvas.height
      ) {
        const protectedUntil=Number(c.protected_until||c.protectedUntil||0);
        if(protectedUntil>Date.now()){
          ctx.save();
          ctx.fillStyle="rgba(135,225,255,0.20)";
          ctx.strokeStyle="rgba(194,246,255,0.95)";
          ctx.lineWidth=Math.max(2,tileSize*0.035);
          ctx.shadowColor="#81e8ff";
          ctx.shadowBlur=tileSize*0.25;
          ctx.beginPath();
          ctx.ellipse(px+tileSize/2,py+tileSize/2,tileSize*0.76,tileSize*0.68,0,0,Math.PI*2);
          ctx.fill();ctx.stroke();ctx.restore();
        }
        ctx.drawImage(hqIcon, px, py, tileSize, tileSize);
        ctx.fillStyle = "white";
        ctx.font = "12px Arial";
        ctx.fillText(`${c.username} (${c.x}:${c.y})`, px + 2, py + tileSize - 5);
      }
    });
  }, [offset, castles, hqIcon, mineIcons, alienIcon, zoom, tileSize, mineData, campaign]);

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
    const event=campaign.mothershipEvent?.active?nearest([campaign.mothershipEvent.coordinates]):null;
    const station=castle||event?null:nearest(campaign.stations?.stations||spaceStations);
    const alien=castle||event||station?null:nearest(alienBases);
    const mine=castle||event||station||alien?null:nearest(mineData);
    setSelectedAlien(castle||station?null:alien||null);
    setMarchDraft(null);
    setStationNotice("");
    setSelectedTarget(castle?{type:"castle",...castle}:event?{type:"mothership",...campaign.mothershipEvent.coordinates}:station?{type:"station",stationId:station.id,x:station.x,y:station.y}:alien?{type:"alien",...alien}:mine?{type:"mine",...mine}:{type:"field",x:x+1,y:y+1});
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
      setAvailableResources(data.gameProgress?.resources || {});
      setMarchUnits({});
      setTradeAmounts({Gold:0,Iron:0,Water:0,Solar:0});
      const firstAttackSlot=Object.keys(attackPresets)[0];
      setMarchFormationSlot(firstAttackSlot || "default");
      setFormationRows(firstAttackSlot ? attackPresets[firstAttackSlot] : defaultFormation());
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
    setPreviewOpen(false);
    const isAlienAttack=marchDraft?.type==="Attack"&&marchDraft?.target?.type==="alien";
    const isMothershipAttack=marchDraft?.type==="Attack"&&marchDraft?.target?.type==="mothership";
    const isPlayerAttack=marchDraft?.type==="Attack"&&marchDraft?.target?.type==="castle"&&!targetIsOwn;
    const isStationDefense=marchDraft?.type==="Defend"&&marchDraft?.target?.type==="station";
    const isMineGather=marchDraft?.type==="Gather"&&marchDraft?.target?.type==="mine";
    const isMineAttack=marchDraft?.type==="Attack"&&marchDraft?.target?.type==="mine";
    if(selectedTroops>marchLimit){setMarchNotice("A march can contain at most 50,000 troops.");return;}
    if((isAlienAttack||isMothershipAttack)&&!knightAdded){setMarchNotice("Add Cyber Knight before launching the attack.");return;}
    if(!isAlienAttack&&!isMothershipAttack&&!isPlayerAttack&&!isStationDefense&&!isMineGather&&!isMineAttack){setMarchNotice("Choose an available target.");return;}
    const selected=Object.fromEntries(Object.entries(marchUnits).filter(([,n])=>n>0));
    if(!Object.keys(selected).length){setMarchNotice("Choose at least one unit.");return;}
    try{
      setMarchLoading(true);
      const base=(process.env.REACT_APP_API_URL||window.location.origin).replace(/\/$/,"");
      const standardRows=defaultFormation();
      const formation=Object.entries(selected).map(([unit,count])=>({unit,count,row:formationRows[unit]||standardRows[unit]}));
      const payload=isMineGather||isMineAttack
        ? {userId:sessionStorage.getItem("userId"),mineId:marchDraft.target.id,kind:isMineAttack?"attack":"gather",army:selected,formation}
        : isAlienAttack
        ? {userId:sessionStorage.getItem("userId"),level:marchDraft.target.level,army:selected,formation,includeCyberKnight:knightAdded,target:{x:marchDraft.target.x,y:marchDraft.target.y}}
        : isMothershipAttack ? {userId:sessionStorage.getItem("userId"),army:selected,formation,includeCyberKnight:knightAdded}
        : isStationDefense ? {userId:sessionStorage.getItem("userId"),stationId:marchDraft.target.stationId,army:selected}
        : {userId:sessionStorage.getItem("userId"),army:selected,formation,target:{username:marchDraft.target.username,x:marchDraft.target.x,y:marchDraft.target.y}};
      const response=await fetch(base+(isMineGather||isMineAttack?"/resource-mines/launch":isMothershipAttack?"/mothership/attack":isAlienAttack?"/alien-campaign/attack":isStationDefense?"/alien-stations/defend":"/player-campaign/attack"),{
        method:"POST",headers:{"Content-Type":"application/json",Authorization:"Bearer "+sessionStorage.getItem("authToken")},body:JSON.stringify(payload)
      });
      const data=await response.json();
      if(!response.ok)throw Error(data.message||"Mission failed.");
      if(isMineGather||isMineAttack){
        const latest=await fetch(base+"/alien-campaign/"+sessionStorage.getItem("userId"),{headers:{Authorization:"Bearer "+sessionStorage.getItem("authToken")},cache:"no-store"});
        if(latest.ok)setCampaign(await latest.json());
        setMarchSuccess(isMineAttack?"Attack march is heading to the occupied mine.":"Gathering march is heading to the mine.");
      }else if(isStationDefense){
        const latest=await fetch(base+"/alien-campaign/"+sessionStorage.getItem("userId"),{headers:{Authorization:"Bearer "+sessionStorage.getItem("authToken")},cache:"no-store"});
        if(latest.ok)setCampaign(await latest.json());
        setMarchSuccess("Army is heading to defend the alliance station.");
      }else if(isMothershipAttack){
        setCampaign(old=>({...old,mothershipEvent:{...old.mothershipEvent,attacksRemaining:data.attacksRemaining,myAttacks:(old.mothershipEvent?.myAttacks||0)+1,attacks:[...(old.mothershipEvent?.attacks||[]),{id:data.attackId,user_id:sessionStorage.getItem("userId"),username:sessionStorage.getItem("username"),origin_x:data.origin.x,origin_y:data.origin.y,launched_at:data.launchedAt,arrives_at:data.arrivesAt,resolved_at:null,damage:0,xp:0}]}}));
        setMarchSuccess("Cyber Knight is heading to the Mother Ship. The attack arrives in 30 seconds. Open the Hospital after arrival to recover your troops.");
      }else if(isAlienAttack){
        setCampaign(old=>({...old,remaining:data.remaining,knightBusy:true,missions:[{
          id:data.missionId,level:data.level,arrives_at:data.arrivesAt,launched_at:data.launchedAt,target:data.target,origin:data.origin,units:selected,formation,cyberKnightLevel:old.knightLevel||1
        },...(old.missions||[]).filter(m=>m.id!==data.missionId)]}));
        setMarchSuccess("Attack sent successfully. Track the march and its return in CAMPAIGNS.");
      }else{
        setCampaign(old=>({...old,playerMissions:[{
          id:data.missionId,attacker_name:marchDraft.origin.username,defender_name:marchDraft.target.username,
          arrives_at:data.arrivesAt,launched_at:data.launchedAt,target:data.target,origin:data.origin,units:selected,formation,incoming:false
        },...(old.playerMissions||[]).filter(m=>m.id!==data.missionId)]}));
        setMarchSuccess("Attack sent successfully. Track the march and its return in CAMPAIGNS.");
      }
      setSelectedTarget(null);
      setMarchDraft(null);
      setPreviewOpen(false);
    }catch(e){setMarchNotice(e.message);}finally{setMarchLoading(false);}
  };
  const stationRequest=async(path,payload,successMessage)=>{
    setStationBusy(true);setStationNotice("");
    try{
      const api=(process.env.REACT_APP_API_URL||window.location.origin).replace(/\/$/,"");
      const headers={"Content-Type":"application/json",Authorization:"Bearer "+sessionStorage.getItem("authToken")};
      const response=await fetch(api+path,{method:"POST",headers,body:JSON.stringify({userId:Number(sessionStorage.getItem("userId")),...payload})});
      const result=await response.json();if(!response.ok)throw Error(result.message||"Station action failed.");
      const latest=await fetch(api+"/alien-campaign/"+sessionStorage.getItem("userId"),{headers:{Authorization:headers.Authorization},cache:"no-store"});
      if(latest.ok)setCampaign(await latest.json());
      setStationDonationAmount("");setStationNotice(successMessage);
    }catch(error){setStationNotice(error.message);}finally{setStationBusy(false);}
  };
  const sendInterbaseTrade=async()=>{
    setMarchLoading(true);setMarchNotice("");
    try{
      const api=(process.env.REACT_APP_API_URL||window.location.origin).replace(/\/$/,"");
      const response=await fetch(api+"/player-campaign/trade",{method:"POST",headers:{"Content-Type":"application/json",Authorization:"Bearer "+sessionStorage.getItem("authToken")},body:JSON.stringify({
        userId:sessionStorage.getItem("userId"),resources:tradeAmounts,target:{username:marchDraft.target.username,x:marchDraft.target.x,y:marchDraft.target.y}
      })});
      const data=await response.json();
      if(!response.ok)throw Error(data.message||"Trade failed.");
      setAvailableResources(data.remaining||{});setTradeAmounts({Gold:0,Iron:0,Water:0,Solar:0});
      setMarchNotice("Trade completed. "+Object.entries(data.resources).filter(([,amount])=>amount>0).map(([resource,amount])=>`${amount.toLocaleString()} ${localLabel(resource)}`).join(" · ")+" sent to "+data.target.username+".");
      window.dispatchEvent(new Event("game-progress-updated"));
    }catch(error){setMarchNotice(error.message);}
    finally{setMarchLoading(false);}
  };
  const selectedTroops=Object.values(marchUnits).reduce((total,count)=>total+count,0);
  const selectedCargoCapacity=Object.entries(marchUnits).reduce((total,[unit,count])=>total+Number(count||0)*Number(unitEconomy.cargoCapacity?.[unit]||0),0);
  const previewRows=normalizeFormation(formationRows);
  const formationSettings=campaign.formations || {};
  const attackPresets=formationSettings.attackPresets || formationSettings.presets || {};
  const attackNames=formationSettings.attackNames || formationSettings.names || {};
  const defensePresets=formationSettings.defensePresets || {};
  const defenseNames=formationSettings.defenseNames || {};
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
      if(payload.slot && payload.name) setPresetName(payload.name);
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

  const attackRoutes=[...(campaign.missions||[]),...(campaign.playerMissions||[]).map(m=>({...m,playerBattle:true}))]
    .filter(m=>m.target&&m.origin&&!m.returned_at).map(m=>({
      id:(m.playerBattle?"player-attack-":"attack-")+m.id,color:"#ff5252",from:m.result?m.target:m.origin,to:m.result?m.origin:m.target,
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
        <div>{t("Alien campaign: defeated level","Извънземна кампания: победено ниво")} {campaign.highestDefeated}{t("/20 · Next: level","/20 · Следващо ниво")} {campaign.nextLevel} {t("· Attacks left:","· Оставащи атаки:")} {campaign.remaining??"—"}{t("/20 · Cyber Knight Lv","/20 · Киберрицар ниво")} {campaign.knightLevel||1} · {t("Prestige","Престиж")} {Number(campaign.prestige||0)} ({Number(campaign.prestige||0)%20}/20)</div>
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
          {selectedTarget?.type==="station"&&<section style={{padding:14,margin:"12px 0",background:"linear-gradient(135deg,#163a40,#0d202b)",border:"1px solid #4bd4ba",borderRadius:10}}>
            {(()=>{
              const status=campaign.stations||{};
              const station=status.stations?.find(item=>item.id===selectedTarget.stationId);
              const owner=station?.allianceName;
              const countdown=Math.max(0,Math.ceil((Number(station?.protectionUntil||0)-clock)/1000));
              const h=Math.floor(countdown/3600),mm=Math.floor((countdown%3600)/60),ss=countdown%60;
              const wallRemaining=Math.max(0,Math.ceil((Number(station?.plasmaWallCompletesAt||0)-clock)/1000));
              const spaceportRemaining=Math.max(0,Math.ceil((Number(station?.spaceportCompletesAt||0)-clock)/1000));
              const formatDuration=seconds=>Math.floor(seconds/86400)+"d "+Math.floor((seconds%86400)/3600)+"h "+String(Math.floor((seconds%3600)/60)).padStart(2,"0")+"m";
              const defense=status.myDefense;
              const isOwner=!!station?.allianceId&&station.allianceId===status.allianceId;
              const structureLabel=(value)=>value==="built"?t("Complete","Завършено"):value==="building"?t("Under construction","В строеж"):t("Not built","Не е построено");
              return <>
                <h3 style={{color:"#83ffe0",marginTop:0}}>🛰️ {t("Alliance Space Station","Съюзна космическа база")} {selectedTarget.stationId}</h3>
                <p>{owner?t("Unlocked for alliance:","Отключена за алианса:")+" "+owner:t("Locked · top four alliances compete to unlock it with 10,000 donated green crystals.","Заключена · първите четири алианса се съревновават да я отключат с 10 000 дарени зелени кристала.")}</p>
                {status.allianceId?<p>{t("Your alliance:","Твоят алианс:")} <strong>{status.allianceName}</strong> · 💚 {Number(status.allianceGreen||0).toLocaleString()} / 10,000 · 🔴 {Number(status.allianceRed||0).toLocaleString()}<br/>{t("Your crystals:","Твоите кристали:")} 💚 {Number(status.personalGreen||0).toLocaleString()} · 🔴 {Number(status.personalRed||0).toLocaleString()}</p>:<p>{t("Join an alliance to donate crystals.","Присъедини се към алианс, за да даряваш кристали.")} · 💚 {Number(status.personalGreen||0).toLocaleString()} · 🔴 {Number(status.personalRed||0).toLocaleString()}</p>}
                {status.allianceId&&<div style={{display:"flex",gap:8,flexWrap:"wrap",alignItems:"center",margin:"10px 0"}}>
                  <select value={stationDonationKind} onChange={event=>setStationDonationKind(event.target.value)}><option value="green">{t("Green crystals","Зелени кристали")}</option><option value="red">{t("Red crystals","Червени кристали")}</option></select>
                  <input type="number" min="1" step="1" value={stationDonationAmount} onChange={event=>setStationDonationAmount(event.target.value)} placeholder={t("Amount to donate","Количество за даряване")} style={{width:170}}/>
                  <button type="button" disabled={stationBusy||!Number(stationDonationAmount)} onClick={()=>stationRequest("/alien-stations/donate",{kind:stationDonationKind,amount:Number(stationDonationAmount)},t("Crystals donated to the alliance.","Кристалите са дарени на алианса."))}>{t("Donate to alliance","Дарявай на алианса")}</button>
                </div>}
                <p><strong>{t("Top four alliances","Първите четири алианса")}</strong></p>
                <ol>{(status.eligibleAlliances||[]).map(alliance=><li key={alliance.id}>{alliance.name} · {Number(alliance.points||0).toLocaleString()} {t("points","точки")} {alliance.id===status.allianceId&&<>{t("· rank","· място")} {alliance.rank}</>}</li>)}</ol>
                {station?.locked&&status.canUnlock&&<button type="button" disabled={stationBusy} onClick={()=>stationRequest("/alien-stations/unlock",{stationId:selectedTarget.stationId},t("Station unlocked. Protection is active for 24 hours.","Станцията е отключена. Протекцията е активна 24 часа."))}>{stationBusy?t("Working…","Изпълнява се…"):t("Leader: unlock with 10,000 alliance green crystals","Лидер: отключи с 10 000 зелени кристала на алианса")}</button>}
                {station?.locked&&status.allianceId&&!status.canUnlock&&<p>{!status.eligibleAlliance?t("Your alliance must rank among the top four to unlock a station.","Алиансът ти трябва да е сред първите четири."):status.allianceRole!=="Leader"?t("Only the alliance leader can unlock a station.","Само лидерът на алианса може да отключи станция."):t("Donate green crystals until the alliance bank reaches 10,000.","Дарявайте зелени кристали, докато алиансът събере 10 000.")}</p>}
                {owner&&<div style={{padding:10,background:"#10222c",borderRadius:8,marginTop:10}}>
                  <h4 style={{margin:"4px 0"}}>{t("Station protection","Протекция на базата")}: {station?.protected&&countdown>0?t("Plasma shield active","Плазменият щит е активен"):t("Protection ended","Протекцията изтече")}{station?.protected&&countdown>0&&<span> · {h}h {String(mm).padStart(2,"0")}m {String(ss).padStart(2,"0")}s</span>}</h4>
                  {station?.protected&&<p>{t("Attacks and espionage against this station are blocked during the 24-hour shield.","Атаките и шпионажът срещу станцията са блокирани през 24-часовия щит.")}</p>}
                  <p>🧱 {t("Plasma Wall","Плазмена стена")} · {t("Level","Ниво")} {Number(station?.plasmaWallLevel||0)} / 20 · 💚 100 {t("per level","за ниво")} · 24h {t("per level","за ниво")} · {t("total","общо")} 💚 2,000</p>
                  {station?.plasmaWallStatus==="building"&&<p>{t("Building wall level","Строи се ниво на стената")} {Number(station?.plasmaWallLevel||0)+1} / 20 · {t("Time remaining","Оставащо време")}: {formatDuration(wallRemaining)}</p>}
                  {Number(station?.plasmaWallLevel||0)<20&&station?.plasmaWallStatus!=="building"&&status.allianceRole==="Leader"&&<button type="button" disabled={stationBusy} onClick={()=>stationRequest("/alien-stations/build",{kind:"plasma-wall"},t("Plasma Wall level construction started. It will take 24 hours.","Строежът на следващото ниво на плазмената стена започна. Ще отнеме 24 часа."))}>{t("Build next Plasma Wall level","Построй следващо ниво на плазмената стена")} · {Number(station?.plasmaWallLevel||0)+1}/20 · 💚 100</button>}
                  <p>🚀 {t("Spaceport","Космодрум")}: {station?.spaceportUnlocked?t("Unlocked","Отключен"):t("Locked until Plasma Wall level 20","Заключен до ниво 20 на плазмената стена")} · 💚 3,000 + 🔴 100 · 7 {t("days","дни")}</p>
                  {station?.spaceportStatus==="building"&&<><p>{t("Spaceport construction","Строеж на космодрума")} · {t("Time remaining","Оставащо време")}: {formatDuration(spaceportRemaining)}</p><p style={{color:"#ffcf72"}}>{t("The station is exposed during construction. Keep alliance defenders stationed here against alien attacks and rival alliances.","По време на строежа станцията е уязвима. Дръжте гарнизон за защита от извънземни атаки и съперничещи алианси.")}</p></>}
                  {station?.spaceportUnlocked&&station?.spaceportStatus==="not_started"&&status.allianceRole==="Leader"&&<button type="button" disabled={stationBusy} onClick={()=>stationRequest("/alien-stations/build",{kind:"spaceport"},t("Spaceport construction started. It costs 3,000 green and 100 red crystals and will take seven days.","Строежът на космодрума започна. Струва 3 000 зелени и 100 червени кристала и ще отнеме седем дни."))}>{t("Start Spaceport construction","Започни строежа на космодрума")}</button>}
                  <h4>{t("Station defenders","Защитници на станцията")}</h4>
                  {(station?.defenders||[]).length===0?<p>{t("No armies assigned yet.","Все още няма изпратени армии.")}</p>:(station.defenders||[]).map(item=><p key={item.user_id}>{item.username} · {item.status==="travelling"?t("Marching","Походът пътува"):t("Garrison","Гарнизон")} · {Object.entries(item.army||{}).map(([unit,count])=>localLabel(unit)+": "+count).join(", ")}</p>)}
                  {isOwner&&!defense&&<button type="button" disabled={marchLoading} onClick={()=>{const home=castles.find(c=>c.username===ownUsername);if(home)openMarch("Defend",selectedTarget,home);else setStationNotice(t("Your base could not be found.","Базата ти не е намерена."));}}>{t("Send army to defend","Изпрати армия за защита")}</button>}
                  {isOwner&&defense&&<div><p>{t("Your army at this station","Твоята армия в станцията")}: {defense.status==="travelling"?t("on the way","на път"):t("in garrison","в гарнизона")}</p><button type="button" disabled={stationBusy} onClick={()=>stationRequest("/alien-stations/recall",{stationId:selectedTarget.stationId},t("Your army returned to base.","Армията се върна в базата ти."))}>{t("Recall army","Върни армията")}</button></div>}
                </div>}
                {stationNotice&&<p role="status">{stationNotice}</p>}
              </>;
            })()}
          </section>}          {selectedTarget?.type==="mothership"&&campaign.mothershipEvent&&<section style={{padding:12,margin:"10px 0",background:"#3b2632",border:"1px solid #cc684f",borderRadius:8}}>
            <strong>{t("The global event lasts 24 hours. Every player gets 10 attacks; each march arrives in 30 seconds. Each 1,000 damage counts as one alien population killed and grants 1 XP. The Mother Ship cannot be destroyed.","Глобалното събитие трае 24 часа. Всеки играч има 10 атаки; походът пристига за 30 секунди. На всеки 1 000 щети се отчита една убита извънземна популация и се дава 1 опит. Майчиният кораб не може да бъде унищожен.")}</strong>
            <p>{t("Top 10: 20 extra Cyber Knight missions and equipment with 3 bonuses; rank 1 gets 3 items, rank 2 gets 2. All participants receive resources for hospital treatment.","Първите 10: 20 допълнителни мисии на Киберрицаря и екипировка с 3 бонуса; първият получава 3 предмета, вторият 2. Всички участници получават ресурси за лечението в болницата.")}</p>
            <div style={{marginTop:8}}>{t("Your attacks left:","Оставащи твои атаки:")} {campaign.mothershipEvent.attacksRemaining} · {t("Cyber Knight prestige:","Престиж на Киберрицаря:")} {campaign.mothershipEvent.prestige} · {t("Ship integrity:","Здравина на кораба:")} {Number(campaign.mothershipEvent.hp).toLocaleString()}</div>
            <h3>{t("Global damage rankings","Глобално класиране по щети")}</h3>
            {(campaign.mothershipEvent.rankings||[]).map((row,index)=><div key={row.user_id}>{index+1}. {row.username} · {Number(row.damage).toLocaleString()} {t("damage","щети")} · {row.attacks} {t("attacks","атаки")}</div>)}
            <details style={{marginTop:8}}><summary>{t("All attacks from all players","Всички атаки на играчите")}</summary>
              <div style={{maxHeight:180,overflowY:"auto"}}>{(campaign.mothershipEvent.attacks||[]).slice().reverse().map(attack=><div key={attack.id}>{attack.username} · {attack.origin_x}:{attack.origin_y} → 50:50 · {attack.resolved_at?Number(attack.damage).toLocaleString()+" "+t("damage","щети")+" · "+Number(attack.xp||0).toLocaleString()+" XP":t("en route","на път")}</div>)}</div>
            </details>
          </section>}
          <p style={{color:"#c0d2e3"}}>{selectedTarget?.type==="alien"?t("Alien Stronghold · Level ","Извънземна крепост · Ниво ")+selectedTarget.level:selectedTarget?.type==="mothership"?t("Mother Ship Hunt · Global Event","Ловът на Майчиния кораб · Глобално събитие"):selectedTarget?.type==="castle"?"Player Base · "+selectedTarget.username:selectedTarget?.type==="mine"?t(selectedTarget.resource+" Mine","Мина за "+({Gold:"злато",Iron:"желязо",Water:"вода",Solar:"слънчева енергия"}[selectedTarget.resource]||selectedTarget.resource)):localLabel("Open Sector")} {t("· Coordinates","· Координати")} {selectedTarget?.x}:{selectedTarget?.y}</p>
          {selectedTarget?.type==="mine"&&<section style={{padding:14,margin:"10px 0",background:"#172d3f",border:"1px solid #63829a",borderRadius:10}}>
            <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:12}}>
              <img src={MINE_RESOURCE_ICONS[selectedTarget.resource]} alt="" style={{width:42,height:42,objectFit:"contain",background:"#111923",border:"1px solid #6b7782",borderRadius:5,padding:3}} />
              <strong style={{fontSize:18}}>{localLabel(selectedTarget.resource)} {t("Mine","мина")}</strong>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"minmax(0,1fr) auto",gap:"8px 12px",alignItems:"center",padding:12,background:"#f2f3f4",color:"#18212b",borderRadius:8}}>
              <span>{t("Remaining quantity:","Оставащо количество:")}</span>
              <strong>{Number(selectedTarget.remaining).toLocaleString()}</strong>
              <span>{t("Gathering per hour:","Добив на час:")}</span>
              <strong>{Number(selectedTarget.production_per_hour).toLocaleString()}</strong>
            </div>
            <div style={{marginTop:10,padding:10,textAlign:"center",background:"#f2f3f4",borderRadius:8,fontWeight:700,color:Number(selectedTarget.ownerId)?"#b83232":"#168044"}}>
              {Number(selectedTarget.ownerId)?`${t("Occupied by:","Завладяна от:")} ${selectedTarget.ownerName||t("another player","друг играч")}`:t("Unoccupied","Незаета")}
            </div>
            <p style={{marginBottom:0}}>{t("Travel time uses the slowest unit in the selected army. Troops gather only up to their total cargo capacity, then return to base.","Времето за път се изчислява по най-бавната избрана единица. Войниците събират до общата си товароносимост, след което се връщат в базата.")}</p>
          </section>}
          {selectedTarget?.type==="alien" && <div style={{padding:12,background:"#243449",border:"1px solid #58758e",borderRadius:8}}>
            <strong>{t("Alien garrison · Level","Извънземен гарнизон · Ниво")} {selectedTarget.level}</strong>
            {campaign.garrisons?.[selectedTarget.level] ? <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))",gap:6,marginTop:8}}>
              {Object.entries(campaign.garrisons[selectedTarget.level]).map(([unit,count])=><div key={unit}>{localLabel(unit)}: <strong>{count.toLocaleString()}</strong></div>)}
              <div style={{gridColumn:"1 / -1",marginTop:6,fontWeight:"bold"}}>{t("Total defenders:","Общо защитници:")} {Object.values(campaign.garrisons[selectedTarget.level]).reduce((sum,n)=>sum+n,0).toLocaleString()}</div>
            </div> : <p>{t("Loading fixed garrison data...","Зареждане на гарнизона…")}</p>}
            <p style={{fontSize:12}}>{t("Higher-level alien strongholds have larger and more advanced garrisons. The level 20 fortress has an Alien Overlord.","По-високите нива имат по-големи и по-силни гарнизони. Крепостта на ниво 20 има извънземен владетел.")}</p>
          </div>}
          {!marchDraft && selectedTarget?.type!=="station" && <div>
            <p>{t("Choose mission type:","Избери вид мисия:")}</p>
            <div style={{display:"flex",gap:10,flexWrap:"wrap",margin:"18px 0"}}>
              {(selectedTarget?.type==="alien"||selectedTarget?.type==="mothership"?["Attack"]:selectedTarget?.type==="mine"?(Number(selectedTarget.ownerId)&&Number(selectedTarget.ownerId)!==Number(sessionStorage.getItem("userId"))?["Attack"]:Number(selectedTarget.ownerId)?[]:["Gather"]):["Attack","Support","Espionage","Patrol","Gather","Trade","Relocation"]).map(type=>{
                const field=selectedTarget?.type==="field",own=targetIsOwn,alien=selectedTarget?.type==="alien";
                const mothership=selectedTarget?.type==="mothership";
                const resourceMine=selectedTarget?.type==="mine";
                const shielded=Number(selectedTarget?.protected_until||selectedTarget?.protectedUntil||0)>Date.now();
                const blockedByShield=shielded&&(type==="Attack"||type==="Espionage");
                const allowed=!blockedByShield&&(type==="Attack"?(alien||mothership||(selectedTarget?.type==="castle"&&!own)||(resourceMine&&Number(selectedTarget.ownerId)!==Number(sessionStorage.getItem("userId")))): type==="Support"?!field&&!alien&&!own&&canSupport:
                  type==="Espionage"?!field&&!own:
                  type==="Patrol"?field:
                  type==="Gather"?(field||resourceMine):
                  type==="Trade"?!field&&!alien&&!own&&(campaign.tradeModuleLevel||0)>=3:
                  type==="Relocation"?field:false);
                return <button key={type} disabled={!allowed} onClick={()=>chooseAction(type)}
                  style={{padding:"12px 18px",background:allowed?(type==="Attack"?"#9e4437":type==="Gather"&&resourceMine?"#208044":"#205c78"):"#253441",color:allowed?"white":"#788796",border:"1px solid #50718b",borderRadius:7,cursor:allowed?"pointer":"not-allowed"}}>
                  {type==="Attack"?"⚔ ":type==="Espionage"?"◈ ":type==="Support"?"🛡 ":type==="Gather"?"⛏ ":""}{type==="Gather"?t("Gather","Събирай"):localLabel(type)}
                </button>;
              })}
            </div>
            {selectedTarget?.type==="castle"&&!targetIsOwn&&Number(selectedTarget?.protected_until||selectedTarget?.protectedUntil||0)>Date.now()&&<p role="status" style={{color:"#c4f4ff",background:"rgba(41,117,145,.35)",padding:10,borderRadius:7}}>{t("This player is protected by a 24-hour Plasma Shield. Attacks and espionage are blocked until it expires.","Този играч е защитен от 24-часов плазмен щит. Атаките и шпионажът са блокирани до изтичането му.")}</p>}
            {targetIsOwn && <p>{t("This is your own base. Choose another destination.","Това е твоята база. Избери друга цел.")}</p>}
            {selectedTarget?.type==="castle"&&!targetIsOwn&&(campaign.tradeModuleLevel||0)<3 ? <p style={{fontSize:12,color:"#ffdc9c"}}>{t("Inter-base trade unlocks when your Cargo Depot reaches level 3.","Междубазовата търговия се отключва, когато Товарното депо достигне ниво 3.")}</p> : selectedTarget?.type==="alien" || selectedTarget?.type==="mothership" || (selectedTarget?.type==="castle"&&!targetIsOwn) || (selectedTarget?.type==="mine"&&Number(selectedTarget.ownerId)) ? <p style={{fontSize:12,color:"#b2c8d8"}}>{t("Select Attack to launch a combat mission.","Избери „Атака“, за да започнеш бойна мисия.")}</p> : <p style={{fontSize:12,color:"#b2c8d8"}}>{t("Select Gather to send troops to collect this resource.","Избери „Събирай“, за да изпратиш войници да събират този ресурс.")}</p>}
          </div>}
          {marchLoading && <p>{t("Loading your army...","Зареждане на армията…")}</p>}
          {marchDraft && <div>
            <h3>{marchDraft.type}: {marchDraft.origin.username} ({marchDraft.origin.x}:{marchDraft.origin.y}) → ({marchDraft.target.x}:{marchDraft.target.y})</h3>
            {marchDraft.type==="Trade" ? <div>
              <p>{t("Direct transfers have been replaced by the marketplace. Publish an offer from your base; the other player must accept it before resources move.","Директното изпращане е заменено с пазар. Публикувай оферта от базата си; другият играч трябва да я приеме, преди ресурсите да се преместят.")}</p>
              <button type="button" onClick={()=>{window.location.href="/#/game?market=1";}}>{t("Open marketplace","Отвори пазара")}</button>
              <button type="button" onClick={()=>setMarchDraft(null)}>{t("← Back to mission types","← Към видовете мисии")}</button>
            </div> : <>
            {marchDraft.type === "Attack" && (marchDraft.target.type === "alien"||marchDraft.target.type==="mothership") && <>
            <p>{t("Cyber Knight leads this attack · Level","Киберрицарят води похода · Ниво")} {campaign.knightLevel || 1} {t("(required)","(задължителен)")}</p>
            <button type="button" disabled={marchLoading || campaign.knightBusy} aria-pressed={knightAdded} onClick={()=>setKnightAdded(added=>!added)}>
              {knightAdded ? localLabel("Remove Cyber Knight") : localLabel("Add Cyber Knight")}
            </button>
            {campaign.knightBusy && <p>{t("Cyber Knight is on a mission and must return before launching another attack.","Киберрицарят трябва да се върне от текущата си мисия преди нова атака.")}</p>}
            </>}
            <p>{t("Select troops from your base army ·","Избери войски от базата ·")} {selectedTroops.toLocaleString()} / {marchLimit.toLocaleString()}</p>
            {marchDraft.type==="Attack" && marchDraft.target.type==="castle" && <p>{t("Estimated cargo capacity if the surviving army wins:","Очаквана товароносимост при победа на оцелялата армия:")} {selectedCargoCapacity.toLocaleString()} {t("resources","ресурси")}</p>}
            {marchDraft.target.type==="mine"&&marchDraft.type==="Gather"&&<p>{t("Estimated cargo:","Очакван товар:")} {selectedCargoCapacity.toLocaleString()} · {t("available in mine:","налични в мината:")} {Number(marchDraft.target.remaining).toLocaleString()} · {t("estimated collection:","очакван добив:")} {Math.min(selectedCargoCapacity,Number(marchDraft.target.remaining)||0).toLocaleString()} {localLabel(marchDraft.target.resource)}</p>}
            {formationMessage&&<p role="status">{localLabel(formationMessage)}</p>}
            {!units.some(unit=>Number(availableArmy[unit]||0)>0) && <p>{t("No trained troops available. Train units at your base before preparing a march.","Няма обучени войски. Обучи единици в базата преди поход.")}</p>}
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(190px,1fr))",gap:10}}>
              {units.map(unit=><label key={unit} style={{background:"#20384d",border:"1px solid #46637a",padding:10,borderRadius:8,display:"flex",flexDirection:"column",gap:6,opacity:Number(availableArmy[unit]||0)>0?1:.5}}>
                <strong>{localLabel(unit)}</strong>
                <span>{t("Available:","Налични:")} {Number(availableArmy[unit]||0)}</span>
                <span>{t("Cargo per unit:","Товароносимост на единица:")} {Number(unitEconomy.cargoCapacity?.[unit]||0)}</span>
                <input type="number" min="0" max={Number(availableArmy[unit]||0)} disabled={!Number(availableArmy[unit]||0)} value={marchUnits[unit]||0}
                  onChange={e=>setMarchUnits(old=>({...old,[unit]:Math.max(0,Math.min(Number(availableArmy[unit]||0),Math.floor(Number(e.target.value)||0)))}))}/>
                <button disabled={!Number(availableArmy[unit]||0)} onClick={()=>setMarchUnits(old=>({...old,[unit]:Number(availableArmy[unit]||0)}))}>{t("MAX","МАКС.")}</button>

              </label>)}
            </div>
            {marchDraft.type==="Attack" && (marchDraft.target.type==="alien" || marchDraft.target.type==="castle") && <div style={{margin:"10px 0"}}>
              <strong>{t("Choose an attack formation","Избери формация за атака")}</strong>
              <div style={{display:"flex",gap:8,flexWrap:"wrap",marginTop:8}}>
                {[1,2,3,4,5].map(slot=>{
                  const saved=attackPresets[slot];
                  return <button key={slot} type="button" disabled={!saved}
                    aria-pressed={String(slot)===marchFormationSlot}
                    onClick={()=>{
                      setMarchFormationSlot(String(slot));
                      setFormationRows(saved||{});
                    }}
                    style={{padding:"9px 14px",border:"1px solid #69a5c2",borderRadius:6,color:"#edf6ff",background:String(slot)===marchFormationSlot?"#26765e":"#20384d",opacity:saved?1:.5}}>
                    {attackNames[slot]||t("Attack formation","Формация за атака")+" "+slot}
                  </button>;
                })}
              </div>
              {!Object.keys(attackPresets).length && <p>{t("No saved attack formations yet. The standard attack layout is selected.","Още няма запазени формации за атака. Избрана е стандартната атака.")}</p>}
            </div>
            }
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
              <button type="button" disabled={!selectedTroops || selectedTroops>marchLimit} onClick={()=>setPreviewOpen(true)}>{t("Preview formation","Преглед на строя")}</button>
              <button disabled={marchLoading || (marchDraft.target.type==="alien" && (campaign.knightBusy || !knightAdded || !marchFormationSlot)) || !selectedTroops || selectedTroops>marchLimit} onClick={prepareMarch} style={{background:"#26765e",color:"white",padding:"10px 22px"}}>{marchDraft.target.type==="mine"&&marchDraft.type==="Gather"?t("Send gathering march","Изпрати поход за добив"):t("Launch attack","Изпрати атаката")}</button>
              <button onClick={()=>setMarchDraft(null)}>{t("← Back to mission types","← Към видовете мисии")}</button>
            </div>
            {selectedTroops>marchLimit && <p role="alert">{t("Cyber Knight can command at most 50,000 troops.","Киберрицарят може да води най-много 50 000 войници.")}</p>}
            <p style={{fontSize:12,color:"#b5c7d9"}}>{t("Alien attacks reserve selected troops immediately; survivors return after the battle.","Избраните войски тръгват веднага. Оцелелите се връщат след битката.")}</p>
            </>}
          </div>}
          {marchNotice && <p role="status" style={{color:"#ffdc9c"}}>{localLabel(marchNotice)}</p>}
        </div>
      </div>}
      {previewOpen && marchDraft && <div role="dialog" aria-modal="true" aria-label={t("Formation preview","Преглед на строя")} style={{position:"fixed",inset:0,zIndex:55,background:"rgba(0,0,0,.86)",display:"grid",placeItems:"center",padding:16}}>
        <div style={{width:"min(980px,96vw)",maxHeight:"90vh",overflowY:"auto",background:"#e8dec1",color:"#211c16",border:"3px solid #76664b",borderRadius:10,padding:18,boxShadow:"0 12px 50px #000"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:12}}>
            <div><h2 style={{margin:"0 0 4px"}}>{t("Attack formation preview","Преглед на бойната формация")}</h2><div>{marchDraft.target.username||t("Alien base","Извънземна база")} · {marchDraft.target.x}:{marchDraft.target.y}</div></div>
            <button type="button" aria-label={t("Close preview","Затвори прегледа")} onClick={()=>setPreviewOpen(false)}>✕</button>
          </div>
          <div style={{overflowX:"auto",marginTop:14}}><div style={{minWidth:640,display:"grid",gridTemplateColumns:"56px repeat(7,minmax(0,1fr))",gap:6}}>
            {[4,3,2,1].map(row=><React.Fragment key={row}><strong style={{alignSelf:"center",textAlign:"center"}}>{row}<br/>{t("ROW","РЕД")}</strong>{Array.from({length:7},(_,column)=>{
              const unit=units.find(name=>previewRows[name]===row&&previewRows.columns[name]===column);
              const count=unit?Number(marchUnits[unit]||0):0;
              return <div key={column} style={{minHeight:92,display:"flex",flexDirection:"column",justifyContent:"space-between",padding:6,background:"#f6f0df",border:"1px solid #9d8b6a",borderRadius:4,textAlign:"center"}}>
                {unit&&count>0&&<><strong style={{fontSize:12}}>{localLabel(unit)}</strong><small>{formationUnitTypes[unit]?.[1] ? t(formationUnitTypes[unit][0],formationUnitTypes[unit][1]) : ""} · {t("Range","Обхват")} {formationUnitTypes[unit]?.[2]}</small><b style={{background:"white",borderRadius:4,padding:3}}>{count.toLocaleString()}</b></>}
              </div>;
            })}</React.Fragment>)}
          </div></div>
          <div style={{margin:"12px 0",padding:10,textAlign:"center",fontWeight:"bold",background:"#897452",color:"white"}}>{t("Target wall","Стена на целта")}</div>
          <p>{t("Troops in formation:","Войници във формацията:")} {selectedTroops.toLocaleString()} · {t("Formation:","Формация:")} {attackNames[marchFormationSlot]||t("Standard attack","Стандартна атака")}</p>
          <div style={{display:"flex",justifyContent:"flex-end",gap:8,flexWrap:"wrap"}}>
            <button type="button" onClick={()=>setPreviewOpen(false)}>{t("Back to army selection","Назад към избора на войници")}</button>
            <button type="button" disabled={marchLoading || (marchDraft.target.type==="alien" && (campaign.knightBusy || !knightAdded || !marchFormationSlot)) || !selectedTroops || selectedTroops>marchLimit} onClick={prepareMarch} style={{background:"#26765e",color:"white",padding:"10px 22px"}}>{t("Send attack","Изпрати похода")}</button>
          </div>
        </div>
      </div>}
      {marchSuccess && <div role="dialog" aria-modal="true" aria-label={t("March sent","Походът е изпратен")} style={{position:"fixed",inset:0,zIndex:60,background:"rgba(0,0,0,.72)",display:"grid",placeItems:"center",padding:16}}>
        <div style={{width:"min(640px,94vw)",padding:28,textAlign:"center",background:"#f4efdf",color:"#181818",border:"3px solid #857450",borderRadius:10,boxShadow:"0 12px 50px #000"}}>
          <h2>{t("March sent successfully!","Походът е изпратен успешно!")}</h2><p>{localLabel(marchSuccess)}</p>
          {marchSuccess.includes("Mother Ship")&&<button type="button" onClick={()=>{window.location.href="/#/game?hospital=1";}}>{t("Open Hospital","Отвори болницата")}</button>} <button type="button" onClick={()=>setMarchSuccess("")} style={{background:"#26765e",color:"white",padding:"10px 24px"}}>{t("Continue","Продължи")}</button>
        </div>
      </div>}
      <button onClick={()=>{setCampaignTab("active");setMarchHistoryOpen(true);}} style={{position:"absolute",right:18,bottom:22,zIndex:12,background:"#142b39",color:"#ccecff",border:"1px solid #64a9c9",padding:"12px 20px",borderRadius:8,cursor:"pointer"}}>{t("🚀 CAMPAIGNS","🚀 КАМПАНИИ")}</button>
      {marchHistoryOpen && <div style={{position:"absolute",inset:0,zIndex:40,background:"rgba(0,0,0,.76)",display:"grid",placeItems:"center",padding:16}}>
        <div style={{width:"min(850px,95vw)",maxHeight:"85vh",overflowY:"auto",padding:24,background:"#122334",color:"#edf6ff",border:"1px solid #69a5c2",borderRadius:12}}>
          <div style={{display:"flex",justifyContent:"space-between"}}><h2 style={{margin:0}}>{t("🚀 CAMPAIGNS","🚀 КАМПАНИИ")}</h2><button onClick={()=>setMarchHistoryOpen(false)}>{t("✕ Close","✕ Затвори")}</button></div>
          <nav aria-label={t("Campaign sections","Раздели на кампаниите")} style={{display:"flex",flexWrap:"wrap",gap:8,margin:"16px 0"}}>
            {[
              ["campaigns",t("Campaigns","Кампании")],
              ["formations",t("Formations","Формации")]
            ].map(([tab,label])=>{
              const active=tab==="formations"?campaignTab==="formations":campaignTab!=="formations";
              return <button key={tab} type="button" aria-pressed={active}
                style={{padding:"8px 14px",border:"1px solid #69a5c2",borderRadius:6,color:"#edf6ff",background:active?"#27657e":"#20384d"}}
                onClick={()=>{
                  if(tab==="formations"){
                    setPresetRows(attackPresets[presetSlot]||{});
                    setPresetName(attackNames[presetSlot]||"");
                    setFormationMode("attack");
                    setCampaignTab("formations");
                  }else if(campaignTab==="formations"){
                    setCampaignTab("active");
                  }
                }}>{label}</button>;
            })}
          </nav>
          {campaignTab!=="formations" && <nav aria-label={t("Campaign views","Изглед на кампаниите")} style={{display:"flex",gap:8,margin:"8px 0"}}>
            {[
              ["active",t("Active Marches","Активни походи")],
              ["reports",t("Reports","Доклади")]
            ].map(([tab,label])=><button key={tab} type="button" aria-pressed={campaignTab===tab}
              style={{padding:"7px 12px",border:"1px solid #69a5c2",borderRadius:6,color:"#edf6ff",background:campaignTab===tab?"#27657e":"#20384d"}}
              onClick={()=>setCampaignTab(tab)}>{label}</button>)}
          </nav>}
          {campaignTab==="formations" ? <section>
            <div style={{display:"flex",gap:8,margin:"12px 0"}}>
              {["attack","defense"].map(mode=><button key={mode} type="button" aria-pressed={formationMode===mode}
                onClick={()=>{
                  setFormationMode(mode);
                  const nextPresets=mode==="defense"?defensePresets:attackPresets;
                  const nextNames=mode==="defense"?defenseNames:attackNames;
                  setPresetRows(nextPresets[presetSlot]||{});
                  setPresetName(nextNames[presetSlot]||"");
                }}
                style={{padding:"9px 16px",border:"1px solid #69a5c2",borderRadius:6,color:"#edf6ff",background:formationMode===mode?"#26765e":"#20384d"}}>
                {mode==="attack"?t("Attack formations","Формации за атака"):t("Defense formations","Формации за защита")}
              </button>)}
            </div>
            <div style={{display:"flex",gap:8,flexWrap:"wrap",margin:"12px 0"}}>
              {[1,2,3,4,5].map(slot=>{
                const saved=(formationMode==="defense"?defensePresets:attackPresets)[slot];
                const name=(formationMode==="defense"?defenseNames:attackNames)[slot];
                return <button key={slot} type="button" aria-pressed={presetSlot===slot}
                  onClick={()=>{
                    setPresetSlot(slot);
                    setPresetRows((formationMode==="defense"?defensePresets:attackPresets)[slot]||{});
                    setPresetName((formationMode==="defense"?defenseNames:attackNames)[slot]||"");
                  }}
                  style={{padding:"9px 12px",border:"1px solid #69a5c2",borderRadius:6,color:"#edf6ff",background:presetSlot===slot?"#27657e":"#20384d"}}>
                  {name||t("Formation","Формация")+" "+slot}{saved?"":localLabel(" (празен)")}
                </button>;
              })}
            </div>
            <button type="button" onClick={()=>setPresetRows(defaultFormation(formationMode==="defense"))}>
              {formationMode==="defense"?t("Load default defense","Зареди стандартна защита"):t("Load default attack","Зареди стандартна атака")}
            </button>
            <label style={{display:"inline-flex",gap:8,alignItems:"center",margin:"12px 0"}}>{t("Formation name","Име на формацията")} <input value={presetName} maxLength={32} onChange={event=>setPresetName(event.target.value)} placeholder={t("e.g. Fast attack","например Бърза атака")} /></label>
            <FormationBoard key={formationMode+"-"+presetSlot} rows={presetRows} setRows={setPresetRows} />
            <div style={{position:"sticky",bottom:0,zIndex:5,display:"flex",alignItems:"center",justifyContent:"space-between",gap:12,flexWrap:"wrap",padding:"12px 8px",background:"#122334",borderTop:"1px solid #69a5c2"}}>
              <strong>{units.filter(unit => presetRows[unit]).length} / {units.length} {t("troops placed","войници подредени")}</strong>
              <button type="button" disabled={formationBusy || !units.every(unit => presetRows[unit]) || !presetName.trim()}
                onClick={()=>saveFormation({mode:formationMode,slot:presetSlot,rows:presetRows,name:presetName.trim()})}
                style={{padding:"10px 20px",fontWeight:"bold",background:"#26765e",color:"white",border:"1px solid #8fe0a5",borderRadius:6,opacity:formationBusy || !units.every(unit => presetRows[unit]) || !presetName.trim() ? .7 : 1}}>
                {formationBusy ? t("Saving…","Запазване…") : t("Save Formation","Запази формацията")}
              </button>
            </div>
            {!units.every(unit => presetRows[unit]) && <p>{t("Place every troop in one of the 28 cells to save this formation.","Постави всички войници в някоя от 28-те клетки, за да запазиш формацията.")}</p>}
            <p><label>{t("Active defense formation","Активна отбранителна формация")}{" "}
              <select disabled={formationBusy} value={formationSettings.defenseSlot || 0} onChange={event=>saveFormation({defenseSlot:Number(event.target.value)})}>
                <option value={0}>{t("Default Defense","Стандартна защита")}</option>
                {Object.keys(defensePresets).map(slot=><option key={slot} value={slot}>{defenseNames[slot]||t("Defense formation","Формация за защита")+" "+slot}</option>)}
              </select>
            </label></p>
            <p>{t("The selected defense formation is used for future player battles. You can change it at any time.","Избраната формация за защита се използва в бъдещи битки с играчи. Можеш да я смениш по всяко време.")}</p>
            {formationMessage&&<p role="status">{localLabel(formationMessage)}</p>}
          </section> : <>
          {campaignTab==="active" && !scoutMarches.length && !alienMarches.length && !playerMarches.length && !resourceMarches.length &&
            <p>{t("No active marches. Close this panel and select a target on the map to start a march.","Няма активни походи. Затвори панела и избери цел на картата, за да започнеш поход.")}</p>}
          {resourceMarches.length>0&&<><h3>{t("Resource mine marches","Походи към ресурсни мини")}</h3>
            {resourceMarches.map(mission=>{
              const returning=mission.status==="returning"||mission.status==="gathering";
              const due=returning?mission.returns_at:mission.arrives_at;
              const remaining=Math.max(0,Math.ceil((Number(due||0)-clock)/1000));
              const status=mission.status==="gathering"?t("Gathering · returning in","Добив · връщане след"):mission.status==="returning"?t("Returning in","Връщане след"):t("Travelling · arrival in","По пътя · пристигане след");
              return <p key={"resource-"+mission.id}><strong>{mission.kind==="attack"?t("Attack march","Атакуващ поход"):t("Gathering march","Поход за добив")} #{mission.id}</strong> · {localLabel(mission.resource)} · {mission.x}:{mission.y} · {status} {remaining} {t("sec.","сек.")} · {Number(mission.gathered||0).toLocaleString()} / {Number(mission.gather_amount||0).toLocaleString()}</p>;
            })}
          </>}
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
          {(alienMarches.length>0) && <h3>{campaignTab==="reports" ? t("Alien Mission Reports","Доклади от извънземни мисии") : t("Alien Attacks","Атаки срещу извънземни")}</h3>}
        {alienMarches.map(m=><details key={m.id} style={{marginBottom:10,borderBottom:"1px solid #536c80",paddingBottom:8}}>
          <summary>{t("Mission #","Мисия №")}{m.id} {t("· Alien Lv","· Извънземна база ниво")} {m.level} · {m.result ? (m.result.victory?localLabel("VICTORY"):localLabel("DEFEAT")) : localLabel("Travelling")}{!m.returned_at && ` · ${m.result ? localLabel("Returning") : localLabel("Arrival")} · ${Math.max(0,Math.ceil(((m.result ? m.returns_at : m.arrives_at)-clock)/1000))}s` }</summary>
          {m.cyberKnightLevel && <p>{t("Commander: Cyber Knight Lv","Командир: Киберрицар ниво")} {m.cyberKnightLevel}</p>}
          {m.formation?.length ? <ul>{m.formation.map(({unit,count,row},index)=><li key={index}>{count.toLocaleString()} {localLabel(unit)} {t("· Row","· Ред")} {row}</li>)}</ul>
            : m.units && <p>{t("Dispatched:","Изпратени:")} {Object.entries(m.units).map(([unit,count])=>`${count} ${localLabel(unit)}`).join(", ")}</p>}
          {m.result&&<div><p>{t("Rounds:","Рундове:")} {m.result.rounds} {t("· Remaining alien defenders:","· Оставащи извънземни защитници:")} {m.result.defendersRemaining}</p>
          <p>{t("Reward:","Награда:")} {m.result.reward?.item?.name || (m.result.reward?.type==="crafting" ? `${m.result.reward.amount} ${t("Universal Forge points","универсални точки за изковаване")}` : m.result.reward?.type==="resources" ? `${m.result.reward.amount} ${t("of each resource","от всеки ресурс")}` : m.result.reward?.type==="army" ? `${m.result.reward.amount} ${localLabel(m.result.reward.unit)}` : "None")}</p>
          {m.result.greenCrystals>0&&<p>💚 {t("Green crystals earned:","Спечелени зелени кристали:")} {Number(m.result.greenCrystals).toLocaleString()} {t("· credited to your balance","· добавени към личния ти баланс")}</p>}
          {m.result.redCrystals>0&&<p>🔴 {t("Red crystals earned:","Спечелени червени кристали:")} {Number(m.result.redCrystals).toLocaleString()} {t("· credited to your balance","· добавени към личния ти баланс")}</p>}
          <p>{t("Survivors:","Оцелели:")} {Object.entries(m.result.survivors||{}).map(([u,n])=>localLabel(u)+": "+n).join(", ") || "None"}</p>
          {(m.result.report||[]).map(round=><details key={round.round}><summary>{t("Round","Рунд")} {round.round}</summary>
            {round.events.map((e,i)=><p key={i} style={{fontSize:12}}>{e.restored > 0 ? `Nano Regeneration: ${e.restored} ${localLabel(e.unit)} restored` : <>{localLabel(e.attacker)}: {e.units} {localLabel(e.unit)} → {localLabel(e.target)} · {e.damage} {t("damage","щети")}{Number.isInteger(e.kills) ? ` · ${e.kills} ${t("defeated","убити")}` : ""}{e.dodged ? t(" · Evaded"," · Избегнат удар") : ""}</>}</p>)}
          </details>)}</div>}
        </details>)}
        {playerMarches.length>0 && <h3>{campaignTab==="reports"?t("Player Battle Reports","Доклади от битки с играчи"):t("Player Attacks","Атаки срещу играчи")}</h3>}
        {playerMarches.map(m=>{
          const outcome=m.result
            ? m.incoming
              ? (m.result.shielded?t("Protection blocked attack","Протекцията спря атаката"):m.result.victory?t("Base lost","Базата е превзета"):t("Defense held","Защитата устоя"))
              : (m.result.shielded?t("Target protected","Целта е под протекция"):m.result.victory?t("Victory","Победа"):t("Defeat","Загуба"))
            : t("Travelling","На път");
          return <details key={"player-"+m.id} style={{marginBottom:10,borderBottom:"1px solid #536c80",paddingBottom:8}}>
            <summary>{m.incoming?t("Incoming attack from","Вражеска атака от")+" "+m.attacker_name:t("Attack on","Атака срещу")+" "+m.defender_name} · {m.target?.x}:{m.target?.y} · {outcome}{!m.returned_at&&` · ${m.result?t("Returning","Връщане"):t("Arrival","Пристигане")} · ${Math.max(0,Math.ceil(((m.result?m.returns_at:m.arrives_at)-clock)/1000))} ${t("sec.","сек.")}`}</summary>
            <p>{t("Sent troops:","Изпратени войници:")} {Object.entries(m.units||{}).map(([unit,count])=>`${count.toLocaleString()} ${localLabel(unit)}`).join(", ")}</p>
            {m.formation?.length>0&&<ul>{m.formation.map((group,index)=><li key={index}>{group.count.toLocaleString()} {localLabel(group.unit)} · {t("Row","Ред")} {group.row}</li>)}</ul>}
            {m.result&&<div>
              {m.result.shielded&&<p>{m.incoming?t("Your protection blocked this attack; the troops return safely.","Протекцията ти спря атаката; войските се връщат невредими."):t("The target’s protection blocked this attack; your troops return safely.","Протекцията на целта спря атаката; войските ти се връщат невредими.")}</p>}
              <p>{t("Rounds:","Рундове:")} {m.result.rounds} · {t("Attacker survivors:","Оцелели нападатели:")} {Object.values(m.result.survivors||{}).reduce((sum,count)=>sum+count,0).toLocaleString()} · {t("Defender survivors:","Оцелели защитници:")} {Object.values(m.result.defenderSurvivors||{}).reduce((sum,count)=>sum+count,0).toLocaleString()}</p>
              <p>{m.incoming?t("Resources plundered by attacker:","Ресурси, отнети от нападателя:"):t("Loot carried back:","Плячка, която се връща:")} {Object.entries(m.result.loot||{}).filter(([,amount])=>Number(amount)>0).map(([resource,amount])=>String(amount.toLocaleString())+" "+localLabel(resource)).join(", ")||t("None","Няма")} · {t("Cargo capacity:","Товароносимост:")} {Number(m.result.cargoCapacity||0).toLocaleString()}</p>
              {(m.result.report||[]).map(round=><details key={round.round}><summary>{t("Round","Рунд")} {round.round}</summary>
                {round.events.map((event,index)=><p key={index} style={{fontSize:12}}>{localLabel(event.attacker)}: {event.units} {localLabel(event.unit)} → {localLabel(event.target)} · {event.damage} {t("damage","щети")}{Number.isInteger(event.kills)?` · ${event.kills} ${t("defeated","убити")}`:""}</p>)}
              </details>)}
            </div>}
          </details>;
        })}
        {campaignTab==="reports" && !alienMarches.length&&!playerMarches.length&&<p>{t("No battle reports yet.","Все още няма бойни доклади.")}</p>}
          </>}
        </div>
      </div>}
    </div>
  );
}

export default Map;
