import React from "react";

type BrandLogoProps = {
  size?: "sm" | "md" | "lg";
};

const sizes = {
  sm: "h-9 w-9",
  md: "h-12 w-12",
  lg: "h-16 w-16"
};

export default function BrandLogo({ size = "md" }: BrandLogoProps) {
  return (
    <div className={`${sizes[size]} shrink-0 rounded-2xl bg-blue-500/10 p-1.5 shadow-lg shadow-blue-950/40`}>
      <svg viewBox="0 0 64 64" role="img" aria-label="Kostenlos AI logo" className="h-full w-full">
        <defs>
          <linearGradient id="kostenlos-logo-gradient" x1="10" x2="54" y1="8" y2="58" gradientUnits="userSpaceOnUse">
            <stop stopColor="#67e8f9" />
            <stop offset="0.48" stopColor="#3b82f6" />
            <stop offset="1" stopColor="#8b5cf6" />
          </linearGradient>
          <filter id="kostenlos-logo-glow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="2.2" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        <path
          d="M24.4 13.8c-5.8.9-10.1 5.8-10.1 11.8 0 1.1.1 2.1.4 3.1A10.2 10.2 0 0 0 18.2 48h25.1a9.7 9.7 0 0 0 2.2-19.1 11.9 11.9 0 0 0-21.1-15.1Z"
          fill="#020617"
          stroke="url(#kostenlos-logo-gradient)"
          strokeWidth="3"
        />
        <path
          d="M22 30.5c0-4 3.1-7.2 7-7.2 1.7 0 3.3.6 4.5 1.6a7 7 0 0 1 11.9 5.1c0 4-3.1 7.2-7 7.2h-1.5v5.1M31.4 27.7v17M25.7 35h17.2"
          fill="none"
          stroke="url(#kostenlos-logo-gradient)"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="3"
          filter="url(#kostenlos-logo-glow)"
        />
        <path d="M49.8 8.3 52 13l5 2.2-5 2.2-2.2 4.9-2.2-4.9-4.9-2.2 4.9-2.2 2.2-4.7Z" fill="#7dd3fc" />
        <path d="M12.8 43.6 14 46l2.5 1.1L14 48.2l-1.2 2.5-1.1-2.5-2.5-1.1 2.5-1.1 1.1-2.4Z" fill="#60a5fa" />
      </svg>
    </div>
  );
}
