import { useEffect, useRef } from "react";

/**
 * Subscribes the calling component to ChatHel WebSocket events.
 * Reconnects with exponential backoff. The `onEvent` callback receives the
 * parsed JSON payload pushed by the backend (e.g. {type:'message',message:{...}}).
 */
export default function useChatSocket({ token, role = "guest", onEvent }) {
  const cbRef = useRef(onEvent);
  cbRef.current = onEvent;

  useEffect(() => {
    if (!token) return;
    let socket = null;
    let stopped = false;
    let retry = 0;
    let timer = null;

    const buildUrl = () => {
      const backend = process.env.REACT_APP_BACKEND_URL || "";
      const wsUrl = backend.replace(/^http/i, "ws");
      return `${wsUrl}/api/ws?token=${encodeURIComponent(token)}&role=${role}`;
    };

    const connect = () => {
      if (stopped) return;
      try {
        socket = new WebSocket(buildUrl());
      } catch (e) {
        scheduleReconnect();
        return;
      }
      socket.onopen = () => { retry = 0; };
      socket.onmessage = (ev) => {
        try {
          const data = JSON.parse(ev.data);
          cbRef.current && cbRef.current(data);
        } catch (e) { console.debug("[chathel] ignored", e); }
      };
      socket.onclose = () => { if (!stopped) scheduleReconnect(); };
      socket.onerror = () => { try { socket && socket.close(); } catch (e) { console.debug("[chathel] ignored", e); } };
    };

    const scheduleReconnect = () => {
      retry = Math.min(retry + 1, 6);
      const delay = 500 * 2 ** (retry - 1); // 500ms,1s,2s,4s,8s,16s,32s
      timer = setTimeout(connect, delay);
    };

    connect();
    return () => {
      stopped = true;
      if (timer) clearTimeout(timer);
      try { socket && socket.close(); } catch (e) { console.debug("[chathel] ignored", e); }
    };
  }, [token, role]);
}
