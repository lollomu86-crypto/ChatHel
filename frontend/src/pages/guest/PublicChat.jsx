import React, { useEffect, useRef, useState } from "react";
import { api, getGuestToken } from "../../lib/api";
import useChatSocket from "../../lib/useChatSocket";
import { useTranslation } from "react-i18next";
import { Send, Trophy, Check, Languages } from "lucide-react";
import { toast } from "sonner";

const CHALLENGE_TYPES = [
  { key: "pingpong", label: "Ping pong", emoji: "🏓" },
  { key: "biliardo", label: "Biliardo", emoji: "🎱" },
  { key: "calciobalilla", label: "Calcio balilla", emoji: "⚽" },
  { key: "carte", label: "Carte", emoji: "🃏" },
  { key: "dardi", label: "Freccette", emoji: "🎯" },
];

const ChallengeCard = ({ m, isMine, onAccept }) => {
  const { t } = useTranslation();
  const meta = m.meta || {};
  const type = CHALLENGE_TYPES.find((tp) => tp.key === meta.type) || { label: meta.type || "Sfida", emoji: "🏆" };
  const accepted = meta.status === "accepted";
  return (
    <div data-testid={`challenge-card-${m.id}`} className="brutal-card p-4 bg-sun max-w-[85%]">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-2xl">{type.emoji}</span>
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-700">{t("public_chat.challenge_card_label")}</p>
      </div>
      <p className="font-display text-lg font-black leading-tight">{m.sender_nickname} {t("public_chat.challenge_to")} {type.label}</p>
      {meta.when && <p className="text-sm text-slate-700 mt-1">⏱ {meta.when}</p>}
      {m.content && <p className="text-sm mt-2 italic">"{m.content}"</p>}
      <div className="mt-3 pt-3 border-t-2 border-ink/20">
        {accepted ? (
          <p className="text-sm font-bold text-ink inline-flex items-center gap-1"><Check size={14}/> {t("public_chat.challenge_accepted_by")} <span className="bg-mint border-2 border-ink px-1.5 rounded">{meta.accepted_nickname}</span></p>
        ) : isMine ? (
          <p className="text-xs font-bold text-slate-600">{t("public_chat.challenge_waiting")}</p>
        ) : (
          <button data-testid={`accept-challenge-${m.id}`} onClick={() => onAccept(m.id)} className="btn-primary !py-1.5 !px-4 text-sm">
            {t("public_chat.challenge_accept")} 🔥
          </button>
        )}
      </div>
    </div>
  );
};

export const ChatView = ({ messages, me, otherName, variant = "public", emptyText, onAcceptChallenge }) => {
  const { t, i18n } = useTranslation();
  const endRef = useRef(null);
  const [translations, setTranslations] = useState({});
  const [showOriginal, setShowOriginal] = useState({});
  const [translating, setTranslating] = useState({});

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const translateMsg = async (m) => {
    if (translations[m.id]) {
      setShowOriginal((s) => ({ ...s, [m.id]: !s[m.id] }));
      return;
    }
    setTranslating((s) => ({ ...s, [m.id]: true }));
    try {
      const { data } = await api.post("/translate", { text: m.content, target_lang: i18n.language });
      setTranslations((s) => ({ ...s, [m.id]: data.translated }));
    } catch { /* silent */ }
    finally { setTranslating((s) => ({ ...s, [m.id]: false })); }
  };

  if (!messages || messages.length === 0) {
    return <div className="flex-1 flex items-center justify-center text-slate-500 text-sm py-12">{emptyText || t("public_chat.empty")}</div>;
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
        const isTranslated = translations[m.id] && !showOriginal[m.id];
        const shownText = isTranslated ? translations[m.id] : m.content;
        return (
          <div key={m.id} data-testid={`msg-${m.id}`} className={`flex flex-col ${isMe ? "items-end" : "items-start"}`}>
            {!isMe && variant !== "private" && (
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1 ml-2">{m.sender_nickname}</span>
            )}
            <div className={`${bubble} max-w-[78%] text-sm whitespace-pre-wrap break-words`}>{shownText}</div>
            <div className="flex items-center gap-2 mt-1 mx-2">
              <span className="text-[10px] text-slate-400">{new Date(m.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
              {!isMe && (
                <button data-testid={`translate-${m.id}`} onClick={() => translateMsg(m)} disabled={translating[m.id]} className="text-[10px] text-slate-500 hover:text-brand inline-flex items-center gap-1 font-bold uppercase tracking-wider">
                  <Languages size={10}/>
                  {translating[m.id] ? t("common.translating") : translations[m.id] ? (showOriginal[m.id] ? t("common.translate") : t("common.show_original")) : t("common.translate")}
                </button>
              )}
            </div>
          </div>
        );
      })}
      <div ref={endRef}/>
    </div>
  );
};

export const ChatComposer = ({ onSend, disabled, placeholder, initialText = "" }) => {
  const { t } = useTranslation();
  const [text, setText] = useState(initialText);
  useEffect(() => { if (initialText) setText(initialText); }, [initialText]);
  const submit = (e) => {
    e.preventDefault();
    if (!text.trim()) return;
    onSend(text.trim());
    setText("");
  };
  return (
    <form onSubmit={submit} className="sticky bottom-20 bg-cream/95 backdrop-blur-md border-2 border-ink rounded-2xl p-2 shadow-brutal flex gap-2">
      <input data-testid="chat-composer-input" value={text} onChange={(e)=>setText(e.target.value)} placeholder={placeholder || t("public_chat.send_placeholder")} className="flex-1 px-3 py-2 bg-transparent focus:outline-none font-medium text-sm" />
      <button data-testid="chat-send-btn" type="submit" disabled={disabled || !text.trim()} className="bg-brand text-white border-2 border-ink rounded-xl px-4 font-bold shadow-brutal-sm disabled:opacity-50">
        <Send size={16} strokeWidth={2.5}/>
      </button>
    </form>
  );
};

export default function PublicChat({ me }) {
  const { t } = useTranslation();
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
  useEffect(() => { fetchMsgs(); const id = setInterval(fetchMsgs, 20000); return () => clearInterval(id); }, []);

  useChatSocket({
    token: getGuestToken(),
    onEvent: (ev) => {
      if (ev.type === "message" && ev.message?.channel === "public") {
        setMsgs((prev) => prev.some((m) => m.id === ev.message.id) ? prev : [...prev, ev.message]);
      } else if (ev.type === "message_update" && ev.message?.channel === "public") {
        setMsgs((prev) => prev.map((m) => m.id === ev.message.id ? ev.message : m));
      }
    },
  });

  const send = async (content) => {
    try { await api.post("/messages", { channel: "public", content }); fetchMsgs(); }
    catch { toast.error("Errore invio"); }
  };

  const sendChallenge = async () => {
    const t2 = CHALLENGE_TYPES.find((x) => x.key === chType);
    const fallbackContent = `${t2?.label || "Sfida"}${chWhen.trim() ? " · " + chWhen.trim() : ""}`;
    try {
      await api.post("/messages", {
        channel: "public",
        content: chNote.trim() || fallbackContent,
        kind: "challenge",
        meta: { type: chType, when: chWhen.trim(), status: "open" },
      });
      toast.success(`${t("public_chat.challenge_sent")}: ${t2?.label || ""}`);
      setShowChallenge(false); setChWhen(""); setChNote(""); setChType("pingpong");
      fetchMsgs();
    } catch { toast.error(t("common.error")); }
  };

  const acceptChallenge = async (id) => {
    try { await api.post(`/messages/${id}/accept`); toast.success("Sfida accettata 🔥"); fetchMsgs(); }
    catch (e) { toast.error(e?.response?.data?.detail || "Errore"); }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-180px)]">
      <div className="mb-2 flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">{t("public_chat.kicker")}</p>
          <h2 className="font-display text-3xl font-black tracking-tight">{t("public_chat.title")}</h2>
          <p className="text-sm text-slate-600">{t("public_chat.subtitle")}</p>
        </div>
        <button data-testid="open-challenge-btn" onClick={() => setShowChallenge(true)} className="btn-outline !py-2 !px-3 inline-flex items-center gap-2 text-sm shrink-0">
          <Trophy size={16}/> {t("public_chat.challenge_btn")}
        </button>
      </div>
      <ChatView messages={msgs} me={me} variant="public" onAcceptChallenge={acceptChallenge} />
      <ChatComposer onSend={send} initialText={prefill} />

      {showChallenge && (
        <div className="fixed inset-0 bg-ink/40 z-50 flex items-end sm:items-center justify-center p-4" onClick={() => setShowChallenge(false)}>
          <div className="brutal-card p-6 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">{t("public_chat.challenge_kicker")}</p>
            <h3 className="font-display text-2xl font-black mt-1">{t("public_chat.challenge_title")}</h3>
            <p className="text-sm text-slate-700 mt-1 mb-4">{t("public_chat.challenge_sub")}</p>
            <div className="grid grid-cols-3 gap-2 mb-4">
              {CHALLENGE_TYPES.map((ct) => (
                <button
                  key={ct.key}
                  data-testid={`challenge-type-${ct.key}`}
                  onClick={() => setChType(ct.key)}
                  className={`border-2 border-ink rounded-xl p-2 text-xs font-bold flex flex-col items-center gap-1 transition ${chType === ct.key ? "bg-sun shadow-brutal-sm" : "bg-white hover:bg-slate-50"}`}
                >
                  <span className="text-xl">{ct.emoji}</span>
                  <span>{ct.label}</span>
                </button>
              ))}
            </div>
            <input data-testid="challenge-when-input" value={chWhen} onChange={(e) => setChWhen(e.target.value)} placeholder={t("public_chat.when")} className="input-brutal mb-3"/>
            <input data-testid="challenge-note-input" value={chNote} onChange={(e) => setChNote(e.target.value)} placeholder={t("public_chat.note")} className="input-brutal mb-4"/>
            <div className="flex gap-3">
              <button onClick={() => setShowChallenge(false)} className="btn-outline flex-1">{t("common.cancel")}</button>
              <button data-testid="send-challenge-btn" onClick={sendChallenge} className="btn-primary flex-1">{t("public_chat.challenge_launch")} 🏆</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
