const crypto = require("crypto");
const express = require("express");
const router = express.Router();
const bcrypt = require("bcrypt");
const DatabaseManager = require("../database/database");

const db = new DatabaseManager();
const sessions = new Map();
const SESSION_MS = 24 * 60 * 60 * 1000;
let settlingEndedEvents=false;
const eventSettlementTimer=setInterval(()=>{
  if(settlingEndedEvents)return;
  settlingEndedEvents=true;
  try{db.settleEndedEvents();}catch(error){console.error("Event hospital recovery:",error);}
  finally{settlingEndedEvents=false;}
},15000);
if(typeof eventSettlementTimer.unref==="function")eventSettlementTimer.unref();
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
    const result = db.upgradeUnit(Number(req.body.userId), req.body.unit, req.body.stat, Number(req.body.slot));
    if (result.error) return res.status(400).json({ message: result.error });
    res.json(result);
  } catch (error) { console.error("Upgrade unit:", error); res.status(500).json({ message: "Upgrade failed." }); }
});

router.post("/barracks/mobilize",requireSession,(req,res)=>{
  try{
    const result=db.mobilizeBarracks(Number(req.body.userId),req.body.unit,Number(req.body.amount));
    if(result.error)return res.status(400).json({message:result.error});
    res.json(result);
  }catch(e){console.error(e);res.status(500).json({message:"Mobilization unavailable."});}
});

router.get("/player-talents/:userId",requireSession,(req,res)=>{
 try{res.json(db.playerTalents(Number(req.params.userId)));}catch(e){console.error(e);res.status(500).json({message:"Protocols unavailable."});}
});
router.post("/player-talents/upgrade",requireSession,(req,res)=>{
 try{const result=db.upgradePlayerTalent(Number(req.body.userId),req.body.name);if(result.error)return res.status(400).json({message:result.error});res.json(result);}catch(e){console.error(e);res.status(500).json({message:"Protocol upgrade failed."});}
});
router.get("/wheel/:userId",requireSession,(req,res)=>{
  try{res.json(db.getWheel(Number(req.params.userId)));}catch(e){console.error(e);res.status(500).json({message:"Wheel unavailable."});}
});
router.post("/wheel/spin",requireSession,(req,res)=>{
  try{
    if(typeof req.body.paid!=="boolean")return res.status(400).json({message:"Choose free or token spin."});
    const result=db.spinWheel(Number(req.body.userId),req.body.paid);
    if(result.error)return res.status(400).json({message:result.error});
    res.json(result);
  }catch(e){console.error(e);res.status(500).json({message:"Spin unavailable."});}
});
router.route("/messages/:scope/:userId")
  .get(requireSession,(req,res)=>{
    const result=db.listMessages(Number(req.params.userId),req.params.scope);
    res.status(result.error?400:200).json(result.error?{message:result.error}:result);
  })
  .post(requireSession,(req,res)=>{
    const result=db.sendMessage(Number(req.params.userId),req.params.scope,req.body.recipient,req.body.body);
    res.status(result.error?400:201).json(result.error?{message:result.error}:result);
  });

router.get("/rankings/:userId",requireSession,(req,res)=>{try{res.json(db.rankings(Number(req.params.userId)));}catch(e){console.error("Rankings:",e);res.status(500).json({message:"Rankings unavailable."});}});
router.get("/alliance/:userId",requireSession,(req,res)=>{
  try{res.json(db.allianceState(Number(req.params.userId)));}catch(e){console.error(e);res.status(500).json({message:"Alliance unavailable."});}
});
router.post("/alliance/create",requireSession,(req,res)=>{
  try{const result=db.createAlliance(Number(req.body.userId),req.body.name);if(result.error)return res.status(400).json({message:result.error});res.json(result);}catch(e){console.error(e);res.status(500).json({message:"Cannot create alliance."});}
});
router.post("/alliance/invite",requireSession,(req,res)=>{
  try {
    const result=db.inviteToAlliance(Number(req.body.userId),Number(req.body.targetId));
    if(result.error)return res.status(400).json({message:result.error});
    res.json(result);
  } catch(error){console.error(error);res.status(500).json({message:"Unable to send invitation."});}
});
router.post("/alliance/invite/respond",requireSession,(req,res)=>{
  try {
    const result=db.respondToAllianceInvite(Number(req.body.userId),Number(req.body.allianceId),req.body.accept);
    if(result.error)return res.status(400).json({message:result.error});
    res.json(result);
  } catch(error){console.error(error);res.status(500).json({message:"Unable to respond to invitation."});}
});

router.post("/alliance/join",requireSession,(req,res)=>{
  try{const result=db.joinAlliance(Number(req.body.userId),req.body.name);if(result.error)return res.status(400).json({message:result.error});res.json(result);}catch(e){console.error(e);res.status(500).json({message:"Cannot join alliance."});}
});
for(const [route,method] of [["application","allianceApplication"],["role","allianceRole"],["leave","allianceLeave"],["transfer","allianceTransfer"]]){
  router.post("/alliance/"+route,requireSession,(req,res)=>{
    try{
      const userId=Number(req.body.userId),targetId=Number(req.body.targetId);
      if(!Number.isSafeInteger(targetId)||targetId<1)return res.status(400).json({message:"Invalid player."});
      const result=route==="application"?db[method](userId,targetId,req.body.accept===true):route==="role"?db[method](userId,targetId,req.body.role):db[method](userId,targetId);
      if(result.error)return res.status(400).json({message:result.error});
      res.json(result);
    }catch(e){console.error(e);res.status(500).json({message:"Alliance action failed."});}
  });
}
router.post("/alliance/reinforce",requireSession,(req,res)=>{
  try{const result=db.sendAllianceReinforcement(Number(req.body.userId),Number(req.body.recipientId),req.body.units);
    if(result.error)return res.status(400).json({message:result.error});res.json(result);
  }catch(e){console.error(e);res.status(500).json({message:"Reinforcement dispatch failed."});}
});
router.post("/alliance/recall",requireSession,(req,res)=>{
  try{const result=db.recallAllianceReinforcement(Number(req.body.userId),Number(req.body.missionId));
    if(result.error)return res.status(400).json({message:result.error});res.json(result);
  }catch(e){console.error(e);res.status(500).json({message:"Reinforcement recall failed."});}
});
for(const [path,method,key] of [["donate","donateAlliance","resource"],["market/buy","buyAllianceMarket","item"],["bonus/upgrade","upgradeAllianceBonus","kind"]]){
  router.post("/alliance/"+path,requireSession,(req,res)=>{
    try{const result=db[method](Number(req.body.userId),req.body[key]);if(result.error)return res.status(400).json({message:result.error});res.json(result);}
    catch(e){console.error(e);res.status(500).json({message:"Alliance economy action failed."});}
  });
}
router.post("/alliance/request-help",requireSession,(req,res)=>{
  try{const result=db.requestAllianceHelp(Number(req.body.userId));if(result.error)return res.status(400).json({message:result.error});res.json(result);}catch(e){console.error(e);res.status(500).json({message:"Cannot request help."});}
});
router.post("/alliance/help",requireSession,(req,res)=>{
  try{const result=db.helpAlliance(Number(req.body.userId),Number(req.body.requestId));if(result.error)return res.status(400).json({message:result.error});res.json(result);}catch(e){console.error(e);res.status(500).json({message:"Cannot help construction."});}
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
router.post("/inventory/use-item",requireSession,(req,res)=>{
  try {
    const result=db.useInventoryItem(Number(req.body.userId),req.body.item,Number(req.body.amount));
    if(result.error)return res.status(400).json({message:result.error});
    res.json(result);
  } catch(e){console.error(e);res.status(500).json({message:"Item use failed."});}
});

router.get("/alien-campaign/:userId",requireSession,(req,res)=>{
  try { res.json(db.getAlienCampaign(Number(req.params.userId))); }
  catch(error) { console.error(error);res.status(500).json({message:"Campaign unavailable."}); }
});
router.post("/alien-campaign/formations",requireSession,(req,res)=>{
  const result=db.saveFormation(Number(req.body.userId),req.body.slot,req.body.rows,req.body.defenseSlot,req.body.name,req.body.mode);
  if(result.error)return res.status(400).json({message:result.error});
  res.json(result);
});

router.post("/battle-simulator/simulate",requireSession,(req,res)=>{
  try{
    const result=db.simulateAlienBattle(Number(req.body.userId),Number(req.body.level),req.body.army,req.body.formation);
    if(result.error)return res.status(400).json({message:result.error});
    res.json(result);
  }catch(error){console.error("Battle simulation:",error);res.status(500).json({message:"Battle simulation unavailable."});}
});

router.get("/events/:userId",requireSession,(req,res)=>{
  try{const userId=Number(req.params.userId);res.json({saturdayInvasion:db.getSaturdayAllianceInvasion(userId),motherShip:db.getMothershipEvent(userId)});}
  catch(error){console.error("Events:",error);res.status(500).json({message:"Events unavailable."});}
});
router.post("/events/saturday-invasion/start",requireSession,(req,res)=>{
  try{
    const result=db.startSaturdayAllianceInvasion(Number(req.body.userId));
    if(result.error)return res.status(400).json({message:result.error});
    res.json(result);
  }catch(error){console.error("Saturday invasion:",error);res.status(500).json({message:"The event could not be started."});}
});
router.post("/mothership/attack",requireSession,(req,res)=>{
  try{
    const result=db.launchMothershipAttack(Number(req.body.userId),req.body.army,req.body.formation,req.body.includeCyberKnight);
    if(result.error)return res.status(400).json({message:result.error});
    res.json(result);
  }catch(error){console.error("Mother Ship attack:",error);res.status(500).json({message:"Mother Ship attack could not be launched."});}
});
router.get("/hospital/:userId",requireSession,(req,res)=>{
  try{res.json(db.getHospital(Number(req.params.userId)));}
  catch(error){console.error("Hospital:",error);res.status(500).json({message:"Hospital unavailable."});}
});
router.post("/hospital/treat",requireSession,(req,res)=>{
  try{
    const result=db.startHospitalTreatment(Number(req.body.userId));
    if(result.error)return res.status(400).json({message:result.error});
    res.json(result);
  }catch(error){console.error("Hospital treatment:",error);res.status(500).json({message:"Hospital treatment could not start."});}
});
router.get("/mothership/hospital/:userId",requireSession,(req,res)=>{
  try{res.json(db.getMothershipHospital(Number(req.params.userId)));}
  catch(error){console.error("Mother Ship hospital:",error);res.status(500).json({message:"Hospital unavailable."});}
});
router.post("/mothership/hospital/heal",requireSession,(req,res)=>{
  try{
    const result=db.startMothershipHealing(Number(req.body.userId));
    if(result.error)return res.status(400).json({message:result.error});
    res.json(result);
  }catch(error){console.error("Hospital healing:",error);res.status(500).json({message:"Hospital treatment could not start."});}
});

router.post("/alien-campaign/attack",requireSession,(req,res)=>{
  try {
    const result=db.attackAlienBase(Number(req.body.userId),Number(req.body.level),req.body.army,req.body.formation,req.body.includeCyberKnight,req.body.target);
    if(result.error) return res.status(400).json({message:result.error});
    res.json(result);
  } catch(error) {console.error(error);res.status(500).json({message:"Attack unavailable."});}
});

router.post("/player-campaign/attack",requireSession,(req,res)=>{
  try {
    const result=db.launchPlayerAttack(Number(req.body.userId),req.body.army,req.body.formation,req.body.target);
    if(result.error)return res.status(400).json({message:result.error});
    res.json(result);
  } catch(error) {console.error("Player attack:",error);res.status(500).json({message:"Player attack unavailable."});}
});

router.post("/player-campaign/trade",requireSession,(req,res)=>{
  res.status(400).json({message:"Instant transfers are disabled. Use the marketplace."});
});

router.get("/market/:userId",requireSession,(req,res)=>{
  try{res.json({offers:db.getMarketOffers(Number(req.params.userId))});}
  catch(error){console.error("Market offers:",error);res.status(500).json({message:"Marketplace unavailable."});}
});
router.post("/market/offers",requireSession,(req,res)=>{
  try{
    const result=db.createMarketOffer(Number(req.body.userId),req.body.offered,req.body.requested);
    if(result.error)return res.status(400).json({message:result.error});
    res.json(result);
  }catch(error){console.error("Create market offer:",error);res.status(500).json({message:"Offer could not be created."});}
});
router.post("/market/offers/:offerId/accept",requireSession,(req,res)=>{
  try{
    const result=db.acceptMarketOffer(Number(req.body.userId),Number(req.params.offerId));
    if(result.error)return res.status(400).json({message:result.error});
    res.json(result);
  }catch(error){console.error("Accept market offer:",error);res.status(500).json({message:"Offer could not be accepted."});}
});
router.post("/market/offers/:offerId/cancel",requireSession,(req,res)=>{
  try{
    const result=db.cancelMarketOffer(Number(req.body.userId),Number(req.params.offerId));
    if(result.error)return res.status(400).json({message:result.error});
    res.json(result);
  }catch(error){console.error("Cancel market offer:",error);res.status(500).json({message:"Offer could not be cancelled."});}
});

router.post("/alien-campaign/side-quest",requireSession,(req,res)=>{
  try{
    const result=db.claimAlienSideQuest(Number(req.body.userId),Number(req.body.milestone));
    if(result.error)return res.status(400).json({message:result.error});
    res.json(result);
  }catch(e){console.error(e);res.status(500).json({message:"Side quest unavailable."});}
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

    db.saveEquipmentFromClient(userId, equippedItems || {}, gearInventory, craftingPoints);

    res.status(200).json({ message: "Equipment saved successfully!" });
  } catch (error) {
    console.error("Save equipment error:", error);
    res.status(500).json({ message: "Internal server error while saving equipment." });
  }
});

router.post("/craft-equipment", requireSession, (req, res) => {
  const {userId, itemId, expectedLevel} = req.body;
  try {
    const result = db.craftEquipment(Number(userId), itemId, expectedLevel);
    if (result.error) return res.status(400).json({message:result.error});
    res.json(result);
  } catch (error) {
    console.error("Craft equipment error:", error);
    res.status(500).json({message:"Unable to upgrade equipment."});
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

    db.saveEquipmentFromClient(userId, equippedItems || {}, gearInventory, craftingPoints);

    res.status(200).json({ message: "Equipment updated successfully!" });
  } catch (error) {
    console.error("Update equipment error:", error);
    res.status(500).json({ message: "Internal server error while updating equipment." });
  }
});

module.exports = router;
