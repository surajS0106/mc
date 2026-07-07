import React, { useId } from "react";

/**
 * The my-code "Sentinel" mark — a cyber-dog head in a terracotta helmet wearing
 * over-ear headphones: a contained visor band with a glowing cyan scan slit,
 * antenna fins, and side ear-cups on a headband. Inline SVG so it stays crisp
 * and animatable. `tile` draws the dark rounded app-icon background.
 */
export function Logo({
  size = 32,
  tile = false,
  className,
}: {
  size?: number;
  tile?: boolean;
  className?: string;
}): React.ReactElement {
  const uid = useId().replace(/:/g, "");
  const fur = `fur-${uid}`;
  const glow = `glow-${uid}`;
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 120 120"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="my-code"
    >
      <defs>
        <linearGradient id={fur} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#e2895f" />
          <stop offset="100%" stopColor="#bf5c3b" />
        </linearGradient>
        <filter id={glow} x="-80%" y="-80%" width="260%" height="260%">
          <feGaussianBlur stdDeviation="1.3" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {tile && <rect width="120" height="120" rx="28" fill="#211f1d" />}

      {/* headband (behind head) */}
      <path d="M24 60 C 24 24, 96 24, 96 60" stroke="#464b52" strokeWidth="8" fill="none" strokeLinecap="round" />
      <path d="M24 60 C 24 26, 96 26, 96 60" stroke="#767d86" strokeWidth="2.5" fill="none" strokeLinecap="round" />

      {/* antenna fins */}
      <path d="M42 33 L36 21 L50 30 Z" fill="#5f666e" />
      <path d="M78 33 L84 21 L70 30 Z" fill="#5f666e" />

      {/* head */}
      <rect x="33" y="31" width="54" height="60" rx="24" fill={`url(#${fur})`} />

      {/* goggles + two eyes */}
      <rect x="37" y="50" width="46" height="19" rx="9.5" fill="#141210" />
      <rect x="37" y="50" width="46" height="19" rx="9.5" fill="none" stroke="#2a2724" strokeWidth="1" />
      <g filter={`url(#${glow})`}>
        <circle className="mc-eye" cx="50" cy="59.5" r="4.6" fill="#37dbd0" />
        <circle className="mc-eye" cx="70" cy="59.5" r="4.6" fill="#37dbd0" />
      </g>
      <circle cx="48" cy="57.5" r="1.5" fill="#eafffb" />
      <circle cx="68" cy="57.5" r="1.5" fill="#eafffb" />

      {/* ear cups */}
      <rect x="15" y="48" width="20" height="30" rx="9" fill="#3d424a" />
      <rect x="19" y="52" width="12" height="22" rx="6" fill="#22262b" />
      <rect x="85" y="48" width="20" height="30" rx="9" fill="#3d424a" />
      <rect x="89" y="52" width="12" height="22" rx="6" fill="#22262b" />
      <g filter={`url(#${glow})`}>
        <rect x="22" y="61" width="6" height="4" rx="2" fill="#37dbd0" />
        <rect x="92" y="61" width="6" height="4" rx="2" fill="#37dbd0" />
      </g>
    </svg>
  );
}
