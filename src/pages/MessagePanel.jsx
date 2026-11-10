import React, {useEffect, useState} from "react";

const api = (process.env.REACT_APP_API_URL || (window.location.hostname === "localhost" ? "http://localhost:3001" : window.location.origin)).replace(/\/$/, "");

export default function MessagePanel({alliance = false, recipient = "", playerAction}) {
  const [to, setTo] = useState(recipient);
  const [body, setBody] = useState("");
  const [messages, setMessages] = useState([]);
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);
  const [revision, setRevision] = useState(0);
  const userId = sessionStorage.getItem("userId");
  const token = sessionStorage.getItem("authToken");
  const path = api + "/messages/" + (alliance ? "alliance" : "private") + "/" + encodeURIComponent(userId);

  useEffect(() => {
    let active = true;
    let loading = false;
    const refresh = async () => {
      if (loading || document.hidden) return;
      loading = true;
      try {
        const response = await fetch(path, {headers:{Authorization:"Bearer " + token},cache:"no-store"});
        const result = await response.json();
        if (!response.ok) throw new Error(result.message);
        if (active) setMessages(result.messages);
      } catch (error) {
        if (active) {
          setError(error.message);
          if (alliance) setMessages([]);
        }
      } finally {
        loading = false;
      }
    };
    refresh();
    const timer = setInterval(refresh, 5000);
    return () => { active = false; clearInterval(timer); };
  }, [path, token, revision, alliance]);

  const send = async event => {
    event.preventDefault();
    if (sending || !body.trim()) return;
    setSending(true);
    setError("");
    try {
      const response = await fetch(path, {
        method:"POST",
        headers:{Authorization:"Bearer " + token,"Content-Type":"application/json"},
        body:JSON.stringify({recipient:to, body}),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message);
      setBody("");
      setRevision(value => value + 1);
    } catch (error) {
      setError(error.message);
    } finally {
      setSending(false);
    }
  };

  return <section>
    <h3>{alliance ? "Alliance Chat" : "Private Messages"}</h3>
    {error && <p role="alert">{error}</p>}
    {!messages.length && <p>No messages yet.</p>}
    <div style={{maxHeight:"40vh",overflowY:"auto"}}>
      {messages.map(message => <article key={message.id} style={{padding:8,borderBottom:"1px solid #47758e"}}>
        <strong>{playerAction ? playerAction({id:message.senderId,username:message.sender}) : message.sender}</strong>
        {!alliance && <> → {playerAction ? playerAction({id:message.recipientId,username:message.recipient}) : message.recipient}</>}
        {" · "}<time>{new Date(message.sentAt).toLocaleString()}</time>
        <div style={{whiteSpace:"pre-wrap",overflowWrap:"anywhere"}}>{message.body}</div>
      </article>)}
    </div>
    <form onSubmit={send} style={{display:"grid",gap:8,marginTop:12}}>
      {!alliance && <label>To <input required maxLength={32} value={to} onChange={event=>setTo(event.target.value)} placeholder="Player username" /></label>}
      <textarea aria-label="Message" required maxLength={500} value={body} onChange={event=>setBody(event.target.value)} />
      <button disabled={sending || !body.trim() || (!alliance && !to.trim())}>Send</button>
    </form>
  </section>;
}
