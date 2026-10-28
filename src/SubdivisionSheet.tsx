import { useEffect, useRef } from "react"
import { SubdivIcon } from "./SubdivIcon"
import { SUBDIVISION_SLOTS } from "./session"
import { SUBDIVISIONS, type Session, type Subdivision } from "./types"

const names: Record<Subdivision, string> = {
  quarter: "Quarter",
  eighth: "Eighth",
  triplet: "Triplet",
  sixteenth: "16th",
  quintuplet: "Quintuplet",
  sextuplet: "Sextuplet",
}

export function SubdivisionSheet(props: {
  session: Session
  open: boolean
  onClose(): void
  onChange(session: Session): void
}) {
  const overlayRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!props.open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") props.onClose()
    }
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [props.open, props.onClose])

  function choose(subdivision: Subdivision) {
    props.onChange({
      ...props.session,
      subdivision,
      slots: Array.from({ length: SUBDIVISION_SLOTS[subdivision] }, () => props.session.click),
    })
    props.onClose()
  }

  return (
    <div
      ref={overlayRef}
      inert={!props.open}
      className={`sheet-overlay${props.open ? " open" : ""}`}
      aria-modal={props.open}
      role="dialog"
      aria-label="Subdivision"
      onClick={(e) => { if (e.target === overlayRef.current) props.onClose() }}
    >
      <div className="sheet">
        <div className="sheet-handle" />
        <p className="sheet-title">Subdivision</p>
        <div className="subdiv-grid">
          {SUBDIVISIONS.map((sub) => (
            <button
              key={sub}
              type="button"
              className="subdiv-opt"
              aria-pressed={sub === props.session.subdivision}
              onClick={() => choose(sub)}
            >
              <SubdivIcon subdivision={sub} />
              <span className="subdiv-opt__name">{names[sub]}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
