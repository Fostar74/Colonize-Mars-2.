import React, { useState, useEffect } from "react";
import "./Quests.css";
import goldIcon from "../images/gold.png";
import ironIcon from "../images/iron.png";
import waterIcon from "../images/water.png";
import solarIcon from "../images/solar.png";

const Quests = () => {
  const [activeTab, setActiveTab] = useState("main");
  const [structures, setStructures] = useState(() => { try { return JSON.parse(sessionStorage.getItem("structures") || "{}"); } catch { return {}; } });
  const [claimed, setClaimed] = useState(false);
  const [claimError, setClaimError] = useState("");
  const [claimBusy, setClaimBusy] = useState(false);
  const base = (process.env.REACT_APP_API_URL || (window.location.hostname === "localhost" ? "http://localhost:3001" : window.location.origin)).replace(/\/$/, "");
  const userId = sessionStorage.getItem("userId");
  const headers = () => ({ "Content-Type": "application/json", Authorization: "Bearer " + sessionStorage.getItem("authToken") });
  const refresh = async () => {
    if (!userId) return;
    try {
      const response = await fetch(base + "/get-progress/" + encodeURIComponent(userId), { headers: headers() });
      if (!response.ok) return;
      const data = await response.json();
      if (data.gameProgress) {
        setStructures(data.gameProgress.structures || {});
        setClaimed(!!data.gameProgress.questClaimed);
      }
    } catch (_) {}
  };
  useEffect(() => {
    refresh();
    const timer = setInterval(refresh, 5000);
    window.addEventListener("game-progress-updated", refresh);
    return () => { clearInterval(timer); window.removeEventListener("game-progress-updated", refresh); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);
  const claim = async () => {
    setClaimBusy(true); setClaimError("");
    try {
      const response = await fetch(base + "/claim-first-quest", { method:"POST", headers:headers(), body:JSON.stringify({userId}) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Cannot claim reward");
      setClaimed(true);
      sessionStorage.setItem("resources", JSON.stringify(data.resources));
      window.dispatchEvent(new Event("game-progress-updated"));
    } catch (e) { setClaimError(e.message); }
    finally { setClaimBusy(false); }
  };
  const productionBuildings = ["Gold Synthesizer", "Iron Driller", "Water Extractor", "Solar Array"];
  const completedMines = productionBuildings.filter(name => Number(structures[name]?.level ?? structures[name] ?? 0) >= 3).length;
  const [cyberKnightLevel, setCyberKnightLevel] = useState(1);
  const [gatheredMine, setGatheredMine] = useState(false);

  const handleMainQuest = () => { window.dispatchEvent(new CustomEvent("open-base-panel")); };
  const handleLevelUpKnight = () => { setCyberKnightLevel(1); alert("Cyber Knight leveling is not available yet."); };
  const handleGatherMine = () => { setGatheredMine(false); alert("Mine gathering is not available yet."); };

  const renderMainQuests = () => (
    <div className="quest-section">
      <h3>Main Quest</h3>
      <div className="quest-box">
        <div className="quest-title">Upgrade all production buildings to level 3</div>
        <div className="quest-progress">{claimed ? "Completed — reward claimed" : completedMines === 4 ? "Completed — collect your reward" : `${completedMines} / 4`}</div>
        <div className="quest-rewards">
          <span>500</span><img src={goldIcon} alt="Gold" />
          <span>500</span><img src={ironIcon} alt="Iron" />
          <span>500</span><img src={waterIcon} alt="Water" />
          <span>500</span><img src={solarIcon} alt="Solar" />
        </div>
        {claimError && <p role="alert">{claimError}</p>}\n        {claimed ? <button disabled>Reward claimed</button> : completedMines === 4 ? <button disabled={claimBusy} onClick={claim}>Claim 500 of each resource</button> : <button onClick={handleMainQuest}>Show Me</button>}
      </div>
    </div>
  );

  const renderSideQuests = () => (
    <div className="quest-section">
      <h3>Side Quests</h3>

      <div className="quest-box">
        <div className="quest-title">Level up your Cyber Knight to level 2</div>
        <div className="quest-progress">{cyberKnightLevel >= 2 ? "2 / 2" : "1 / 2"}</div>
        <div className="quest-rewards">
          Helmet x1
          Gloves x25
          Armor x25
          Boots x25
        </div>
        <button onClick={handleLevelUpKnight}>Show Me</button>
      </div>

      <div className="quest-box">
        <div className="quest-title">Gather from 1 independent map mine</div>
        <div className="quest-progress">{gatheredMine ? "1 / 1" : "0 / 1"}</div>
        <div className="quest-rewards">
          Boost x1 (2h)
          Forge Token x50
        </div>
        <button onClick={handleGatherMine}>Show Me</button>
      </div>
    </div>
  );

  const renderActivityRewards = () => (
    <div className="quest-section">
      <h3>Activity Rewards</h3>
      <div className="wheel-placeholder">
        <p>🎯 Free spin every 2 hours or spend tokens to spin again.</p>
        <button disabled>Spin Wheel</button>
        <div className="tokens-count">Tokens: 0</div>
      </div>
    </div>
  );

  const renderLoginRewards = () => (
    <div className="quest-section">
      <h3>Login Rewards</h3>
      <div className="login-calendar">
        {[...Array(30)].map((_, i) => (
          <div key={i} className="login-day">
            Day {i + 1}
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div className="quests-container">
      <h2>Quests</h2>
      <div className="quest-tabs">
        <button onClick={() => setActiveTab("main")}>Main Quests</button>
        <button onClick={() => setActiveTab("side")}>Side Quests</button>
        <button onClick={() => setActiveTab("activity")}>Activity Rewards</button>
        <button onClick={() => setActiveTab("login")}>Login Rewards</button>
      </div>

      {activeTab === "main" && renderMainQuests()}
      {activeTab === "side" && renderSideQuests()}
      {activeTab === "activity" && renderActivityRewards()}
      {activeTab === "login" && renderLoginRewards()}
    </div>
  );
};

export default Quests;
