import type { Subdivision } from "./types"

const glyph: Record<Subdivision, string> = {
  quarter: "♩",
  eighth: "♪",
  triplet: "♪",
  sixteenth: "♪",
  quintuplet: "♪",
  sextuplet: "♪",
}

const badge: Record<Subdivision, string> = {
  quarter: "",
  eighth: "",
  triplet: "3",
  sixteenth: "16",
  quintuplet: "5",
  sextuplet: "6",
}

export function SubdivIcon(props: { subdivision: Subdivision; size?: "sm" | "md" }) {
  const size = props.size ?? "md"
  return (
    <span className={`subdiv-icon subdiv-icon--${size}`} aria-hidden="true">
      <span className="subdiv-icon__glyph">{glyph[props.subdivision]}</span>
      {badge[props.subdivision] && (
        <span className="subdiv-icon__badge">{badge[props.subdivision]}</span>
      )}
    </span>
  )
}
