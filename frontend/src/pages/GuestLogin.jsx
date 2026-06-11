import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { api, setGuestToken } from "../lib/api";
import { toast } from "sonner";
import { QrCode, ArrowLeft } from "lucide-react";

export default function GuestLogin() {
  const [code, setCode] = useState("");
  const [nickname, setNickname] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

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
            <ArrowLeft size={16}/> ChatHel
          </Link>
          <Link to="/admin/login" data-testid="login-admin-link" className="text-sm font-bold text-slate-700 hover:text-ink">Sono un hotel →</Link>
        </div>
      </header>

      <div className="flex-1 flex items-center justify-center px-5 py-10">
        <div className="w-full max-w-md">
          <div className="brutal-card p-8">
            <div className="w-14 h-14 rounded-xl bg-sun border-2 border-ink shadow-brutal-sm flex items-center justify-center mb-5">
              <QrCode size={28} strokeWidth={2.5}/>
            </div>
            <h1 className="font-display text-4xl font-black tracking-tighter mb-2">Entra in hotel.</h1>
            <p className="text-slate-700 mb-7">Codice fornito dalla reception + un nickname per gli altri ospiti.</p>

            <form onSubmit={submit} className="space-y-4">
              <div>
                <label className="text-xs font-bold uppercase tracking-[0.2em] text-slate-600 mb-1.5 block">Codice hotel</label>
                <input
                  data-testid="login-code-input"
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  placeholder="es. WELCOME2026"
                  className="input-brutal font-mono tracking-widest uppercase"
                  required
                />
              </div>
              <div>
                <label className="text-xs font-bold uppercase tracking-[0.2em] text-slate-600 mb-1.5 block">Nickname</label>
                <input
                  data-testid="login-nickname-input"
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                  placeholder="es. Luca · 412"
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
                {loading ? "Accesso in corso…" : "Entra"}
              </button>
            </form>

            <p className="text-xs text-slate-500 mt-5">
              Provando? Usa codice <span className="font-mono bg-sun border border-ink px-1.5">WELCOME2026</span>.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
