import React, { useEffect, useRef, useState } from "react";
import { api } from "../../lib/api";
import { Send } from "lucide-react";
import { toast } from "sonner";

export const ChatView = ({ messages, me, otherName, variant = "public", emptyText }) => {
  const endRef = useRef(null);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);
  if (!messages || messages.length === 0) {
    return <div className="flex-1 flex items-center justify-center text-slate-500 text-sm py-12">{emptyText || "Nessun messaggio ancora. Rompi il ghiaccio!"}</div>;
  }
  return (
    <div className="flex-1 overflow-y-auto px-1 py-3 space-y-3">
      {messages.map((m) => {
        const isMe = m.sender_id === me?.id;
        const isBot = m.sender_role === "ai" || m.sender_role === "reception";
        const bubble = isMe ? "bubble-self" : isBot ? "bubble-reception" : "bubble-other";
        return (
          <div key={m.id} data-testid={`msg-${m.id}`} className={`flex flex-col ${isMe ? "items-end" : "items-start"}`}>
            {!isMe && variant !== "private" && (
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1 ml-2">{m.sender_nickname}</span>
            )}
            <div className={`${bubble} max-w-[78%] text-sm whitespace-pre-wrap break-words`}>{m.content}</div>
            <span className="text-[10px] text-slate-400 mt-1 mx-2">{new Date(m.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
          </div>
        );
      })}
      <div ref={endRef}/>
    </div>
  );
};

export const ChatComposer = ({ onSend, disabled, placeholder = "Scrivi un messaggio…", initialText = "" }) => {
  const [t, setT] = useState(initialText);
  useEffect(() => { if (initialText) setT(initialText); }, [initialText]);
  const submit = (e) => {
    e.preventDefault();
    if (!t.trim()) return;
    onSend(t.trim());
    setT("");
  };
  return (
    <form onSubmit={submit} className="sticky bottom-20 bg-cream/95 backdrop-blur-md border-2 border-ink rounded-2xl p-2 shadow-brutal flex gap-2">
      <input data-testid="chat-composer-input" value={t} onChange={(e)=>setT(e.target.value)} placeholder={placeholder} className="flex-1 px-3 py-2 bg-transparent focus:outline-none font-medium text-sm" />
      <button data-testid="chat-send-btn" type="submit" disabled={disabled || !t.trim()} className="bg-brand text-white border-2 border-ink rounded-xl px-4 font-bold shadow-brutal-sm disabled:opacity-50">
        <Send size={16} strokeWidth={2.5}/>
      </button>
    </form>
  );
};

export default function PublicChat({ me }) {
  const [msgs, setMsgs] = useState([]);
  const [prefill, setPrefill] = useState("");
  useEffect(() => {
    const p = sessionStorage.getItem("chathel_prefill");
    if (p) { setPrefill(p); sessionStorage.removeItem("chathel_prefill"); }
  }, []);
  const fetchMsgs = async () => {
    try { const { data } = await api.get("/messages/public"); setMsgs(data); } catch {}
  };
  useEffect(() => { fetchMsgs(); const id = setInterval(fetchMsgs, 3000); return () => clearInterval(id); }, []);

  const send = async (content) => {
    try { await api.post("/messages", { channel: "public", content }); fetchMsgs(); }
    catch { toast.error("Errore invio"); }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-180px)]">
      <div className="mb-2">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">Sala comune</p>
        <h2 className="font-display text-3xl font-black tracking-tight">Chat pubblica</h2>
        <p className="text-sm text-slate-600">Tutti gli ospiti dell'hotel possono leggere e rispondere.</p>
      </div>
      <ChatView messages={msgs} me={me} variant="public" />
      <ChatComposer onSend={send} initialText={prefill} />
    </div>
  );
}
