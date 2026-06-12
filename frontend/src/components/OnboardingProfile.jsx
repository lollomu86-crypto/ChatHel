import React, { useMemo, useState } from "react";
import { api } from "../lib/api";
import { toast } from "sonner";
import { Sparkles, ArrowRight, SkipForward } from "lucide-react";

/**
 * Progressive onboarding screen shown immediately after the very first
 * registration. Lets users add a photo URL + short bio. Skippable.
 *
 * Props:
 *   me      – { name, email, photo_url, bio }
 *   onDone  – called after successful save OR skip (parent decides next step)
 */
export default function OnboardingProfile({ me, onDone }) {
  const suggested = useMemo(
    () => `https://i.pravatar.cc/240?u=${encodeURIComponent(me?.email || me?.name || "chathel")}`,
    [me]
  );
  const [photo, setPhoto] = useState(me?.photo_url || "");
  const [bio, setBio] = useState(me?.bio || "");
  const [saving, setSaving] = useState(false);

  const initials = (me?.name || "?").slice(0, 2).toUpperCase();

  const save = async () => {
    if (!photo && !bio) { onDone && onDone(); return; }
    setSaving(true);
    try {
      await api.patch("/auth/profile", { photo_url: photo, bio });
      toast.success("Profilo aggiornato");
      onDone && onDone();
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Errore nel salvataggio");
    } finally { setSaving(false); }
  };

  return (
    <div className="w-full max-w-md" data-testid="onboarding-screen">
      <div className="brutal-card p-8">
        <div className="w-14 h-14 rounded-xl bg-bubbleSelf border-2 border-ink shadow-brutal-sm flex items-center justify-center mb-5">
          <Sparkles size={28} strokeWidth={2.5}/>
        </div>
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">Passo 2 di 2 · Opzionale</p>
        <h1 className="font-display text-4xl font-black tracking-tighter mb-2 mt-1">
          Fatti riconoscere.
        </h1>
        <p className="text-slate-700 mb-5">
          Aggiungi una foto e una bio per facilitare le conoscenze in hotel. Puoi sempre modificarli dal profilo.
        </p>

        <div className="flex items-center gap-3 mb-5">
          {photo ? (
            <img src={photo} alt="" className="w-20 h-20 rounded-full border-2 border-ink object-cover bg-white shadow-brutal-sm"/>
          ) : (
            <div className="w-20 h-20 rounded-full border-2 border-ink bg-white shadow-brutal-sm flex items-center justify-center font-display font-black text-2xl">
              {initials}
            </div>
          )}
          <div className="flex-1">
            <button
              type="button"
              data-testid="onboarding-use-suggested"
              onClick={() => setPhoto(suggested)}
              className="btn-outline !py-1.5 !px-3 text-xs w-full mb-2"
            >
              Avatar suggerito
            </button>
            {photo && (
              <button
                type="button"
                data-testid="onboarding-clear-photo"
                onClick={() => setPhoto("")}
                className="text-xs underline text-slate-600 hover:text-brand"
              >
                Rimuovi
              </button>
            )}
          </div>
        </div>

        <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-600">URL foto (pubblico)</label>
        <input
          data-testid="onboarding-photo-input"
          value={photo}
          onChange={(e) => setPhoto(e.target.value)}
          placeholder="https://…"
          className="input-brutal mt-1 mb-4"
        />

        <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-600">Bio · max 160 caratteri</label>
        <textarea
          data-testid="onboarding-bio-input"
          value={bio}
          onChange={(e) => setBio(e.target.value.slice(0, 160))}
          placeholder="Es. Viaggio per piacere, mi piacciono le passeggiate al tramonto…"
          className="input-brutal mt-1 mb-1 min-h-[90px]"
          maxLength={160}
        />
        <p className="text-[10px] text-slate-500 mb-5 text-right">{bio.length}/160</p>

        <div className="flex gap-3">
          <button
            type="button"
            data-testid="onboarding-skip-btn"
            onClick={onDone}
            disabled={saving}
            className="btn-outline flex-1 inline-flex items-center justify-center gap-2"
          >
            <SkipForward size={16}/> Salta per ora
          </button>
          <button
            type="button"
            data-testid="onboarding-save-btn"
            onClick={save}
            disabled={saving}
            className="btn-primary flex-1 inline-flex items-center justify-center gap-2"
          >
            {saving ? "Salvataggio…" : <>Salva e continua <ArrowRight size={16}/></>}
          </button>
        </div>
      </div>
    </div>
  );
}
