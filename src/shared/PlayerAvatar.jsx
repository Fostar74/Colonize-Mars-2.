import React, {useState} from "react";
import AVATARS from "./avatarCatalog";
import commanderArt from "../images/orange-empire-base.png";
import emperorArt from "../images/orange-empire-emperor.png";

const api = (process.env.REACT_APP_API_URL || (window.location.hostname === "localhost"
  ? "http://localhost:3001" : window.location.origin)).replace(/\/$/,"");
function loadPortraits() {
  try {
    const files = require.context("../images/orange-empire-portraits",false,/\.webp$/);
    return Object.fromEntries(files.keys().map(name=>{
      const asset = files(name);
      return [name,asset.default || asset];
    }));
  } catch {
    // Tests render the fallback without Webpack's asset loader.
    return {};
  }
}
const portraits = loadPortraits();

function ImageOrFallback({src,fallback}) {
  const [failed,setFailed] = useState(false);
  return !src || failed ? fallback : <img src={src} alt="" loading="lazy" decoding="async"
    onError={()=>setFailed(true)} style={{width:"100%",height:"100%",objectFit:"cover"}} />;
}

export default function PlayerAvatar({player={},size=38}) {
  let src;
  let fallback = (AVATARS.find(avatar=>avatar.id===player.avatarId) || AVATARS.find(avatar=>avatar.id==="pilot-m")).icon;
  if (player.npc) {
    const id = player.commanderId ?? player.id;
    const emperor = player.emperor || id===10;
    const name = emperor ? "./emperor.webp" : "./commander-"+String(id).padStart(2,"0")+".webp";
    src = portraits[name];
    fallback = <img src={emperor ? emperorArt : commanderArt} alt="" loading="lazy"
      style={{width:"100%",height:"100%",objectFit:"contain"}} />;
  } else if (Number.isSafeInteger(Number(player.id)) && Number(player.id)>0 && /^[a-f0-9]{64}$/.test(player.avatarVersion || "")) {
    src = api+"/player-avatars/"+Number(player.id)+"/"+player.avatarVersion+".webp";
  }
  return <span aria-hidden="true" style={{width:size,height:size,flex:"0 0 "+size+"px",display:"inline-grid",
    placeItems:"center",verticalAlign:"middle",overflow:"hidden",borderRadius:"50%",fontSize:size*0.57,
    background:"radial-gradient(circle at 35% 30%,#718a9c,#263443 72%)"}}>
    <ImageOrFallback key={src || "fallback"} src={src} fallback={fallback} />
  </span>;
}
