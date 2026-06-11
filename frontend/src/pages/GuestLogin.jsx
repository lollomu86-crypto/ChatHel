import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { api, setGuestToken } from "../lib/api";
import { toast } from "sonner";
import { QrCode, ArrowLeft, Camera } from "lucide-react";
import Logo from "../components/Logo";
import QRScanner from "../components/QRScanner";
import LanguageSwitcher from "../components/LanguageSwitcher";

export default function GuestLogin() {
  const { t } = useTranslation();
  const [code, setCode] = useState("");
  const [nickname, setNickname] = useState("");
  const [loading, setLoading] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const navigate = useNavigate();

  const handleScanResult = (raw) => {
    setShowScanner(false);
    let parsed = raw.trim();
    try {
      const url = new URL(raw);
      const c = url.searchParams.get("code") || url.searchParams.get("hotel");
      if (c) parsed = c;
    } catch {}
    parsed = parsed.toUpperCase().slice(0, 32);
    setCode(parsed);
    toast.success(`${t("login.code")}: ${parsed}`);
  };

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data } = await api.post("/guest/login", { access_code: code.toUpperCase(), nickname });
      setGuestToken(data.guest.session_token);
      localStorage.setItem("chathel_guest", JSON.stringify(data.guest));
      localStorage.setItem("chathel_hotel", JSON.stringify(data.hotel));
      toast.success(`Benvenuto in ${data.hotel.name}, ${data.guest.nickname}!`);
      navigate("/app");
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Errore di accesso");
    } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen bg-cream flex flex-col">
      <header className="border-b-2 border-ink bg-cream/80 backdrop-blur-xl sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-5 py-4 flex items-center justify-between">
          <Link to="/" data-testid="back-home-link" className="inline-flex items-center gap-2 text-sm font-bold hover:underline">
            <ArrowLeft size={16}/> <Logo size={36} withText textClass="text-xl"/>
          </Link>
          <div className="flex items-center gap-3">
            <LanguageSwitcher compact />
            <Link to="/admin/login" data-testid="login-admin-link" className="text-sm font-bold text-slate-700 hover:text-ink">{t("landing.cta_hotel")} →</Link>
          </div>
        </div>
      </header>

      <div className="flex-1 flex items-center justify-center px-5 py-10">
        <div className="w-full max-w-md">
          <div className="brutal-card p-8">
            <div className="w-14 h-14 rounded-xl bg-sun border-2 border-ink shadow-brutal-sm flex items-center justify-center mb-5">
              <QrCode size={28} strokeWidth={2.5}/>
            </div>
            <h1 className="font-display text-4xl font-black tracking-tighter mb-2">{t("login.title")}</h1>
            <p className="text-slate-700 mb-5">{t("login.subtitle")}</p>

            <button
              type="button"
              data-testid="open-qr-scanner-btn"
              onClick={() => setShowScanner(true)}
              className="btn-outline w-full inline-flex items-center justify-center gap-2 mb-5"
            >
              <Camera size={18}/> {t("login.scan_qr")}
            </button>

            <div className="relative my-5">
              <div className="absolute inset-0 flex items-center"><span className="w-full border-t-2 border-dashed border-slate-300"/></div>
              <div className="relative flex justify-center text-[10px] font-bold uppercase tracking-[0.2em]"><span className="bg-white px-3 text-slate-500">{t("login.or_manual")}</span></div>
            </div>

            <form onSubmit={submit} className="space-y-4">
              <div>
                <label className="text-xs font-bold uppercase tracking-[0.2em] text-slate-600 mb-1.5 block">{t("login.code")}</label>
                <input
                  data-testid="login-code-input"
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  placeholder="WELCOME2026"
                  className="input-brutal font-mono tracking-widest uppercase"
                  required
                />
              </div>
              <div>
                <label className="text-xs font-bold uppercase tracking-[0.2em] text-slate-600 mb-1.5 block">{t("login.nickname")}</label>
                <input
                  data-testid="login-nickname-input"
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                  placeholder="Luca · 412"
                  className="input-brutal"
                  required
                  minLength={2}
                  maxLength={30}
                />
              </div>
              <button
                data-testid="login-submit-btn"
                disabled={loading}
                className="btn-primary w-full"
                type="submit"
              >
                {loading ? t("login.submitting") : t("login.submit")}
              </button>
            </form>

            <p className="text-xs text-slate-500 mt-5">
              {t("login.demo_hint")} <span className="font-mono bg-sun border border-ink px-1.5">WELCOME2026</span>.
            </p>
          </div>
        </div>
      </div>
      {showScanner && <QRScanner onResult={handleScanResult} onClose={() => setShowScanner(false)} />}
    </div>
  );
}
