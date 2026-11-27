import PlayerAvatar from "../shared/PlayerAvatar";
import React, {useEffect,useState} from "react";
import {useLanguage} from "../language";

export default function AllianceMessages({api,canBroadcast,markDisplayed,playerAction}) {
  const {t,language,label:localLabel}=useLanguage();
  const [messages,setMessages]=useState([]);
  const [body,setBody]=useState("");
  const [loading,setLoading]=useState(true);
  const [sending,setSending]=useState(false);
  const [loadError,setLoadError]=useState("");
  const [sendError,setSendError]=useState("");
  const [revision,setRevision]=useState(0);
  const userId=encodeURIComponent(sessionStorage.getItem("userId"));

  useEffect(()=>{
    let active=true,requesting=false;
    const refresh=async()=>{
      if(requesting||document.hidden)return;
      requesting=true;
      try{
        const response=await fetch(api+"/alliance/messages/"+userId,{
          headers:{Authorization:"Bearer "+sessionStorage.getItem("authToken")},cache:"no-store"
        });
        const result=await response.json();
        if(!active)return;
        if(!response.ok){
          if(response.status===401||response.status===403)setMessages([]);
          throw new Error(result.message);
        }
        setMessages(result.messages);
        setLoadError("");
      }catch(error){
        if(active)setLoadError(error.message);
      }finally{
        requesting=false;
        if(active)setLoading(false);
      }
    };
    void refresh();
    const timer=window.setInterval(refresh,5000);
    window.addEventListener("online",refresh);
    document.addEventListener("visibilitychange",refresh);
    return ()=>{
      active=false;
      window.clearInterval(timer);
      window.removeEventListener("online",refresh);
      document.removeEventListener("visibilitychange",refresh);
    };
  },[api,userId,revision]);

  useEffect(()=>{
    if(!document.hidden)markDisplayed(messages.flatMap(message=>message.unreadId==null?[]:[message.unreadId]));
  },[messages,markDisplayed]);

  const send=async event=>{
    event.preventDefault();
    if(sending||!body.trim())return;
    setSending(true);
    setSendError("");
    try{
      const response=await fetch(api+"/messages/broadcast/"+userId,{
        method:"POST",
        headers:{"Content-Type":"application/json",Authorization:"Bearer "+sessionStorage.getItem("authToken")},
        body:JSON.stringify({body})
      });
      const result=await response.json();
      if(!response.ok)throw new Error(result.message);
      setBody("");
      setRevision(current=>current+1);
    }catch(error){setSendError(error.message);}
    finally{setSending(false);}
  };

  return <section>
    <h3>{t("Alliance Messages","Съобщения на алианса")}</h3>
    {loadError&&<p role="alert">{localLabel(loadError)}</p>}
    {loading&&<p>{t("Loading messages…","Зареждане на съобщенията…")}</p>}
    {!loading&&!loadError&&!messages.length&&<p>{t("No alliance messages yet.","Все още няма съобщения на алианса.")}</p>}
    {messages.map(message=><article key={message.id} style={{padding:"8px 0",borderBottom:"1px solid #47758e"}}>
      <PlayerAvatar player={{id:message.senderId,avatarId:message.senderAvatarId,avatarVersion:message.senderAvatarVersion}} size={26} />{" "}<strong>{playerAction?playerAction({id:message.senderId,username:message.sender,avatarId:message.senderAvatarId,avatarVersion:message.senderAvatarVersion}):message.sender}</strong>
      {" · "}<time dateTime={new Date(message.sentAt).toISOString()}>{new Date(message.sentAt).toLocaleString(language)}</time>
      <div style={{whiteSpace:"pre-wrap",overflowWrap:"anywhere"}}>{message.body}</div>
    </article>)}
    {canBroadcast&&<form onSubmit={send} style={{display:"grid",gap:8,marginTop:12}}>
      <label htmlFor="alliance-broadcast">{t("Message to all alliance members","Съобщение до всички членове на алианса")}</label>
      <textarea id="alliance-broadcast" required maxLength={500} value={body} onChange={event=>setBody(event.target.value)} />
      <button disabled={sending||!body.trim()}>{t("Send to all members","Изпрати до всички членове")}</button>
      {sendError&&<p role="alert">{localLabel(sendError)}</p>}
    </form>}
  </section>;
}
