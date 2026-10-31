// The app's drawn icons: one 24px grid, rounded 2px strokes, filled where a solid shape reads better at small size
const PATHS = {
  play: <path d="M8 5.5v13a1 1 0 0 0 1.5.86l10.6-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5Z" fill="currentColor" />,
  pause: <><rect x="6.5" y="5" width="4" height="14" rx="1.2" fill="currentColor" /><rect x="13.5" y="5" width="4" height="14" rx="1.2" fill="currentColor" /></>,
  stop: <rect x="6" y="6" width="12" height="12" rx="2" fill="currentColor" />,
  sound: <><path d="M4 9.5h3l4.5-3.8v12.6L7 14.5H4z" fill="currentColor" /><path d="M15 9a4 4 0 0 1 0 6M17.5 6.5a7.5 7.5 0 0 1 0 11" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></>,
} as const

export type IconName = keyof typeof PATHS

export function Icon(props: { name: IconName; size?: number }) {
  const size = props.size ?? 24
  return (
    <svg className="icon" width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      {PATHS[props.name]}
    </svg>
  )
}
