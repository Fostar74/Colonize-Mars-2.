import React, { useState } from "react";
import "./Quests.css";

const Quests = () => {
  const [activeTab, setActiveTab] = useState("main");
  const [mainQuestCompleted, setMainQuestCompleted] = useState(false);
  const [cyberKnightLevel, setCyberKnightLevel] = useState(1);
  const [gatheredMine, setGatheredMine] = useState(false);

  const handleMainQuest = () => setMainQuestCompleted(true);
  const handleLevelUpKnight = () => setCyberKnightLevel(2);
  const handleGatherMine = () => setGatheredMine(true);

  const renderMainQuests = () => (
    <div className="quest-section">
      <h3>Main Quest</h3>
      <div className="quest-box">
        <div className="quest-title">Upgrade all production buildings to level 3</div>
        <div className="quest-progress">{mainQuestCompleted ? "4 / 4" : "0 / 4"}</div>
        <div className="quest-rewards">
          <span>500</span><img src="/images/gold.png" alt="Gold" />
          <span>500</span><img src="/images/iron.png" alt="Iron" />
          <span>500</span><img src="/images/water.png" alt="Water" />
          <span>500</span><img src="/images/solar.png" alt="Solar" />
        </div>
        <button onClick={handleMainQuest}>Show Me</button>
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
          <img src="/images/helmet-icon.png" alt="Helmet" /> x1
          <img src="/images/gloves-icon.png" alt="Gloves" /> x25
          <img src="/images/armor-icon.png" alt="Armor" /> x25
          <img src="/images/boots-icon.png" alt="Boots" /> x25
        </div>
        <button onClick={handleLevelUpKnight}>Show Me</button>
      </div>

      <div className="quest-box">
        <div className="quest-title">Gather from 1 independent map mine</div>
        <div className="quest-progress">{gatheredMine ? "1 / 1" : "0 / 1"}</div>
        <div className="quest-rewards">
          <img src="/images/boost-icon.png" alt="Boost" /> x1 (2h)
          <img src="/images/forge-token-icon.png" alt="Forge Token" /> x50
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
