import React from "react";

interface LogoProps {
  size?: number;
  showText?: boolean;
}

export default function Logo({ size = 40, showText = false }: LogoProps) {
  return (
    <div className="flex items-center gap-3">
      <svg
        width={size}
        height={size}
        viewBox="0 0 40 40"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        role="img"
        aria-label="Kostenlos AI logo"
      >
        <defs>
          <linearGradient id="kostenlos-ai-logo-grad" x1="0" y1="0" x2="40" y2="40" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#0066ff" />
            <stop offset="100%" stopColor="#7c3aed" />
          </linearGradient>
        </defs>
        <rect width="40" height="40" rx="12" fill="url(#kostenlos-ai-logo-grad)" />
        <circle cx="20" cy="15" r="5" fill="white" />
        <circle cx="11" cy="26" r="3.5" fill="white" opacity="0.92" />
        <circle cx="20" cy="29" r="3.5" fill="white" opacity="0.92" />
        <circle cx="29" cy="26" r="3.5" fill="white" opacity="0.92" />
        <line x1="20" y1="20" x2="11" y2="26" stroke="white" strokeWidth="1.5" opacity="0.65" />
        <line x1="20" y1="20" x2="20" y2="29" stroke="white" strokeWidth="1.5" opacity="0.65" />
        <line x1="20" y1="20" x2="29" y2="26" stroke="white" strokeWidth="1.5" opacity="0.65" />
      </svg>
      {showText && (
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="truncate font-semibold text-white">Kostenlos AI</span>
            <span className="rounded-full border border-[#333333] bg-[#1a1a1a] px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-[#888888]">
              Beta
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
