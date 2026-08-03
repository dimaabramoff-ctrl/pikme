import type { SVGProps } from 'react'

interface PikmeLogoProps extends SVGProps<SVGSVGElement> {
  withWordmark?: boolean
}

export function PikmeLogo({ withWordmark = true, className, ...props }: PikmeLogoProps) {
  return (
    <svg
      viewBox="0 0 196 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="Пикми"
      {...props}
    >
      <rect x="1" y="1" width="38" height="38" rx="13" fill="#153E45" />
      <path
        d="M12.4 28.1C15.3 24.2 17.6 20.6 19.3 17.2M26.4 28.1C23.5 24.2 21.2 20.6 19.5 17.2M14.5 14.4C17.7 14.4 21.2 14.4 24.4 14.4"
        stroke="white"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
      <circle cx="14.5" cy="11.2" r="1.9" fill="white" />
      <circle cx="24.4" cy="11.2" r="1.9" fill="white" />
      {withWordmark ? (
        <>
          <path d="M55.2 28V11.8H62.6C66.7 11.8 69.3 14 69.3 17.5C69.3 21 66.7 23.2 62.6 23.2H58.8V28H55.2ZM58.8 20.3H62.1C64 20.3 65.5 19.4 65.5 17.5C65.5 15.6 64 14.7 62.1 14.7H58.8V20.3Z" fill="#153E45" />
          <path d="M71.8 28V11.8H75.3V28H71.8Z" fill="#153E45" />
          <path d="M82.6 28H79V11.8H82.4V19.5L89.2 11.8H93.6L87.2 18.8L93.9 28H89.6L84.9 21.4L82.6 23.9V28Z" fill="#153E45" />
          <path d="M95.5 28V11.8H99V28H95.5Z" fill="#153E45" />
          <path d="M102.4 28V11.8H106L111.2 20.6L116.3 11.8H119.9V28H116.5V17.7L112.4 24.7H109.9L105.8 17.7V28H102.4Z" fill="#153E45" />
          <path d="M123.4 28V11.8H134.9V14.7H127V18.3H133.8V21.1H127V25.1H135.1V28H123.4Z" fill="#153E45" />
        </>
      ) : null}
    </svg>
  )
}
