import React, { useEffect, useState } from "react";
import { api } from "../../lib/api";
import { Link } from "react-router-dom";
import { MessageCircle } from "lucide-react";

const palette = ["#FFE5D9", "#D8F3DC", "#F9DC5C", "#E0E7FF", "#FFD6E0", "#CDE7FF"];

export default function GuestsDirectory({ me }) {
  const [guests, setGuests] = useState([]);
  useEffect(() => {
    const load = async () => { try { const { data } = await api.get("/guests"); setGuests(data); } catch {} };
    load(); const id = setInterval(load, 5000); return () => clearInterval(id);
  }, []);
  const others = guests.filter((g) => g.id !== me?.id);

  return (
    <div className="space-y-4 mt-2">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">Persone</p>
        <h2 className="font-display text-3xl font-black tracking-tight">Ospiti in hotel · {others.length}</h2>
        <p className="text-sm text-slate-600">Tocca per chattare in privato.</p>
      </div>
      {others.length === 0 ? (
        <div className="brutal-card p-6 text-slate-600">Per ora sei l'unico ospite online. Riprova più tardi!</div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {others.map((g, i) => (
            <Link key={g.id} to={`/app/guests/${g.id}`} data-testid={`guest-card-${g.id}`} className="brutal-card brutal-card-hover p-4 flex items-center gap-3" style={{ background: palette[i % palette.length] }}>
              <div className="w-12 h-12 rounded-full border-2 border-ink bg-white flex items-center justify-center font-display font-black text-lg shadow-brutal-sm shrink-0">
                {g.nickname.slice(0,2).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold truncate">{g.nickname}</p>
                <p className="text-xs text-slate-700 truncate">{g.status_text || "Online ora"}</p>
              </div>
              <div className="w-9 h-9 rounded-full bg-white border-2 border-ink flex items-center justify-center shadow-brutal-sm">
                <MessageCircle size={14} strokeWidth={2.5}/>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
