import type { SVGProps } from 'react'

interface PikmeLogoProps extends SVGProps<SVGSVGElement> {
  withWordmark?: boolean
}

export function PikmeLogo({ withWordmark = true, className, ...props }: PikmeLogoProps) {
  return (
    <svg
      viewBox="0 0 358 84"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="PickMe"
      {...props}
    >
      <defs>
        <linearGradient id="pickme-logo-night" x1="14" y1="10" x2="74" y2="74" gradientUnits="userSpaceOnUse">
          <stop stopColor="#1A5963" />
          <stop offset="1" stopColor="#0D2D35" />
        </linearGradient>
        <linearGradient id="pickme-logo-gold" x1="22" y1="18" x2="60" y2="64" gradientUnits="userSpaceOnUse">
          <stop stopColor="#E2BF86" />
          <stop offset="1" stopColor="#BE6F43" />
        </linearGradient>
        <linearGradient id="pickme-logo-sheen" x1="6" y1="6" x2="82" y2="82" gradientUnits="userSpaceOnUse">
          <stop stopColor="#FFFFFF" stopOpacity="0.86" />
          <stop offset="1" stopColor="#FFFFFF" stopOpacity="0" />
        </linearGradient>
      </defs>

      <rect x="6" y="6" width="76" height="76" rx="24" fill="url(#pickme-logo-night)" />
      <rect x="9" y="9" width="70" height="70" rx="21" fill="none" stroke="#D0DEE1" strokeWidth="1.2" opacity="0.7" />
      <path d="M17 21C24 12 38 10 50 13C63 16 73 26 74 40" stroke="url(#pickme-logo-sheen)" strokeWidth="2.4" strokeLinecap="round" />

      <g>
        <circle cx="31" cy="31" r="7" fill="none" stroke="#E7EEF0" strokeWidth="2.6" />
        <circle cx="50" cy="50" r="7" fill="none" stroke="#E7EEF0" strokeWidth="2.6" />
        <path d="M35.8 35.8L54.8 54.8" stroke="#E7EEF0" strokeWidth="3" strokeLinecap="round" />
        <path d="M35.6 45L55 25.9" stroke="url(#pickme-logo-gold)" strokeWidth="3.2" strokeLinecap="round" />
        <circle cx="44" cy="40.6" r="2.35" fill="#D8A165" />
      </g>

      {withWordmark ? (
        <>
          <text x="96" y="47" fontFamily="'DM Sans', 'Segoe UI', sans-serif" fontSize="44" fontWeight="700" letterSpacing="0.01em">
            <tspan fill="#10343C">Pick</tspan>
            <tspan fill="#BE6F43">Me</tspan>
          </text>
          <text x="98" y="66" fill="#5F7B82" fontFamily="'DM Sans', 'Segoe UI', sans-serif" fontSize="11" fontWeight="700" letterSpacing="0.14em">
            BEAUTY BOOKING PLATFORM
          </text>
        </>
      ) : null}
    </svg>
  )
}
