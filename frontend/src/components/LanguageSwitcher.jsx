import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { LANGUAGES } from "../i18n";
import { Globe, Check } from "lucide-react";

export default function LanguageSwitcher({ compact = false }) {
  const { i18n: i18nInstance } = useTranslation();
  const [open, setOpen] = useState(false);
  const current = LANGUAGES.find((l) => l.code === i18nInstance.language) || LANGUAGES[0];

  const change = (code) => {
    i18nInstance.changeLanguage(code);
    localStorage.setItem("chathel_lng", code);
    setOpen(false);
  };

  return (
    <div className="relative">
      <button
        data-testid="lang-switcher-btn"
        onClick={() => setOpen((o) => !o)}
        className={`inline-flex items-center gap-1.5 border-2 border-ink rounded-full shadow-brutal-sm bg-white hover:bg-sun transition font-bold ${compact ? "px-2.5 py-1.5 text-xs" : "px-3 py-2 text-sm"}`}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className="text-base leading-none">{current.flag}</span>
        {!compact && <span className="uppercase">{current.code}</span>}
        {compact && <Globe size={12} strokeWidth={3} />}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 mt-2 z-50 bg-white border-2 border-ink rounded-xl shadow-brutal min-w-[180px] py-1" role="listbox">
            {LANGUAGES.map((l) => (
              <button
                key={l.code}
                data-testid={`lang-option-${l.code}`}
                onClick={() => change(l.code)}
                className={`w-full text-left px-3 py-2 text-sm font-bold flex items-center gap-2 hover:bg-sun ${current.code === l.code ? "bg-bubbleSelf" : ""}`}
              >
                <span className="text-base">{l.flag}</span>
                <span className="flex-1">{l.label}</span>
                {current.code === l.code && <Check size={14} strokeWidth={3}/>}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
