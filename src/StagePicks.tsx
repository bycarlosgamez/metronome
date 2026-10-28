import { useEffect, useId, useRef, useState } from "react"
import { SUBDIVISION_SLOTS } from "./session"
import { NoteIcon } from "./NoteIcon"
import { BEATS, NOTES, SUBDIVISIONS, type Session, type Subdivision } from "./types"

const names: Record<Subdivision, string> = {
  quarter: "Quarter",
  eighth: "Eighth",
  triplet: "Triplet",
  sixteenth: "Sixteenth",
  quintuplet: "Quintuplet",
  sextuplet: "Sextuplet",
}

export function StagePicks(props: { session: Session; onChange(session: Session): void }) {
  const [open, setOpen] = useState<"meter" | "subdivision" | null>(null)
  const meterDescriptionId = useId()
  const subdivisionDescriptionId = useId()
  const rootRef = useRef<HTMLDivElement>(null)
  const [beats, note] = props.session.meter.split("/")
  const pending = useRef({ beats, note })
  const seenMeter = useRef(props.session.meter)
  if (seenMeter.current !== props.session.meter) {
    seenMeter.current = props.session.meter
    pending.current = { beats, note }
  }

  useEffect(() => {
    if (!open) return
    function onPointer(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(null)
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(null)
    }
    document.addEventListener("pointerdown", onPointer)
    document.addEventListener("keydown", onKey)
    return () => {
      document.removeEventListener("pointerdown", onPointer)
      document.removeEventListener("keydown", onKey)
    }
  }, [open])

  function chooseMeter(nextBeats: string, nextNote: string) {
    pending.current = { beats: nextBeats, note: nextNote }
    props.onChange({ ...props.session, meter: `${nextBeats}/${nextNote}` })
  }

  return (
    <div className="stage-picks" ref={rootRef}>
      <div className="stage-pick-row">
        <button
          type="button"
          aria-label="Time signature"
          aria-describedby={meterDescriptionId}
          aria-expanded={open === "meter"}
          onClick={() => setOpen(open === "meter" ? null : "meter")}
        >
          {props.session.meter}
        </button>
        <button
          type="button"
          aria-label="Subdivision"
          aria-describedby={subdivisionDescriptionId}
          aria-expanded={open === "subdivision"}
          onClick={() => setOpen(open === "subdivision" ? null : "subdivision")}
        >
          <NoteIcon subdivision={props.session.subdivision} />
        </button>
      </div>
      <span id={meterDescriptionId} className="visually-hidden">{props.session.meter}</span>
      <span id={subdivisionDescriptionId} className="visually-hidden">{names[props.session.subdivision]}</span>
      {open === "meter" && (
        <div className="stage-panel" role="group" aria-label="Choose time signature">
          <select aria-label="Beats" value={beats} onChange={(event) => chooseMeter(event.target.value, pending.current.note)}>
            {BEATS.map((value) => <option key={value} value={value}>{value}</option>)}
          </select>
          <span aria-hidden="true">/</span>
          <select aria-label="Note" value={note} onChange={(event) => chooseMeter(pending.current.beats, event.target.value)}>
            {NOTES.map((value) => <option key={value} value={value}>{value}</option>)}
          </select>
        </div>
      )}
      {open === "subdivision" && (
        <div className="stage-panel" role="group" aria-label="Choose subdivision">
          {SUBDIVISIONS.map((subdivision) => (
            <button
              key={subdivision}
              type="button"
              aria-pressed={subdivision === props.session.subdivision}
              onClick={() => {
                props.onChange({
                  ...props.session,
                  subdivision,
                  slots: Array.from({ length: SUBDIVISION_SLOTS[subdivision] }, () => props.session.click),
                })
                setOpen(null)
              }}
            >
              <NoteIcon subdivision={subdivision} />
              {names[subdivision]}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
