import React, { useEffect, useState } from "react";
import { Routes, Route, NavLink, useNavigate, Navigate } from "react-router-dom";
import { api, clearGuestToken } from "../lib/api";
import { MessageSquare, CalendarHeart, Users, Sparkles, Hotel, LogOut, User } from "lucide-react";
import { toast } from "sonner";

import HomeFeed from "./guest/HomeFeed";
import PublicChat from "./guest/PublicChat";
import GuestsDirectory from "./guest/GuestsDirectory";
import PrivateChat from "./guest/PrivateChat";
import ReceptionChat from "./guest/ReceptionChat";
import AiChat from "./guest/AiChat";
import ProfilePanel from "./guest/ProfilePanel";

const TABS = [
  { to: "/app", label: "Home", icon: Hotel, end: true, testid: "tab-home" },
  { to: "/app/public", label: "Public", icon: MessageSquare, testid: "tab-public" },
  { to: "/app/guests", label: "Ospiti", icon: Users, testid: "tab-guests" },
  { to: "/app/reception", label: "Reception", icon: CalendarHeart, testid: "tab-reception" },
  { to: "/app/ai", label: "AI", icon: Sparkles, testid: "tab-ai" },
];

export default function GuestApp() {
  const navigate = useNavigate();
  const [me, setMe] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    api.get("/guest/me").then(({ data }) => {
      if (!mounted) return;
      setMe(data);
      setLoading(false);
    }).catch(() => {
      clearGuestToken();
      navigate("/login", { replace: true });
    });
    return () => { mounted = false; };
  }, [navigate]);

  const logout = async () => {
    try { await api.post("/guest/logout"); } catch {}
    clearGuestToken();
    localStorage.removeItem("chathel_guest");
    localStorage.removeItem("chathel_hotel");
    toast.success("Check-out effettuato");
    navigate("/", { replace: true });
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center text-slate-600">Caricamento…</div>;
  if (!me) return <Navigate to="/login" replace />;

  return (
    <div className="min-h-screen bg-chatcanvas flex flex-col">
      {/* Top header */}
      <header className="bg-cream/85 backdrop-blur-xl border-b-2 border-ink sticky top-0 z-30">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-brand border-2 border-ink shadow-brutal-sm flex items-center justify-center">
              <MessageSquare size={14} className="text-white" strokeWidth={3} />
            </div>
            <div className="leading-tight">
              <p className="font-display font-black tracking-tight text-base">{me.hotel?.name || "ChatHel"}</p>
              <p className="text-[10px] uppercase font-bold tracking-[0.2em] text-slate-500">Ospite · {me.guest.nickname}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <NavLink to="/app/profile" data-testid="profile-link" className="w-9 h-9 rounded-full border-2 border-ink bg-sun shadow-brutal-sm flex items-center justify-center">
              <User size={16} strokeWidth={2.5}/>
            </NavLink>
            <button data-testid="logout-btn" onClick={logout} className="w-9 h-9 rounded-full border-2 border-ink bg-white shadow-brutal-sm flex items-center justify-center hover:bg-bubbleReception transition">
              <LogOut size={16} strokeWidth={2.5}/>
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-5xl w-full mx-auto px-3 sm:px-5 py-4 pb-24">
        <Routes>
          <Route index element={<HomeFeed />} />
          <Route path="public" element={<PublicChat me={me.guest} />} />
          <Route path="guests" element={<GuestsDirectory me={me.guest} />} />
          <Route path="guests/:id" element={<PrivateChat me={me.guest} />} />
          <Route path="reception" element={<ReceptionChat me={me.guest} />} />
          <Route path="ai" element={<AiChat me={me.guest} />} />
          <Route path="profile" element={<ProfilePanel me={me.guest} onUpdated={(g)=>setMe({...me, guest:g})} />} />
        </Routes>
      </main>

      {/* Bottom tabs */}
      <nav className="fixed bottom-3 left-1/2 -translate-x-1/2 z-40">
        <div className="flex gap-1 p-1 bg-white border-2 border-ink rounded-2xl shadow-brutal">
          {TABS.map((t) => (
            <NavLink
              key={t.to}
              to={t.to}
              end={t.end}
              data-testid={t.testid}
              className={({ isActive }) =>
                `flex flex-col items-center gap-0.5 px-3 py-2 rounded-xl font-bold text-[10px] uppercase tracking-wider transition ${
                  isActive ? "bg-sun border-2 border-ink shadow-brutal-sm" : "text-slate-600 hover:bg-slate-100"
                }`
              }
            >
              <t.icon size={18} strokeWidth={2.5}/>
              <span>{t.label}</span>
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}
