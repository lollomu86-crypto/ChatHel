import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../../lib/api";
import { toast } from "sonner";
import { History, ChevronRight, Hotel as HotelIcon, Settings as SettingsIcon } from "lucide-react";

export default function ProfilePanel({ me, onUpdated }) {
  const [status, setStatus] = useState(me?.status_text || "");
  const [loading, setLoading] = useState(false);
  const [historyMeta, setHistoryMeta] = useState(null); // { total, uniqueHotels }

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const { data } = await api.get("/stays/history");
        if (!mounted) return;
        const total = data.length;
        const uniqueHotels = new Set(data.map(s => s.hotel_id)).size;
        setHistoryMeta({ total, uniqueHotels });
      } catch { /* ignore: legacy guests don't have this */ }
    })();
    return () => { mounted = false; };
  }, []);

  const save = async () => {
    setLoading(true);
    try {
      await api.post("/guest/status", { status_text: status });
      toast.success("Stato aggiornato");
      onUpdated && onUpdated({ ...me, status_text: status });
    } catch { toast.error("Errore"); }
    finally { setLoading(false); }
  };

  const quick = ["In piscina ☀️", "In spa 🧖", "Al bar 🍹", "In camera 🛌", "In escursione 🥾", "Cerco compagnia"];

  return (
    <div className="max-w-xl mx-auto mt-2 space-y-5">
      <div className="brutal-card p-6 bg-sun">
        <div className="flex items-center gap-4">
          {me?.photo_url ? (
            <img src={me.photo_url} alt="" className="w-16 h-16 rounded-full border-2 border-ink object-cover shadow-brutal-sm bg-white"/>
          ) : (
            <div className="w-16 h-16 rounded-full border-2 border-ink bg-white flex items-center justify-center font-display font-black text-2xl shadow-brutal-sm">
              {me.nickname.slice(0,2).toUpperCase()}
            </div>
          )}
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-700">Ospite</p>
            <h2 className="font-display text-3xl font-black leading-tight truncate">{me.nickname}</h2>
            <p className="text-xs text-slate-700">Check-in: {new Date(me.checked_in_at).toLocaleString()}</p>
          </div>
        </div>
        {me?.bio && (
          <p className="text-sm text-slate-800 mt-4 border-t-2 border-ink/15 pt-3 italic">&ldquo;{me.bio}&rdquo;</p>
        )}
      </div>

      {/* Stays history teaser */}
      {historyMeta && (
        <Link to="/app/profile/history" data-testid="profile-history-link" className="block brutal-card p-5 hover:bg-bubbleSelf transition group">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl border-2 border-ink bg-bubbleReception flex items-center justify-center shadow-brutal-sm shrink-0">
              <History size={22} strokeWidth={2.5}/>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">Il tuo viaggio</p>
              <p className="font-display text-xl font-black tracking-tight leading-tight">
                {historyMeta.uniqueHotels === 0 ? "Storico soggiorni"
                  : historyMeta.uniqueHotels === 1 ? "Sei stato in 1 hotel"
                  : `Sei stato in ${historyMeta.uniqueHotels} hotel`}
              </p>
              <p className="text-xs text-slate-600 mt-0.5 inline-flex items-center gap-1">
                <HotelIcon size={12}/> {historyMeta.total} {historyMeta.total === 1 ? "soggiorno totale" : "soggiorni totali"}
              </p>
            </div>
            <ChevronRight size={20} strokeWidth={2.5} className="text-slate-500 group-hover:translate-x-0.5 transition"/>
          </div>
        </Link>
      )}

      <Link to="/app/settings" data-testid="profile-settings-link" className="block brutal-card p-5 hover:bg-bubbleSelf transition group">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl border-2 border-ink bg-bubbleReception flex items-center justify-center shadow-brutal-sm shrink-0">
            <SettingsIcon size={22} strokeWidth={2.5}/>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">Preferenze</p>
            <p className="font-display text-xl font-black tracking-tight leading-tight">Impostazioni</p>
            <p className="text-xs text-slate-600 mt-0.5">Installa app, notifiche, profilo e password.</p>
          </div>
          <ChevronRight size={20} strokeWidth={2.5} className="text-slate-500 group-hover:translate-x-0.5 transition"/>
        </div>
      </Link>

      <div className="brutal-card p-6">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500 mb-1">Stato attuale</p>
        <h3 className="font-bold text-lg mb-3">Cosa stai facendo?</h3>
        <textarea data-testid="status-text" value={status} maxLength={80} onChange={(e)=>setStatus(e.target.value)} placeholder="Es. In piscina, organizzo un giro di calici alle 18…" className="input-brutal min-h-[80px] resize-none"/>
        <div className="flex flex-wrap gap-2 mt-3 mb-4">
          {quick.map((q) => (
            <button key={q} data-testid={`quick-status-${q}`} onClick={() => setStatus(q)} className="text-xs bg-white border-2 border-ink rounded-full px-3 py-1 shadow-brutal-sm hover:bg-bubbleSelf">
              {q}
            </button>
          ))}
        </div>
        <button data-testid="save-status-btn" onClick={save} disabled={loading} className="btn-primary w-full">
          {loading ? "Salvataggio…" : "Salva stato"}
        </button>
      </div>

      <div className="brutal-card p-6 bg-bubbleReception">
        <p className="text-sm">Sicurezza: il tuo profilo è permanente, ma le interazioni di chat sono confinate all&apos;hotel attuale. Al check-out vieni rimosso dall&apos;elenco ospiti visibili.</p>
      </div>
    </div>
  );
}
