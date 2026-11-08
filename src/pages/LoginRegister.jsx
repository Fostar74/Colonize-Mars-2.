import React, { useState } from "react";
import "./LoginRegister.css";
import background from "../images/mars-background.jpg"; // ✅ Correct image path

const API_BASE = (process.env.REACT_APP_API_URL || "http://localhost:3001").replace(/\/$/, "");

function LoginRegister() {
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    const endpoint = isRegister ? "/register" : "/login";

    const payload = isRegister ? { email, username, password } : { username, password };

    try {
      const response = await fetch(`${API_BASE}${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (response.ok) {
        if (isRegister) {
          setMessage("✅ Registration successful. Please log in to continue.");
          setIsRegister(false);
        } else {
          setMessage("✅ Login successful! Redirecting...");

          sessionStorage.setItem("username", data.username || username);
          sessionStorage.setItem("userId", data.userId);

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
      <h1>{isRegister ? "Create Account" : "Log In"}</h1>

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
        {isRegister && (
          <>
            <input
              type="email"
              placeholder="Email"
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
              placeholder="Username"
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

        {!isRegister && (
          <input
            type="text"
            placeholder="Username"
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
        )}

        <input
          type="password"
          placeholder="Password"
          value={password}
          required
          onChange={(e) => setPassword(e.target.value)}
          style={{
            padding: "10px",
            marginBottom: "10px",
            borderRadius: "5px",
            border: "none",
          }}
        />
        <button
          type="submit"
          style={{
            padding: "10px",
            marginBottom: "10px",
            backgroundColor: "#ff4500",
            color: "white",
            border: "none",
            borderRadius: "5px",
            cursor: "pointer",
          }}
        >
          {isRegister ? "Register" : "Login"}
        </button>
        <button
          type="button"
          onClick={() => {
            setIsRegister(!isRegister);
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
          {isRegister ? "Have an account? Log In" : "No account? Register"}
        </button>
      </form>

      {message && (
        <p className="login-message" style={{ marginTop: "15px" }}>
          {message}
        </p>
      )}
    </div>
  );
}

export default LoginRegister;
