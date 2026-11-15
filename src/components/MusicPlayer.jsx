import React, { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { useLanguage } from "../language";
import riseCover from "../images/cyber-knight-rise.jpg";
import earthCover from "../images/cyber-knight-leaving-earth.jpg";
import finaleCover from "../images/cyber-knight-continues.jpg";

const TRACKS = [
  { title: "Orange Shadow", src: "/music/orange-shadow.mp3" },
  { title: "Rise of Cyber Knight", src: "/music/rise-of-cyber-knight.mp3", coverIndex: 0 },
  { title: "Leaving Earth", src: "/music/leaving-earth.mp3", coverIndex: 1 },
];
const GALLERY = [
  { image: riseCover, title: "Rise of Cyber Knight", subtitle: "The legend begins" },
  { image: earthCover, title: "Leaving Earth", subtitle: "The legend of Cyber Knight · Part II" },
  { image: finaleCover, title: "Leaving Earth", subtitle: "The legend continues" },
];

export default function MusicPlayer() {
  const { t } = useLanguage();
  const { pathname } = useLocation();
  const audioRef = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [error, setError] = useState(false);
  const [activeTrack, setActiveTrack] = useState(0);
  const [activeSlide, setActiveSlide] = useState(0);
  const [open, setOpen] = useState(false);
  const inGame = pathname === "/game" || pathname === "/map";

  useEffect(() => {
    if (inGame) return;
    audioRef.current?.pause();
    setPlaying(false);
    setOpen(false);
  }, [inGame]);

  useEffect(() => {
    if (!playing || !audioRef.current) return;
    audioRef.current.play().catch(() => {
      setPlaying(false);
      setError(true);
    });
  }, [activeTrack]);

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

  const selectTrack = index => {
    setActiveTrack(index);
    const coverIndex = TRACKS[index].coverIndex;
    if (Number.isInteger(coverIndex)) setActiveSlide(coverIndex);
    setError(false);
  };

  const moveSlide = direction => {
    setActiveSlide(current => (current + direction + GALLERY.length) % GALLERY.length);
  };

  if (!inGame) return null;

  const currentCover = GALLERY[activeSlide];

  return <>
    <audio ref={audioRef} src={TRACKS[activeTrack].src} preload="none" loop
      onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)}
      onError={() => { setPlaying(false); setError(true); }} />
    <div style={{ position:"fixed", right:12, bottom:"calc(150px + env(safe-area-inset-bottom))", zIndex:12000, display:"flex", flexDirection:"column", alignItems:"flex-end", gap:6 }}>
      {open && <section aria-label={t("Cyber Knight music and artwork","Музика и обложки на Киберрицаря")}
        style={{width:"min(320px, calc(100vw - 24px))",boxSizing:"border-box",padding:12,border:"1px solid rgba(147,216,255,.72)",borderRadius:14,background:"rgba(8,18,29,.97)",color:"#fff",boxShadow:"0 8px 28px rgba(0,0,0,.58)"}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:8,marginBottom:9}}>
          <strong style={{fontSize:13,letterSpacing:".04em"}}>{t("CYBER KNIGHT SOUNDTRACK","САУНДТРАК НА КИБЕРРИЦАРЯ")}</strong>
          <button type="button" onClick={()=>setOpen(false)} aria-label={t("Close","Затвори")} style={{border:0,background:"transparent",color:"#d9efff",fontSize:20,cursor:"pointer"}}>×</button>
        </div>
        <div style={{position:"relative",width:"100%",aspectRatio:"1.72",overflow:"hidden",borderRadius:9,background:"#101820"}}>
          <img src={currentCover.image} alt={t(currentCover.title,currentCover.title==="Rise of Cyber Knight"?"Възходът на Киберрицаря":"Напускане на Земята")} style={{width:"100%",height:"100%",objectFit:"cover",display:"block"}} />
          <button type="button" onClick={()=>moveSlide(-1)} aria-label={t("Previous image","Предишна снимка")} style={{position:"absolute",left:7,top:"50%",transform:"translateY(-50%)",width:34,height:34,border:0,borderRadius:"50%",background:"rgba(0,0,0,.62)",color:"#fff",fontSize:20,cursor:"pointer"}}>‹</button>
          <button type="button" onClick={()=>moveSlide(1)} aria-label={t("Next image","Следваща снимка")} style={{position:"absolute",right:7,top:"50%",transform:"translateY(-50%)",width:34,height:34,border:0,borderRadius:"50%",background:"rgba(0,0,0,.62)",color:"#fff",fontSize:20,cursor:"pointer"}}>›</button>
          <div style={{position:"absolute",left:0,right:0,bottom:0,padding:"22px 10px 8px",background:"linear-gradient(transparent,rgba(0,0,0,.86))"}}>
            <div style={{fontSize:10,color:"#c9d9e7"}}>{t(currentCover.subtitle,currentCover.subtitle==="The legend begins"?"Легендата започва":currentCover.subtitle==="The legend continues"?"Легендата продължава":"Легендата за Киберрицаря · Част II")}</div>
            <strong style={{fontSize:13}}>{t(currentCover.title,currentCover.title==="Rise of Cyber Knight"?"Възходът на Киберрицаря":"Напускане на Земята")}</strong>
          </div>
        </div>
        <div style={{display:"flex",justifyContent:"center",gap:6,margin:"8px 0 10px"}}>
          {GALLERY.map((slide,index)=><button key={slide.image} type="button" aria-label={t("Show image","Покажи снимка")+" "+(index+1)} aria-pressed={activeSlide===index} onClick={()=>setActiveSlide(index)} style={{width:activeSlide===index?22:8,height:8,padding:0,border:0,borderRadius:9,background:activeSlide===index?"#8dd9ff":"#698091",cursor:"pointer"}} />)}
        </div>
        <div style={{display:"grid",gap:6}}>
          {TRACKS.map((track,index)=><button key={track.src} type="button" aria-pressed={activeTrack===index} onClick={()=>selectTrack(index)}
            style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:8,padding:"9px 10px",border:"1px solid "+(activeTrack===index?"#7bd4ff":"#385166"),borderRadius:8,background:activeTrack===index?"rgba(36,110,144,.48)":"rgba(255,255,255,.04)",color:"#fff",textAlign:"left",fontSize:12,cursor:"pointer"}}>
            <span>{t(track.title,track.title==="Rise of Cyber Knight"?"Възходът на Киберрицаря":track.title==="Leaving Earth"?"Напускане на Земята":track.title)}</span><span aria-hidden="true">{activeTrack===index&&playing?"♫":"♪"}</span>
          </button>)}
        </div>
        {error&&<p role="status" style={{margin:"9px 0 0",fontSize:12,color:"#ffd5cd"}}>{t("Music could not be played. Try again.","Музиката не можа да се пусне. Опитай отново.")}</p>}
      </section>}
      <div style={{display:"flex",gap:6}}>
        <button type="button" onClick={togglePlayback} aria-pressed={playing} aria-label={playing?t("Stop music","Спри музиката"):t("Play music","Пусни музиката")}
          style={{minHeight:44,padding:"9px 14px",border:"1px solid #93d8ff",borderRadius:22,background:playing?"#174f64":"rgba(12,24,34,.94)",color:"#fff",fontWeight:700,boxShadow:"0 2px 12px rgba(0,0,0,.55)",cursor:"pointer"}}>
          {playing?"⏸ "+t("Music","Музика"):"▶ "+t("Music","Музика")}
        </button>
        <button type="button" onClick={()=>setOpen(value=>!value)} aria-expanded={open} aria-label={t("Show music and images","Покажи музика и снимки")}
          style={{minWidth:44,minHeight:44,padding:"8px 12px",border:"1px solid #93d8ff",borderRadius:22,background:open?"#174f64":"rgba(12,24,34,.94)",color:"#fff",fontSize:18,fontWeight:700,boxShadow:"0 2px 12px rgba(0,0,0,.55)",cursor:"pointer"}}>♫</button>
      </div>
    </div>
  </>;
}
