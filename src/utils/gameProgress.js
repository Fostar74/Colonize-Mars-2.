const API_BASE = (process.env.REACT_APP_API_URL || "http://localhost:3001").replace(/\/$/, "");

class GameProgressManager {
  constructor() {
    this.userId = null;
    this.username = null;
  }

  setUserInfo(userId, username) {
    this.userId = userId;
    this.username = username;
  }

  async saveProgress(castleData, resources, structures) {
    if (!this.userId) {
      console.error("User ID not found");
      return false;
    }

    try {
      const response = await fetch(`${API_BASE}/save-progress`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userId: this.userId,
          castleData: castleData,
          resources: resources,
          structures: structures,
        }),
      });

      if (response.ok) {
        console.log("Game progress saved successfully");
        return true;
      } else {
        console.error("Failed to save game progress");
        return false;
      }
    } catch (error) {
      console.error("Error saving game progress:", error);
      return false;
    }
  }

  async loadProgress() {
    if (!this.userId) {
      console.error("User ID not found");
      return null;
    }

    try {
      const response = await fetch(`${API_BASE}/get-progress/${this.userId}`);

      if (response.ok) {
        const data = await response.json();
        return data;
      } else {
        console.error("Failed to load game progress");
        return null;
      }
    } catch (error) {
      console.error("Error loading game progress:", error);
      return null;
    }
  }

  async updateStats(playTime, resourcesMined, structuresBuilt) {
    if (!this.userId) {
      console.error("User ID not found");
      return false;
    }

    try {
      const response = await fetch(`${API_BASE}/update-stats`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userId: this.userId,
          playTime: playTime,
          resourcesMined: resourcesMined,
          structuresBuilt: structuresBuilt,
        }),
      });

      if (response.ok) {
        console.log("Game stats updated successfully");
        return true;
      } else {
        console.error("Failed to update game stats");
        return false;
      }
    } catch (error) {
      console.error("Error updating game stats:", error);
      return false;
    }
  }

  async saveEquipment(equippedItems, gearInventory, craftingPoints) {
    if (!this.userId) {
      console.error("User ID not found");
      return false;
    }

    try {
      const response = await fetch(`${API_BASE}/save-equipment`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userId: this.userId,
          equippedItems: equippedItems,
          gearInventory: gearInventory,
          craftingPoints: craftingPoints,
        }),
      });

      if (response.ok) {
        console.log("Equipment saved successfully");
        return true;
      } else {
        console.error("Failed to save equipment");
        return false;
      }
    } catch (error) {
      console.error("Error saving equipment:", error);
      return false;
    }
  }

  async loadEquipment() {
    if (!this.userId) {
      console.error("User ID not found");
      return null;
    }

    try {
      const response = await fetch(`${API_BASE}/get-equipment/${this.userId}`);

      if (response.ok) {
        const data = await response.json();
        return data.equipment;
      } else {
        console.error("Failed to load equipment");
        return null;
      }
    } catch (error) {
      console.error("Error loading equipment:", error);
      return null;
    }
  }

  async updateEquipment(equippedItems, gearInventory, craftingPoints) {
    if (!this.userId) {
      console.error("User ID not found");
      return false;
    }

    try {
      const response = await fetch(`${API_BASE}/update-equipment`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userId: this.userId,
          equippedItems: equippedItems,
          gearInventory: gearInventory,
          craftingPoints: craftingPoints,
        }),
      });

      if (response.ok) {
        console.log("Equipment updated successfully");
        return true;
      } else {
        console.error("Failed to update equipment");
        return false;
      }
    } catch (error) {
      console.error("Error updating equipment:", error);
      return false;
    }
  }

  async checkServerConnection() {
    try {
      const response = await fetch(`${API_BASE}/`);
      return response.ok;
    } catch (error) {
      return false;
    }
  }

  getUserInfo() {
    return {
      userId: this.userId,
      username: this.username,
    };
  }

  isLoggedIn() {
    return !!(this.userId && this.username);
  }
}

export default GameProgressManager;
