import React, { useEffect, useState, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api, clearUserToken, getUserToken } from "../../lib/api";
import { toast } from "sonner";
import { ArrowLeft, Bell, BellOff, Download, KeyRound, Trash2, UserCog, Camera, Save, LogOut, Smartphone, X, ArrowUp } from "lucide-react";
import {
  isPushSupported,
  getPushPermission,
  subscribeToPush,
  unsubscribeFromPush,
} from "../../lib/push";
import LanguageSwitcher from "../../components/LanguageSwitcher";

/**
 * /app/settings — central user-facing settings.
 * Sections: install PWA · push notifications · language · profile ·
 *           password · delete account.
 */
export default function SettingsPanel({ me }) {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);

  const loadUser = useCallback(async () => {
    try { const { data } = await api.get("/auth/me"); setUser(data.user); }
    catch { /* legacy guest — no user profile */ }
  }, []);
  useEffect(() => { loadUser(); }, [loadUser]);

  const isPermanentUser = !!getUserToken();

  return (
    <div className="max-w-2xl mx-auto mt-2 space-y-5 pb-6" data-testid="settings-screen">
      <div className="flex items-center justify-between">
        <Link to="/app/profile" data-testid="back-to-profile" className="inline-flex items-center gap-2 text-sm font-bold hover:text-brand">
          <ArrowLeft size={16}/> Profilo
        </Link>
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">Impostazioni</p>
      </div>

      <h1 className="font-display text-4xl font-black tracking-tighter">Impostazioni.</h1>

      <InstallCard/>
      <NotificationsCard/>
      <LanguageCard/>

      {isPermanentUser && user && <ProfileCard user={user} onUpdated={loadUser}/>}
      {isPermanentUser && user && <PasswordCard hasPassword={!!user.password_hash || user.auth_provider !== "google"}/>}
      {isPermanentUser && user && (
        <DangerZoneCard
          onDeleted={() => { clearUserToken(); toast.success("Account eliminato"); navigate("/", { replace: true }); }}
        />
      )}

      {!isPermanentUser && (
        <div className="brutal-card p-5 bg-bubbleReception">
          <p className="text-sm font-bold mb-1">Sei in modalità ospite temporaneo</p>
          <p className="text-xs text-slate-700">Per gestire profilo, password e account in modo persistente, crea un account permanente al prossimo check-in.</p>
        </div>
      )}
    </div>
  );
}

/* ────────── Install PWA ────────── */
function InstallCard() {
  const [deferred, setDeferred] = useState(null);
  const [installed, setInstalled] = useState(false);
  const [showIosGuide, setShowIosGuide] = useState(false);

  // Detect iOS (iPhone/iPad/iPod) — Safari does not fire beforeinstallprompt
  const isIos = typeof navigator !== "undefined" &&
    /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
  const isSafari = typeof navigator !== "undefined" &&
    /^((?!chrome|android|crios|fxios).)*safari/i.test(navigator.userAgent);

  useEffect(() => {
    const onBefore = (e) => { e.preventDefault(); setDeferred(e); };
    const onInstalled = () => { setInstalled(true); setDeferred(null); };
    window.addEventListener("beforeinstallprompt", onBefore);
    window.addEventListener("appinstalled", onInstalled);
    // Already installed (standalone) heuristic
    const standalone = window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
    if (standalone) setInstalled(true);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBefore);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const install = async () => {
    if (!deferred) return;
    deferred.prompt();
    const choice = await deferred.userChoice;
    if (choice.outcome === "accepted") toast.success("App installata 🎉");
    setDeferred(null);
  };

  return (
    <Section icon={<Download size={20} strokeWidth={2.5}/>} title="Installa l'app" subtitle="Aggiungi ChatHel alla home, apri come app nativa.">
      {installed ? (
        <p className="text-sm text-slate-700" data-testid="pwa-installed">App già installata sul dispositivo.</p>
      ) : deferred ? (
        <button data-testid="pwa-install-btn" onClick={install} className="btn-primary inline-flex items-center gap-2">
          <Download size={16}/> Installa ora
        </button>
      ) : isIos ? (
        <>
          <button
            data-testid="pwa-ios-guide-btn"
            onClick={() => setShowIosGuide(true)}
            className="btn-primary inline-flex items-center gap-2"
          >
            <Smartphone size={16}/> Mostra istruzioni iPhone
          </button>
          {!isSafari && (
            <p className="text-xs text-slate-600 mt-3" data-testid="pwa-ios-not-safari">
              ⚠️ Su iPhone l&apos;installazione funziona <span className="font-bold">solo con Safari</span>. Apri questa pagina in Safari per continuare.
            </p>
          )}
          {showIosGuide && <IosInstallGuide onClose={() => setShowIosGuide(false)} isSafari={isSafari}/>}
        </>
      ) : (
        <p className="text-sm text-slate-700" data-testid="pwa-unavailable">
          Sul tuo dispositivo apri il menu del browser → <span className="font-bold">&quot;Aggiungi alla schermata Home&quot;</span>.
        </p>
      )}
    </Section>
  );
}

/* iOS step-by-step modal */
function IosInstallGuide({ onClose, isSafari }) {
  return (
    <div className="fixed inset-0 bg-ink/60 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={onClose} data-testid="ios-install-guide">
      <div className="bg-cream border-t-2 sm:border-2 border-ink shadow-brutal w-full sm:max-w-md sm:rounded-2xl p-6 max-h-[92vh] overflow-y-auto" onClick={(e)=>e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3 mb-2">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">iPhone · iPad</p>
            <h3 className="font-display text-2xl font-black tracking-tight">Installa ChatHel</h3>
          </div>
          <button data-testid="ios-guide-close" onClick={onClose} className="text-slate-500 hover:text-brand"><X size={20}/></button>
        </div>
        {!isSafari && (
          <div className="brutal-card p-3 bg-bubbleSelf mb-4 text-sm">
            ⚠️ Apri questa pagina con <span className="font-bold">Safari</span> (l&apos;icona della bussola). Altri browser non possono installare PWA su iOS.
          </div>
        )}
        <ol className="space-y-4 mt-3">
          <IosStep n={1} title="Tocca il pulsante Condividi">
            In basso al centro su Safari (in alto a destra su iPad). È l&apos;icona del quadrato con la freccia <ArrowUp size={14} className="inline -mt-0.5"/> rivolta verso l&apos;alto.
          </IosStep>
          <IosStep n={2} title={'Scegli "Aggiungi alla schermata Home"'}>
            Scorri in basso nel menu di condivisione. L&apos;icona è un quadrato con un <span className="font-bold">+</span> al centro.
          </IosStep>
          <IosStep n={3} title="Conferma con Aggiungi">
            In alto a destra. ChatHel apparirà sulla home come un&apos;app vera, con il logo dell&apos;hotel e schermo pieno.
          </IosStep>
        </ol>
        <div className="mt-6 brutal-card p-3 bg-sun text-xs">
          <p className="font-bold">💡 Suggerimento</p>
          <p className="mt-1 text-slate-700">Dopo l&apos;installazione potrai aprire ChatHel anche offline (i tuoi messaggi precedenti restano disponibili).</p>
        </div>
        <button data-testid="ios-guide-done" onClick={onClose} className="btn-primary w-full mt-5">Ho capito</button>
      </div>
    </div>
  );
}

const IosStep = ({ n, title, children }) => (
  <li className="flex items-start gap-3">
    <span className="w-8 h-8 shrink-0 rounded-full bg-ink text-cream font-display font-black text-base flex items-center justify-center shadow-brutal-sm">{n}</span>
    <div className="min-w-0">
      <p className="font-bold text-sm">{title}</p>
      <p className="text-xs text-slate-700 mt-0.5">{children}</p>
    </div>
  </li>
);

/* ────────── Notifiche push ────────── */
function NotificationsCard() {
  const supported = isPushSupported();
  const [perm, setPerm] = useState(supported ? getPushPermission() : "denied");
  const [busy, setBusy] = useState(false);
  const [subscribed, setSubscribed] = useState(false);

  useEffect(() => {
    if (!supported) return;
    (async () => {
      try {
        const reg = await navigator.serviceWorker.getRegistration();
        const sub = reg && (await reg.pushManager.getSubscription());
        setSubscribed(!!sub);
      } catch { /* ignore */ }
    })();
  }, [supported, perm]);

  const enable = async () => {
    setBusy(true);
    try { await subscribeToPush(); setPerm(getPushPermission()); setSubscribed(true); toast.success("Notifiche attive 🔔"); }
    catch (e) { toast.error(e.message === "Permission denied" ? "Permesso negato" : "Notifiche non disponibili"); }
    finally { setBusy(false); }
  };
  const disable = async () => {
    setBusy(true);
    try { await unsubscribeFromPush(); setSubscribed(false); toast.success("Notifiche disattivate"); }
    catch { toast.error("Errore"); }
    finally { setBusy(false); }
  };
  const sendTest = async () => {
    setBusy(true);
    try { await api.post("/push/test"); toast.success("Notifica di test inviata"); }
    catch { toast.error("Errore invio test"); }
    finally { setBusy(false); }
  };

  return (
    <Section icon={subscribed ? <Bell size={20} strokeWidth={2.5}/> : <BellOff size={20} strokeWidth={2.5}/>} title="Notifiche push" subtitle="Messaggi, sfide, eventi e coupon — anche con l'app chiusa.">
      {!supported ? (
        <p className="text-sm text-slate-700">Questo browser non supporta le notifiche push.</p>
      ) : perm === "denied" ? (
        <p className="text-sm text-slate-700" data-testid="push-denied">
          Hai negato il permesso. Riabilitalo dalle impostazioni del browser per questo sito.
        </p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {subscribed ? (
            <>
              <span className="tag-pill bg-bubbleSelf" data-testid="push-status">Attive · {perm}</span>
              <button data-testid="push-test-btn" disabled={busy} onClick={sendTest} className="btn-outline !py-2 !px-3 text-xs">Invia notifica di test</button>
              <button data-testid="push-disable-btn" disabled={busy} onClick={disable} className="btn-outline !py-2 !px-3 text-xs inline-flex items-center gap-1"><BellOff size={12}/> Disattiva</button>
            </>
          ) : (
            <button data-testid="push-enable-btn" disabled={busy} onClick={enable} className="btn-primary inline-flex items-center gap-2">
              <Bell size={16}/> Attiva notifiche
            </button>
          )}
        </div>
      )}
    </Section>
  );
}

/* ────────── Lingua ────────── */
function LanguageCard() {
  return (
    <Section icon={<UserCog size={20} strokeWidth={2.5}/>} title="Lingua" subtitle="Seleziona la lingua dell'interfaccia.">
      <LanguageSwitcher />
    </Section>
  );
}

/* ────────── Profilo ────────── */
function ProfileCard({ user, onUpdated }) {
  const [name, setName] = useState(user.name || "");
  const [photo, setPhoto] = useState(user.photo_url || "");
  const [bio, setBio] = useState(user.bio || "");
  const [saving, setSaving] = useState(false);
  const suggested = `https://i.pravatar.cc/240?u=${encodeURIComponent(user.email || user.name)}`;

  const save = async () => {
    setSaving(true);
    try { await api.patch("/auth/profile", { name, photo_url: photo, bio }); toast.success("Profilo aggiornato"); onUpdated && onUpdated(); }
    catch (err) { toast.error(err?.response?.data?.detail || "Errore"); }
    finally { setSaving(false); }
  };

  return (
    <Section icon={<UserCog size={20} strokeWidth={2.5}/>} title="Profilo" subtitle="Nome, foto, biografia — visibili agli altri ospiti.">
      <div className="flex items-start gap-3 mb-3">
        {photo ? (
          <img src={photo} alt="" className="w-16 h-16 rounded-full border-2 border-ink object-cover shadow-brutal-sm"/>
        ) : (
          <div className="w-16 h-16 rounded-full border-2 border-ink bg-white shadow-brutal-sm flex items-center justify-center font-display font-black">{(name||"?").slice(0,2).toUpperCase()}</div>
        )}
        <div className="flex-1 space-y-2">
          <button data-testid="settings-suggested-avatar" onClick={()=>setPhoto(suggested)} className="text-xs btn-outline !py-1.5 !px-3 inline-flex items-center gap-1"><Camera size={12}/> Avatar suggerito</button>
        </div>
      </div>
      <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-600">Nome</label>
      <input data-testid="settings-name-input" value={name} onChange={(e)=>setName(e.target.value)} className="input-brutal mt-1 mb-3" maxLength={60}/>
      <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-600">URL foto</label>
      <input data-testid="settings-photo-input" value={photo} onChange={(e)=>setPhoto(e.target.value)} placeholder="https://…" className="input-brutal mt-1 mb-3"/>
      <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-600">Bio · max 160 caratteri</label>
      <textarea data-testid="settings-bio-input" value={bio} onChange={(e)=>setBio(e.target.value.slice(0,160))} className="input-brutal mt-1 mb-1 min-h-[80px]" maxLength={160}/>
      <p className="text-[10px] text-slate-500 mb-3 text-right">{bio.length}/160</p>
      <button data-testid="settings-profile-save" onClick={save} disabled={saving} className="btn-primary w-full inline-flex items-center justify-center gap-2">
        <Save size={16}/> {saving ? "Salvataggio…" : "Salva profilo"}
      </button>
    </Section>
  );
}

/* ────────── Password ────────── */
function PasswordCard({ hasPassword }) {
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
      await api.post("/auth/change-password", { current_password: hasPassword ? current : undefined, new_password: next });
      toast.success(hasPassword ? "Password aggiornata" : "Password impostata");
      setCurrent(""); setNext(""); setConfirm("");
    } catch (err) { toast.error(err?.response?.data?.detail || "Errore"); }
    finally { setBusy(false); }
  };

  return (
    <Section icon={<KeyRound size={20} strokeWidth={2.5}/>} title={hasPassword ? "Cambio password" : "Imposta password"} subtitle={hasPassword ? "Cambia la password di accesso con email." : "Aggiungi una password per accedere anche senza Google."}>
      <form onSubmit={submit} className="space-y-3">
        {hasPassword && (
          <>
            <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-600">Password attuale</label>
            <input data-testid="pwd-current" type="password" value={current} onChange={(e)=>setCurrent(e.target.value)} className="input-brutal" required minLength={6}/>
          </>
        )}
        <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-600">Nuova password</label>
        <input data-testid="pwd-new" type="password" value={next} onChange={(e)=>setNext(e.target.value)} className="input-brutal" required minLength={6}/>
        <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-600">Conferma nuova password</label>
        <input data-testid="pwd-confirm" type="password" value={confirm} onChange={(e)=>setConfirm(e.target.value)} className="input-brutal" required minLength={6}/>
        <button data-testid="pwd-save" type="submit" disabled={busy} className="btn-primary w-full">{busy ? "…" : (hasPassword ? "Aggiorna password" : "Imposta password")}</button>
      </form>
    </Section>
  );
}

/* ────────── Danger zone ────────── */
function DangerZoneCard({ onDeleted }) {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [text, setText] = useState("");

  const doDelete = async () => {
    if (text !== "ELIMINA") return toast.error("Digita ELIMINA per confermare");
    setBusy(true);
    try { await api.post("/auth/delete-account"); onDeleted && onDeleted(); }
    catch (err) { toast.error(err?.response?.data?.detail || "Errore"); }
    finally { setBusy(false); }
  };

  return (
    <Section icon={<Trash2 size={20} strokeWidth={2.5}/>} title="Elimina account" subtitle="Disattiva il tuo account ChatHel. Conserveremo solo i messaggi inviati ad altri ospiti.">
      {!confirming ? (
        <button data-testid="delete-account-init" onClick={()=>setConfirming(true)} className="btn-outline inline-flex items-center gap-2 text-brand border-brand">
          <Trash2 size={16}/> Elimina il mio account
        </button>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-slate-700">Azione irreversibile. Tutte le sessioni verranno chiuse e non potrai più accedere con questo account.</p>
          <input
            data-testid="delete-account-confirm-input"
            value={text}
            onChange={(e)=>setText(e.target.value.toUpperCase())}
            placeholder='Digita "ELIMINA" per confermare'
            className="input-brutal"
          />
          <div className="flex gap-2">
            <button data-testid="delete-account-cancel" onClick={()=>{setConfirming(false); setText("");}} className="btn-outline flex-1">Annulla</button>
            <button data-testid="delete-account-confirm" onClick={doDelete} disabled={busy || text !== "ELIMINA"} className="btn-primary flex-1 bg-brand inline-flex items-center justify-center gap-2">
              <LogOut size={14}/> {busy ? "…" : "Elimina ora"}
            </button>
          </div>
        </div>
      )}
    </Section>
  );
}

/* ────────── Section primitive ────────── */
const Section = ({ icon, title, subtitle, children }) => (
  <div className="brutal-card p-5" data-testid={`settings-section-${(title||"").toLowerCase().replace(/\s+/g, "-")}`}>
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
