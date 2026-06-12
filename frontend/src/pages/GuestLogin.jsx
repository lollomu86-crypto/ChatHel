import React, { useEffect, useState } from "react";
import { useNavigate, Link, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { api, setUserToken, getUserToken, clearUserToken } from "../lib/api";
import { toast } from "sonner";
import { ArrowLeft, LogIn, UserPlus, Hotel as HotelIcon, Camera } from "lucide-react";
import Logo from "../components/Logo";
import LanguageSwitcher from "../components/LanguageSwitcher";
import QRScanner from "../components/QRScanner";
import OnboardingProfile from "../components/OnboardingProfile";

const ONBOARDING_FLAG = "chathel_onboarding_pending";

export default function AuthGate() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [phase, setPhase] = useState("login"); // login | register | onboarding | join
  const [loading, setLoading] = useState(false);
  const [me, setMe] = useState(null);

  // Google session callback (#session_id in URL)
  useEffect(() => {
    const hash = window.location.hash || "";
    const m = hash.match(/session_id=([^&]+)/);
    if (m) {
      window.history.replaceState(null, "", window.location.pathname);
      (async () => {
        try {
          const { data } = await api.post("/auth/google/session", { session_id: m[1] });
          setUserToken(data.token);
          if (data.is_new) localStorage.setItem(ONBOARDING_FLAG, "1");
          await refreshMe();
          toast.success(`Benvenuto, ${data.user.name}!`);
        } catch (e) { toast.error("Google login fallito"); }
      })();
    }
  }, []);

  const refreshMe = async () => {
    const tok = getUserToken();
    if (!tok) { setMe(null); return null; }
    try {
      const { data } = await api.get("/auth/me");
      setMe(data);
      if (data.stay) { navigate("/app"); return data; }
      // If user has just registered and has no photo/bio yet, gate to onboarding once
      const pending = localStorage.getItem(ONBOARDING_FLAG) === "1";
      if (pending) setPhase("onboarding");
      else setPhase("join");
      return data;
    } catch {
      clearUserToken(); setMe(null); return null;
    }
  };

  useEffect(() => { refreshMe(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (!me) return <LoginRegisterScreen phase={phase} setPhase={setPhase} onAuthed={refreshMe} loading={loading} setLoading={setLoading}/>;
  if (phase === "onboarding") {
    return (
      <Shell>
        <OnboardingProfile
          me={me.user}
          onDone={async () => {
            localStorage.removeItem(ONBOARDING_FLAG);
            try { const { data } = await api.get("/auth/me"); setMe(data); } catch { /* ignore */ }
            setPhase("join");
          }}
        />
      </Shell>
    );
  }
  return <JoinHotelScreen me={me} onJoined={() => navigate("/app")} onLogout={async () => { try { await api.post("/auth/logout"); } catch { /* ignore */ } clearUserToken(); setMe(null); setPhase("login"); }}/>;
}

const Shell = ({ children }) => {
  return (
    <div className="min-h-screen bg-cream flex flex-col">
      <header className="border-b-2 border-ink bg-cream/80 backdrop-blur-xl sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-5 py-4 flex items-center justify-between">
          <Link to="/" data-testid="back-home-link" className="inline-flex items-center gap-2 text-sm font-bold">
            <ArrowLeft size={16}/> <Logo size={36} withText textClass="text-xl"/>
          </Link>
          <LanguageSwitcher compact />
        </div>
      </header>
      <div className="flex-1 flex items-center justify-center px-5 py-10">{children}</div>
    </div>
  );
};

function LoginRegisterScreen({ phase, setPhase, onAuthed, loading, setLoading }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");

  const goGoogle = () => {
    const redirect = window.location.origin + "/login";
    window.location.href = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirect)}`;
  };

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const path = phase === "register" ? "/auth/register" : "/auth/login";
      const body = phase === "register" ? { email, password, name } : { email, password };
      const { data } = await api.post(path, body);
      setUserToken(data.token);
      if (phase === "register") {
        localStorage.setItem(ONBOARDING_FLAG, "1");
        toast.success("Account creato! Ora completa il profilo");
      } else {
        toast.success(`Bentornato, ${data.user.name}`);
      }
      onAuthed();
    } catch (err) { toast.error(err?.response?.data?.detail || "Errore"); }
    finally { setLoading(false); }
  };

  return (
    <Shell>
      <div className="w-full max-w-md">
        <div className="brutal-card p-8">
          <div className="w-14 h-14 rounded-xl bg-sun border-2 border-ink shadow-brutal-sm flex items-center justify-center mb-5">
            {phase === "register" ? <UserPlus size={28} strokeWidth={2.5}/> : <LogIn size={28} strokeWidth={2.5}/>}
          </div>
          <h1 className="font-display text-4xl font-black tracking-tighter mb-2">
            {phase === "register" ? "Crea account" : "Accedi"}
          </h1>
          <p className="text-slate-700 mb-5">
            {phase === "register"
              ? "Il tuo profilo ti segue di hotel in hotel."
              : "Il profilo permanente: stesso login in ogni hotel."}
          </p>

          <button onClick={goGoogle} data-testid="google-login-btn" className="btn-outline w-full inline-flex items-center justify-center gap-2 mb-5">
            <svg width="18" height="18" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg"><g><path fill="#4285F4" d="M17.64 9.2c0-.63-.06-1.25-.16-1.84H9v3.49h4.84a4.14 4.14 0 01-1.79 2.71v2.26h2.9c1.7-1.56 2.69-3.87 2.69-6.62z"/><path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.91-2.26c-.8.54-1.84.86-3.05.86-2.34 0-4.32-1.58-5.03-3.71H.95v2.34A9 9 0 009 18z"/><path fill="#FBBC05" d="M3.97 10.71A5.41 5.41 0 013.68 9c0-.59.1-1.17.29-1.71V4.95H.95A9 9 0 000 9c0 1.45.35 2.83.95 4.05l3.02-2.34z"/><path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58A9 9 0 009 0 9 9 0 00.95 4.95l3.02 2.34C4.68 5.16 6.66 3.58 9 3.58z"/></g></svg>
            Continua con Google
          </button>

          <div className="relative my-4">
            <div className="absolute inset-0 flex items-center"><span className="w-full border-t-2 border-dashed border-slate-300"/></div>
            <div className="relative flex justify-center"><span className="bg-white px-3 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">oppure email</span></div>
          </div>

          <form onSubmit={submit} className="space-y-3">
            {phase === "register" && (
              <input data-testid="reg-name-input" required value={name} onChange={(e)=>setName(e.target.value)} placeholder="Nome" className="input-brutal" minLength={2} maxLength={60}/>
            )}
            <input data-testid="auth-email-input" type="email" required value={email} onChange={(e)=>setEmail(e.target.value)} placeholder="Email" className="input-brutal"/>
            <input data-testid="auth-password-input" type="password" required value={password} onChange={(e)=>setPassword(e.target.value)} placeholder="Password" className="input-brutal" minLength={6}/>
            <button data-testid="auth-submit-btn" disabled={loading} type="submit" className="btn-primary w-full">
              {loading ? "…" : phase === "register" ? "Crea account" : "Accedi"}
            </button>
          </form>

          <p className="text-sm text-slate-600 mt-4 text-center">
            {phase === "register" ? "Hai già un account?" : "Non hai un account?"}{" "}
            <button data-testid="auth-switch-mode" onClick={() => setPhase(phase === "register" ? "login" : "register")} className="font-bold underline">
              {phase === "register" ? "Accedi" : "Registrati"}
            </button>
          </p>
          <p className="text-xs text-slate-500 mt-3 text-center">
            <Link to="/admin/login" className="hover:text-ink font-bold">Sei un hotel? Accedi alla dashboard →</Link>
          </p>
        </div>
      </div>
    </Shell>
  );
}

function JoinHotelScreen({ me, onJoined, onLogout }) {
  const [code, setCode] = useState("");
  const [nickname, setNickname] = useState(me.user?.name || "");
  const [showScanner, setShowScanner] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showProfile, setShowProfile] = useState(false);

  const join = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data } = await api.post("/stays/join", { access_code: code.toUpperCase(), nickname });
      toast.success(`Benvenuto in ${data.hotel.name}!`);
      if (data.welcome_coupon) {
        setTimeout(() => {
          toast.success(
            `${data.welcome_coupon.emoji || "🎁"} Welcome coupon: ${data.welcome_coupon.name}`,
            { description: data.welcome_coupon.message || "Un regalo di benvenuto dall'hotel" }
          );
        }, 350);
      }
      onJoined();
    } catch (err) { toast.error(err?.response?.data?.detail || "Errore"); }
    finally { setLoading(false); }
  };

  const handleScan = (raw) => {
    setShowScanner(false);
    let parsed = raw.trim();
    try { const url = new URL(raw); parsed = url.searchParams.get("code") || url.searchParams.get("hotel") || raw; } catch { /* ignore */ }
    setCode(parsed.toUpperCase().slice(0, 32));
    toast.success(`Codice rilevato`);
  };

  return (
    <Shell>
      <div className="w-full max-w-md space-y-4">
        <div className="brutal-card p-6 bg-bubbleSelf flex items-center gap-3">
          {me.user.photo_url
            ? <img src={me.user.photo_url} alt="" className="w-12 h-12 rounded-full border-2 border-ink object-cover"/>
            : <div className="w-12 h-12 rounded-full border-2 border-ink bg-white flex items-center justify-center font-display font-black">{me.user.name.slice(0,2).toUpperCase()}</div>}
          <div className="flex-1 min-w-0">
            <p className="font-bold truncate">{me.user.name}</p>
            <p className="text-xs text-slate-600 truncate">{me.user.email}</p>
          </div>
          <button data-testid="open-profile-edit" onClick={() => setShowProfile(true)} className="btn-outline !py-1.5 !px-3 text-xs">Profilo</button>
        </div>

        <div className="brutal-card p-8">
          <div className="w-14 h-14 rounded-xl bg-sun border-2 border-ink shadow-brutal-sm flex items-center justify-center mb-5"><HotelIcon size={28} strokeWidth={2.5}/></div>
          <h1 className="font-display text-4xl font-black tracking-tighter mb-2">Unisciti all&apos;hotel.</h1>
          <p className="text-slate-700 mb-5">Inserisci il codice ricevuto dalla reception.</p>

          <button type="button" data-testid="open-qr-scanner-btn" onClick={() => setShowScanner(true)} className="btn-outline w-full inline-flex items-center justify-center gap-2 mb-5">
            <Camera size={18}/> Scansiona QR code
          </button>

          <form onSubmit={join} className="space-y-3">
            <input data-testid="join-code-input" value={code} onChange={(e)=>setCode(e.target.value.toUpperCase())} placeholder="WELCOME2026" className="input-brutal font-mono tracking-widest uppercase" required/>
            <input data-testid="join-nickname-input" value={nickname} onChange={(e)=>setNickname(e.target.value)} placeholder="Come ti chiamano in hotel" className="input-brutal" maxLength={30}/>
            <button data-testid="join-submit-btn" type="submit" disabled={loading} className="btn-primary w-full">
              {loading ? "Entrando…" : "Entra in hotel"}
            </button>
          </form>

          <button onClick={onLogout} className="text-xs text-slate-500 hover:text-brand font-bold mt-5 underline">Esci dall&apos;account</button>
        </div>

        {showScanner && <QRScanner onResult={handleScan} onClose={() => setShowScanner(false)}/>}
        {showProfile && <ProfileEditModal me={me.user} onClose={() => setShowProfile(false)} onSaved={() => { setShowProfile(false); window.location.reload(); }}/>}
      </div>
    </Shell>
  );
}

function ProfileEditModal({ me, onClose, onSaved }) {
  const [name, setName] = useState(me.name || "");
  const [photo, setPhoto] = useState(me.photo_url || "");
  const [bio, setBio] = useState(me.bio || "");
  const [saving, setSaving] = useState(false);
  const save = async () => {
    setSaving(true);
    try { await api.patch("/auth/profile", { name, photo_url: photo, bio }); toast.success("Profilo aggiornato"); onSaved(); }
    catch { toast.error("Errore"); }
    finally { setSaving(false); }
  };
  const suggested = `https://i.pravatar.cc/200?u=${encodeURIComponent(me.email || me.name)}`;
  return (
    <div className="fixed inset-0 bg-ink/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="brutal-card p-6 w-full max-w-md bg-white" onClick={(e)=>e.stopPropagation()}>
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">Profilo</p>
        <h3 className="font-display text-2xl font-black mt-1 mb-4">Il tuo profilo</h3>
        <div className="flex items-center gap-3 mb-4">
          <img src={photo || suggested} alt="" className="w-16 h-16 rounded-full border-2 border-ink object-cover bg-white"/>
          <button data-testid="use-suggested-avatar" onClick={()=>setPhoto(suggested)} className="text-xs btn-outline !py-1.5 !px-3">Avatar suggerito</button>
        </div>
        <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-600">Nome</label>
        <input data-testid="profile-name" value={name} onChange={(e)=>setName(e.target.value)} className="input-brutal mb-3 mt-1" maxLength={60}/>
        <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-600">URL foto (pubblico)</label>
        <input data-testid="profile-photo" value={photo} onChange={(e)=>setPhoto(e.target.value)} placeholder="https://…" className="input-brutal mb-3 mt-1"/>
        <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-600">Bio · max 160 caratteri</label>
        <textarea data-testid="profile-bio" value={bio} onChange={(e)=>setBio(e.target.value.slice(0,160))} className="input-brutal mt-1 mb-1 min-h-[80px]" maxLength={160}/>
        <p className="text-[10px] text-slate-500 mb-4 text-right">{bio.length}/160</p>
        <div className="flex gap-3">
          <button onClick={onClose} className="btn-outline flex-1">Annulla</button>
          <button data-testid="profile-save" onClick={save} disabled={saving} className="btn-primary flex-1">{saving ? "…" : "Salva"}</button>
        </div>
      </div>
    </div>
  );
}
