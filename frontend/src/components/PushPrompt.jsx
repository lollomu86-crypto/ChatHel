import React, { useEffect, useState } from "react";
import { Bell, X } from "lucide-react";
import { toast } from "sonner";
import { isPushSupported, getPushPermission, subscribeToPush, registerServiceWorker } from "../lib/push";

const KEY_DISMISSED = "chathel_push_dismissed";

export default function PushPrompt() {
  const [visible, setVisible] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isPushSupported()) return;
    registerServiceWorker();
    const perm = getPushPermission();
    const dismissed = sessionStorage.getItem(KEY_DISMISSED) === "1";
    if (perm === "default" && !dismissed) setVisible(true);
  }, []);

  // Listen to service-worker postMessage for navigation
  useEffect(() => {
    const handler = (e) => {
      if (e.data && e.data.type === "navigate" && e.data.url) {
        const url = e.data.url.startsWith("/") ? e.data.url : `/${e.data.url}`;
        if (window.location.pathname !== url) window.location.assign(url);
      }
    };
    navigator.serviceWorker?.addEventListener("message", handler);
    return () => navigator.serviceWorker?.removeEventListener("message", handler);
  }, []);

  const enable = async () => {
    setLoading(true);
    try {
      await subscribeToPush();
      toast.success("Notifiche attive 🔔");
      setVisible(false);
    } catch (e) {
      toast.error(e.message === "Permission denied" ? "Permesso negato dal browser" : "Notifiche non disponibili");
      setVisible(false);
    } finally { setLoading(false); }
  };

  const dismiss = () => {
    sessionStorage.setItem(KEY_DISMISSED, "1");
    setVisible(false);
  };

  if (!visible) return null;
  return (
    <div data-testid="push-prompt" className="fixed bottom-24 left-1/2 -translate-x-1/2 z-40 max-w-md w-[92%]">
      <div className="brutal-card p-4 bg-sun flex items-center gap-3">
        <div className="w-11 h-11 shrink-0 rounded-xl bg-white border-2 border-ink shadow-brutal-sm flex items-center justify-center">
          <Bell size={20} strokeWidth={2.5}/>
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-sm leading-tight">Attiva le notifiche</p>
          <p className="text-xs text-slate-700">Messaggi, sfide, eventi e coupon — anche con l'app chiusa.</p>
        </div>
        <button data-testid="push-enable-btn" onClick={enable} disabled={loading} className="btn-primary !py-1.5 !px-3 text-xs">
          {loading ? "…" : "Attiva"}
        </button>
        <button data-testid="push-dismiss-btn" onClick={dismiss} className="text-slate-500 hover:text-ink" aria-label="Chiudi">
          <X size={16}/>
        </button>
      </div>
    </div>
  );
}
