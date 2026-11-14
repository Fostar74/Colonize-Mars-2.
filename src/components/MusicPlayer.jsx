import React, { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { useLanguage } from "../language";

const TRACK = "/music/orange-shadow.mp3";

export default function MusicPlayer() {
  const { t } = useLanguage();
  const { pathname } = useLocation();
  const audioRef = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [error, setError] = useState(false);
  const inGame = pathname === "/game" || pathname === "/map";

  useEffect(() => {
    if (inGame) return;
    audioRef.current?.pause();
    setPlaying(false);
  }, [inGame]);

  const togglePlayback = async () => {
    const audio = audioRef.current;
    if (!audio) return;
    setError(false);
    if (!audio.paused) {
      audio.pause();
      setPlaying(false);
      return;
    }
    try {
      await audio.play();
      setPlaying(true);
    } catch (_) {
      setPlaying(false);
      setError(true);
    }
  };

  if (!inGame) return null;

  return <>
    <audio ref={audioRef} src={TRACK} preload="none" loop onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} />
    <div style={{ position:"fixed", right:12, bottom:"calc(70px + env(safe-area-inset-bottom))", zIndex:12000, display:"flex", flexDirection:"column", alignItems:"flex-end", gap:5 }}>
      {error && <span role="status" style={{maxWidth:240,padding:"6px 9px",borderRadius:7,background:"#281414",color:"#fff",fontSize:12}}>{t("Music could not be played. Reload the game and try again.","Музиката не можа да се пусне. Презареди играта и опитай отново.")}</span>}
      <button type="button" onClick={togglePlayback} aria-pressed={playing} aria-label={playing?t("Stop music","Спри музиката"):t("Play music","Пусни музиката")}
        style={{minHeight:44,padding:"9px 14px",border:"1px solid #93d8ff",borderRadius:22,background:playing?"#174f64":"rgba(12,24,34,.94)",color:"#fff",fontWeight:700,boxShadow:"0 2px 12px rgba(0,0,0,.55)",cursor:"pointer"}}>
        {playing?"⏸ "+t("Music","Музика"):"▶ "+t("Music","Музика")}
      </button>
    </div>
  </>;
}
