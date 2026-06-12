import React, { useEffect, useState } from "react";
import { api, getGuestToken } from "../../lib/api";
import useChatSocket from "../../lib/useChatSocket";
import { Gift, Sparkles, Check, Send } from "lucide-react";
import { toast } from "sonner";

const fmtPrice = (cents, ccy = "EUR") => (cents / 100).toFixed(2).replace(/\.00$/, "") + " " + (ccy === "EUR" ? "€" : ccy);

const CouponCard = ({ c, mode, onRedeem }) => {
  const fromHotel = c.sender_type === "hotel";
  const redeemed = c.status === "redeemed";
  return (
    <div data-testid={`coupon-${c.id}`} className={`brutal-card p-4 ${redeemed ? "bg-slate-100 opacity-80" : fromHotel ? "bg-sun" : "bg-bubbleSelf"}`}>
      <div className="flex items-start gap-3">
        <div className="w-12 h-12 rounded-xl bg-white border-2 border-ink shadow-brutal-sm flex items-center justify-center text-2xl shrink-0">{c.emoji}</div>
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-600">{fromHotel ? "Omaggio hotel" : mode === "received" ? `Da ${c.sender_nickname}` : `A ${c.recipient_nickname}`}</p>
          <p className="font-display text-lg font-black truncate">{c.name}</p>
          <p className="text-sm text-slate-700">{c.description}</p>
          {c.message && <p className="text-sm italic mt-1 text-slate-700">&quot;{c.message}&quot;</p>}
        </div>
        <div className="text-right shrink-0">
          <p className="font-bold">{fmtPrice(c.price_cents, c.currency)}</p>
          <p className="text-[10px] font-mono mt-1 bg-white border border-ink rounded px-1.5">{c.code}</p>
        </div>
      </div>
      <div className="mt-3 flex items-center justify-between gap-2 pt-3 border-t-2 border-ink/15">
        <span className={`text-xs font-bold inline-flex items-center gap-1 ${redeemed ? "text-slate-500" : "text-mint" }`}>
          {redeemed ? <><Check size={12}/> Usato il {new Date(c.redeemed_at).toLocaleDateString()}</> : <><Sparkles size={12}/> Valido</>}
        </span>
        {!redeemed && mode === "received" && (
          <button data-testid={`redeem-${c.id}`} onClick={() => onRedeem(c.id)} className="btn-primary !py-1.5 !px-4 text-xs">
            Usa coupon
          </button>
        )}
      </div>
    </div>
  );
};

const SendCouponModal = ({ open, onClose, recipient, onSent }) => {
  const [tpls, setTpls] = useState([]);
  const [guests, setGuests] = useState([]);
  const [tplId, setTplId] = useState("");
  const [recId, setRecId] = useState(recipient?.id || "");
  const [note, setNote] = useState("");
  const [phase, setPhase] = useState("pick"); // pick → paying → done
  useEffect(() => {
    if (!open) return;
    setPhase("pick"); setTplId(""); setNote(""); setRecId(recipient?.id || "");
    api.get("/coupon-templates").then(({ data }) => setTpls(data));
    if (!recipient) api.get("/guests").then(({ data }) => setGuests(data));
  }, [open, recipient]);

  const submit = async () => {
    if (!tplId || !recId) return toast.error("Scegli destinatario e regalo");
    setPhase("paying");
    await new Promise((r) => setTimeout(r, 1200)); // mock payment delay
    try {
      const { data } = await api.post("/coupons", { template_id: tplId, recipient_id: recId, message: note });
      setPhase("done");
      onSent && onSent(data);
      setTimeout(() => { onClose(); }, 1400);
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Errore");
      setPhase("pick");
    }
  };

  if (!open) return null;
  const sel = tpls.find((t) => t.id === tplId);
  return (
    <div className="fixed inset-0 bg-ink/50 z-[55] flex items-end sm:items-center justify-center p-4" onClick={onClose}>
      <div className="brutal-card p-6 w-full max-w-lg bg-white" onClick={(e) => e.stopPropagation()}>
        {phase === "pick" && (
          <>
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">Regala</p>
            <h3 className="font-display text-2xl font-black mt-1 mb-4">{recipient ? `Coupon per ${recipient.nickname}` : "Manda un coupon"}</h3>
            {!recipient && (
              <select data-testid="coupon-recipient-select" value={recId} onChange={(e) => setRecId(e.target.value)} className="input-brutal mb-4">
                <option value="">Seleziona destinatario…</option>
                {guests.map((g) => (<option key={g.id} value={g.id}>{g.nickname}</option>))}
              </select>
            )}
            <div className="grid grid-cols-2 gap-3 max-h-72 overflow-y-auto pr-1">
              {tpls.map((t) => (
                <button key={t.id} data-testid={`coupon-tpl-${t.id}`} onClick={() => setTplId(t.id)} className={`text-left p-3 rounded-xl border-2 border-ink shadow-brutal-sm transition ${tplId === t.id ? "bg-sun" : "bg-white hover:bg-slate-50"}`}>
                  <div className="flex items-start gap-2">
                    <span className="text-2xl">{t.emoji}</span>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-sm leading-tight">{t.name}</p>
                      <p className="text-xs text-slate-600 truncate">{t.description}</p>
                    </div>
                  </div>
                  <p className="text-right font-bold text-sm mt-1">{fmtPrice(t.price_cents, t.currency)}</p>
                </button>
              ))}
            </div>
            <textarea data-testid="coupon-note-input" value={note} onChange={(e) => setNote(e.target.value)} maxLength={200} placeholder="Aggiungi un messaggio (opzionale)" className="input-brutal mt-4 min-h-[60px] resize-none"/>
            <div className="flex gap-3 mt-4">
              <button onClick={onClose} className="btn-outline flex-1">Annulla</button>
              <button data-testid="send-coupon-btn" onClick={submit} disabled={!tplId || !recId} className="btn-primary flex-1">
                Paga {sel ? fmtPrice(sel.price_cents, sel.currency) : "—"}
              </button>
            </div>
            <p className="text-[10px] text-slate-500 mt-2 text-center">Pagamento di dimostrazione — nessun addebito reale.</p>
          </>
        )}
        {phase === "paying" && (
          <div className="py-12 text-center" data-testid="coupon-paying">
            <div className="w-16 h-16 mx-auto rounded-full border-4 border-ink border-t-transparent animate-spin"/>
            <p className="font-display text-xl font-black mt-5">Pagamento in corso…</p>
            <p className="text-sm text-slate-600 mt-1">Stiamo confermando la transazione (mock)</p>
          </div>
        )}
        {phase === "done" && (
          <div className="py-12 text-center" data-testid="coupon-sent-confirmation">
            <div className="w-20 h-20 mx-auto rounded-full bg-mint border-2 border-ink shadow-brutal-sm flex items-center justify-center">
              <Check size={36} strokeWidth={3}/>
            </div>
            <p className="font-display text-2xl font-black mt-4">Coupon inviato! 🎁</p>
            <p className="text-sm text-slate-600 mt-1">Riceverà una notifica immediata.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export { SendCouponModal };

export default function CouponsPage({ me }) {
  const [tab, setTab] = useState("received");
  const [received, setReceived] = useState([]);
  const [sent, setSent] = useState([]);
  const [showSend, setShowSend] = useState(false);

  const load = async () => {
    try {
      const [r, s] = await Promise.all([api.get("/coupons/received"), api.get("/coupons/sent")]);
      setReceived(r.data); setSent(s.data);
    } catch (e) { console.debug("[chathel] ignored", e); }
  };
  useEffect(() => { load(); const t = setInterval(load, 30000); return () => clearInterval(t); }, []);

  useChatSocket({
    token: getGuestToken(),
    onEvent: (ev) => { if (ev.type === "coupon_received" || ev.type === "coupon_updated") load(); },
  });

  const redeem = async (id) => {
    try { await api.post(`/coupons/${id}/redeem`); toast.success("Coupon usato 🎉"); load(); }
    catch (e) { toast.error(e?.response?.data?.detail || "Errore"); }
  };

  const list = tab === "received" ? received : sent;
  return (
    <div className="space-y-4 mt-2">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">Regali</p>
          <h2 className="font-display text-3xl font-black tracking-tight">Coupon</h2>
          <p className="text-sm text-slate-600">Ricevi e regala benefit dell'hotel.</p>
        </div>
        <button data-testid="open-send-coupon-btn" onClick={() => setShowSend(true)} className="btn-primary inline-flex items-center gap-2 text-sm !py-2 !px-3">
          <Gift size={16}/> Regala
        </button>
      </div>

      <div className="flex gap-2 p-1 bg-white border-2 border-ink rounded-xl shadow-brutal-sm w-fit">
        <button data-testid="tab-coupons-received" onClick={() => setTab("received")} className={`px-4 py-2 rounded-lg text-sm font-bold ${tab === "received" ? "bg-sun border-2 border-ink shadow-brutal-sm" : "text-slate-600 hover:bg-slate-50"}`}>Ricevuti ({received.length})</button>
        <button data-testid="tab-coupons-sent" onClick={() => setTab("sent")} className={`px-4 py-2 rounded-lg text-sm font-bold ${tab === "sent" ? "bg-sun border-2 border-ink shadow-brutal-sm" : "text-slate-600 hover:bg-slate-50"}`}>Inviati ({sent.length})</button>
      </div>

      {list.length === 0 ? (
        <div className="brutal-card p-6 text-slate-600 text-sm">
          {tab === "received" ? "Nessun coupon ricevuto ancora." : "Non hai ancora regalato nulla. Tocca \"Regala\" per iniziare!"}
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 gap-4">
          {list.map((c) => (<CouponCard key={c.id} c={c} mode={tab} onRedeem={redeem}/>))}
        </div>
      )}

      <SendCouponModal open={showSend} onClose={() => setShowSend(false)} onSent={() => { toast.success("Coupon inviato 🎁"); load(); }}/>
    </div>
  );
}
