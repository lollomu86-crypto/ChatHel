import React from "react";
import { Link } from "react-router-dom";
import { QrCode, MessageSquare, CalendarHeart, Sparkles, ArrowRight, Hotel } from "lucide-react";
import Logo from "../components/Logo";

const Feature = ({ icon: Icon, title, desc, bg }) => (
  <div className="brutal-card brutal-card-hover p-6" style={{ background: bg }} data-testid={`feature-${title.toLowerCase().replace(/\s/g,'-')}`}>
    <div className="w-12 h-12 rounded-xl border-2 border-ink bg-white flex items-center justify-center shadow-brutal-sm mb-4">
      <Icon size={24} strokeWidth={2.5} />
    </div>
    <h3 className="text-xl font-bold mb-2">{title}</h3>
    <p className="text-slate-700 text-sm leading-relaxed">{desc}</p>
  </div>
);

export default function Landing() {
  return (
    <div className="min-h-screen">
      {/* Nav */}
      <header className="bg-cream/80 backdrop-blur-xl border-b-2 border-ink sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-5 py-4 flex items-center justify-between">
          <Logo size={56} withText textClass="text-3xl"/>
          <div className="flex items-center gap-3">
            <Link to="/admin/login" data-testid="nav-admin-link" className="hidden sm:inline-flex text-sm font-bold text-slate-700 hover:text-ink">
              Per hotel
            </Link>
            <Link to="/login" data-testid="nav-login-link" className="btn-primary text-sm">Entra</Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="max-w-6xl mx-auto px-5 pt-12 sm:pt-20 pb-14 grid lg:grid-cols-12 gap-10 items-center">
        <div className="lg:col-span-7">
          <span className="tag-pill mb-5"><Sparkles size={14}/> Solo per ospiti dell'hotel</span>
          <h1 className="font-display font-black text-5xl sm:text-6xl lg:text-7xl leading-[0.95] tracking-tighter mb-6">
            La tua stanza<br/>
            <span className="bg-sun border-2 border-ink px-3 inline-block -rotate-1 shadow-brutal-sm">virtuale</span><br/>
            in hotel.
          </h1>
          <p className="text-lg text-slate-700 max-w-xl mb-8 leading-relaxed">
            Chat privata fra ospiti, eventi dell'hotel, prenotazioni di aree comuni e un concierge AI. Tutto in un'unica app, accessibile solo con il codice del tuo hotel.
          </p>
          <div className="flex flex-wrap gap-4">
            <Link to="/login" data-testid="hero-cta-login" className="btn-primary inline-flex items-center gap-2">
              Entra con codice <ArrowRight size={18}/>
            </Link>
            <Link to="/admin/login" data-testid="hero-cta-admin" className="btn-outline inline-flex items-center gap-2">
              <Hotel size={18}/> Sono un hotel
            </Link>
          </div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-600 mt-8">
            Demo: codice <span className="bg-sun border border-ink px-1.5">WELCOME2026</span>
          </p>
        </div>
        <div className="lg:col-span-5">
          <div className="relative">
            <div className="brutal-card p-5 rotate-2">
              <div className="flex items-center gap-3 mb-3">
                <img
                  src="https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200&q=80&auto=format&fit=crop&crop=faces"
                  alt="Sofia"
                  className="w-11 h-11 rounded-full border-2 border-ink object-cover object-center shadow-brutal-sm shrink-0"
                />
                <div>
                  <p className="font-bold text-sm">Sofia · 412</p>
                  <p className="text-xs text-slate-500">In piscina ☀️</p>
                </div>
              </div>
              <div className="bubble-other text-sm max-w-[80%] mb-2">Chi viene al tour in barca domani? 🛥️</div>
              <div className="bubble-self text-sm max-w-[80%] ml-auto">Io ci sono! Posso aggiungere altri due amici?</div>
            </div>
            <div className="brutal-card p-4 -rotate-3 mt-5 ml-8 bg-bubbleReception">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-full bg-accent2 border-2 border-ink"></div>
                <p className="font-bold text-sm">Concierge AI</p>
              </div>
              <p className="text-sm mt-2">La spa è prenotabile fino alle 21. Vuoi che la prenoti per te?</p>
            </div>
            <div className="brutal-card p-4 rotate-1 mt-5 ml-2 bg-sun max-w-[260px]">
              <p className="text-xs font-bold uppercase tracking-widest">Evento di oggi</p>
              <p className="font-bold mt-1">Aperitivo al tramonto</p>
              <p className="text-xs text-slate-700">19:00 · Piscina Sky</p>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="bg-ink py-16">
        <div className="max-w-6xl mx-auto px-5">
          <h2 className="font-display text-4xl sm:text-5xl font-black text-white tracking-tight mb-3">Pensata per ospiti e hotel.</h2>
          <p className="text-slate-300 mb-10 max-w-2xl">Una rete chiusa, sicura e temporanea — solo per chi sta soggiornando.</p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            <Feature icon={QrCode} title="Accesso QR" desc="Entri solo se sei un ospite registrato. Logout automatico al check-out." bg="#FFFDF7"/>
            <Feature icon={MessageSquare} title="Chat tra ospiti" desc="Pubblica per organizzare attività, privata per fare conoscenza." bg="#D8F3DC"/>
            <Feature icon={Sparkles} title="Concierge AI 24/7" desc="Domande sull'hotel? Risposte istantanee, personalizzate dall'hotel." bg="#FFE5D9"/>
            <Feature icon={CalendarHeart} title="Bacheca eventi" desc="Aperitivi, escursioni, cene tematiche. Sempre aggiornati." bg="#F9DC5C"/>
            <Feature icon={Hotel} title="Aree comuni" desc="Prenoti spa, palestra, sala giochi direttamente dall'app." bg="#FFFDF7"/>
            <Feature icon={MessageSquare} title="Reception diretta" desc="Scrivi alla reception senza chiamare. Risposte rapide." bg="#fff"/>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-4xl mx-auto px-5 py-20 text-center">
        <h2 className="font-display text-4xl sm:text-5xl font-black tracking-tighter mb-5">Pronto a scoprire chi alloggia con te?</h2>
        <p className="text-slate-700 mb-8">Inserisci il codice ricevuto dall'hotel e crea il tuo nickname.</p>
        <Link to="/login" data-testid="footer-cta-login" className="btn-primary inline-flex items-center gap-2">
          Inizia ora <ArrowRight size={18}/>
        </Link>
      </section>

      <footer className="border-t-2 border-ink py-6">
        <div className="max-w-6xl mx-auto px-5 text-sm text-slate-600 flex flex-wrap justify-between gap-2">
          <span>© 2026 ChatHel — La rete chiusa per ospiti.</span>
          <span>Costruito per hotel moderni.</span>
        </div>
      </footer>
    </div>
  );
}
