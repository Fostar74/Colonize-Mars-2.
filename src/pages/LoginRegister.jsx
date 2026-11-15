import { useLanguage } from "../language";
import React, { useEffect, useState } from "react";
import "./LoginRegister.css";
import riseImage from "../images/cyber-knight-rise.jpg";
import continuesImage from "../images/cyber-knight-continues.jpg";
import leavingEarthImage from "../images/cyber-knight-leaving-earth.jpg";

const API_BASE = (process.env.REACT_APP_API_URL || (window.location.hostname === "localhost" ? "http://localhost:3001" : window.location.origin)).replace(/\/$/, "");

const currentUtcTime = () => new Date().toISOString().replace("T", " ").slice(0, 19) + " UTC";

const dailyResetCountdown = () => {
  const now = new Date();
  const nextReset = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1, 0, 0, 0));
  const totalSeconds = Math.max(0, Math.floor((nextReset.getTime() - now.getTime()) / 1000));
  const hours = String(Math.floor(totalSeconds / 3600)).padStart(2, "0");
  const minutes = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, "0");
  const seconds = String(totalSeconds % 60).padStart(2, "0");
  return hours + ":" + minutes + ":" + seconds;
};

function LoginRegister() {
  const { t, label: localLabel } = useLanguage();
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [activeSlide, setActiveSlide] = useState(0);
  const [utcNow, setUtcNow] = useState(currentUtcTime);
  const [resetCountdown, setResetCountdown] = useState(dailyResetCountdown);

  const slides = [
    { image: riseImage, title: t("Rise of Cyber Knight", "Възходът на Киберрицаря"), subtitle: t("The legend begins", "Легендата започва") },
    { image: continuesImage, title: t("Leaving Earth", "Напускане на Земята"), subtitle: t("The legend continues", "Легендата продължава") },
    { image: leavingEarthImage, title: t("Leaving Earth", "Напускане на Земята"), subtitle: t("The legend of Cyber Knight · Part II", "Легендата за Киберрицаря · Част II") },
  ];

  useEffect(() => {
    const slideTimer = window.setInterval(() => setActiveSlide(current => (current + 1) % 3), 7000);
    const clockTimer = window.setInterval(() => {
      setUtcNow(currentUtcTime());
      setResetCountdown(dailyResetCountdown());
    }, 1000);
    return () => {
      window.clearInterval(slideTimer);
      window.clearInterval(clockTimer);
    };
  }, []);

  const handleSubmit = async e => {
    e.preventDefault();
    const endpoint = isRegister ? "/register" : "/login";
    const cleanUsername = username.trim();
    const cleanEmail = email.trim().toLowerCase();
    if (isRegister && (!cleanEmail || !cleanUsername || password.length < 8)) {
      setMessage("Please enter your email and username and a password with at least 8 characters.");
      return;
    }
    const payload = isRegister ? { email: cleanEmail, username: cleanUsername, password } : { username: cleanUsername, password };

    try {
      const response = await fetch(API_BASE + endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json();

      if (response.ok) {
        if (isRegister) {
          setMessage("✅ Registration successful. Please log in to continue.");
          setIsRegister(false);
          setPassword("");
        } else {
          setMessage("✅ Login successful! Redirecting...");
          sessionStorage.setItem("username", data.username || username);
          sessionStorage.setItem("userId", data.userId);
          sessionStorage.setItem("authToken", data.token);

          if (data.gameProgress) {
            sessionStorage.setItem("castle", JSON.stringify(data.gameProgress.castle));
            sessionStorage.setItem("resources", JSON.stringify(data.gameProgress.resources));
            sessionStorage.setItem("structures", JSON.stringify(data.gameProgress.structures));
          } else {
            sessionStorage.removeItem("castle");
            sessionStorage.removeItem("resources");
            sessionStorage.removeItem("structures");
          }
          if (data.gameStats) sessionStorage.setItem("gameStats", JSON.stringify(data.gameStats));
          setTimeout(() => { window.location.href = "/#/game"; }, 1500);
        }
      } else {
        setMessage(data.message || "❌ Something went wrong");
      }
    } catch (err) {
      setMessage("❌ Error connecting to server");
    }
  };

  return (
    <main className="login-page" style={{ backgroundImage: "linear-gradient(120deg, rgba(3, 8, 17, .96), rgba(5, 15, 29, .9))" }}>
      <div className="landing-layout">
        <section className="landing-story" aria-label={t("Game introduction", "Представяне на играта")}>
          <div className="landing-brand">
            <span className="brand-orbit" aria-hidden="true">✦</span>
            <span>COLONIZE <b>MARS</b></span>
            <span className="brand-caption">{t("A strategy game", "Стратегическа игра")}</span>
          </div>
          <p className="landing-kicker">{t("THE FUTURE IS YOURS TO BUILD", "БЪДЕЩЕТО Е В ТВОИТЕ РЪЦЕ")}</p>
          <h1>{t("A new world awaits.", "Нов свят те очаква.")}</h1>
          <p className="landing-description">{t("Build your base. Gather resources across Mars. Stand with your alliance against the invasion.", "Изгради базата си. Добивай ресурси на Марс. Заедно с алианса защити колонията от нашествието.")}</p>

          <div className="poster-carousel" aria-live="polite">
            <img className="poster-image" key={activeSlide} src={slides[activeSlide].image} alt={slides[activeSlide].title} />
            <div className="poster-caption">
              <span>{slides[activeSlide].subtitle}</span>
              <strong>{slides[activeSlide].title}</strong>
            </div>
          </div>
          <div className="carousel-dots" aria-label={t("Choose artwork", "Избери изображение")}>
            {slides.map((slide, index) => (
              <button key={slide.image} type="button" aria-label={slide.title} aria-pressed={activeSlide === index} className={activeSlide === index ? "active" : ""} onClick={() => setActiveSlide(index)} />
            ))}
          </div>
        </section>

        <section className="login-panel" aria-label={t("Account access", "Достъп до акаунта")}>
          <div className="login-panel-heading">
            <span className="login-panel-kicker">{t("COMMANDER ACCESS", "ДОСТЪП НА КОМАНДИРА")}</span>
            <h2>{isRegister ? t("Join the colony", "Присъедини се към колонията") : t("Welcome back", "Добре дошъл отново")}</h2>
            <p>{isRegister ? t("Create your account and take your place on Mars.", "Създай акаунт и заеми мястото си на Марс.") : t("Your colony is waiting for you.", "Колонията те очаква.")}</p>
          </div>

          <form onSubmit={handleSubmit} className="login-form">
            {isRegister && (
              <input type="email" placeholder={t("Email", "Имейл")} value={email} required autoComplete="email" onChange={e => setEmail(e.target.value)} />
            )}
            <input type="text" placeholder={isRegister ? t("Username", "Потребителско име") : t("Username or email", "Потребителско име или имейл")} value={username} required autoComplete="username" onChange={e => setUsername(e.target.value)} />
            <input
              type="password"
              minLength={isRegister ? 8 : undefined}
              autoComplete={isRegister ? "new-password" : "current-password"}
              placeholder={isRegister ? t("Password (at least 8 characters)", "Парола (поне 8 знака)") : t("Password", "Парола")}
              value={password}
              required
              onChange={e => setPassword(e.target.value)}
            />
            <button type="submit" className="primary-button">{isRegister ? t("Create account", "Създай акаунт") : t("Log in", "Вход")}</button>
            <button type="button" className="secondary-button" onClick={() => { setIsRegister(!isRegister); setPassword(""); setMessage(""); }}>
              {isRegister ? t("Already have an account? Log in", "Вече имаш акаунт? Вход") : t("New to Mars? Create an account", "Нов си на Марс? Създай акаунт")}
            </button>
          </form>
          {message && <p role="status" className="login-message">{localLabel(message)}</p>}
        </section>
      </div>

      <footer className="reset-footer">
        <span className="reset-dot" aria-hidden="true" />
        <span>{t("Current UTC", "Текущо UTC")}: <strong className="utc-clock">{utcNow}</strong></span>
        <span className="reset-separator">·</span>
        <span>{t("Daily reset", "Смяна на деня")}: <strong>00:00 UTC</strong></span>
        <span className="reset-separator">·</span>
        <span>{t("Next reset in", "До смяната")} <strong className="countdown">{resetCountdown}</strong></span>
      </footer>
    </main>
  );
}

export default LoginRegister;
