const crypto = require("crypto");
const express = require("express");
const router = express.Router();
const bcrypt = require("bcrypt");
const {maxBytes,normalizeAvatar} = require("../database/playerAvatars");
const DatabaseManager = require("../database/database");

const db = new DatabaseManager();
router.post("/password-reset", require("./passwordRecovery")(db));
require("./passwordRecoveryEmail")(router, db);
const tokenHash = token => crypto.createHash("sha256").update(token).digest("hex");
const authorizationHash = req => {
  const match = /^Bearer ([a-f0-9]{64})$/.exec(req.get("authorization") || "");
  return match ? tokenHash(match[1]) : null;
};
const sessionFor = req => {
  const hash=authorizationHash(req);
  return hash&&db.findLoginSession(hash,Date.now());
};
const SESSION_MS = 24 * 60 * 60 * 1000;
let settlingEndedEvents=false;
const eventSettlementTimer=setInterval(()=>{
  if(settlingEndedEvents)return;
  settlingEndedEvents=true;
  try{db.settleResourceMines();db.settleEndedEvents();}catch(error){console.error("Event hospital recovery:",error);}
  finally{settlingEndedEvents=false;}
},15000);
if(typeof eventSettlementTimer.unref==="function")eventSettlementTimer.unref();
if (process.env.ORANGE_EMPIRE_ENABLED === "true") {
  const advanceOrangeEmpire = () => {
    try { db.advanceOrangeEmpire(); db.scheduleOrangeEmpireAttacks(); }
    catch (error) { console.error("Orange Empire development:", error); }
  };
  advanceOrangeEmpire();
  setInterval(() => {
    advanceOrangeEmpire();
    try { db.scheduleOrangeEmpireGathering(); }
    catch (error) { console.error("Orange Empire gathering:", error); }
  }, 10000).unref();
}

function requireAuthenticatedPlayer(req, res, next) {
  const session = sessionFor(req);
  if (!session) return res.status(401).json({ message: "Please log in again." });
  const requestedId = req.params.userId ?? req.body?.userId;
  if (String(requestedId) !== String(session.userId)) return res.status(403).json({ message: "Access denied." });
  next();
}

function requireSession(req, res, next) {
  requireAuthenticatedPlayer(req, res, () => {
    db.advanceCampaignTimeline();
    db.markPlayerActive(Number(req.params.userId ?? req.body?.userId));
    next();
  });
}

router.post("/register", async (req, res) => {
  const { email, password, username } = req.body || {};

  if (typeof email !== "string" || typeof password !== "string" ||
      typeof username !== "string" || !/^\S+@[^@\s]+$/.test(email.trim()) || !username.trim() ||
      password.length < 8 || username.length > 32 || email.length > 254) {
    return res.status(400).json({ message: "Enter a valid email and username, and use a password of at least 8 characters." });
  }

  try {
    const existingUserByEmail = db.findUserByEmail(email.trim().toLowerCase());
    if (existingUserByEmail) {
      return res.status(409).json({ message: "Email is already registered." });
    }

    const existingUserByUsername = db.findUserByUsername(username.trim());
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
    console.error("Registration error:", error.code || error.name);
    if (error.code === "SQLITE_CONSTRAINT_UNIQUE") {
      return res.status(409).json({ message: "Email or username already exists." });
    }
    res.status(500).json({ message: "Internal server error during registration." });
  }
});

// LOGIN
router.post("/login", async (req, res) => {
  const { username, password } = req.body || {};

  if (typeof username !== "string" || !username.trim() || typeof password !== "string" || !password) {
    return res.status(400).json({ message: "Username and password required." });
  }

  try {
    const loginIdentifier = username.trim();
    const nameMatch = db.findUserByUsername(loginIdentifier);
    const emailMatch = db.findUserByEmail(loginIdentifier);
    let user = null;
    for(const candidate of [nameMatch,emailMatch?.id===nameMatch?.id?null:emailMatch]){
      if(candidate&&await bcrypt.compare(password,candidate.password)){
        user=candidate;
        break;
      }
    }
    if(!user)return res.status(401).json({message:"Invalid username or password."});

    const gameProgress = db.initializeLogin(user.id,user.username);
    db.markPlayerActive(user.id);
    const gameStats = db.getGameStats(user.id);

    const token = crypto.randomBytes(32).toString("hex");
    const now = Date.now();
    if (!db.storeLoginSession(tokenHash(token),user.id,now+SESSION_MS,now,user.password)) {
      return res.status(401).json({message:"Invalid username or password."});
    }
    res.set("Cache-Control","no-store");
    res.status(200).json({
      token,
      message: "Login successful!",
      username: user.username,
      userId: user.id,
      gameProgress: gameProgress,
      gameStats: gameStats,
    });
  } catch (error) {
    console.error("Login error:", error.code || error.name);
    res.status(500).json({ message: "Internal server error during login." });
  }
});

router.post("/logout", (req,res)=>{
  const hash=authorizationHash(req);
  if(hash)db.revokeLoginSession(hash);
  res.status(204).end();
});

router.get("/map/bases", requireSessionForMap, (req, res) => {
  try {
    const orangeEmpireBases = db.getOrangeEmpireBases();
    res.json({
      bases: db.getPublicBases(),
      ...db.getMapResources(req.mapUserId),
      ...db.getOrangeEmpireCombat(req.mapUserId),
      ...(orangeEmpireBases.length ? {orangeEmpireBases} : {})
    });
  } catch (error) {
    console.error("Map data error:", error);
    res.status(500).json({ message: "Could not load the map." });
  }
});
function requireSessionForMap(req, res, next) {
  const session = sessionFor(req);
  if (!session) return res.status(401).json({ message: "Please log in again." });
  req.mapUserId=session.userId;
  db.advanceCampaignTimeline();
  db.markPlayerActive(session.userId);
  next();
}

router.post("/map/gathering", requireSession, (req,res)=>{
  try{
    const result=db.startGathering(Number(req.body.userId),Number(req.body.mineId),req.body.units);
    if(result.error)return res.status(400).json({message:result.error});
    res.json({...result,...db.getMapResources(Number(req.body.userId))});
  }catch(error){console.error("Gathering march:",error);res.status(500).json({message:"Could not start the gathering march."});}
});

router.post("/map/gathering/recall", requireSession, (req,res)=>{
  try{
    const userId=Number(req.body.userId);
    const result=db.recallGathering(userId,Number(req.body.mineId));
    if(result.error)return res.status(400).json({message:result.error});
    res.json(result);
  }catch(error){console.error("Recall gathering army:",error);res.status(500).json({message:"Could not recall the gathering army."});}
});

const allianceMineActions = {
  place: (userId, body) => db.placeAllianceMine(userId, body.x, body.y, body.resource),
  march: (userId, body) => db.launchAllianceMineMarch(userId, Number(body.mineId), body.mode, body.units),
  withdraw: (userId, body) => db.withdrawAllianceMine(userId, Number(body.mineId)),
};
for (const [action, perform] of Object.entries(allianceMineActions)) {
  router.post("/alliance/mine/"+action,requireSession,(req,res)=>{
    try {
      const userId=Number(req.body.userId);
      const result=perform(userId,req.body);
      if(result.error)return res.status(400).json({message:result.error});
      res.json(action==="withdraw"?{...result,...db.getMapResources(userId)}:result);
    } catch(error) {
      console.error("Alliance mine action:",error);
      res.status(500).json({message:"Alliance mine action failed."});
    }
  });
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

router.post("/cancel-training-group", requireSession, (req,res) => {
  try {
    const result = db.cancelTrainingGroup(Number(req.body.userId),req.body.category,Number(req.body.index));
    if (result.error) return res.status(400).json({message:result.error});
    res.json(result);
  } catch (error) {
    console.error("Cancel training group:",error);
    res.status(500).json({message:"Could not cancel training."});
  }
});

router.post("/cancel-unit-upgrade", requireSession, (req, res) => {
  try {
    const result = db.cancelUnitUpgrade(Number(req.body.userId), Number(req.body.slot));
    if (result.error) return res.status(400).json({message:result.error});
    res.json(result);
  } catch (error) {
    console.error("Cancel unit upgrade:",error);
    res.status(500).json({message:"Could not cancel upgrade."});
  }
});

router.post("/barracks/mobilize",requireSession,(req,res)=>{
  try{
    const result=db.mobilizeBarracks(Number(req.body.userId),req.body.unit,Number(req.body.amount),req.body.requestId);
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
router.get("/reports/recipients/:userId",requireSession,(req,res)=>{
  try{res.json({players:db.searchReportRecipients(Number(req.params.userId),req.query.q)});}
  catch(error){console.error("Search report recipients:",error);res.status(500).json({message:"Player search unavailable."});}
});
router.get("/reports/shared/:userId/:messageId", requireAuthenticatedPlayer, (req,res)=>{
  const report=db.getSharedBattleReport(Number(req.params.userId),Number(req.params.messageId));
  res.set("Cache-Control","no-store");
  if(!report)return res.status(404).json({message:"Battle report not found."});
  return res.json(report);
});

router.post("/reports/share",requireSession,(req,res)=>{
  try{
    const result=db.shareBattleReport(Number(req.body.userId),req.body.reportType,Number(req.body.reportId),req.body.scope,req.body.recipient);
    res.status(result.error?400:200).json(result.error?{message:result.error}:result);
  }catch(error){console.error("Share battle report:",error);res.status(500).json({message:"Could not share report."});}
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
router.get("/alliance/messages/:userId",requireAuthenticatedPlayer,(req,res)=>{
  try{
    const result=db.listMessages(Number(req.params.userId),"alliance");
    res.set("Cache-Control","no-store").status(result.error?403:200).json(result.error?{message:result.error}:result);
  }catch(error){console.error("Alliance messages:",error);res.status(500).json({message:"Could not load alliance messages."});}
});
router.post("/alliance/messages/:userId/read",requireAuthenticatedPlayer,(req,res)=>{
  try{
    const result=db.acknowledgeAllianceMessages(Number(req.params.userId),req.body?.ids);
    res.status(result.error?400:200).json(result.error?{message:result.error}:result);
  }catch(error){console.error("Alliance message acknowledgment:",error);res.status(500).json({message:"Could not update alliance messages."});}
});
router.get("/notifications/:userId",requireAuthenticatedPlayer,(req,res)=>{
  try{res.set("Cache-Control","no-store").json(db.listPlayerNotifications(Number(req.params.userId)));}
  catch(error){console.error("Player notifications:",error);res.status(500).json({message:"Notifications unavailable."});}
});
router.post("/notifications/:userId/read",requireAuthenticatedPlayer,(req,res)=>{
  try{
    const notificationId=Number(req.body?.notificationId);
    if(!Number.isSafeInteger(notificationId)||notificationId<1)return res.status(400).json({message:"Choose a valid notification."});
    const result=db.markPlayerNotificationRead(Number(req.params.userId),notificationId);
    res.status(result.success?200:404).json(result);
  }catch(error){console.error("Mark notification read:",error);res.status(500).json({message:"Could not update notification."});}
});

router.get("/rankings/:userId",requireSession,(req,res)=>{try{res.json(db.rankings(Number(req.params.userId)));}catch(e){console.error("Rankings:",e);res.status(500).json({message:"Rankings unavailable."});}});
router.get("/alliance/:userId",requireSession,(req,res)=>{
  try{res.json(db.allianceState(Number(req.params.userId)));}catch(e){console.error(e);res.status(500).json({message:"Alliance unavailable."});}
});
router.post("/alliance/description",requireSession,(req,res)=>{
  try{const result=db.saveAllianceDescription(Number(req.body.userId),req.body.description);if(result.error)return res.status(400).json({message:result.error});res.json(result);}
  catch(e){console.error(e);res.status(500).json({message:"Could not update the alliance profile."});}
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
  try{
    const userId=Number(req.body.userId);
    const result=req.body.orangeEmpireAttackId == null
      ? db.sendAllianceReinforcement(userId,Number(req.body.recipientId),req.body.units)
      : db.sendOrangeEmpireSupport(userId,Number(req.body.orangeEmpireAttackId),req.body.units);
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
router.post("/alliance/market/exchange",requireSession,(req,res)=>{
  try{
    const result=db.exchangeAllianceResource(Number(req.body.userId),req.body.from,req.body.to,Number(req.body.amount));
    if(result.error)return res.status(400).json({message:result.error});
    res.json(result);
  }catch(e){console.error(e);res.status(500).json({message:"Resource exchange failed."});}
});
router.post("/alliance/request-help",requireSession,(req,res)=>{
  try{const result=db.requestAllianceHelp(Number(req.body.userId),["building","upgrade"].includes(req.body.kind)?req.body.kind:"all");if(result.error)return res.status(400).json({message:result.error});res.json(result);}catch(e){console.error(e);res.status(500).json({message:"Cannot request help."});}
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

router.post("/alien-stations/unlock",requireSession,(req,res)=>{
  try{
    const result=db.unlockAlienStation(Number(req.body.userId),Number(req.body.stationId));
    if(result.error)return res.status(400).json({message:result.error});
    res.json(result);
  }catch(error){console.error("Station unlock:",error);res.status(500).json({message:"Station could not be unlocked."});}
});
router.post("/alien-stations/donate",requireSession,(req,res)=>{
  try{
    const result=db.donateAlienCrystals(Number(req.body.userId),req.body.kind,Number(req.body.amount));
    if(result.error)return res.status(400).json({message:result.error});
    res.json(result);
  }catch(error){console.error("Station crystal donation:",error);res.status(500).json({message:"Crystal donation failed."});}
});
router.post("/alien-stations/build",requireSession,(req,res)=>{
  try{
    const result=db.buildAlienStation(Number(req.body.userId),req.body.kind);
    if(result.error)return res.status(400).json({message:result.error});
    res.json(result);
  }catch(error){console.error("Station construction:",error);res.status(500).json({message:"Station construction failed."});}
});
router.post("/alien-stations/defend",requireSession,(req,res)=>{
  try{
    const result=db.sendStationDefense(Number(req.body.userId),Number(req.body.stationId),req.body.army);
    if(result.error)return res.status(400).json({message:result.error});
    res.json(result);
  }catch(error){console.error("Station defense march:",error);res.status(500).json({message:"Station defense march failed."});}
});
router.post("/alien-stations/recall",requireSession,(req,res)=>{
  try{
    const result=db.recallStationDefense(Number(req.body.userId),Number(req.body.stationId));
    if(result.error)return res.status(400).json({message:result.error});
    res.json(result);
  }catch(error){console.error("Station defense recall:",error);res.status(500).json({message:"Station defense recall failed."});}
});
router.get("/app-version",requireSession,(req,res)=>res.set("Cache-Control","no-store").json({version:process.env.RENDER_GIT_COMMIT||process.env.APP_VERSION||"local"}));
router.get("/reports/:userId",requireSession,(req,res)=>{
  try{
    const userId=Number(req.params.userId);
    const campaign=db.getAlienCampaign(userId);
    const playerMissions=campaign.playerMissions||[];
    const now=Date.now();
    const recentSince=now-20000;
    const shieldImpacts=playerMissions.filter(mission=>mission.incoming&&mission.resolved_at>=recentSince&&
      mission.result&&!mission.result.shielded&&!mission.result.error).map(mission=>"player:"+mission.id);
    for(const id of db.getRecentInvasionImpacts(userId,recentSince))shieldImpacts.push("invasion:"+id);
    res.json({...campaign,mothershipReports:db.getMothershipReports(userId),orangeEmpireReports:db.getOrangeEmpireReports(userId),shieldImpacts,
      unreadIncoming:playerMissions.filter(mission=>mission.incoming&&!mission.result&&!mission.returned_at&&Number(mission.arrives_at)>now).length});
  }catch(error){console.error("Report inbox:",error);res.status(500).json({message:"Reports unavailable."});}
});
router.post("/reports/read",requireSession,(req,res)=>{
  try{res.json(db.markIncomingReportsRead(Number(req.body.userId)));}
  catch(error){console.error("Mark reports read:",error);res.status(500).json({message:"Could not mark reports as read."});}
});
router.post("/player-missions/recall",requireSession,(req,res)=>{
  try{const result=db.recallPlayerAttack(Number(req.body.userId),Number(req.body.missionId));if(result.error)return res.status(400).json({message:result.error});res.json(result);}
  catch(error){console.error("Recall player attack:",error);res.status(500).json({message:"Could not recall this attack."});}
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
  try{const userId=Number(req.params.userId);res.json({saturdayInvasion:db.getSaturdayAllianceInvasion(userId),motherShip:db.getMothershipEvent(userId),labyrinth:db.getLabyrinthStatus(userId)});}
  catch(error){console.error("Events:",error);res.status(500).json({message:"Events unavailable."});}
});
router.post("/events/labyrinth/battle",requireSession,(req,res)=>{
  try{
    const action=String(req.body.action||"status");
    if(!["status","start","strike"].includes(action))return res.status(400).json({message:"Invalid battle action."});
    const result=db.labyrinthBattle(Number(req.body.userId),action,{room:req.body.room});
    if(result.error)return res.status(400).json({message:result.error});
    res.json(result);
  }catch(error){console.error("Labyrinth combat:",error);res.status(500).json({message:"Labyrinth combat unavailable."});}
});
router.post("/events/labyrinth/mission",requireSession,(req,res)=>{
  try{const result=db.runLabyrinthMission(Number(req.body.userId),{room:Number(req.body.room)});if(result.error)return res.status(400).json({message:result.error});res.json(result);}
  catch(error){console.error("Labyrinth mission:",error);res.status(500).json({message:"Labyrinth mission failed."});}
});
router.post("/events/labyrinth/move",requireSession,(req,res)=>{
  try{return res.status(410).json({message:"The old directional labyrinth has been retired."});}
  catch(error){console.error("Labyrinth move:",error);res.status(500).json({message:"Could not open the next square."});}
});
router.post("/events/labyrinth/backtrack",requireSession,(req,res)=>{
  try{return res.status(410).json({message:"The old directional labyrinth has been retired."});}
  catch(error){console.error("Labyrinth return:",error);res.status(500).json({message:"Could not return to that square."});}
});
router.post("/events/saturday-invasion/start",requireSession,(req,res)=>{
  try{
    const result=db.startSaturdayAllianceInvasion(Number(req.body.userId));
    if(result.error)return res.status(400).json({message:result.error});
    res.json(result);
  }catch(error){console.error("Saturday invasion:",error);res.status(500).json({message:"The event could not be started."});}
});
router.post("/events/saturday-invasion/restart",requireSession,(req,res)=>{
  try{
    const result=db.restartSaturdayAllianceInvasion(Number(req.body.userId));
    if(result.error)return res.status(400).json({message:result.error});
    res.json(result);
  }catch(error){console.error("Saturday invasion restart:",error);res.status(500).json({message:"The event could not be restarted."});}
});
router.post("/mothership/attack",requireSession,(req,res)=>{
  try{
    const result=db.launchMothershipAttack(Number(req.body.userId),req.body.army,req.body.formation,req.body.includeCyberKnight);
    if(result.error)return res.status(400).json({message:result.error});
    res.json(result);
  }catch(error){console.error("Alien Command Ship attack:",error);res.status(500).json({message:"Alien Command Ship attack could not be launched."});}
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
  catch(error){console.error("Alien Command Ship hospital:",error);res.status(500).json({message:"Hospital unavailable."});}
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

router.post("/player-campaign/scout",requireSession,(req,res)=>{
  try {
    const result=db.launchPlayerScout(Number(req.body.userId),req.body.target,Number(req.body.quantity));
    if(result.error)return res.status(400).json({message:result.error});
    res.json(result);
  }catch(error){console.error("Player scouting:",error);res.status(500).json({message:"Scouting unavailable."});}
});

router.post("/player-campaign/attack",requireSession,(req,res)=>{
  try {
    const result=db.launchPlayerAttack(Number(req.body.userId),req.body.army,req.body.formation,req.body.target,req.body.includeCyberKnight===true,req.body.confirmProtectionLoss===true);
    if(result.error)return res.status(400).json({message:result.error,requiresProtectionConfirmation:!!result.requiresProtectionConfirmation,protectionUntil:result.protectionUntil});
    res.json(result);
  } catch(error) {console.error("Player attack:",error);res.status(500).json({message:"Player attack unavailable."});}
});

router.post("/players/send-resources",requireSession,(req,res)=>{
  try{
    const result=db.sendPlayerResources(Number(req.body.userId),Number(req.body.recipientId),req.body.resources);
    if(result.error)return res.status(400).json({message:result.error});
    res.json(result);
  }catch(error){console.error("Send player resources:",error);res.status(500).json({message:"Resource transfer failed."});}
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

router.get("/side-quests/:userId/reward",requireSession,(req,res)=>{
  res.set("Cache-Control","no-store").json({id:db.sideQuests.unreadReward(Number(req.params.userId))});
});
router.post("/side-quests/:userId/read",requireSession,(req,res)=>{
  const ids=req.body.ids;
  if(!Array.isArray(ids)||ids.length>34||!ids.every(id=>Number.isInteger(id)&&id>=1&&id<=34)){
    return res.status(400).json({message:"Invalid side quest IDs."});
  }
  db.sideQuests.acknowledgeReward(Number(req.params.userId),ids);
  res.json({success:true});
});
router.get("/side-quests/:userId",requireSession,(req,res)=>{
  res.json(db.sideQuests.state(Number(req.params.userId)));
});
router.post("/side-quests/claim",requireSession,(req,res)=>{
  const result=db.sideQuests.claim(Number(req.body.userId),Number(req.body.missionId));
  if(result.error)return res.status(400).json({message:result.error});
  res.json(result);
});
router.post("/hospital/mobilize",requireSession,(req,res)=>{
  const result=db.mobilizeHealedTroops(Number(req.body.userId),req.body.unit,Number(req.body.amount),req.body.requestId);
  if(result.error)return res.status(400).json({message:result.error});
  res.json(result);
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

router.get("/profile/:userId", requireSession, (req, res) => {
  try {
    const user = db.findUserById(req.params.userId);
    if (!user) return res.status(404).json({message:"User not found."});
    res.json(db.getPlayerProfile(user.id));
  } catch (error) {
    console.error("Get player profile:", error);
    res.status(500).json({message:"Unable to load player profile."});
  }
});

router.post("/profile/avatar", requireSession, (req, res) => {
  try {
    const result = db.setPlayerAvatar(Number(req.body.userId), req.body.avatarId);
    if (result.error) return res.status(400).json({message:result.error});
    res.json(result);
  } catch (error) {
    console.error("Save player avatar:", error);
    res.status(500).json({message:"Unable to save avatar."});
  }
});

const parseAvatarImage = express.raw({type:()=>true,limit:maxBytes,inflate:false});
let activeAvatarDecodes = 0;
const avatarImageTypes = new Set(["image/jpeg","image/png","image/webp","application/octet-stream"]);

router.put("/profile/:userId/avatar-image", requireAuthenticatedPlayer, (req,res,next)=>{
  if (!avatarImageTypes.has(req.get("content-type")?.split(";")[0].trim().toLowerCase())) {
    return res.status(415).json({code:"avatar-format"});
  }
  if (!db.canStoreAvatarImages()) return res.status(503).json({code:"avatar-storage"});
  parseAvatarImage(req,res,error=>{
    if (error) return res.status(error.status===413?413:415).json({code:error.status===413?"avatar-size":"avatar-format"});
    next();
  });
}, async (req,res)=>{
  if (activeAvatarDecodes>=2) return res.status(429).json({code:"avatar-busy"});
  let image;
  activeAvatarDecodes++;
  try { image = await normalizeAvatar(req.body); }
  catch { return res.status(400).json({code:"avatar-invalid"}); }
  finally { activeAvatarDecodes--; }
  try { res.json(db.setPlayerAvatarImage(Number(req.params.userId),image)); }
  catch (error) {
    console.error("Save player avatar image:",error);
    res.status(500).json({code:"avatar-save"});
  }
});

router.delete("/profile/:userId/avatar-image", requireAuthenticatedPlayer, (req,res)=>{
  try { res.json(db.removePlayerAvatarImage(Number(req.params.userId))); }
  catch (error) {
    console.error("Remove player avatar image:",error);
    res.status(500).json({code:"avatar-save"});
  }
});

router.get("/player-avatars/:userId/:version.webp", (req,res)=>{
  const userId = Number(req.params.userId);
  const {version} = req.params;
  if (!Number.isSafeInteger(userId) || userId<1 || !/^[a-f0-9]{64}$/.test(version)) return res.sendStatus(404);
  const image = db.getPlayerAvatarImage(userId,version);
  if (!image) return res.sendStatus(404);
  res.set({"Cache-Control":"public, no-cache","X-Content-Type-Options":"nosniff"}).type("image/webp").send(image);
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

    const result=db.saveEquipmentFromClient(userId, equippedItems || {}, gearInventory, craftingPoints);
    if(result?.error)return res.status(400).json({message:result.error});

    res.status(200).json({ message: "Equipment saved successfully!" });
  } catch (error) {
    console.error("Save equipment error:", error);
    res.status(500).json({ message: "Internal server error while saving equipment." });
  }
});

router.post("/dismantle-equipment", requireSession, (req, res) => {
  const {userId,itemId}=req.body;
  if(!itemId)return res.status(400).json({message:"Item ID required."});
  try{
    const result=db.dismantleEquipment(Number(userId),itemId);
    if(result.error)return res.status(400).json({message:result.error});
    res.json(result);
  }catch(error){
    console.error("Dismantle equipment error:",error);
    res.status(500).json({message:"Unable to dismantle equipment."});
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

    const result=db.saveEquipmentFromClient(userId, equippedItems || {}, gearInventory, craftingPoints);
    if(result?.error)return res.status(400).json({message:result.error});

    res.status(200).json({ message: "Equipment updated successfully!" });
  } catch (error) {
    console.error("Update equipment error:", error);
    res.status(500).json({ message: "Internal server error while updating equipment." });
  }
});

module.exports = router;
