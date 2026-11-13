import React from "react";
import { LanguageProvider } from "./language";
import { HashRouter as Router, Routes, Route } from "react-router-dom";
import LoginRegister from "./pages/LoginRegister";
import Game from "./pages/Game";
import Map from "./pages/Map"; // ✅ still capital filename

function App() {
  return (
    <LanguageProvider>
    <Router>
      <Routes>
        <Route path="/" element={<LoginRegister />} />
        <Route path="/reset-password" element={<LoginRegister />} />
        <Route path="/game" element={<Game />} />
        <Route path="/map" element={<Map />} /> {/* ✅ lowercase path */}
      </Routes>
    </Router>
    </LanguageProvider>
  );
}

export default App;
