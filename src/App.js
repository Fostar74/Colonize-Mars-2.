import React from "react";
import { LanguageProvider } from "./language";
import { HashRouter as Router, Routes, Route } from "react-router-dom";
import LoginRegister from "./pages/LoginRegister";
import PasswordReset from "./pages/PasswordReset";
import Game from "./pages/Game";
import Map from "./pages/Map"; // ✅ still capital filename
import MusicPlayer from "./components/MusicPlayer";

function App() {
  return (
    <LanguageProvider>
    <Router>
      <MusicPlayer />
      <Routes>
        <Route path="/" element={<LoginRegister />} />
        <Route path="/password-reset" element={<PasswordReset />} />
        <Route path="/game" element={<Game />} />
        <Route path="/map" element={<Map />} /> {/* ✅ lowercase path */}
      </Routes>
    </Router>
    </LanguageProvider>
  );
}

export default App;
