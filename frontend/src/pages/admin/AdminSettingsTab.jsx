import React, { useEffect, useState } from "react";
import { api } from "../../lib/api";
import { toast } from "sonner";
import { Save, KeyRound, Coffee, Bot, Globe, Image as ImageIcon, Palette, Building2 } from "lucide-react";

/**
 * Admin → Impostazioni tab. Lets the hotel modify all its core settings,
 * including welcome coupon, AI prompt, branding, default language and
 * admin password.
 */
export default function AdminSettingsTab({ hotel, tpls, onUpdated }) {
  return (
    <div className="grid lg:grid-cols-2 gap-5">
      <div className="space-y-5">
        <HotelIdentitySection hotel={hotel} onUpdated={onUpdated}/>
        <BrandingSection hotel={hotel} onUpdated={onUpdated}/>
        <PasswordSection/>
      </div>
      <div className="space-y-5">
        <WelcomeCouponSection hotel={hotel} tpls={tpls} onUpdated={onUpdated}/>
        <AiPromptSection hotel={hotel} onUpdated={onUpdated}/>
      </div>
    </div>
  );
}

const Section = ({ icon, title, subtitle, children, testid }) => (
  <div className="brutal-card p-5" data-testid={testid}>
    <div className="flex items-start gap-3 mb-4">
      <div className="w-11 h-11 rounded-xl border-2 border-ink bg-sun shadow-brutal-sm flex items-center justify-center shrink-0">{icon}</div>
      <div className="min-w-0">
        <h3 className="font-display text-xl font-black tracking-tight leading-none">{title}</h3>
        {subtitle && <p className="text-xs text-slate-600 mt-1.5">{subtitle}</p>}
      </div>
    </div>
    {children}
  </div>
);

function HotelIdentitySection({ hotel, onUpdated }) {
  const [name, setName] = useState(hotel?.name || "");
  const [code, setCode] = useState(hotel?.access_code || "");
  const [lang, setLang] = useState(hotel?.default_language || "it");
  const [busy, setBusy] = useState(false);
  useEffect(() => { setName(hotel?.name || ""); setCode(hotel?.access_code || ""); setLang(hotel?.default_language || "it"); }, [hotel]);

  const save = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await api.patch("/admin/hotel", { name, access_code: code, default_language: lang });
      toast.success("Hotel aggiornato");
      onUpdated && onUpdated();
    } catch (err) { toast.error(err?.response?.data?.detail || "Errore"); }
    finally { setBusy(false); }
  };

  return (
    <Section testid="admin-section-identity" icon={<Building2 size={20} strokeWidth={2.5}/>} title="Anagrafica hotel" subtitle="Nome, codice di accesso, lingua di default.">
      <form onSubmit={save} className="space-y-3">
        <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-600">Nome hotel</label>
        <input data-testid="admin-hotel-name" value={name} onChange={(e)=>setName(e.target.value)} className="input-brutal" required maxLength={80}/>
        <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-600">Codice di accesso ospiti</label>
        <input data-testid="admin-hotel-code" value={code} onChange={(e)=>setCode(e.target.value.toUpperCase())} className="input-brutal font-mono tracking-widest uppercase" required maxLength={32} minLength={4}/>
        <p className="text-[11px] text-slate-500 -mt-1">Cambiando il codice gli ospiti dovranno usare quello nuovo per entrare.</p>
        <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-600 inline-flex items-center gap-1"><Globe size={12}/> Lingua di default</label>
        <select data-testid="admin-hotel-lang" value={lang} onChange={(e)=>setLang(e.target.value)} className="input-brutal">
          <option value="it">Italiano</option>
          <option value="en">English</option>
          <option value="es">Español</option>
          <option value="fr">Français</option>
          <option value="de">Deutsch</option>
          <option value="pt">Português</option>
          <option value="nl">Nederlands</option>
          <option value="ru">Русский</option>
          <option value="zh">中文</option>
          <option value="ja">日本語</option>
        </select>
        <button data-testid="admin-hotel-save" disabled={busy} type="submit" className="btn-primary w-full inline-flex items-center justify-center gap-2"><Save size={16}/> {busy ? "…" : "Salva"}</button>
      </form>
    </Section>
  );
}

function BrandingSection({ hotel, onUpdated }) {
  const [logo, setLogo] = useState(hotel?.logo_url || "");
  const [color, setColor] = useState(hotel?.brand_color || "#1E40AF");
  const [busy, setBusy] = useState(false);
  useEffect(() => { setLogo(hotel?.logo_url || ""); setColor(hotel?.brand_color || "#1E40AF"); }, [hotel]);

  const save = async (e) => {
    e.preventDefault();
    setBusy(true);
    try { await api.patch("/admin/hotel", { logo_url: logo, brand_color: color }); toast.success("Branding aggiornato"); onUpdated && onUpdated(); }
    catch (err) { toast.error(err?.response?.data?.detail || "Errore"); }
    finally { setBusy(false); }
  };

  return (
    <Section testid="admin-section-branding" icon={<Palette size={20} strokeWidth={2.5}/>} title="Logo & colore brand" subtitle="Personalizza l'identità visiva dell'hotel.">
      <form onSubmit={save} className="space-y-3">
        <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-600 inline-flex items-center gap-1"><ImageIcon size={12}/> URL logo (pubblico)</label>
        <input data-testid="admin-logo-url" value={logo} onChange={(e)=>setLogo(e.target.value)} placeholder="https://…" className="input-brutal"/>
        {logo && (
          <div className="flex items-center gap-3 p-3 bg-cream border-2 border-ink rounded-lg">
            <img src={logo} alt="logo" className="w-10 h-10 rounded object-contain bg-white border-2 border-ink"/>
            <span className="text-xs text-slate-600 truncate">{logo}</span>
          </div>
        )}
        <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-600">Colore brand</label>
        <div className="flex items-center gap-2">
          <input data-testid="admin-brand-color-picker" type="color" value={color} onChange={(e)=>setColor(e.target.value)} className="w-14 h-12 border-2 border-ink rounded cursor-pointer"/>
          <input data-testid="admin-brand-color-text" value={color} onChange={(e)=>setColor(e.target.value)} className="input-brutal font-mono flex-1" maxLength={9}/>
        </div>
        <button data-testid="admin-branding-save" disabled={busy} type="submit" className="btn-primary w-full inline-flex items-center justify-center gap-2"><Save size={16}/> {busy ? "…" : "Salva branding"}</button>
      </form>
    </Section>
  );
}

function PasswordSection() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (next.length < 6) return toast.error("Password troppo corta (min 6)");
    if (next !== confirm) return toast.error("Le password non coincidono");
    setBusy(true);
    try {
      await api.post("/admin/change-password", { current_password: current, new_password: next });
      toast.success("Password aggiornata");
      setCurrent(""); setNext(""); setConfirm("");
    } catch (err) { toast.error(err?.response?.data?.detail || "Errore"); }
    finally { setBusy(false); }
  };

  return (
    <Section testid="admin-section-password" icon={<KeyRound size={20} strokeWidth={2.5}/>} title="Password admin" subtitle="Cambia la password della dashboard hotel.">
      <form onSubmit={submit} className="space-y-3">
        <input data-testid="admin-pwd-current" type="password" value={current} onChange={(e)=>setCurrent(e.target.value)} placeholder="Password attuale" className="input-brutal" required minLength={6}/>
        <input data-testid="admin-pwd-new" type="password" value={next} onChange={(e)=>setNext(e.target.value)} placeholder="Nuova password" className="input-brutal" required minLength={6}/>
        <input data-testid="admin-pwd-confirm" type="password" value={confirm} onChange={(e)=>setConfirm(e.target.value)} placeholder="Conferma nuova password" className="input-brutal" required minLength={6}/>
        <button data-testid="admin-pwd-save" type="submit" disabled={busy} className="btn-primary w-full inline-flex items-center justify-center gap-2"><Save size={16}/> {busy ? "…" : "Aggiorna password"}</button>
      </form>
    </Section>
  );
}

function WelcomeCouponSection({ hotel, tpls, onUpdated }) {
  const [tplId, setTplId] = useState(hotel?.welcome_coupon_template_id || "");
  const [msg, setMsg] = useState(hotel?.welcome_coupon_message || "");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    setTplId(hotel?.welcome_coupon_template_id || "");
    setMsg(hotel?.welcome_coupon_message || "");
  }, [hotel]);

  const save = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await api.patch("/admin/hotel", {
        welcome_coupon_template_id: tplId || "",
        welcome_coupon_message: msg,
      });
      toast.success("Welcome coupon aggiornato");
      onUpdated && onUpdated();
    } catch (err) { toast.error(err?.response?.data?.detail || "Errore"); }
    finally { setBusy(false); }
  };

  const selected = tpls.find((t) => t.id === tplId);

  return (
    <Section testid="admin-section-welcome-coupon" icon={<Coffee size={20} strokeWidth={2.5}/>} title="Welcome coupon" subtitle="Coupon automatico consegnato all'ospite al check-in.">
      <form onSubmit={save} className="space-y-3">
        <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-600">Coupon dal catalogo</label>
        <select data-testid="admin-welcome-coupon-tpl" value={tplId} onChange={(e)=>setTplId(e.target.value)} className="input-brutal">
          <option value="">Nessuno (disattivato)</option>
          {tpls.map((t) => (<option key={t.id} value={t.id}>{`${t.emoji} ${t.name}`}</option>))}
        </select>
        {selected && (
          <div className="brutal-card p-3 bg-bubbleSelf">
            <p className="text-xl">{selected.emoji} <span className="font-bold">{selected.name}</span></p>
            <p className="text-xs text-slate-700 mt-1">{selected.description}</p>
          </div>
        )}
        <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-600">Messaggio personalizzato</label>
        <textarea data-testid="admin-welcome-coupon-msg" value={msg} onChange={(e)=>setMsg(e.target.value.slice(0,200))} placeholder="Benvenuto! Un piccolo regalo per iniziare…" className="input-brutal min-h-[80px]" maxLength={200}/>
        <p className="text-[10px] text-slate-500 text-right">{msg.length}/200</p>
        <button data-testid="admin-welcome-coupon-save" disabled={busy} type="submit" className="btn-primary w-full inline-flex items-center justify-center gap-2"><Save size={16}/> {busy ? "…" : "Salva welcome coupon"}</button>
      </form>
    </Section>
  );
}

function AiPromptSection({ hotel, onUpdated }) {
  const [prompt, setPrompt] = useState(hotel?.ai_prompt || "");
  const [busy, setBusy] = useState(false);
  useEffect(() => { setPrompt(hotel?.ai_prompt || ""); }, [hotel]);

  const save = async (e) => {
    e.preventDefault();
    setBusy(true);
    try { await api.patch("/admin/hotel", { ai_prompt: prompt }); toast.success("AI concierge aggiornato"); onUpdated && onUpdated(); }
    catch (err) { toast.error(err?.response?.data?.detail || "Errore"); }
    finally { setBusy(false); }
  };

  return (
    <Section testid="admin-section-ai-prompt" icon={<Bot size={20} strokeWidth={2.5}/>} title="AI Concierge" subtitle="Personalità e istruzioni del concierge AI per i tuoi ospiti.">
      <form onSubmit={save} className="space-y-3">
        <textarea
          data-testid="admin-ai-prompt"
          value={prompt}
          onChange={(e)=>setPrompt(e.target.value.slice(0,4000))}
          placeholder="Sei il concierge AI dell'hotel… Servizi: piscina (8-22), spa…, Wifi…"
          className="input-brutal min-h-[180px] text-sm leading-relaxed"
          maxLength={4000}
        />
        <p className="text-[10px] text-slate-500 text-right">{prompt.length}/4000</p>
        <button data-testid="admin-ai-prompt-save" disabled={busy} type="submit" className="btn-primary w-full inline-flex items-center justify-center gap-2"><Save size={16}/> {busy ? "…" : "Salva prompt"}</button>
      </form>
    </Section>
  );
}
