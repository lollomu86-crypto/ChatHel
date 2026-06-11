import React, { useEffect, useState } from "react";
import { api, getGuestToken } from "../../lib/api";
import useChatSocket from "../../lib/useChatSocket";
import { ChatView, ChatComposer } from "./PublicChat";
import { toast } from "sonner";
import { Sparkles } from "lucide-react";

export default function AiChat({ me }) {
  const [msgs, setMsgs] = useState([]);
  const [sending, setSending] = useState(false);

  const load = async () => { try { const { data } = await api.get("/messages/ai"); setMsgs(data); } catch {} };
  useEffect(() => { load(); const t = setInterval(load, 20000); return () => clearInterval(t); }, []);

  useChatSocket({
    token: getGuestToken(),
    onEvent: (ev) => {
      if (ev.type !== "message" || ev.message?.channel !== "ai") return;
      const m = ev.message;
      if (m.sender_id === me?.id || m.recipient_id === me?.id) {
        setMsgs((prev) => prev.some((x) => x.id === m.id) ? prev : [...prev, m]);
        if (m.sender_role === "ai") setSending(false);
      }
    },
  });

  const send = async (content) => {
    setSending(true);
    try { await api.post("/messages", { channel: "ai", content }); await load(); }
    catch { toast.error("Errore: assistente non disponibile"); }
    finally { setSending(false); }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-180px)]">
      <div className="mb-2 flex items-start justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">Assistente</p>
          <h2 className="font-display text-3xl font-black tracking-tight">Concierge AI</h2>
          <p className="text-sm text-slate-600">Risposte rapide su orari, servizi, dintorni.</p>
        </div>
        <span className="tag-pill"><Sparkles size={12}/> GPT-5.2</span>
      </div>
      <ChatView messages={msgs} me={me} variant="ai" emptyText="Chiedi qualsiasi cosa: orari piscina, wifi, suggerimenti…"/>
      {sending && <p className="text-xs text-slate-500 mb-1 ml-2">Concierge AI sta scrivendo…</p>}
      <ChatComposer onSend={send} disabled={sending} placeholder="Chiedi al concierge…"/>
    </div>
  );
}
