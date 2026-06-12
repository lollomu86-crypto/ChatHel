import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../../lib/api";
import { ArrowLeft, Hotel as HotelIcon, MapPin, Calendar } from "lucide-react";

const fmtDate = (iso) => {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" });
  } catch { return "—"; }
};

const fmtNights = (joined, left) => {
  if (!joined) return null;
  const start = new Date(joined);
  const end = left ? new Date(left) : new Date();
  const ms = end - start;
  if (ms < 0) return null;
  const nights = Math.max(1, Math.round(ms / 86400000));
  return nights;
};

export default function StaysHistory() {
  const [items, setItems] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const { data } = await api.get("/stays/history");
        if (mounted) setItems(data);
      } catch (e) {
        if (mounted) setError(e?.response?.data?.detail || "Errore");
      }
    })();
    return () => { mounted = false; };
  }, []);

  const uniqueHotels = items ? new Set(items.map(s => s.hotel_id)).size : 0;

  return (
    <div className="max-w-2xl mx-auto mt-2 space-y-5" data-testid="stays-history-screen">
      <div className="flex items-center justify-between">
        <Link to="/app/profile" data-testid="back-to-profile" className="inline-flex items-center gap-2 text-sm font-bold hover:text-brand">
          <ArrowLeft size={16}/> Profilo
        </Link>
      </div>

      <div className="brutal-card p-6 bg-sun">
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-700">Il tuo viaggio</p>
        <h2 className="font-display text-4xl font-black tracking-tighter leading-none mt-1">
          {items === null ? "…" : (
            uniqueHotels === 0 ? "Nessun soggiorno ancora"
            : uniqueHotels === 1 ? "Sei stato in 1 hotel"
            : `Sei stato in ${uniqueHotels} hotel`
          )}
        </h2>
        <p className="text-sm text-slate-700 mt-2">
          {items === null ? "Stiamo caricando il tuo storico…"
            : items.length === 0 ? "Quando finirai questo soggiorno, lo vedrai qui."
            : `${items.length} ${items.length === 1 ? "stay registrato" : "stay registrati"} nel tuo profilo permanente.`}
        </p>
      </div>

      {error && (
        <div className="brutal-card p-4 bg-bubbleSelf text-sm" data-testid="stays-history-error">{error}</div>
      )}

      <div className="space-y-3">
        {items && items.map((s) => {
          const nights = fmtNights(s.joined_at, s.left_at);
          return (
            <div key={s.id} data-testid={`stay-row-${s.id}`} className={`brutal-card p-5 ${s.active ? "bg-bubbleSelf" : "bg-white"}`}>
              <div className="flex items-start gap-4">
                <div className={`w-12 h-12 rounded-xl border-2 border-ink flex items-center justify-center shrink-0 shadow-brutal-sm ${s.active ? "bg-sun" : "bg-bubbleReception"}`}>
                  <HotelIcon size={22} strokeWidth={2.5}/>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-display text-xl font-black leading-tight truncate">
                      {s.hotel?.name || "Hotel"}
                    </h3>
                    {s.active && (
                      <span className="text-[10px] font-bold uppercase tracking-widest bg-ink text-cream px-2 py-0.5 rounded-full">In corso</span>
                    )}
                  </div>
                  <p className="text-xs text-slate-600 mt-0.5 inline-flex items-center gap-1">
                    <MapPin size={12}/> Nickname: <span className="font-bold text-slate-800">{s.nickname}</span>
                  </p>
                  <div className="grid grid-cols-2 gap-2 mt-3 text-xs">
                    <div className="bg-cream border-2 border-ink rounded-lg px-3 py-2">
                      <p className="text-[9px] uppercase font-bold tracking-widest text-slate-500">Check-in</p>
                      <p className="font-bold inline-flex items-center gap-1"><Calendar size={11}/> {fmtDate(s.joined_at)}</p>
                    </div>
                    <div className="bg-cream border-2 border-ink rounded-lg px-3 py-2">
                      <p className="text-[9px] uppercase font-bold tracking-widest text-slate-500">Check-out</p>
                      <p className="font-bold inline-flex items-center gap-1">
                        <Calendar size={11}/> {s.left_at ? fmtDate(s.left_at) : "—"}
                      </p>
                    </div>
                  </div>
                  {nights !== null && (
                    <p className="text-[11px] text-slate-600 mt-2">
                      {nights} {nights === 1 ? "notte" : "notti"}{s.active ? " (in corso)" : ""}
                    </p>
                  )}
                </div>
              </div>
            </div>
          );
        })}
        {items && items.length === 0 && (
          <div className="brutal-card p-6 text-center text-sm text-slate-600" data-testid="stays-history-empty">
            Inizia il primo soggiorno per costruire il tuo storico.
          </div>
        )}
      </div>
    </div>
  );
}
