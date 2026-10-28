import type { Subdivision } from "./types"

const mark: Record<Subdivision, string> = {
  quarter: "",
  eighth: "",
  triplet: "3",
  sixteenth: "",
  quintuplet: "5",
  sextuplet: "6",
}

export function NoteIcon(props: { subdivision: Subdivision }) {
  const flags = props.subdivision === "quarter" ? 0 : props.subdivision === "sixteenth" ? 2 : 1
  return (
    <svg aria-hidden="true" viewBox="0 0 32 32" width="28" height="28">
      <ellipse cx="11" cy="24" rx="6" ry="4.5" fill="currentColor" />
      <rect x="16" y="6" width="2" height="18" fill="currentColor" />
      {flags > 0 && <path d="M18 6c6 2 8 6 8 8-4-1-8-1-8 2V6z" fill="currentColor" />}
      {flags > 1 && <path d="M18 11c6 2 8 6 8 8-4-1-8-1-8 2V11z" fill="currentColor" />}
      {mark[props.subdivision] && (
        <text x="22" y="30" fontSize="11" fontFamily="system-ui, sans-serif" fill="currentColor">
          {mark[props.subdivision]}
        </text>
      )}
    </svg>
  )
}
