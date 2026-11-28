import React, {useEffect, useState} from "react";
import {Link, useLocation, useNavigate} from "react-router-dom";
import {useLanguage} from "../language";
import "./LoginRegister.css";

export default function PasswordReset() {
  const {t, choose, language} = useLanguage();
  const {search} = useLocation();
  const navigate = useNavigate();
  const [token, setToken] = useState(null);
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [status, setStatus] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!search) return;
    const value = new URLSearchParams(search).get("token");
    setToken(/^[a-f0-9]{64}$/.test(value || "") ? value : null);
    setStatus(null);
    navigate("/password-reset", {replace: true});
  }, [search, navigate]);

  const messages = {
    "invalid-link": t("This recovery link is invalid or has expired.", "Връзката за възстановяване е невалидна или е изтекла."),
    "invalid-password": t("Use at least 8 characters and no more than 72 UTF-8 bytes.", "Използвай поне 8 знака и най-много 72 байта в UTF-8."),
    mismatch: t("The passwords do not match.", "Паролите не съвпадат."),
    "rate-limit": t("Too many attempts. Please wait and try again.", "Твърде много опити. Изчакай и опитай отново."),
    unavailable: t("Password recovery is temporarily unavailable.", "Възстановяването на паролата временно не е достъпно."),
    success: t("Password updated. Log in with your new password.", "Паролата е променена. Влез с новата си парола."),
  };

  async function submit(event) {
    event.preventDefault();
    if (!token || submitting) return;
    if (password !== confirmation) {
      setStatus("mismatch");
      return;
    }
    setSubmitting(true);
    setStatus(null);
    try {
      const response = await fetch("/password-reset", {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({token, password}),
      });
      if (response.status === 204) {
        setStatus("success");
        setToken(null);
        setPassword("");
        setConfirmation("");
        return;
      }
      const {code} = await response.json();
      setStatus(Object.hasOwn(messages, code) ? code : "unavailable");
      if (code === "invalid-link") setToken(null);
    } catch {
      setStatus("unavailable");
    } finally {
      setSubmitting(false);
    }
  }

  return <main className="login-page" style={{backgroundColor: "#081425"}}>
    <section className="login-panel" style={{width: "min(100%, 28rem)", boxSizing: "border-box", margin: "auto"}}>
      <button type="button" onClick={() => choose(language === "en" ? "bg" : "en")} lang={language === "en" ? "bg" : "en"}>
        {language === "en" ? "Български" : "English"}
      </button>
      <h1>{t("Reset password", "Смяна на парола")}</h1>
      <p role="status">{messages[status || (!token && !search ? "invalid-link" : "")]}</p>
      {token && status !== "success" && <form className="login-form" onSubmit={submit}>
        <label htmlFor="new-password">{t("New password", "Нова парола")}</label>
        <input id="new-password" type="password" autoComplete="new-password" required minLength={8}
          value={password} onChange={event => setPassword(event.target.value)} />
        <label htmlFor="confirm-password">{t("Confirm password", "Потвърди паролата")}</label>
        <input id="confirm-password" type="password" autoComplete="new-password" required
          value={confirmation} onChange={event => setConfirmation(event.target.value)} />
        <button type="submit" style={{background: "#245a91"}} disabled={submitting}>{t("Save new password", "Запази новата парола")}</button>
      </form>}
      <p><Link to="/" style={{color: "#91dbff"}}>{t("Back to login", "Обратно към входа")}</Link></p>
    </section>
  </main>;
}
