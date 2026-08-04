import type { SVGProps } from 'react'

interface PikmeLogoProps extends SVGProps<SVGSVGElement> {
  withWordmark?: boolean
}

export function PikmeLogo({ withWordmark = true, className, ...props }: PikmeLogoProps) {
  return (
    <svg
      viewBox="0 0 220 44"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="PickMe"
      {...props}
    >
      <path d="M22 3C14.82 3 9 8.82 9 16C9 25.29 22 39.5 22 39.5C22 39.5 35 25.29 35 16C35 8.82 29.18 3 22 3Z" fill="#0F5A63" />
      <path d="M17 19.5C18.83 17.12 20.28 14.95 21.35 13M27 19.5C25.17 17.12 23.72 14.95 22.65 13M18.3 11.25C20.32 11.25 22.63 11.25 24.7 11.25" stroke="white" strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="18.3" cy="9.05" r="1.45" fill="white" />
      <circle cx="24.7" cy="9.05" r="1.45" fill="white" />
      <circle cx="22" cy="17.8" r="2.8" fill="#0B3E45" opacity="0.22" />
      {withWordmark ? (
        <text x="49" y="27" fill="#113E45" fontFamily="Manrope, Segoe UI, sans-serif" fontSize="24" fontWeight="700" letterSpacing="0.2">PickMe</text>
      ) : null}
    </svg>
  )
}
