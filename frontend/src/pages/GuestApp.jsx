import React, { useEffect, useState } from "react";
import { Routes, Route, NavLink, useNavigate, Navigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { api, clearGuestToken, getGuestToken, clearUserToken, getUserToken } from "../lib/api";
import { MessageSquare, CalendarHeart, Users, Sparkles, Hotel, LogOut, User, Gift } from "lucide-react";
import { toast } from "sonner";
import Logo from "../components/Logo";
import LanguageSwitcher from "../components/LanguageSwitcher";
import PushPrompt from "../components/PushPrompt";

import HomeFeed from "./guest/HomeFeed";
import PublicChat from "./guest/PublicChat";
import GuestsDirectory from "./guest/GuestsDirectory";
import PrivateChat from "./guest/PrivateChat";
import ReceptionChat from "./guest/ReceptionChat";
import AiChat from "./guest/AiChat";
import ProfilePanel from "./guest/ProfilePanel";
import CouponsPage from "./guest/CouponsPage";

const TABS_DEF = [
  { to: "/app", labelKey: "tabs.home", icon: Hotel, end: true, testid: "tab-home" },
  { to: "/app/public", labelKey: "tabs.public", icon: MessageSquare, testid: "tab-public" },
  { to: "/app/guests", labelKey: "tabs.guests", icon: Users, testid: "tab-guests" },
  { to: "/app/reception", labelKey: "tabs.reception", icon: CalendarHeart, testid: "tab-reception" },
  { to: "/app/ai", labelKey: "tabs.ai", icon: Sparkles, testid: "tab-ai" },
];

export default function GuestApp() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [me, setMe] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      // Legacy guest token path
      if (getGuestToken()) {
        try {
          const { data } = await api.get("/guest/me");
          if (mounted) { setMe(data); setLoading(false); }
          return;
        } catch { clearGuestToken(); }
      }
      // User+stay path
      if (getUserToken()) {
        try {
          const { data } = await api.get("/auth/me");
          if (!data.stay) { navigate("/login", { replace: true }); return; }
          if (mounted) {
            setMe({
              guest: { id: data.stay.id, nickname: data.stay.nickname, status_text: data.stay.status_text, checked_in_at: data.stay.joined_at, photo_url: data.user.photo_url, bio: data.user.bio },
              hotel: data.hotel,
              user: data.user,
            });
            setLoading(false);
          }
          return;
        } catch { clearUserToken(); }
      }
      navigate("/login", { replace: true });
    };
    load();
    return () => { mounted = false; };
  }, [navigate]);

  const logout = async () => {
    // For user-based auth: leave the hotel (keeps account); legacy: full logout
    if (getUserToken()) {
      try { await api.post("/stays/leave"); } catch { /* ignore */ }
      toast.success("Hai lasciato l'hotel");
      navigate("/login", { replace: true });
      return;
    }
    try { await api.post("/guest/logout"); } catch { /* ignore */ }
    clearGuestToken();
    localStorage.removeItem("chathel_guest");
    localStorage.removeItem("chathel_hotel");
    toast.success(t("common.logout"));
    navigate("/", { replace: true });
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center text-slate-600">{t("common.loading")}</div>;
  if (!me) return <Navigate to="/login" replace />;

  return (
    <div className="min-h-screen bg-chatcanvas flex flex-col">
      {/* Top header */}
      <header className="bg-cream/85 backdrop-blur-xl border-b-2 border-ink sticky top-0 z-30">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Logo size={40}/>
            <div className="leading-tight">
              <p className="font-display font-black tracking-tight text-base">{me.hotel?.name || "ChatHel"}</p>
              <p className="text-[10px] uppercase font-bold tracking-[0.2em] text-slate-500">{t("header.guest_prefix")} · {me.guest.nickname}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <LanguageSwitcher compact />
            <NavLink to="/app/coupons" data-testid="coupons-link" className="w-9 h-9 rounded-full border-2 border-ink bg-bubbleReception shadow-brutal-sm flex items-center justify-center hover:bg-sun transition">
              <Gift size={16} strokeWidth={2.5}/>
            </NavLink>
            <NavLink to="/app/profile" data-testid="profile-link" className="w-9 h-9 rounded-full border-2 border-ink bg-sun shadow-brutal-sm flex items-center justify-center">
              <User size={16} strokeWidth={2.5}/>
            </NavLink>
            <button data-testid="logout-btn" onClick={logout} className="w-9 h-9 rounded-full border-2 border-ink bg-white shadow-brutal-sm flex items-center justify-center hover:bg-bubbleReception transition">
              <LogOut size={16} strokeWidth={2.5}/>
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-5xl w-full mx-auto px-3 sm:px-5 py-4 pb-32">
        <Routes>
          <Route index element={<HomeFeed />} />
          <Route path="public" element={<PublicChat me={me.guest} />} />
          <Route path="guests" element={<GuestsDirectory me={me.guest} />} />
          <Route path="guests/:id" element={<PrivateChat me={me.guest} />} />
          <Route path="reception" element={<ReceptionChat me={me.guest} />} />
          <Route path="ai" element={<AiChat me={me.guest} />} />
          <Route path="profile" element={<ProfilePanel me={me.guest} onUpdated={(g)=>setMe({...me, guest:g})} />} />
          <Route path="coupons" element={<CouponsPage me={me.guest} />} />
        </Routes>
      </main>

      {/* Bottom tabs */}
      <PushPrompt />
      <nav className="fixed bottom-3 left-1/2 -translate-x-1/2 z-40">
        <div className="flex gap-1 p-1 bg-white border-2 border-ink rounded-2xl shadow-brutal">
          {TABS_DEF.map((tb) => (
            <NavLink
              key={tb.to}
              to={tb.to}
              end={tb.end}
              data-testid={tb.testid}
              className={({ isActive }) =>
                `flex flex-col items-center gap-0.5 px-3 py-2 rounded-xl font-bold text-[10px] uppercase tracking-wider transition ${
                  isActive ? "bg-sun border-2 border-ink shadow-brutal-sm" : "text-slate-600 hover:bg-slate-100"
                }`
              }
            >
              <tb.icon size={18} strokeWidth={2.5}/>
              <span>{t(tb.labelKey)}</span>
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}
