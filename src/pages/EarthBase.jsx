import React, {useEffect, useRef, useState} from "react";
import {useLanguage} from "../language";
import "./EarthBase.css";

export const structureTypes = {
  Resources: ["Gold Synthesizer", "Iron Driller", "Solar Array", "Water Extractor"],
  Economy: ["Cargo Depot", "Defense Grid", "Upgrade Lab", "Bio-Lab"],
  Military: ["Training Center", "Combat Simulator", "Vehicle Bay", "Drone Factory"],
  Order: ["Order"]
};

const buildings = [
  ["Gold Synthesizer", "gold", 15, 30], ["Iron Driller", "iron", 32, 28],
  ["Solar Array", "solar", 67, 28], ["Water Extractor", "water", 84, 31],
  ["Cargo Depot", "cargo", 12, 52], ["Upgrade Lab", "upgrade", 31, 51],
  ["Bio-Lab", "bio", 69, 51], ["Training Center", "training", 88, 54],
  ["Combat Simulator", "combat", 15, 76], ["Vehicle Bay", "vehicle", 32, 74],
  ["Drone Factory", "drone", 68, 74], ["Order", "order", 85, 77],
];
const hospital = ["Field Hospital", "hospital", 50, 72];
const defense = ["Defense Grid", "defense", 50, 97];
const command = ["Command Center", "command", 50, 51];
const launch = ["Launch site", "launch", 93, 20];
const assetRoot = (process.env.PUBLIC_URL || "") + "/earth-base";
const initialCamera = {x: 0, y: 0, zoom: 1};
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

function savedSetting(key, valid, fallback) {
  const value = localStorage.getItem(key);
  return valid.includes(value) ? value : fallback;
}

function countdown(end, now) {
  const seconds = Math.max(0, Math.ceil((end - now) / 1000));
  return [Math.floor(seconds / 3600), Math.floor(seconds / 60) % 60, seconds % 60]
    .map(value => String(value).padStart(2, "0")).join(":");
}

function EarthMap({quality, children, t}) {
  const [camera, setCamera] = useState(initialCamera);
  const viewport = useRef(null);
  const pointers = useRef(new Map());
  const moved = useRef(false);

  function moveCamera(dx, dy, scale = 1, anchor) {
    const bounds = viewport.current.getBoundingClientRect();
    setCamera(previous => {
      const zoom = clamp(previous.zoom * scale, .85, 3.5);
      const ratio = zoom / previous.zoom;
      const ax = anchor ? anchor.x - bounds.left - bounds.width / 2 : 0;
      const ay = anchor ? anchor.y - bounds.top - bounds.height / 2 : 0;
      const scene = viewport.current?.firstElementChild;
      const limitX = Math.max(0, ((scene?.offsetWidth || bounds.width) * zoom - bounds.width) / 2);
      const limitY = Math.max(0, ((scene?.offsetHeight || bounds.height) * zoom - bounds.height) / 2);
      return {
        zoom,
        x: clamp(ax + (previous.x - ax) * ratio + dx, -limitX, limitX),
        y: clamp(ay + (previous.y - ay) * ratio + dy, -limitY, limitY),
      };
    });
  }

  useEffect(() => {
    const element = viewport.current;
    const wheel = event => {
      event.preventDefault();
      moveCamera(0, 0, Math.exp(-clamp(event.deltaY, -100, 100) * .003), {x: event.clientX, y: event.clientY});
    };
    element.addEventListener("wheel", wheel, {passive: false});
    return () => element.removeEventListener("wheel", wheel);
  }, []);

  function pointerDown(event) {
    if (event.button !== 0) return;
    if (pointers.current.size === 0) moved.current = false;
    pointers.current.set(event.pointerId, {x: event.clientX, y: event.clientY});
  }

  function pointerMove(event) {
    const previous = pointers.current.get(event.pointerId);
    if (!previous) return;
    const point = {x: event.clientX, y: event.clientY};
    const dx = point.x - previous.x;
    const dy = point.y - previous.y;
    const other = [...pointers.current].find(([id]) => id !== event.pointerId)?.[1];
    if (!other && !moved.current && Math.hypot(dx, dy) < 7) return;
    moved.current = true;
    if (!event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.setPointerCapture(event.pointerId);
    }
    pointers.current.set(event.pointerId, point);
    if (other) {
      const distance = Math.hypot(previous.x - other.x, previous.y - other.y);
      const nextDistance = Math.hypot(point.x - other.x, point.y - other.y);
      moveCamera(dx / 2, dy / 2, distance ? nextDistance / distance : 1,
        {x: (previous.x + other.x) / 2, y: (previous.y + other.y) / 2});
    } else {
      moveCamera(dx, dy);
    }
  }

  function releasePointer(event) {
    pointers.current.delete(event.pointerId);
  }

  return <div className="earth-map-wrap">
    <div className="earth-viewport" ref={viewport}
      onPointerDown={pointerDown} onPointerMove={pointerMove}
      onPointerUp={releasePointer} onPointerCancel={releasePointer}
      onPointerLeave={event => {
        if (!event.currentTarget.hasPointerCapture(event.pointerId)) releasePointer(event);
      }}
      onClickCapture={event => {
        if (moved.current && event.detail !== 0) {
          event.preventDefault();
          event.stopPropagation();
        }
      }}>
      <div className="earth-scene" data-quality={quality} data-overview={camera.zoom < 1}
        data-mobile-overview={camera.zoom < 1.18}
        style={{transform: `translate(-50%, -50%) translate(${camera.x}px, ${camera.y}px) scale(${camera.zoom})`}}>
        <picture>
          <source media={quality === "low" ? "all" : "(max-width: 640px)"} srcSet={assetRoot + "/terrain-small.webp"} />
          <img className="earth-terrain" src={assetRoot + "/terrain.webp"} alt="" draggable="false" />
        </picture>
        {children}
      </div>
    </div>
    <div className="earth-map-controls">
      <button type="button" aria-label={t("Zoom in", "Приближи")} onClick={() => moveCamera(0, 0, 1.35)}>+</button>
      <button type="button" aria-label={t("Zoom out", "Отдалечи")} onClick={() => moveCamera(0, 0, 1 / 1.35)}>−</button>
      <button type="button" onClick={() => setCamera(initialCamera)}>{t("Reset view", "Начален изглед")}</button>
    </div>
  </div>;
}

export default function EarthBase({progress, hospitalEntries = [], onBuilding, onHospital, onHeadquarters}) {
  const {t, label} = useLanguage();
  const [view, setView] = useState(() => savedSetting("earth-base-view", ["map", "compact"], "map"));
  const [quality, setQuality] = useState(() => savedSetting("earth-base-quality", ["low", "medium", "high"], "medium"));
  const [now, setNow] = useState(Date.now);
  const construction = progress?.buildingJob;
  const healing = hospitalEntries.find(entry => entry.status === "healing");
  const hasTimers = Boolean(construction?.endsAt || healing?.heals_at);

  useEffect(() => {
    if (!hasTimers) return;
    setNow(Date.now());
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [hasTimers]);

  function buildingName(name) {
    if (name === defense[0]) return t("Defensive Network", "Отбранителна мрежа");
    if (name === hospital[0]) return t("Field Hospital", "Полева болница");
    if (name === command[0]) return t("Command Center", "Команден център");
    return label(name);
  }

  const level = name => Number(progress.structures?.[name] || 0);
  const select = name => () => onBuilding(name);
  const status = name => {
    if (construction?.name === name) {
      return t("Under construction", "В строеж") + (construction.endsAt ? " · " + countdown(construction.endsAt, now) : "");
    }
    if (name === "Training Center" && Object.values(progress.trainingQueues || {}).some(queue => queue.length)) {
      return t("Training", "Обучение");
    }
    if (name === "Upgrade Lab" && progress.upgradeJobs?.some(job => job?.endsAt)) {
      return t("Upgrading troops", "Подобряване на войски");
    }
    return "";
  };
  const healEnd = healing ? Number(healing.heals_at) : 0;
  const healingStatus = healing
    ? t("Treatment in progress", "Лечението продължава") + (healEnd ? " · " + countdown(healEnd, now) : "")
    : "";

  function renderBuilding([name, id, x, y], buildingLevel, activity, action) {
    if (view === "compact" && id === "launch") return null;
    const blueprint = buildingLevel === 0;
    const caption = buildingName(name);
    const levelText = buildingLevel === null ? "" : t("Level", "Ниво") + " " + buildingLevel;
    const className = "earth-site earth-site-" + id;
    const sprite = view === "map" && <img className="earth-sprite"
      src={assetRoot + "/" + id + (blueprint ? "-blueprint" : "") + ".webp"} alt="" draggable="false" />;
    const style = {"--site-x": x + "%", "--site-y": y + "%", "--site-depth": y};
    if (id === "launch") return <div key={id} className={className} aria-hidden="true" style={style}>{sprite}</div>;
    return <button key={id} type="button" className={className} style={style}
      data-blueprint={blueprint} data-active={Boolean(activity)}
      data-activity={construction?.name === name ? "construction" : id}
      aria-label={[caption, levelText, activity].filter(Boolean).join(" · ")} onClick={action}>
      {sprite}
      <span className="earth-caption"><strong>{caption}</strong>
        {levelText && <span>{levelText}</span>}
        {activity && <span className="earth-activity">{activity}</span>}
      </span>
    </button>;
  }

  const sites = progress && <>
    {renderBuilding(launch, null, "", null)}
    {renderBuilding(command, null, "", onHeadquarters)}
    <div className="earth-defense-site" data-tier={Math.min(5, Math.ceil(level(defense[0]) / 6))}>
      {renderBuilding(defense, level(defense[0]), status(defense[0]), select(defense[0]))}
    </div>
    <div className="earth-compact-grid" aria-label={t("Base buildings", "Сгради в базата")}>
      {buildings.map(building => renderBuilding(building, level(building[0]), status(building[0]), select(building[0])))}
    </div>
    {renderBuilding(hospital, null, healingStatus, onHospital)}
  </>;

  return <main className="earth-base">
    <header>
      <div><h1>{t("Earth Base", "База на Земята")}</h1>
        <span>{t("Mars Expedition · Preparations", "Експедиция до Марс · Подготовка")}</span></div>
      {progress && <div className="earth-options">
        <button type="button" onClick={() => {
          const next = view === "map" ? "compact" : "map";
          setView(next);
          localStorage.setItem("earth-base-view", next);
        }}>{view === "map" ? t("Compact view", "Компактен изглед") : t("Isometric view", "Изометричен изглед")}</button>
        {view === "map" && <select aria-label={t("Graphics quality", "Качество на графиката")} value={quality} onChange={event => {
          setQuality(event.target.value);
          localStorage.setItem("earth-base-quality", event.target.value);
        }}>
          <option value="low">{t("Low", "Ниско")}</option>
          <option value="medium">{t("Medium", "Средно")}</option>
          <option value="high">{t("High", "Високо")}</option>
        </select>}
      </div>}
    </header>
    {!progress ? <p role="status">{t("Loading your base…", "Зареждане на твоята база…")}</p> :
      view === "map" ? <EarthMap quality={quality} t={t}>{sites}</EarthMap> :
        <div className="earth-compact">{sites}</div>}
  </main>;
}
