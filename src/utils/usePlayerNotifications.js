import {useCallback, useEffect, useRef, useState} from "react";

function readPending(key) {
  try {
    const ids = JSON.parse(localStorage.getItem(key) || "[]");
    return Array.isArray(ids) ? ids.filter(id => Number.isSafeInteger(id) && id > 0) : [];
  } catch {
    return [];
  }
}

function writePending(key, ids) {
  try {
    if (ids.size) localStorage.setItem(key, JSON.stringify([...ids]));
    else localStorage.removeItem(key);
  } catch {
    // Keep retrying in this tab if persistent storage is unavailable.
  }
}

export default function usePlayerNotifications(api, userId) {
  const [notifications, setNotifications] = useState([]);
  const key = "colonize-mars-pending-notification-reads:" + userId;
  const pending = useRef(null);
  const hidden = useRef(new Set());
  const inFlight = useRef(new Set());
  if (pending.current === null) pending.current = new Set(readPending(key));

  const endpoint = api + "/notifications/" + encodeURIComponent(userId);

  const acknowledge = useCallback(async id => {
    if (inFlight.current.has(id)) return;
    inFlight.current.add(id);
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), 8000);
    try {
      const response = await fetch(endpoint + "/read", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + sessionStorage.getItem("authToken")
        },
        body: JSON.stringify({notificationId: id}),
        keepalive: true,
        signal: controller.signal
      });
      const result = await response.json();
      if ((response.ok && result.success === true) ||
          (response.status === 404 && result.success === false)) {
        pending.current.delete(id);
        const stored = new Set(readPending(key));
        stored.delete(id);
        writePending(key, stored);
      }
    } catch {
      // The next poll, or the next login, retries the pending ID.
    } finally {
      window.clearTimeout(timer);
      inFlight.current.delete(id);
    }
  }, [endpoint, key]);

  const dismiss = useCallback(id => {
    if (hidden.current.has(id)) return;
    hidden.current.add(id);
    pending.current.add(id);
    writePending(key, new Set([...readPending(key), ...pending.current]));
    setNotifications(current => current.filter(item => item.id !== id));
    void acknowledge(id);
  }, [acknowledge, key]);

  useEffect(() => {
    if (!userId) return;
    let active = true;
    let polling = false;
    const refresh = async () => {
      if (polling) return;
      polling = true;
      for (const id of readPending(key)) pending.current.add(id);
      for (const id of pending.current) {
        hidden.current.add(id);
        void acknowledge(id);
      }
      setNotifications(current => current.some(item => hidden.current.has(item.id))
        ? current.filter(item => !hidden.current.has(item.id)) : current);
      try {
        const response = await fetch(endpoint, {
          headers: {Authorization: "Bearer " + sessionStorage.getItem("authToken")},
          cache: "no-store"
        });
        if (!response.ok || !active) return;
        const data = await response.json();
        if (!active) return;
        const unique = new Map(data.notifications.map(item => [item.id, item]));
        setNotifications([...unique.values()].filter(item => !hidden.current.has(item.id)));
      } catch {
        // Keep the current queue until the next successful poll.
      } finally {
        polling = false;
      }
    };
    void refresh();
    const timer = window.setInterval(refresh, 10000);
    window.addEventListener("online", refresh);
    return () => {
      active = false;
      window.clearInterval(timer);
      window.removeEventListener("online", refresh);
    };
  }, [acknowledge, endpoint, key, userId]);

  return {notifications, dismiss};
}
