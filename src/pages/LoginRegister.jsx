import { useLanguage } from "../language";
import React, { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import "./LoginRegister.css";
import background from "../images/mars-background.jpg"; // ✅ Correct image path

const API_BASE = (process.env.REACT_APP_API_URL || (window.location.hostname === "localhost" ? "http://localhost:3001" : window.location.origin)).replace(/\/$/, "");

function LoginRegister() {
  const { t , label: localLabel} = useLanguage();
  const location = useLocation();
  const navigate = useNavigate();
  const isResetPassword = location.pathname === "/reset-password";
  const resetToken = new URLSearchParams(location.search).get("token") || "";
  const [isRegister, setIsRegister] = useState(false);
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    const cleanUsername = username.trim();
    const cleanEmail = email.trim().toLowerCase();
    let endpoint = "/login";
    let payload = { username: cleanUsername, password };

    if (isRegister && (!cleanEmail || !cleanUsername || password.length < 8)) {
      setMessage("Please enter your email and username and a password with at least 8 characters.");
      return;
    }
    if (isResetPassword) {
      if (!resetToken) { setMessage(t("This password reset link is missing its token.","В линка за смяна липсва кодът за потвърждение.")); return; }
      if (password.length < 8) { setMessage(t("Use a password with at least 8 characters.","Новата парола трябва да е поне 8 знака.")); return; }
      if (password !== confirmPassword) { setMessage(t("The passwords do not match.","Паролите не съвпадат.")); return; }
      endpoint = "/reset-password";
      payload = { token: resetToken, password };
    } else if (isForgotPassword) {
      if (!cleanEmail) { setMessage("Enter the email address used for your account."); return; }
      endpoint = "/forgot-password";
      payload = { email: cleanEmail };
    } else if (isRegister) {
      endpoint = "/register";
      payload = { email: cleanEmail, username: cleanUsername, password };
    }

    try {
      const response = await fetch(`${API_BASE}${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (response.ok) {
        if (isForgotPassword) {
          setMessage(t("If an account exists for that email, a password reset link will be sent.","Ако има акаунт с този имейл, ще бъде изпратен линк за смяна на паролата."));
        } else if (isResetPassword) {
          setMessage(t("Password changed. You can now log in with your new password.","Паролата е сменена. Вече можеш да влезеш с новата парола."));
          setPassword("");
          setConfirmPassword("");
          window.setTimeout(() => navigate("/"), 1800);
        } else if (isRegister) {
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

          if (data.gameStats) {
            sessionStorage.setItem("gameStats", JSON.stringify(data.gameStats));
          }

          setTimeout(() => {
            window.location.href = "/#/game"; // ✅ Correct destination
          }, 1500);
        }
      } else {
        setMessage(data.message || "❌ Something went wrong");
      }
    } catch (err) {
      setMessage("❌ Error connecting to server");
    }
  };

  return (
    <div
      className="login-page"
      style={{
        backgroundImage: `url(${background})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
        height: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexDirection: "column",
        color: "white",
        textShadow: "0 0 5px #000",
        padding: "20px",
        boxSizing: "border-box",
      }}
    >
      <h1>{isResetPassword?t("Choose a new password","Избери нова парола"):isForgotPassword?t("Forgot password?","Забравена парола?"):isRegister ? t("Create Account","Създай акаунт") : t("Log In","Вход")}</h1>

      <form
        onSubmit={handleSubmit}
        className="login-form"
        style={{
          display: "flex",
          flexDirection: "column",
          width: "300px",
          backgroundColor: "rgba(0, 0, 0, 0.6)",
          padding: "20px",
          borderRadius: "10px",
          boxShadow: "0 0 10px black",
        }}
      >
        {isResetPassword && !resetToken && <p role="alert">{t("This password reset link is missing its token.","В линка за смяна липсва кодът за потвърждение.")}</p>}
        {isRegister && (
          <>
            <input
              type="email"
              placeholder={t("Email","Имейл")}
              value={email}
              required
              onChange={(e) => setEmail(e.target.value)}
              style={{
                padding: "10px",
                marginBottom: "10px",
                borderRadius: "5px",
                border: "none",
              }}
            />
            <input
              type="text"
              placeholder={t("Username","Потребителско име")}
              value={username}
              required
              onChange={(e) => setUsername(e.target.value)}
              style={{
                padding: "10px",
                marginBottom: "10px",
                borderRadius: "5px",
                border: "none",
              }}
            />
          </>
        )}

        {!isRegister && !isForgotPassword && !isResetPassword && (
          <input
            type="text"
            placeholder={t("Username or email","Потребителско име или имейл")}
            value={username}
            required
            autoComplete="username"
            onChange={(e) => setUsername(e.target.value)}
            style={{
              padding: "10px",
              marginBottom: "10px",
              borderRadius: "5px",
              border: "none",
            }}
          />
        )}

        {isForgotPassword && <input
          type="email"
          placeholder={t("Account email","Имейлът на акаунта")}
          value={email}
          required
          autoComplete="email"
          onChange={(e) => setEmail(e.target.value)}
          style={{padding:"10px",marginBottom:"10px",borderRadius:"5px",border:"none"}}
        />}

        {!isForgotPassword && <input
          type="password"
          minLength={isRegister || isResetPassword ? 8 : undefined}
          autoComplete={isRegister || isResetPassword ? "new-password" : "current-password"}
          placeholder={isResetPassword?t("New password (at least 8 characters)","Нова парола (поне 8 знака)"):isRegister ? t("Password (at least 8 characters)","Парола (поне 8 знака)") : t("Password","Парола")}
          value={password}
          required
          onChange={(e) => setPassword(e.target.value)}
          style={{padding:"10px",marginBottom:"10px",borderRadius:"5px",border:"none"}}
        />}
        {isResetPassword && <input
          type="password"
          minLength={8}
          autoComplete="new-password"
          placeholder={t("Confirm new password","Потвърди новата парола")}
          value={confirmPassword}
          required
          onChange={(e) => setConfirmPassword(e.target.value)}
          style={{padding:"10px",marginBottom:"10px",borderRadius:"5px",border:"none"}}
        />}
        <button
          type="submit"
          disabled={isResetPassword && !resetToken}
          style={{
            padding: "10px",
            marginBottom: "10px",
            backgroundColor: "#ff4500",
            color: "white",
            border: "none",
            borderRadius: "5px",
            cursor: isResetPassword && !resetToken ? "not-allowed" : "pointer",
          }}
        >
          {isResetPassword?t("Save new password","Запази новата парола"):isForgotPassword?t("Send reset link","Изпрати линк за смяна"):isRegister ? t("Register","Регистрация") : t("Login","Вход")}
        </button>
        {!isRegister && !isForgotPassword && !isResetPassword && <button
          type="button"
          onClick={() => { setIsForgotPassword(true); setMessage(""); setPassword(""); }}
          style={{padding:"8px",marginBottom:"10px",background:"transparent",color:"white",border:"none",textDecoration:"underline",cursor:"pointer"}}
        >{t("Forgot password?","Забравена парола?")}</button>}
        <button
          type="button"
          onClick={() => {
            if (isForgotPassword || isResetPassword) navigate("/");
            else setIsRegister(!isRegister);
            setIsForgotPassword(false);
            setPassword("");
            setConfirmPassword("");
            setMessage("");
          }}
          style={{
            padding: "10px",
            backgroundColor: "#666",
            color: "white",
            border: "none",
            borderRadius: "5px",
            cursor: "pointer",
          }}
        >
          {isForgotPassword||isResetPassword?t("Back to login","Обратно към входа"):isRegister ? t("Have an account? Log In","Имаш акаунт? Вход") : t("No account? Register","Нямаш акаунт? Регистрация")}
        </button>
      </form>

      {message && (
        <p className="login-message" style={{ marginTop: "15px" }}>
          {localLabel(message)}
        </p>
      )}
    </div>
  );
}

export default LoginRegister;
