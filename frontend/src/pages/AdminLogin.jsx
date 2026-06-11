import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { api, setAdminToken } from "../lib/api";
import { toast } from "sonner";
import { Hotel, ArrowLeft } from "lucide-react";

export default function AdminLogin() {
  const [code, setCode] = useState("");
  const [pw, setPw] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data } = await api.post("/admin/login", { access_code: code.toUpperCase(), password: pw });
      setAdminToken(data.token);
      localStorage.setItem("chathel_admin_hotel", JSON.stringify(data.hotel));
      toast.success(`${data.hotel.name} — dashboard`);
      navigate("/admin");
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Credenziali non valide");
    } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen bg-cream flex flex-col">
      <header className="border-b-2 border-ink">
        <div className="max-w-5xl mx-auto px-5 py-4">
          <Link to="/" data-testid="admin-back-home" className="inline-flex items-center gap-2 text-sm font-bold">
            <ArrowLeft size={16}/> ChatHel
          </Link>
        </div>
      </header>
      <div className="flex-1 flex items-center justify-center px-5 py-10">
        <div className="w-full max-w-md">
          <div className="brutal-card p-8">
            <div className="w-14 h-14 rounded-xl bg-accent2 border-2 border-ink shadow-brutal-sm flex items-center justify-center mb-5">
              <Hotel size={28} className="text-white" strokeWidth={2.5}/>
            </div>
            <h1 className="font-display text-4xl font-black tracking-tighter mb-2">Dashboard hotel.</h1>
            <p className="text-slate-700 mb-7">Gestisci eventi, aree e ospiti del tuo hotel.</p>
            <form onSubmit={submit} className="space-y-4">
              <div>
                <label className="text-xs font-bold uppercase tracking-[0.2em] text-slate-600 mb-1.5 block">Codice hotel</label>
                <input data-testid="admin-code-input" value={code} onChange={(e)=>setCode(e.target.value.toUpperCase())} className="input-brutal font-mono tracking-widest uppercase" required />
              </div>
              <div>
                <label className="text-xs font-bold uppercase tracking-[0.2em] text-slate-600 mb-1.5 block">Password admin</label>
                <input data-testid="admin-password-input" type="password" value={pw} onChange={(e)=>setPw(e.target.value)} className="input-brutal" required />
              </div>
              <button data-testid="admin-submit-btn" type="submit" disabled={loading} className="btn-secondary w-full">
                {loading ? "Accesso…" : "Accedi"}
              </button>
            </form>
            <p className="text-xs text-slate-500 mt-5">Demo: <span className="font-mono">WELCOME2026 / admin123</span></p>
          </div>
        </div>
      </div>
    </div>
  );
}
