import React, { useEffect, useRef, useState } from "react";
import { api } from "../../lib/api";
import { Send, Trophy, Check } from "lucide-react";
import { toast } from "sonner";

const CHALLENGE_TYPES = [
  { key: "pingpong", label: "Ping pong", emoji: "🏓" },
  { key: "biliardo", label: "Biliardo", emoji: "🎱" },
  { key: "calciobalilla", label: "Calcio balilla", emoji: "⚽" },
  { key: "carte", label: "Carte", emoji: "🃏" },
  { key: "dardi", label: "Freccette", emoji: "🎯" },
];

const ChallengeCard = ({ m, isMine, onAccept }) => {
  const meta = m.meta || {};
  const type = CHALLENGE_TYPES.find((t) => t.key === meta.type) || { label: meta.type || "Sfida", emoji: "🏆" };
  const accepted = meta.status === "accepted";
  return (
    <div data-testid={`challenge-card-${m.id}`} className="brutal-card p-4 bg-sun max-w-[85%]">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-2xl">{type.emoji}</span>
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-700">Sfida lanciata</p>
      </div>
      <p className="font-display text-lg font-black leading-tight">{m.sender_nickname} sfida a {type.label}</p>
      {meta.when && <p className="text-sm text-slate-700 mt-1">⏱ {meta.when}</p>}
      {m.content && <p className="text-sm mt-2 italic">"{m.content}"</p>}
      <div className="mt-3 pt-3 border-t-2 border-ink/20">
        {accepted ? (
          <p className="text-sm font-bold text-ink inline-flex items-center gap-1"><Check size={14}/> Accettata da <span className="bg-mint border-2 border-ink px-1.5 rounded">{meta.accepted_nickname}</span></p>
        ) : isMine ? (
          <p className="text-xs font-bold text-slate-600">In attesa di un avversario…</p>
        ) : (
          <button data-testid={`accept-challenge-${m.id}`} onClick={() => onAccept(m.id)} className="btn-primary !py-1.5 !px-4 text-sm">
            Accetto! 🔥
          </button>
        )}
      </div>
    </div>
  );
};

export const ChatView = ({ messages, me, otherName, variant = "public", emptyText, onAcceptChallenge }) => {
  const endRef = useRef(null);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);
  if (!messages || messages.length === 0) {
    return <div className="flex-1 flex items-center justify-center text-slate-500 text-sm py-12">{emptyText || "Nessun messaggio ancora. Rompi il ghiaccio!"}</div>;
  }
  return (
    <div className="flex-1 overflow-y-auto px-1 py-3 space-y-3">
      {messages.map((m) => {
        const isMe = m.sender_id === me?.id;
        if (m.kind === "challenge") {
          return (
            <div key={m.id} className={`flex flex-col ${isMe ? "items-end" : "items-start"}`}>
              <ChallengeCard m={m} isMine={isMe} onAccept={onAcceptChallenge}/>
              <span className="text-[10px] text-slate-400 mt-1 mx-2">{new Date(m.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
            </div>
          );
        }
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
  const [showChallenge, setShowChallenge] = useState(false);
  const [chType, setChType] = useState("pingpong");
  const [chWhen, setChWhen] = useState("");
  const [chNote, setChNote] = useState("");

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

  const sendChallenge = async () => {
    const t = CHALLENGE_TYPES.find((x) => x.key === chType);
    try {
      await api.post("/messages", {
        channel: "public",
        content: chNote.trim(),
        kind: "challenge",
        meta: { type: chType, when: chWhen.trim(), status: "open" },
      });
      toast.success(`Sfida a ${t?.label} lanciata!`);
      setShowChallenge(false); setChWhen(""); setChNote(""); setChType("pingpong");
      fetchMsgs();
    } catch { toast.error("Errore sfida"); }
  };

  const acceptChallenge = async (id) => {
    try { await api.post(`/messages/${id}/accept`); toast.success("Sfida accettata 🔥"); fetchMsgs(); }
    catch (e) { toast.error(e?.response?.data?.detail || "Errore"); }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-180px)]">
      <div className="mb-2 flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">Sala comune</p>
          <h2 className="font-display text-3xl font-black tracking-tight">Chat pubblica</h2>
          <p className="text-sm text-slate-600">Tutti gli ospiti dell'hotel possono leggere e rispondere.</p>
        </div>
        <button data-testid="open-challenge-btn" onClick={() => setShowChallenge(true)} className="btn-outline !py-2 !px-3 inline-flex items-center gap-2 text-sm shrink-0">
          <Trophy size={16}/> Sfida
        </button>
      </div>
      <ChatView messages={msgs} me={me} variant="public" onAcceptChallenge={acceptChallenge} />
      <ChatComposer onSend={send} initialText={prefill} />

      {showChallenge && (
        <div className="fixed inset-0 bg-ink/40 z-50 flex items-end sm:items-center justify-center p-4" onClick={() => setShowChallenge(false)}>
          <div className="brutal-card p-6 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">Rompighiaccio</p>
            <h3 className="font-display text-2xl font-black mt-1">Lancia una sfida</h3>
            <p className="text-sm text-slate-700 mt-1 mb-4">Scegli il gioco e (opzionale) quando.</p>
            <div className="grid grid-cols-3 gap-2 mb-4">
              {CHALLENGE_TYPES.map((t) => (
                <button
                  key={t.key}
                  data-testid={`challenge-type-${t.key}`}
                  onClick={() => setChType(t.key)}
                  className={`border-2 border-ink rounded-xl p-2 text-xs font-bold flex flex-col items-center gap-1 transition ${chType === t.key ? "bg-sun shadow-brutal-sm" : "bg-white hover:bg-slate-50"}`}
                >
                  <span className="text-xl">{t.emoji}</span>
                  <span>{t.label}</span>
                </button>
              ))}
            </div>
            <input data-testid="challenge-when-input" value={chWhen} onChange={(e) => setChWhen(e.target.value)} placeholder="Quando? (es. tra 10 min)" className="input-brutal mb-3"/>
            <input data-testid="challenge-note-input" value={chNote} onChange={(e) => setChNote(e.target.value)} placeholder="Nota (opzionale) — es. 'vincitore offre un caffè'" className="input-brutal mb-4"/>
            <div className="flex gap-3">
              <button onClick={() => setShowChallenge(false)} className="btn-outline flex-1">Annulla</button>
              <button data-testid="send-challenge-btn" onClick={sendChallenge} className="btn-primary flex-1">Lancia 🏆</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
