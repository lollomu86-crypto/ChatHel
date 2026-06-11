import React, { useEffect, useState } from "react";
import { api } from "../../lib/api";
import { useNavigate } from "react-router-dom";
import { CalendarHeart, MapPin, Clock, Sparkles, MessageSquare } from "lucide-react";
import { toast } from "sonner";

const bookableColor = (i) => ["#FFE5D9", "#D8F3DC", "#F9DC5C", "#fff"][i % 4];

export default function HomeFeed() {
  const navigate = useNavigate();
  const [events, setEvents] = useState([]);
  const [areas, setAreas] = useState([]);
  const [daily, setDaily] = useState(null);
  const [bookingArea, setBookingArea] = useState(null);
  const [slot, setSlot] = useState("");

  const load = async () => {
    const [e, a, q] = await Promise.all([api.get("/events"), api.get("/areas"), api.get("/daily-question")]);
    setEvents(e.data); setAreas(a.data); setDaily(q.data);
  };
  useEffect(() => { load(); }, []);

  const shareQuestion = () => {
    if (!daily) return;
    sessionStorage.setItem("chathel_prefill", `🤔 Domanda del giorno: ${daily.question}`);
    navigate("/app/public");
  };

  const book = async () => {
    if (!slot.trim()) return toast.error("Inserisci un orario");
    try {
      await api.post(`/areas/${bookingArea.id}/book`, { slot });
      toast.success(`Prenotazione confermata per ${bookingArea.name}`);
      setBookingArea(null); setSlot("");
    } catch (e) { toast.error("Errore prenotazione"); }
  };

  return (
    <div className="space-y-8 mt-2">
      {daily && (
        <section data-testid="daily-question-banner" className="brutal-card p-5 sm:p-6 bg-sun flex flex-col sm:flex-row sm:items-center gap-4 justify-between">
          <div className="flex items-start sm:items-center gap-3">
            <div className="w-11 h-11 shrink-0 rounded-xl bg-white border-2 border-ink shadow-brutal-sm flex items-center justify-center">
              <Sparkles size={20} strokeWidth={2.5}/>
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-700">Rompighiaccio · Domanda del giorno</p>
              <p className="font-display text-xl sm:text-2xl font-black tracking-tight">{daily.question}</p>
            </div>
          </div>
          <button data-testid="share-daily-question-btn" onClick={shareQuestion} className="btn-primary inline-flex items-center gap-2 self-start sm:self-auto">
            <MessageSquare size={16}/> Condividi nella chat
          </button>
        </section>
      )}
      <section>
        <div className="flex items-end justify-between mb-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">Bacheca</p>
            <h2 className="font-display text-3xl font-black tracking-tight">Eventi in hotel</h2>
          </div>
          <span className="tag-pill"><Sparkles size={12}/> Live</span>
        </div>
        {events.length === 0 ? (
          <div className="brutal-card p-6 text-slate-600">Nessun evento programmato.</div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {events.map((ev) => (
              <article key={ev.id} data-testid={`event-card-${ev.id}`} className="brutal-card brutal-card-hover overflow-hidden">
                {ev.image_url && (
                  <div className="aspect-[16/10] border-b-2 border-ink overflow-hidden">
                    <img src={ev.image_url} alt={ev.title} className="w-full h-full object-cover"/>
                  </div>
                )}
                <div className="p-4">
                  <h3 className="font-bold text-lg leading-tight">{ev.title}</h3>
                  <p className="text-sm text-slate-700 mt-1 mb-3">{ev.description}</p>
                  <div className="flex items-center gap-3 text-xs text-slate-600">
                    <span className="inline-flex items-center gap-1"><Clock size={12}/> {ev.event_time}</span>
                    {ev.location && <span className="inline-flex items-center gap-1"><MapPin size={12}/> {ev.location}</span>}
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <section>
        <div className="flex items-end justify-between mb-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">Aree comuni</p>
            <h2 className="font-display text-3xl font-black tracking-tight">Prenota uno spazio</h2>
          </div>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {areas.map((a, i) => (
            <article key={a.id} data-testid={`area-card-${a.id}`} className="brutal-card brutal-card-hover overflow-hidden" style={{ background: bookableColor(i) }}>
              {a.image_url && (
                <div className="aspect-[16/10] border-b-2 border-ink overflow-hidden">
                  <img src={a.image_url} alt={a.name} className="w-full h-full object-cover"/>
                </div>
              )}
              <div className="p-4">
                <h3 className="font-bold text-lg">{a.name}</h3>
                <p className="text-sm text-slate-700 mt-1 mb-3">{a.description}</p>
                <div className="flex items-center justify-between">
                  <span className="text-xs inline-flex items-center gap-1"><Clock size={12}/> {a.hours}</span>
                  {a.bookable && (
                    <button data-testid={`book-area-${a.id}`} onClick={() => setBookingArea(a)} className="text-xs btn-primary !py-1.5 !px-3">Prenota</button>
                  )}
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      {bookingArea && (
        <div className="fixed inset-0 bg-ink/40 z-50 flex items-end sm:items-center justify-center p-4" onClick={()=>setBookingArea(null)}>
          <div className="brutal-card p-6 w-full max-w-md" onClick={(e)=>e.stopPropagation()}>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">Prenota</p>
            <h3 className="font-display text-2xl font-black mt-1">{bookingArea.name}</h3>
            <p className="text-sm text-slate-700 mt-1 mb-4">Indica l'orario preferito</p>
            <input data-testid="booking-slot-input" value={slot} onChange={(e)=>setSlot(e.target.value)} placeholder="es. Oggi 18:00 - 19:30" className="input-brutal mb-4"/>
            <div className="flex gap-3">
              <button onClick={()=>setBookingArea(null)} className="btn-outline flex-1">Annulla</button>
              <button data-testid="confirm-booking-btn" onClick={book} className="btn-primary flex-1">Conferma</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
