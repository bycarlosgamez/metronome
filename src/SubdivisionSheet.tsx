import { useEffect, useRef, useState } from "react"
import { SubdivIcon } from "./SubdivIcon"
import { SUBDIVISION_SLOTS, toggleClick } from "./session"
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
  const { beats, click } = props.session
  const allBeats = () => new Set(beats.map((_, index) => index))
  const [selected, setSelected] = useState<Set<number>>(allBeats)

  useEffect(() => {
    if (props.open) setSelected(allBeats())
    // Reset only when the sheet opens; the meter can't change while it is open
  }, [props.open])

  useEffect(() => {
    if (!props.open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") props.onClose()
    }
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [props.open, props.onClose])

  function toggleBeat(index: number) {
    const next = new Set(selected)
    if (next.has(index)) next.delete(index)
    else next.add(index)
    setSelected(next)
  }

  function choose(subdivision: Subdivision) {
    if (selected.size === 0) return
    props.onChange({
      ...props.session,
      beats: beats.map((beat, index) => selected.has(index)
        ? { subdivision, slots: Array.from({ length: SUBDIVISION_SLOTS[subdivision] }, () => click) }
        : beat),
    })
  }


  const selectedSubs = new Set(beats.filter((_, index) => selected.has(index)).map((beat) => beat.subdivision))

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
        <p className="sheet-title">Subdivision · {props.session.meter}</p>
        <p className="beat-tiles-label">Beats</p>
        <div className="beat-tiles">
          {beats.map((beat, index) => (
            <div key={index} className={`beat-tile${selected.has(index) ? " selected" : ""}`}>
              <button
                type="button"
                className="beat-tile__select"
                aria-label={`Beat ${index + 1}`}
                aria-pressed={selected.has(index)}
                onClick={() => toggleBeat(index)}
              >
                <strong>{index + 1}</strong>
                <span>{names[beat.subdivision]}</span>
              </button>
              <div className="beat-tile__dots">
                {beat.slots.map((slot, slotIndex) => (
                  <button
                    key={slotIndex}
                    type="button"
                    className={`beat-dot${slotIndex === 0 ? " first" : ""}`}
                    aria-label={`Beat ${index + 1} click ${slotIndex + 1}`}
                    aria-pressed={slot !== "off"}
                    onClick={() => props.onChange(toggleClick(props.session, index, slotIndex))}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
        <button type="button" className="all-beats" onClick={() => setSelected(allBeats())}>All beats</button>
        <div className="subdiv-grid">
          {SUBDIVISIONS.map((sub) => (
            <button
              key={sub}
              type="button"
              className="subdiv-opt"
              aria-label={names[sub]}
              aria-pressed={selectedSubs.size === 1 && selectedSubs.has(sub)}
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
