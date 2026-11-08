
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
  const [hqIcon, setHqIcon] = useState(null);
  const [hoveredTitle, setHoveredTitle] = useState("");
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

  const alienBases = Array.from({ length: 25 }, (_, i) => ({
    x: (i * 4 + 10) % mapSize,
    y: (i * 7 + 15) % mapSize,
    level: i + 1,
  }));

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

      setCastles([savedCastle]);

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
