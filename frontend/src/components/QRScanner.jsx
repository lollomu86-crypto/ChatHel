import React, { useEffect, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { X, Camera } from "lucide-react";

/**
 * Modal that opens the device camera and reads a QR code, returning its text
 * via onResult. The QR is expected to contain the hotel access code.
 */
export default function QRScanner({ onResult, onClose }) {
  const containerId = "qr-scanner-area";
  const [error, setError] = useState("");
  const [running, setRunning] = useState(false);
  const qrRef = useRef(null);

  useEffect(() => {
    let canceled = false;
    const start = async () => {
      try {
        const html5 = new Html5Qrcode(containerId);
        qrRef.current = html5;
        await html5.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 240, height: 240 } },
          (decoded) => {
            if (canceled) return;
            canceled = true;
            html5.stop().then(() => html5.clear()).catch(() => {});
            onResult(decoded);
          },
          () => {}
        );
        setRunning(true);
      } catch (e) {
        setError(e?.message || "Impossibile accedere alla fotocamera");
      }
    };
    start();
    return () => {
      canceled = true;
      const r = qrRef.current;
      if (r) { r.stop().then(() => r.clear()).catch(() => {}); }
    };
  }, [onResult]);

  return (
    <div className="fixed inset-0 bg-ink/70 z-[60] flex items-center justify-center p-4" onClick={onClose}>
      <div className="brutal-card p-5 w-full max-w-sm bg-white" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">Onboarding rapido</p>
            <h3 className="font-display text-xl font-black flex items-center gap-2"><Camera size={18}/> Scansiona QR</h3>
          </div>
          <button data-testid="qr-close-btn" onClick={onClose} className="w-9 h-9 rounded-full bg-white border-2 border-ink shadow-brutal-sm flex items-center justify-center">
            <X size={16}/>
          </button>
        </div>
        <div id={containerId} className="border-2 border-ink rounded-xl overflow-hidden aspect-square bg-slate-100"/>
        {!running && !error && <p className="text-xs text-slate-600 mt-3">Apertura fotocamera in corso…</p>}
        {error && (
          <p className="text-xs text-brand font-bold mt-3" data-testid="qr-error">
            ⚠️ {error} — assicurati di permettere l'accesso alla fotocamera.
          </p>
        )}
        <p className="text-xs text-slate-500 mt-3">Inquadra il QR code del tuo hotel. Verrà riempito automaticamente il codice di accesso.</p>
      </div>
    </div>
  );
}
