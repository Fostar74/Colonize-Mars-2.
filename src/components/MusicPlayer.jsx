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
  const [error, setError] = useState(false);
  const [trackIndex, setTrackIndex] = useState(2);
  const [albumsOpen, setAlbumsOpen] = useState(false);
  const inGame = pathname === "/game" || pathname === "/map";

  useEffect(() => {
    if (inGame) return;
    audioRef.current?.pause();
    setPlaying(false);
  }, [inGame]);

  const playTrack = async (index) => {
    const audio = audioRef.current;
    if (!audio) return;
    setError(false);
    if (index !== trackIndex) {
      audio.pause();
      audio.src = TRACKS[index].src;
      audio.load();
      setTrackIndex(index);
    } else if (!audio.paused) {
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

  const buttonStyle = (selected) => ({
    minHeight: 40, padding: "8px 13px", border: "1px solid #93d8ff",
    borderRadius: 22, background: selected ? "#174f64" : "rgba(12,24,34,.94)",
    color: "#fff", fontWeight: 700, boxShadow: "0 2px 12px rgba(0,0,0,.55)",
    cursor: "pointer", maxWidth: "min(280px,85vw)", textAlign: "center"
  });

  return <>
    <audio ref={audioRef} src={TRACKS[trackIndex].src} preload="none" loop
      onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)}
      onError={() => { setError(true); setPlaying(false); }} />
    <div style={{ position:"fixed", right:12, bottom:"calc(150px + env(safe-area-inset-bottom))", zIndex:12000, display:"flex", flexDirection:"column", alignItems:"flex-end", gap:6 }}>
      <button type="button" onClick={() => setAlbumsOpen(value => !value)}
        aria-expanded={albumsOpen} aria-label={t("Show album links","Покажи връзките към албумите")}
        style={buttonStyle(false)}>
        {albumsOpen ? "⌄⌄ " : "⌃⌃ "}{t("Albums","Албуми")}
      </button>
      {albumsOpen && <div style={{display:"flex",flexDirection:"column",gap:6,alignItems:"flex-end"}}>
        {ALBUMS.map(album => <a key={album.label} href={album.url} target="_blank" rel="noopener noreferrer"
          style={{...buttonStyle(false),textDecoration:"none",display:"block"}}>
          ↗ {album.label}
        </a>)}
        <span style={{fontSize:11,color:"#c8d4df",maxWidth:220,textAlign:"right"}}>
          {t("Find albums on YouTube","Намери албумите в YouTube")}
        </span>
      </div>}
      {error && <span role="status" style={{maxWidth:240,padding:"6px 9px",borderRadius:7,background:"#281414",color:"#fff",fontSize:12}}>
        {t("Music could not be played. Reload the game and try again.","Музиката не можа да се пусне. Презареди играта и опитай отново.")}
      </span>}
      {TRACKS.map((track,index) => <button key={track.src} type="button"
        onClick={() => playTrack(index)} aria-pressed={playing && trackIndex===index}
        style={buttonStyle(playing && trackIndex===index)}>
        {playing && trackIndex===index ? "⏸ " : "▶ "}
        {index===2 ? t("Music","Музика") : track.label}
      </button>)}
    </div>
  </>;
}
