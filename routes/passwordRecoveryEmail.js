const nodemailer = require("nodemailer");
const {emailRequestsEnabled} = require("../database/passwordRecovery");

const emailPattern = /^[A-Za-z0-9.!#$%&'*+\/=?^_`{|}~-]+@[A-Za-z0-9.-]+$/;
const requestWindowMs = 10 * 60 * 1000;

function emailSender(env) {
  const {SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, PASSWORD_RECOVERY_ORIGIN} = env;
  const port = Number(SMTP_PORT);
  if (SMTP_HOST !== "smtp.gmail.com" || ![465, 587].includes(port) ||
      !emailPattern.test(SMTP_USER || "") || !SMTP_PASS) return null;
  let origin;
  try {
    origin = new URL(PASSWORD_RECOVERY_ORIGIN);
  } catch {
    return null;
  }
  if (origin.protocol !== "https:" || origin.username || origin.password ||
      origin.pathname !== "/" || origin.search || origin.hash) return null;

  const transport = nodemailer.createTransport({
    host: SMTP_HOST, port, secure: port === 465, requireTLS: true,
    tls: {rejectUnauthorized: true, minVersion: "TLSv1.2"},
    auth: {user: SMTP_USER, pass: SMTP_PASS},
    connectionTimeout: 10000, greetingTimeout: 10000, socketTimeout: 15000,
    logger: false, debug: false,
  });
  return async ({email, token}) => {
    if (!emailPattern.test(email)) throw new Error("Invalid stored email");
    const url = origin.origin + "/#/password-reset?token=" + token;
    await transport.sendMail({
      from: {name: "Colonize Mars 2", address: SMTP_USER},
      to: {address: email},
      subject: "Colonize Mars 2 — Password reset / Смяна на парола",
      text: [
        "Open this link within 30 minutes to change your password. If you did not request it, ignore this message.",
        "Отвори връзката до 30 минути, за да смениш паролата си. Ако не си поискал смяна, пренебрегни това писмо.",
        "", url,
      ].join("\n"),
    });
  };
}

function mountPasswordRecoveryEmail(router, db) {
  const send = emailRequestsEnabled() ? emailSender(process.env) : null;
  let windowEnds = 0;
  let requests = 0;
  let inFlight = 0;
  const peers = new Map();
  router.get("/password-reset/request", (req, res) => {
    res.set("Cache-Control", "no-store").json({enabled: Boolean(send)});
  });
  router.post("/password-reset/request", (req, res) => {
    res.set("Cache-Control", "no-store");
    if (!send) return res.sendStatus(404);

    // Keep the same response and avoid waiting on account lookup or SMTP delivery.
    res.status(202).json({code: "request-received"});
    const email = typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "";
    if (email.length > 254 || !emailPattern.test(email) || inFlight >= 4) return;
    const now = Date.now();
    if (now >= windowEnds) {
      windowEnds = now + requestWindowMs;
      peers.clear();
      requests = 0;
    }
    const peer = req.socket.remoteAddress;
    const peerRequests = peers.get(peer) || 0;
    if (requests >= 240 || peerRequests >= 30) return;
    requests++;
    peers.set(peer, peerRequests + 1);
    inFlight++;
    setImmediate(async () => {
      try {
        const reset = db.reservePasswordResetEmail(email);
        if (reset) await send(reset);
      } catch {
        // SMTP errors can contain addresses and provider details.
        console.error("Password recovery email could not be sent");
      } finally {
        inFlight--;
      }
    });
  });
}

module.exports = mountPasswordRecoveryEmail;
