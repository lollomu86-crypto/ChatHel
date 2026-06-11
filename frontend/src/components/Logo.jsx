import React from "react";

/**
 * ChatHel monogram (H+C). Uses the cropped symbol asset stored in /public.
 * The image is transparent square so it always centers nicely.
 */
const SYMBOL_SRC = "/chathel-symbol.png";

export default function Logo({ size = 44, withText = false, className = "", textClass = "" }) {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <div
        aria-label="ChatHel"
        role="img"
        className="border-2 border-ink rounded-lg bg-white shadow-brutal-sm shrink-0 flex items-center justify-center overflow-hidden"
        style={{ width: size, height: size }}
      >
        <img src={SYMBOL_SRC} alt="ChatHel" className="object-contain" style={{ width: "82%", height: "82%" }}/>
      </div>
      {withText && (
        <span className={`font-display font-black tracking-tighter ${textClass || "text-2xl"}`}>
          <span className="text-ink">Chat</span><span className="text-brand">Hel</span>
        </span>
      )}
    </div>
  );
}

export { SYMBOL_SRC };
