import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, clearAdminToken } from "../lib/api";
import { toast } from "sonner";
import { LogOut, Plus, Trash2, Users, CalendarHeart, MapPinned, MessageSquare, Send } from "lucide-react";
import Logo from "../components/Logo";

const Tab = ({ active, onClick, children, testid }) => (
  <button data-testid={testid} onClick={onClick} className={`px-4 py-2 rounded-xl font-bold text-sm border-2 border-ink transition ${active ? "bg-sun shadow-brutal-sm" : "bg-white hover:bg-slate-50"}`}>
    {children}
  </button>
);

export default function AdminDashboard() {
  const nav = useNavigate();
  const [tab, setTab] = useState("guests");
  const [hotel, setHotel] = useState(null);
  const [guests, setGuests] = useState([]);
  const [events, setEvents] = useState([]);
  const [areas, setAreas] = useState([]);
  const [threads, setThreads] = useState([]);
  const [activeThread, setActiveThread] = useState(null);
  const [threadMsgs, setThreadMsgs] = useState([]);
  const [replyText, setReplyText] = useState("");

  const loadAll = async () => {
    try {
      const [me, g, e, a, t] = await Promise.all([
        api.get("/admin/me"), api.get("/admin/guests"), api.get("/admin/events"),
        api.get("/admin/areas"), api.get("/admin/reception/threads"),
      ]);
      setHotel(me.data.hotel); setGuests(g.data); setEvents(e.data); setAreas(a.data); setThreads(t.data);
    } catch {
      clearAdminToken(); nav("/admin/login");
    }
  };
  useEffect(() => { loadAll(); const id = setInterval(loadAll, 5000); return () => clearInterval(id); }, []);

  useEffect(() => {
    if (!activeThread) return;
    const fetch = async () => { const { data } = await api.get(`/admin/reception/${activeThread.guest_id}`); setThreadMsgs(data); };
    fetch(); const id = setInterval(fetch, 3000); return () => clearInterval(id);
  }, [activeThread]);

  const logout = () => { clearAdminToken(); localStorage.removeItem("chathel_admin_hotel"); nav("/"); };

  return (
    <div className="min-h-screen bg-admincanvas">
      <header className="bg-white border-b-2 border-ink sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-5 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Logo size={46}/>
            <div>
              <p className="text-[10px] uppercase font-bold tracking-[0.2em] text-slate-500">Admin · ChatHel</p>
              <h1 className="font-display font-black text-xl tracking-tight">{hotel?.name || "…"}</h1>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden sm:inline tag-pill">Codice: {hotel?.access_code}</span>
            <button data-testid="admin-logout-btn" onClick={logout} className="btn-outline !py-2 !px-4 inline-flex items-center gap-2 text-sm"><LogOut size={14}/> Esci</button>
          </div>
        </div>
        <div className="max-w-6xl mx-auto px-5 pb-3 flex gap-2 flex-wrap">
          <Tab testid="admin-tab-guests" active={tab==="guests"} onClick={()=>setTab("guests")}><Users size={14} className="inline -mt-0.5 mr-1"/> Ospiti ({guests.filter(g=>g.active).length})</Tab>
          <Tab testid="admin-tab-events" active={tab==="events"} onClick={()=>setTab("events")}><CalendarHeart size={14} className="inline -mt-0.5 mr-1"/> Eventi</Tab>
          <Tab testid="admin-tab-areas" active={tab==="areas"} onClick={()=>setTab("areas")}><MapPinned size={14} className="inline -mt-0.5 mr-1"/> Aree</Tab>
          <Tab testid="admin-tab-reception" active={tab==="reception"} onClick={()=>setTab("reception")}><MessageSquare size={14} className="inline -mt-0.5 mr-1"/> Reception ({threads.length})</Tab>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-5 py-6">
        {tab === "guests" && <GuestsTab guests={guests} reload={loadAll}/>}
        {tab === "events" && <EventsTab events={events} reload={loadAll}/>}
        {tab === "areas" && <AreasTab areas={areas} reload={loadAll}/>}
        {tab === "reception" && (
          <ReceptionTab threads={threads} active={activeThread} msgs={threadMsgs} replyText={replyText} setReplyText={setReplyText} onOpen={setActiveThread}
            onSend={async () => {
              if (!replyText.trim() || !activeThread) return;
              try { await api.post(`/admin/reception/${activeThread.guest_id}`, { channel: "reception", content: replyText, recipient_id: activeThread.guest_id }); setReplyText(""); }
              catch { toast.error("Errore invio"); }
            }}
          />
        )}
      </main>
    </div>
  );
}

const GuestsTab = ({ guests, reload }) => {
  const checkout = async (id) => {
    if (!window.confirm("Effettuare check-out di questo ospite?")) return;
    try { await api.post(`/admin/guests/${id}/checkout`); toast.success("Check-out eseguito"); reload(); } catch {}
  };
  return (
    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {guests.length === 0 && <p className="text-slate-600">Nessun ospite ancora.</p>}
      {guests.map((g) => (
        <div key={g.id} data-testid={`admin-guest-${g.id}`} className={`brutal-card p-4 ${g.active ? "" : "opacity-60"}`}>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full border-2 border-ink bg-sun flex items-center justify-center font-display font-black shadow-brutal-sm">
              {g.nickname.slice(0,2).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-bold truncate">{g.nickname}</p>
              <p className="text-xs text-slate-600 truncate">{g.status_text || (g.active ? "Online" : "Check-out")}</p>
              <p className="text-[10px] text-slate-500">Check-in: {new Date(g.checked_in_at).toLocaleString()}</p>
            </div>
          </div>
          {g.active && (
            <button data-testid={`admin-checkout-${g.id}`} onClick={() => checkout(g.id)} className="mt-3 text-xs btn-outline !py-1.5 !px-3 inline-flex items-center gap-1">
              <LogOut size={12}/> Check-out
            </button>
          )}
        </div>
      ))}
    </div>
  );
};

const EventsTab = ({ events, reload }) => {
  const [form, setForm] = useState({ title: "", description: "", event_time: "", location: "", image_url: "" });
  const create = async (e) => {
    e.preventDefault();
    try { await api.post("/admin/events", form); toast.success("Evento creato"); setForm({ title: "", description: "", event_time: "", location: "", image_url: "" }); reload(); }
    catch { toast.error("Errore"); }
  };
  const del = async (id) => { if (!window.confirm("Eliminare?")) return; await api.delete(`/admin/events/${id}`); reload(); };
  return (
    <div className="grid lg:grid-cols-3 gap-5">
      <form onSubmit={create} className="brutal-card p-5 space-y-3 lg:col-span-1 h-fit">
        <h3 className="font-display font-black text-xl">Nuovo evento</h3>
        <input data-testid="event-title-input" required value={form.title} onChange={(e)=>setForm({...form, title: e.target.value})} placeholder="Titolo" className="input-brutal"/>
        <textarea data-testid="event-desc-input" required value={form.description} onChange={(e)=>setForm({...form, description: e.target.value})} placeholder="Descrizione" className="input-brutal min-h-[80px]"/>
        <input data-testid="event-time-input" required value={form.event_time} onChange={(e)=>setForm({...form, event_time: e.target.value})} placeholder="Orario (es. Oggi 19:00)" className="input-brutal"/>
        <input data-testid="event-loc-input" value={form.location} onChange={(e)=>setForm({...form, location: e.target.value})} placeholder="Luogo" className="input-brutal"/>
        <input data-testid="event-img-input" value={form.image_url} onChange={(e)=>setForm({...form, image_url: e.target.value})} placeholder="URL immagine (opz.)" className="input-brutal"/>
        <button data-testid="event-create-btn" type="submit" className="btn-primary w-full inline-flex items-center justify-center gap-2"><Plus size={16}/> Pubblica</button>
      </form>
      <div className="lg:col-span-2 grid sm:grid-cols-2 gap-4">
        {events.map((ev) => (
          <div key={ev.id} className="brutal-card p-4">
            {ev.image_url && <img src={ev.image_url} alt={ev.title} className="w-full h-32 object-cover rounded-md border-2 border-ink mb-3"/>}
            <div className="flex justify-between items-start gap-2">
              <h4 className="font-bold">{ev.title}</h4>
              <button data-testid={`event-delete-${ev.id}`} onClick={()=>del(ev.id)} className="text-slate-500 hover:text-brand"><Trash2 size={14}/></button>
            </div>
            <p className="text-xs text-slate-600 mt-1">{ev.event_time} {ev.location && `· ${ev.location}`}</p>
            <p className="text-sm mt-2">{ev.description}</p>
          </div>
        ))}
      </div>
    </div>
  );
};

const AreasTab = ({ areas, reload }) => {
  const [form, setForm] = useState({ name: "", description: "", hours: "08:00 - 22:00", image_url: "", bookable: true });
  const create = async (e) => {
    e.preventDefault();
    try { await api.post("/admin/areas", form); toast.success("Area creata"); setForm({ name: "", description: "", hours: "08:00 - 22:00", image_url: "", bookable: true }); reload(); }
    catch { toast.error("Errore"); }
  };
  const del = async (id) => { if (!window.confirm("Eliminare?")) return; await api.delete(`/admin/areas/${id}`); reload(); };
  return (
    <div className="grid lg:grid-cols-3 gap-5">
      <form onSubmit={create} className="brutal-card p-5 space-y-3 lg:col-span-1 h-fit">
        <h3 className="font-display font-black text-xl">Nuova area</h3>
        <input data-testid="area-name-input" required value={form.name} onChange={(e)=>setForm({...form, name: e.target.value})} placeholder="Nome (es. Piscina)" className="input-brutal"/>
        <textarea data-testid="area-desc-input" required value={form.description} onChange={(e)=>setForm({...form, description: e.target.value})} placeholder="Descrizione" className="input-brutal min-h-[80px]"/>
        <input data-testid="area-hours-input" value={form.hours} onChange={(e)=>setForm({...form, hours: e.target.value})} placeholder="Orari" className="input-brutal"/>
        <input data-testid="area-img-input" value={form.image_url} onChange={(e)=>setForm({...form, image_url: e.target.value})} placeholder="URL immagine (opz.)" className="input-brutal"/>
        <label className="flex items-center gap-2 text-sm font-bold">
          <input type="checkbox" checked={form.bookable} onChange={(e)=>setForm({...form, bookable: e.target.checked})}/> Prenotabile
        </label>
        <button data-testid="area-create-btn" type="submit" className="btn-primary w-full inline-flex items-center justify-center gap-2"><Plus size={16}/> Crea area</button>
      </form>
      <div className="lg:col-span-2 grid sm:grid-cols-2 gap-4">
        {areas.map((a) => (
          <div key={a.id} className="brutal-card p-4">
            {a.image_url && <img src={a.image_url} alt={a.name} className="w-full h-32 object-cover rounded-md border-2 border-ink mb-3"/>}
            <div className="flex justify-between items-start gap-2">
              <h4 className="font-bold">{a.name}</h4>
              <button data-testid={`area-delete-${a.id}`} onClick={()=>del(a.id)} className="text-slate-500 hover:text-brand"><Trash2 size={14}/></button>
            </div>
            <p className="text-xs text-slate-600">{a.hours} {a.bookable ? "· prenotabile" : ""}</p>
            <p className="text-sm mt-2">{a.description}</p>
          </div>
        ))}
      </div>
    </div>
  );
};

const ReceptionTab = ({ threads, active, msgs, replyText, setReplyText, onOpen, onSend }) => (
  <div className="grid lg:grid-cols-3 gap-5 h-[70vh]">
    <div className="brutal-card p-3 overflow-y-auto">
      <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500 mb-2 px-2">Conversazioni</p>
      {threads.length === 0 ? (
        <p className="text-sm text-slate-600 p-2">Nessuna conversazione.</p>
      ) : threads.map((t) => (
        <button key={t.guest_id} data-testid={`reception-thread-${t.guest_id}`} onClick={() => onOpen(t)} className={`w-full text-left p-3 rounded-xl border-2 border-ink mb-2 transition ${active?.guest_id === t.guest_id ? "bg-sun shadow-brutal-sm" : "bg-white hover:bg-slate-50"}`}>
          <p className="font-bold text-sm">{t.guest_nickname}</p>
          <p className="text-xs text-slate-600 line-clamp-1">{t.last_message}</p>
        </button>
      ))}
    </div>
    <div className="brutal-card p-4 lg:col-span-2 flex flex-col">
      {!active ? (
        <p className="text-slate-600 text-sm m-auto">Seleziona una conversazione.</p>
      ) : (
        <>
          <div className="border-b-2 border-ink pb-2 mb-3">
            <p className="font-bold">{active.guest_nickname}</p>
          </div>
          <div className="flex-1 overflow-y-auto space-y-2 pr-2">
            {msgs.map((m) => (
              <div key={m.id} className={`flex ${m.sender_role === "reception" ? "justify-end" : "justify-start"}`}>
                <div className={`${m.sender_role === "reception" ? "bubble-self" : "bubble-other"} max-w-[80%] text-sm`}>{m.content}</div>
              </div>
            ))}
          </div>
          <form onSubmit={(e)=>{e.preventDefault(); onSend();}} className="mt-3 flex gap-2">
            <input data-testid="reception-reply-input" value={replyText} onChange={(e)=>setReplyText(e.target.value)} placeholder="Rispondi all'ospite…" className="input-brutal flex-1"/>
            <button data-testid="reception-reply-btn" type="submit" className="btn-primary inline-flex items-center gap-1"><Send size={14}/> Invia</button>
          </form>
        </>
      )}
    </div>
  </div>
);
