import React, { useState, useEffect } from "react";
import "./Quests.css";
import ActivityWheel from "./ActivityWheel";
import goldIcon from "../images/gold.png";
import ironIcon from "../images/iron.png";
import waterIcon from "../images/water.png";
import solarIcon from "../images/solar.png";

const Quests = () => {
  const [activeTab, setActiveTab] = useState("main");
  const [loginRewards, setLoginRewards] = useState(null);
  const [loginBusy, setLoginBusy] = useState(false);
  const [loginMessage, setLoginMessage] = useState("");
  const [tutorial, setTutorial] = useState([]);
  const [structures, setStructures] = useState(() => { try { return JSON.parse(sessionStorage.getItem("structures") || "{}"); } catch { return {}; } });
  const [claimed, setClaimed] = useState(false);
  const [secondClaimed, setSecondClaimed] = useState(false);
  const [armyCount, setArmyCount] = useState(0);
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
      const loginResponse = await fetch(base + "/daily-login/" + encodeURIComponent(userId), {headers:headers()});
      if(loginResponse.ok) setLoginRewards(await loginResponse.json());
      const tutorialResponse = await fetch(base + "/tutorial/" + encodeURIComponent(userId), {headers:headers()});
      if (tutorialResponse.ok) { const t=await tutorialResponse.json(); setTutorial(t.missions || []); }
      if (data.gameProgress) {
        setStructures(data.gameProgress.structures || {});
        setClaimed(!!data.gameProgress.questClaimed);
        setSecondClaimed(!!data.gameProgress.quest2Claimed);
        setArmyCount(Object.values(data.gameProgress.army || {}).reduce((a,b)=>a+Number(b||0),0));
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
  const claimSecond = async () => {
    setClaimBusy(true); setClaimError("");
    try {
      const response = await fetch(base + "/claim-second-quest", { method:"POST", headers:headers(), body:JSON.stringify({userId}) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Cannot claim reward");
      setSecondClaimed(true);
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

  const claimTutorial = async (missionId) => {
    setClaimBusy(true); setClaimError("");
    try {
      const response = await fetch(base + "/tutorial/claim", {
        method:"POST",headers:headers(),body:JSON.stringify({userId,missionId})
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Cannot claim reward");
      // Rewards now go to Inventory; leave the base resource balance unchanged.
      window.dispatchEvent(new Event("game-progress-updated"));
      await refresh();
    } catch(error) { setClaimError(error.message); }
    finally { setClaimBusy(false); }
  };

  const renderMainQuests = () => (
    <div className="quest-section">
      <h3>Colonize Mars — Tutorial Missions ({tutorial.filter(m=>m.claimed).length}/{tutorial.length})</h3>
      {claimError && <p role="alert">{claimError}</p>}
      {tutorial.map(m => (
        <div className="quest-box" key={m.id} style={{opacity:m.unlocked?1:0.55}}>
          <div className="quest-title">{m.id}. {m.title}</div>
          <p>{m.description}</p>
          <div className="quest-progress">{m.claimed ? "Completed — reward claimed" :
            !m.unlocked ? "Locked — complete previous mission" :
            !m.available ? "Feature under development" :
            m.completed ? "Completed — collect your reward" :
            m.progress + " / " + m.target}</div>
          {m.kind==="mines" && m.available && !m.claimed && <div style={{fontSize:13,marginTop:8,lineHeight:1.7}}>
            {productionBuildings.map(name => {const level=Number(structures[name]?.level ?? structures[name] ?? 0);return <div key={name}>{level>=m.target?"✓ ":"○ "}{name}: Level {level} / {m.target}</div>;})}
          </div>}
          <div className="quest-rewards">Reward: {m.reward.toLocaleString()} each — Gold, Iron, Water, Solar + 100 Wheel Tokens</div>
          {m.claimed ? <button disabled>Reward claimed</button> :
            !m.unlocked || !m.available ? <button disabled>{m.unlocked?"Coming soon":"Locked"}</button> :
            m.completed ? <button disabled={claimBusy} onClick={()=>claimTutorial(m.id)}>Claim reward</button> :
            <button onClick={handleMainQuest}>Show Me</button>}
        </div>
      ))}
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

  const renderActivityRewards = () => <ActivityWheel />;

  const claimLoginReward = async () => {
    setLoginBusy(true); setLoginMessage("");
    try {
      const response=await fetch(base+"/daily-login/claim",{method:"POST",headers:headers(),body:JSON.stringify({userId})});
      const data=await response.json();
      if(!response.ok) throw new Error(data.message||"Could not claim reward");
      setLoginMessage("Day "+data.day+" reward collected!");
      window.dispatchEvent(new Event("game-progress-updated"));
      await refresh();
    } catch(error) {setLoginMessage(error.message);}
    finally {setLoginBusy(false);}
  };
  const renderLoginRewards = () => (
    <div className="quest-section">
      <h3>30-Day Login Rewards</h3>
      <p>Collect one reward per UTC calendar day. Each player has their own Cyber Knight and equipment inventory.</p>
      {loginMessage && <p role="status">{loginMessage}</p>}
      {!loginRewards ? <p>Loading daily rewards...</p> : <>
        <p>{loginRewards.claimedToday?"Today's reward collected. Come back tomorrow!":loginRewards.nextDay<=30?"Day "+loginRewards.nextDay+" is ready to claim.":"All 30 rewards collected!"}</p>
        <div className="login-calendar">
          {loginRewards.days.map(d=>(
            <div key={d.day} className="login-day" style={{opacity:d.claimed?0.6:1,padding:10}}>
              <strong>Day {d.day}</strong>
              <div>{d.reward.type==="resources"?d.reward.amount+" each: Gold, Iron, Water, Solar":d.reward.type==="army"?d.reward.amount+" "+d.reward.label:d.reward.label+" (Rare)"}</div>
              <div>{d.claimed?"✓ Collected":d.day===loginRewards.nextDay&&!loginRewards.claimedToday?"Available":"Locked"}</div>
              {d.day===loginRewards.nextDay&&!loginRewards.claimedToday&&<button disabled={loginBusy} onClick={claimLoginReward}>{loginBusy?"Claiming...":"Claim reward"}</button>}
            </div>
          ))}
        </div>
      </>}
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
