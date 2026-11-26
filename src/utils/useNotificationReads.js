import {useCallback, useEffect, useRef, useState} from "react";
import {readPending, writePending} from "./usePlayerNotifications";

export function useNotificationReads(api, userId, unreadIds, key, path) {
  const [seen,setSeen]=useState(()=>new Set(readPending(key)));
  const pending=useRef(null);
  const flushing=useRef(false);
  if(pending.current===null)pending.current=new Set(seen);

  const flush=useCallback(async()=>{
    if(!userId||flushing.current)return;
    const stored=readPending(key);
    for(const id of stored)pending.current.add(id);
    if(stored.length)setSeen(current=>stored.every(id=>current.has(id))?current:new Set([...current,...stored]));
    if(!pending.current.size)return;
    flushing.current=true;
    try{
      while(pending.current.size){
        const ids=[...pending.current].slice(0,200);
        const controller=new AbortController();
        const timeout=window.setTimeout(()=>controller.abort(),8000);
        try{
          const response=await fetch(api+path,{
            method:"POST",
            headers:{"Content-Type":"application/json",Authorization:"Bearer "+sessionStorage.getItem("authToken")},
            body:JSON.stringify({ids}),keepalive:true,signal:controller.signal
          });
          if(!response.ok||(await response.json()).success!==true)return;
          const remaining=new Set(readPending(key));
          for(const id of ids){
            pending.current.delete(id);
            remaining.delete(id);
          }
          writePending(key,remaining);
        }finally{window.clearTimeout(timeout);}
      }
    }catch{
      // Persisted receipt IDs are retried when polling or reconnecting.
    }finally{flushing.current=false;}
  },[api,key,path,userId]);

  const markDisplayed=useCallback(ids=>{
    if(!ids.length)return;
    for(const id of ids)pending.current.add(id);
    writePending(key,new Set([...readPending(key),...pending.current]));
    setSeen(current=>ids.every(id=>current.has(id))?current:new Set([...current,...ids]));
    void flush();
  },[flush,key]);

  useEffect(()=>{
    void flush();
    const timer=window.setInterval(flush,10000);
    const onStorage=event=>{if(event.key===key)void flush();};
    window.addEventListener("online",flush);
    window.addEventListener("storage",onStorage);
    return ()=>{
      window.clearInterval(timer);
      window.removeEventListener("online",flush);
      window.removeEventListener("storage",onStorage);
    };
  },[flush,key]);

  return {unreadCount:unreadIds.filter(id=>!seen.has(id)).length,markDisplayed};
}
