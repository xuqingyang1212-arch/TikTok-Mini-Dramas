"use client"

/**
 * Faceted "V" diamond icon used on VIP subscription cards.
 * Rendered as inline SVG (custom brand art), themed per tier.
 * The weekly / recommended tier shows a gold crown on top.
 */

export type VipTheme = "gold" | "purple" | "blue" | "rose" | "teal"

interface VipDiamondIconProps {
  theme: VipTheme
  crown?: boolean
  className?: string
}

// Per-theme gradient stops for the diamond body.
const THEME_STOPS: Record<VipTheme, { light: string; mid: string; dark: string }> = {
  gold: { light: "#ffe89a", mid: "#f6b64b", dark: "#c9781a" },
  purple: { light: "#e5b6ff", mid: "#a86bff", dark: "#5b2ea6" },
  blue: { light: "#bfe4ff", mid: "#6aa8ff", dark: "#2f5fb0" },
  rose: { light: "#ffc1d4", mid: "#ef668f", dark: "#9e294f" },
  teal: { light: "#b8fff2", mid: "#4fd5c2", dark: "#167f7b" },
}

export function VipDiamondIcon({ theme, crown = false, className }: VipDiamondIconProps) {
  const stops = THEME_STOPS[theme]
  const uid = `vip-${theme}`

  return (
    <svg
      className={className}
      width="56"
      height="56"
      viewBox="0 0 56 56"
      fill="none"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={`${uid}-body`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={stops.light} />
          <stop offset="55%" stopColor={stops.mid} />
          <stop offset="100%" stopColor={stops.dark} />
        </linearGradient>
        <linearGradient id={`${uid}-facet`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.55" />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0.05" />
        </linearGradient>
        <linearGradient id={`${uid}-crown`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={stops.light} />
          <stop offset="55%" stopColor={stops.mid} />
          <stop offset="100%" stopColor={stops.dark} />
        </linearGradient>
      </defs>

      {/* Crown (recommended tier only) */}
      {crown && (
        <g>
          <path
            d="M15 13 L20.5 17 L28 9.5 L35.5 17 L41 13 L39 21 L17 21 Z"
            fill={`url(#${uid}-crown)`}
            stroke={stops.light}
            strokeWidth="0.6"
            strokeLinejoin="round"
          />
          <circle cx="15" cy="12" r="1.7" fill={stops.light} />
          <circle cx="28" cy="8.5" r="1.9" fill={stops.light} />
          <circle cx="41" cy="12" r="1.7" fill={stops.light} />
        </g>
      )}

      {/* Diamond body */}
      <g transform={crown ? "translate(0,2)" : "translate(0,0)"}>
        <path
          d="M28 50 L7 27 L15 20 L41 20 L49 27 Z"
          fill={`url(#${uid}-body)`}
          stroke="#ffffff"
          strokeOpacity="0.35"
          strokeWidth="0.8"
          strokeLinejoin="round"
        />
        {/* Top facet highlight */}
        <path d="M15 20 L41 20 L49 27 L7 27 Z" fill={`url(#${uid}-facet)`} />
        {/* Facet dividers */}
        <path
          d="M15 20 L20 27 M41 20 L36 27 M20 27 L28 50 M36 27 L28 50"
          stroke="#ffffff"
          strokeOpacity="0.28"
          strokeWidth="0.7"
        />
        {/* "V" mark */}
        <path
          d="M20 26.5 L28 40 L36 26.5"
          fill="none"
          stroke="#ffffff"
          strokeOpacity="0.92"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </g>
    </svg>
  )
}
