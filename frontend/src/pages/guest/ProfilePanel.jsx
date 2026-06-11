import React, { useState } from "react";
import { api } from "../../lib/api";
import { toast } from "sonner";
import { User } from "lucide-react";

export default function ProfilePanel({ me, onUpdated }) {
  const [status, setStatus] = useState(me?.status_text || "");
  const [loading, setLoading] = useState(false);

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
          <div className="w-16 h-16 rounded-full border-2 border-ink bg-white flex items-center justify-center font-display font-black text-2xl shadow-brutal-sm">
            {me.nickname.slice(0,2).toUpperCase()}
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-700">Ospite</p>
            <h2 className="font-display text-3xl font-black leading-tight">{me.nickname}</h2>
            <p className="text-xs text-slate-700">Check-in: {new Date(me.checked_in_at).toLocaleString()}</p>
          </div>
        </div>
      </div>

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
        <p className="text-sm">Sicurezza: il tuo account è temporaneo. Al check-out (logout) i tuoi messaggi vengono archiviati e non sei più visibile agli altri ospiti.</p>
      </div>
    </div>
  );
}
