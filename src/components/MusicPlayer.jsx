import React, { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { useLanguage } from "../language";

const TRACKS = [
  { label: "Leaving Earth", src: "/music/leaving-earth.mp3" },
  { label: "The Legend of Cyber Knight", src: "/music/rise-of-cyber-knight.mp3" },
  { label: "Orange Shadow", src: "/music/orange-shadow.mp3" }
];

const ALBUMS = [
  { label: "The Legend of Cyber Knight", url: "https://www.youtube.com/playlist?list=OLAK5uy_leWTj9gVAEi4l3VWdoma1gvuqNrikvMg8" },
  { label: "The Legend of Cyber Knight 2", url: "https://www.youtube.com/playlist?list=OLAK5uy_mySrUtbquz5ngyrLfxVfyvAprcqX9uVAI" }
];

export default function MusicPlayer() {
  const { t } = useLanguage();
  const { pathname } = useLocation();
  const audioRef = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [error, setError] = useState("");
  const [trackIndex, setTrackIndex] = useState(2);
  const [openAlbum, setOpenAlbum] = useState(null);
  const inGame = pathname === "/game" || pathname === "/map";

  useEffect(() => {
    if (inGame) return;
    audioRef.current?.pause();
    setPlaying(false);
  }, [inGame]);

  const playTrack = async (index) => {
    const audio = audioRef.current;
    if (!audio) return;
    setError("");
    const selected = TRACKS[index];
    const currentSource = audio.getAttribute("src");
    if (currentSource === selected.src && !audio.paused) {
      audio.pause();
      setPlaying(false);
      return;
    }
    // Keep the audio source under DOM control. React must not reset src
    // during a pending play() promise when the selected track changes.
    if (currentSource !== selected.src) {
      audio.pause();
      audio.setAttribute("src", selected.src);
      audio.load();
    }
    setTrackIndex(index);
    try {
      await audio.play();
      setPlaying(true);
    } catch (reason) {
      setPlaying(false);
      const code = audio.error?.code;
      const message = reason?.name === "NotAllowedError"
        ? t("Tap the song again to allow playback.","Натисни песента отново, за да разрешиш възпроизвеждането.")
        : code === 4
          ? t("Audio format or file is unavailable.","Аудиофайлът липсва или форматът не се поддържа.")
          : t("The song could not be loaded. Please try again.","Песента не можа да се зареди. Опитай отново.");
      setError(message);
    }
  };

  if (!inGame) return null;

  const buttonStyle = (selected) => ({
    minHeight: 40, padding: "8px 13px", border: "1px solid #93d8ff",
    borderRadius: 22, background: selected ? "#174f64" : "rgba(12,24,34,.94)",
    color: "#fff", fontWeight: 700, boxShadow: "0 2px 12px rgba(0,0,0,.55)",
    cursor: "pointer", maxWidth: "min(280px,85vw)", textAlign: "center"
  });

  return <>
    <audio ref={audioRef} preload="none" loop
      onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)}
      onError={() => { setPlaying(false); setError(t("Audio file could not be loaded.","Аудиофайлът не може да се зареди.")); }} />
    <div style={{ position:"fixed", right:0, bottom:"calc(150px + env(safe-area-inset-bottom))", zIndex:12000, display:"flex", flexDirection:"column", alignItems:"flex-end", gap:6, maxWidth:"90vw" }}>
      {ALBUMS.map((album,index) => <div key={album.label} style={{display:"flex",alignItems:"center",justifyContent:"flex-end",maxWidth:"90vw"}}>
        {openAlbum===index && <a href={album.url} target="_blank" rel="noopener noreferrer"
          style={{...buttonStyle(false),minHeight:36,textDecoration:"none",display:"flex",alignItems:"center",marginRight:3}}>
          {album.label} ↗
        </a>}
        <button type="button" onClick={() => setOpenAlbum(current => current===index?null:index)}
          aria-expanded={openAlbum===index}
          aria-label={t("Toggle album link: ","Покажи или скрий албума: ")+album.label}
          title={album.label}
          style={{...buttonStyle(false),minWidth:30,width:30,minHeight:36,padding:"4px 5px",borderRadius:"9px 0 0 9px"}}>
          {openAlbum===index?"›":"‹"}
        </button>
      </div>)}
      {error && <span role="status" style={{maxWidth:240,marginRight:12,padding:"6px 9px",borderRadius:7,background:"#281414",color:"#fff",fontSize:12}}>{error}</span>}
      <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:6,marginRight:12}}>
        {TRACKS.map((track,index) => <button key={track.src} type="button"
          onClick={() => playTrack(index)} aria-pressed={playing && trackIndex===index}
          style={buttonStyle(playing && trackIndex===index)}>
          {playing && trackIndex===index ? "⏸ " : "▶ "}{track.label}
        </button>)}
      </div>
    </div>
  </>;
}
