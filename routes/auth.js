const crypto = require("crypto");
const express = require("express");
const router = express.Router();
const bcrypt = require("bcrypt");
const DatabaseManager = require("../database/database");

const db = new DatabaseManager();
const sessions = new Map();
const SESSION_MS = 24 * 60 * 60 * 1000;
function requireSession(req, res, next) {
  const match = /^Bearer ([a-f0-9]{64})$/.exec(req.get("authorization") || "");
  const session = match && sessions.get(match[1]);
  if (!session || session.expires < Date.now()) return res.status(401).json({ message: "Please log in again." });
  const requestedId = req.params.userId ?? req.body?.userId;
  if (String(requestedId) !== String(session.userId)) return res.status(403).json({ message: "Access denied." });
  next();
}


router.post("/register", async (req, res) => {
  const { email, password, username } = req.body;

  if (typeof email !== "string" || typeof password !== "string" ||
      typeof username !== "string" || !email.trim() || !username.trim() ||
      password.length < 8 || username.length > 32 || email.length > 254) {
    return res.status(400).json({ message: "Enter a valid email and username, and use a password of at least 8 characters." });
  }

  try {
    const existingUserByEmail = db.findUserByEmail(email);
    if (existingUserByEmail) {
      return res.status(409).json({ message: "Email is already registered." });
    }

    const existingUserByUsername = db.findUserByUsername(username);
    if (existingUserByUsername) {
      return res.status(409).json({ message: "Username is already taken." });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const result = db.createUser(email.trim().toLowerCase(), username.trim(), hashedPassword);

    res.status(201).json({
      message: "Registration successful!",
      userId: result.userId,
      position: result.position,
    });
  } catch (error) {
    console.error("Registration error:", error);
    if (error.code === "SQLITE_CONSTRAINT_UNIQUE") {
      return res.status(409).json({ message: "Email or username already exists." });
    }
    res.status(500).json({ message: "Internal server error during registration." });
  }
});

// LOGIN
router.post("/login", async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ message: "Username and password required." });
  }

  try {
    const user = db.findUserByUsername(username);

    if (!user) {
      return res.status(401).json({ message: "Invalid username or password." });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      return res.status(401).json({ message: "Invalid username or password." });
    }

    db.ensureBase(user.id, user.username);
    const gameProgress = db.getGameProgress(user.id);
    const gameStats = db.getGameStats(user.id);

    const token = crypto.randomBytes(32).toString("hex");
    sessions.set(token, { userId: user.id, expires: Date.now() + SESSION_MS });
    res.status(200).json({
      token,
      message: "Login successful!",
      username: user.username,
      userId: user.id,
      gameProgress: gameProgress,
      gameStats: gameStats,
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ message: "Internal server error during login." });
  }
});

router.get("/map/bases", requireSessionForMap, (req, res) => {
  try {
    res.json({ bases: db.getPublicBases() });
  } catch (error) {
    console.error("Map bases error:", error);
    res.status(500).json({ message: "Could not load player bases." });
  }
});
function requireSessionForMap(req, res, next) {
  const match = /^Bearer ([a-f0-9]{64})$/.exec(req.get("authorization") || "");
  const session = match && sessions.get(match[1]);
  if (!session || session.expires < Date.now()) return res.status(401).json({ message: "Please log in again." });
  next();
}

router.post("/upgrade-building", requireSession, (req, res) => {
  try {
    const result = db.upgradeBuilding(req.body.userId, req.body.name);
    if (result.error) return res.status(400).json({ message: result.error });
    return res.json(result);
  } catch (error) {
    console.error("Building upgrade error:", error);
    return res.status(500).json({ message: "Could not upgrade building." });
  }
});


router.post("/train-units", requireSession, (req, res) => {
  try {
    const result = db.trainUnits(req.body.userId, req.body.unit, req.body.quantity);
    if (result.error) return res.status(400).json({ message: result.error });
    res.json(result);
  } catch (error) { console.error("Train units:", error); res.status(500).json({ message: "Training failed." }); }
});

router.post("/upgrade-unit", requireSession, (req, res) => {
  try {
    const result = db.upgradeUnit(req.body.userId, req.body.unit, req.body.stat);
    if (result.error) return res.status(400).json({ message: result.error });
    res.json(result);
  } catch (error) { console.error("Upgrade unit:", error); res.status(500).json({ message: "Upgrade failed." }); }
});

router.get("/inventory/:userId",requireSession,(req,res)=>{
  try {res.json(db.getInventory(Number(req.params.userId)));} catch(e){console.error(e);res.status(500).json({message:"Inventory unavailable."});}
});
router.post("/inventory/withdraw",requireSession,(req,res)=>{
  try {
    const result=db.withdrawInventory(Number(req.body.userId),req.body.kind,req.body.name,Number(req.body.amount));
    if(result.error)return res.status(400).json({message:result.error});
    res.json(result);
  } catch(e){console.error(e);res.status(500).json({message:"Withdrawal unavailable."});}
});

router.get("/alien-campaign/:userId",requireSession,(req,res)=>{
  try { res.json(db.getAlienCampaign(Number(req.params.userId))); }
  catch(error) { console.error(error);res.status(500).json({message:"Campaign unavailable."}); }
});
router.post("/alien-campaign/attack",requireSession,(req,res)=>{
  try {
    const result=db.attackAlienBase(Number(req.body.userId),Number(req.body.level));
    if(result.error) return res.status(400).json({message:result.error});
    res.json(result);
  } catch(error) {console.error(error);res.status(500).json({message:"Attack unavailable."});}
});

router.get("/tutorial/:userId", requireSession, (req,res) => {
  try {
    const data = db.getTutorial(Number(req.params.userId));
    if (!data) return res.status(404).json({message:"Player not found."});
    res.json(data);
  } catch(error) { console.error("Tutorial:",error); res.status(500).json({message:"Tutorial unavailable."}); }
});
router.post("/tutorial/claim", requireSession, (req,res) => {
  try {
    const result = db.claimTutorialMission(Number(req.body.userId),Number(req.body.missionId));
    if (result.error) return res.status(400).json({message:result.error});
    res.json(result);
  } catch(error) { console.error("Tutorial claim:",error); res.status(500).json({message:"Reward unavailable."}); }
});

router.get("/daily-login/:userId",requireSession,(req,res)=>{
  try {
    const result=db.getDailyLogin(Number(req.params.userId));
    if (!result) return res.status(404).json({message:"Player not found."});
    res.json(result);
  } catch(error) {console.error("Daily login:",error);res.status(500).json({message:"Login rewards unavailable."});}
});
router.post("/daily-login/claim",requireSession,(req,res)=>{
  try {
    const result=db.claimDailyLogin(Number(req.body.userId));
    if(result.error) return res.status(400).json({message:result.error});
    res.json(result);
  } catch(error) {console.error("Claim daily login:",error);res.status(500).json({message:"Unable to claim login reward."});}
});

router.post("/claim-second-quest", requireSession, (req, res) => {
  try {
    const result = db.claimSecondQuest(req.body.userId);
    if (result.error) return res.status(400).json({ message: result.error });
    res.json(result);
  } catch (error) { console.error("Claim second quest:", error); res.status(500).json({ message: "Claim failed." }); }
});

router.post("/claim-first-quest", requireSession, (req, res) => {
  try {
    const result = db.claimFirstQuest(req.body.userId);
    if (result.error) return res.status(400).json({ message: result.error });
    res.json(result);
  } catch (error) { console.error("Claim quest:", error); res.status(500).json({ message: "Claim failed." }); }
});

router.post("/save-progress", requireSession, async (req, res) => {
  const { userId, castleData, resources, structures } = req.body;

  if (!userId || !castleData || !resources || !structures) {
    return res.status(400).json({ message: "All game data is required." });
  }

  try {
    const user = db.findUserById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }

    const assigned = db.ensureBase(user.id, user.username);
    // Never trust client-provided map coordinates.
    const current = db.getGameProgress(userId);
    db.saveGameProgress(userId, assigned, current.resources, current.structures);

    res.status(200).json({ message: "Game progress saved successfully!" });
  } catch (error) {
    console.error("Save progress error:", error);
    res.status(500).json({ message: "Internal server error while saving progress." });
  }
});

router.get("/get-progress/:userId", requireSession, async (req, res) => {
  const { userId } = req.params;

  try {
    const user = db.findUserById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }

    const gameProgress = db.getGameProgress(userId);
    const gameStats = db.getGameStats(userId);

    res.status(200).json({
      gameProgress: gameProgress,
      gameStats: gameStats,
    });
  } catch (error) {
    console.error("Get progress error:", error);
    res.status(500).json({ message: "Internal server error while getting progress." });
  }
});

router.post("/update-stats", requireSession, async (req, res) => {
  const { userId, playTime, resourcesMined, structuresBuilt } = req.body;

  if (!userId) {
    return res.status(400).json({ message: "User ID is required." });
  }

  try {
    const user = db.findUserById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }

    db.updateGameStats(userId, playTime || 0, resourcesMined || 0, structuresBuilt || 0);

    res.status(200).json({ message: "Game stats updated successfully!" });
  } catch (error) {
    console.error("Update stats error:", error);
    res.status(500).json({ message: "Internal server error while updating stats." });
  }
});

router.post("/save-equipment", requireSession, async (req, res) => {
  const { userId, equippedItems, gearInventory, craftingPoints } = req.body;

  if (!userId) {
    return res.status(400).json({ message: "User ID is required." });
  }

  try {
    const user = db.findUserById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }

    db.saveUserEquipment(userId, equippedItems || {}, gearInventory || [], craftingPoints || {});

    res.status(200).json({ message: "Equipment saved successfully!" });
  } catch (error) {
    console.error("Save equipment error:", error);
    res.status(500).json({ message: "Internal server error while saving equipment." });
  }
});

router.get("/get-equipment/:userId", requireSession, async (req, res) => {
  const { userId } = req.params;

  try {
    const user = db.findUserById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }

    const equipment = db.getUserEquipment(userId);

    res.status(200).json({
      equipment: equipment,
    });
  } catch (error) {
    console.error("Get equipment error:", error);
    res.status(500).json({ message: "Internal server error while getting equipment." });
  }
});

router.post("/update-equipment", requireSession, async (req, res) => {
  const { userId, equippedItems, gearInventory, craftingPoints } = req.body;

  if (!userId) {
    return res.status(400).json({ message: "User ID is required." });
  }

  try {
    const user = db.findUserById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }

    db.updateUserEquipment(userId, equippedItems || {}, gearInventory || [], craftingPoints || {});

    res.status(200).json({ message: "Equipment updated successfully!" });
  } catch (error) {
    console.error("Update equipment error:", error);
    res.status(500).json({ message: "Internal server error while updating equipment." });
  }
});

module.exports = router;
