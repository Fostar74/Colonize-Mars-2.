
// Colonize Mars Map.jsx with full formatting, mines, and alien bases

import React, { useEffect, useRef, useState } from "react";
import hqIconFile from "../images/hq-icon.png";
import goldMineImg from "../images/mine-gold.png";
import ironMineImg from "../images/mine-iron.png";
import solarMineImg from "../images/mine-solar.png";
import waterMineImg from "../images/mine-water.png";
import alienBaseImg from "../images/alien-base.png";

function Map() {
  const canvasRef = useRef(null);
  const tileSize = 60;
  const mapSize = 200;

  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [dragStart, setDragStart] = useState(null);
  const [castles, setCastles] = useState([]);
  const [mapError, setMapError] = useState("");
  const [campaign, setCampaign] = useState({highestDefeated:0,nextLevel:1});
  const [selectedAlien, setSelectedAlien] = useState(null);
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
    fetch((process.env.REACT_APP_API_URL || window.location.origin).replace(/\\/$/,"") + "/alien-campaign/" + sessionStorage.getItem("userId"), {headers:{Authorization:"Bearer "+sessionStorage.getItem("authToken")}}).then(r=>r.ok?r.json():null).then(d=>{if(d && !cancelled)setCampaign(d)}).catch(()=>{});
    const timer = setInterval(loadBases, 30000);
    return () => { cancelled = true; clearInterval(timer); };
  }, []);
  const [hqIcon, setHqIcon] = useState(null);
  const [hoveredTitle, setHoveredTitle] = useState("");
  const [cursorCoord, setCursorCoord] = useState(null);
  const [mineIcons, setMineIcons] = useState({});
  const [alienIcon, setAlienIcon] = useState(null);

  const mineData = [
    ...Array.from({ length: 15 }, (_, i) => ({
      x: i * 3 + 5,
      y: 10,
      type: "gold",
    })),
    ...Array.from({ length: 15 }, (_, i) => ({
      x: i * 3 + 5,
      y: 30,
      type: "iron",
    })),
    ...Array.from({ length: 15 }, (_, i) => ({
      x: i * 3 + 5,
      y: 50,
      type: "solar",
    })),
    ...Array.from({ length: 15 }, (_, i) => ({
      x: i * 3 + 5,
      y: 70,
      type: "water",
    })),
  ];

  // Alien strongholds occupy multiple rings: level 20 in the center, level 1 at the edge.
  const alienBases = [
    { x: 100, y: 100, level: 20 },
    ...Array.from({ length: 19 }, (_, index) => {
      const level = 19 - index;
      const radius = (20 - level) * 4.6;
      const count = Math.max(5, Math.round(2 * Math.PI * radius / 12));
      return Array.from({ length: count }, (_, j) => {
        const angle = (j + (level % 2) * 0.5) * 2 * Math.PI / count;
        return {
          x: Math.max(1, Math.min(200, Math.round(100 + radius * Math.cos(angle)))),
          y: Math.max(1, Math.min(200, Math.round(100 + radius * Math.sin(angle)))),
          level
        };
      });
    }).flat()
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

    for (let x = 0; x < mapSize; x++) {
      for (let y = 0; y < mapSize; y++) {
        const px = x * tileSize + offset.x;
        const py = y * tileSize + offset.y;

        if (px > canvas.width || py > canvas.height || px + tileSize < 0 || py + tileSize < 0) continue;
        ctx.strokeStyle = "#0077cc";
        ctx.strokeRect(px, py, tileSize, tileSize);
      }
    }

    mineData.forEach((mine) => {
      const px = mine.x * tileSize + offset.x;
      const py = mine.y * tileSize + offset.y;
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
      const px = base.x * tileSize + offset.x;
      const py = base.y * tileSize + offset.y;

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
      const px = c.x * tileSize + offset.x;
      const py = c.y * tileSize + offset.y;

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
  }, [offset, castles, hqIcon, mineIcons, alienIcon]);

  const centerMapOn = (x, y) => {
    const canvas = canvasRef.current;

    setOffset({
      x: canvas.width / 2 - x * tileSize,
      y: canvas.height / 2 - y * tileSize,
    });
  };

  const handleMouseDown = (e) => {
    setDragStart({
      x: e.clientX - offset.x,
      y: e.clientY - offset.y,
    });
  };

  const handleMouseUp = () => {
    setDragStart(null);
  };

  const handleMouseMove = (e) => {
    const canvas = canvasRef.current;

    if (dragStart) {
      setOffset({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y,
      });

      return;
    }

    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    setCursorCoord({x:Math.floor((mouseX-offset.x)/tileSize),y:Math.floor((mouseY-offset.y)/tileSize)});

    let hovered = null;

    for (const c of castles) {
      const px = c.x * tileSize + offset.x;
      const py = c.y * tileSize + offset.y;

      if (
        mouseX >= px &&
        mouseX <= px + tileSize &&
        mouseY >= py &&
        mouseY <= py + tileSize
      ) {
        hovered = c;
        break;
      }
    }

    setHoveredTitle(
      hovered
        ? `${hovered.username} – Headquarter (${hovered.x}:${hovered.y})`
        : ""
    );
  };

  const handleMapClick = e => {
    const rect = canvasRef.current.getBoundingClientRect();
    const x = (e.clientX-rect.left)*canvasRef.current.width/rect.width;
    const y = (e.clientY-rect.top)*canvasRef.current.height/rect.height;
    const alien = alienBases.find(b=>x>=b.x*tileSize+offset.x && x<(b.x+1)*tileSize+offset.x && y>=b.y*tileSize+offset.y && y<(b.y+1)*tileSize+offset.y);
    setSelectedAlien(alien || null);
  };
  const attackAlien = async () => {
    if (!selectedAlien) return;
    try {
      const base=(process.env.REACT_APP_API_URL || window.location.origin).replace(/\\/$/,"");
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

    if (!isNaN(x) && !isNaN(y) && x >= 1 && x <= 200 && y >= 1 && y <= 200) {
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
          cursor: "grab",
          backgroundColor: "#0e3f1f",
        }}
        onClick={handleMapClick}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
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
        {selectedAlien && <div>Alien base level {selectedAlien.level} ({selectedAlien.x}:{selectedAlien.y}) <button disabled={selectedAlien.level!==campaign.nextLevel} onClick={attackAlien}>Attack</button></div>}
        {mapError && <div role="alert">{mapError}</div>}
        <div>Coordinates: {cursorCoord ? `${cursorCoord.x}:${cursorCoord.y}` : "Move cursor over map"}</div>
        <input type="text" id="usernameInput" placeholder="Search Username" />
        <button onClick={searchByUsername}>Search</button>
        <br />
        <input type="number" id="xCoord" placeholder="X (1–200)" />
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
