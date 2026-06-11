import React from "react";

const LOGO_URL = "https://customer-assets.emergentagent.com/job_hotel-gather/artifacts/vndqz2kn_image.png";

export default function Logo({ size = 36, withText = false, className = "", textClass = "" }) {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <img
        src={LOGO_URL}
        alt="ChatHel"
        width={size}
        height={size}
        className="block border-2 border-ink rounded-lg bg-white shadow-brutal-sm object-contain"
        style={{ width: size, height: size, padding: 2 }}
      />
      {withText && (
        <span className={`font-display font-black tracking-tighter ${textClass || "text-2xl"}`}>
          <span className="text-ink">Chat</span><span className="text-brand">Hel</span>
        </span>
      )}
    </div>
  );
}

export { LOGO_URL };
