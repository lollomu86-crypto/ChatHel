import React, { useEffect, useState } from "react";
import { api, getGuestToken } from "../../lib/api";
import useChatSocket from "../../lib/useChatSocket";
import { ChatView, ChatComposer } from "./PublicChat";
import { toast } from "sonner";

export default function ReceptionChat({ me }) {
  const [msgs, setMsgs] = useState([]);
  const load = async () => { try { const { data } = await api.get("/messages/reception"); setMsgs(data); } catch (e) { console.debug("[chathel] ignored", e); } };
  useEffect(() => { load(); const t = setInterval(load, 20000); return () => clearInterval(t); }, []);

  useChatSocket({
    token: getGuestToken(),
    onEvent: (ev) => {
      if (ev.type !== "message" || ev.message?.channel !== "reception") return;
      const m = ev.message;
      if (m.sender_id === me?.id || m.recipient_id === me?.id) {
        setMsgs((prev) => prev.some((x) => x.id === m.id) ? prev : [...prev, m]);
      }
    },
  });

  const send = async (content) => {
    try { await api.post("/messages", { channel: "reception", content }); load(); }
    catch { toast.error("Errore invio"); }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-180px)]">
      <div className="mb-2">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">Servizio</p>
        <h2 className="font-display text-3xl font-black tracking-tight">Reception</h2>
        <p className="text-sm text-slate-600">Domande, richieste o problemi: lo staff risponde appena possibile.</p>
      </div>
      <ChatView messages={msgs} me={me} variant="private" emptyText="Scrivi alla reception. Lo staff dell'hotel ti risponderà."/>
      <ChatComposer onSend={send} placeholder="Scrivi alla reception…"/>
    </div>
  );
}
