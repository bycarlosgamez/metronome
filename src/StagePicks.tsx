import { useEffect, useId, useRef, useState } from "react"
import { formatDuration, parseDuration } from "./format"
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

const increaseWords = { off: "Off", time: "Time", bars: "Bars" } as const

function ClockIcon() {
  return (
    <svg viewBox="0 0 24 24" width="28" height="28" aria-hidden="true">
      <circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" strokeWidth="2" />
      <path d="M12 8v4l3 2" fill="none" stroke="currentColor" strokeWidth="2" />
    </svg>
  )
}

function BarsIcon() {
  return (
    <svg viewBox="0 0 24 24" width="28" height="28" aria-hidden="true">
      <path d="M8 5v14M16 5v14" fill="none" stroke="currentColor" strokeWidth="2" />
    </svg>
  )
}

export function StagePicks(props: { session: Session; onChange(session: Session): void }) {
  const [open, setOpen] = useState<"meter" | "subdivision" | "increase" | null>(null)
  const meterDescriptionId = useId()
  const subdivisionDescriptionId = useId()
  const increaseDescriptionId = useId()
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

  function chooseIncrease(mode: "off" | "time" | "bars") {
    props.onChange({
      ...props.session,
      time: { ...props.session.time, increaseEvery: mode },
    })
    if (mode === "off") setOpen(null)
  }

  const increaseEvery = props.session.time.increaseEvery

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
        {props.session.type === "time" && (
          <button
            type="button"
            aria-label="BPM increase"
            aria-describedby={increaseDescriptionId}
            aria-expanded={open === "increase"}
            onClick={() => setOpen(open === "increase" ? null : "increase")}
          >
            {increaseEvery === "time" ? <ClockIcon /> : increaseEvery === "bars" ? <BarsIcon /> : "∞"}
          </button>
        )}
      </div>
      <span id={meterDescriptionId} className="visually-hidden">{props.session.meter}</span>
      <span id={subdivisionDescriptionId} className="visually-hidden">{names[props.session.subdivision]}</span>
      {props.session.type === "time" && (
        <span id={increaseDescriptionId} className="visually-hidden">{increaseWords[increaseEvery]}</span>
      )}
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
      {props.session.type === "time" && open === "increase" && (
        <div className="stage-panel" role="group" aria-label="BPM increase">
          {(["off", "time", "bars"] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              aria-pressed={increaseEvery === mode}
              onClick={() => chooseIncrease(mode)}
            >
              {increaseWords[mode]}
            </button>
          ))}
          {increaseEvery !== "off" && (
            <>
              <input
                aria-label="Amount"
                value={String(props.session.bpmIncrease)}
                onChange={(event) => {
                  props.onChange({
                    ...props.session,
                    bpmIncrease: Math.max(0, Math.round(Number(event.target.value))),
                  })
                }}
              />
              <input
                aria-label="Every"
                value={increaseEvery === "bars" ? String(props.session.time.everyBars) : formatDuration(props.session.time.everySec)}
                onChange={(event) => {
                  const value = event.target.value
                  props.onChange({
                    ...props.session,
                    time: increaseEvery === "bars"
                      ? { ...props.session.time, everyBars: Math.max(1, Math.round(Number(value))) }
                      : { ...props.session.time, everySec: parseDuration(value) },
                  })
                }}
              />
              <input
                aria-label="End"
                value={formatDuration(props.session.time.seconds)}
                onChange={(event) => {
                  props.onChange({
                    ...props.session,
                    time: { ...props.session.time, seconds: parseDuration(event.target.value) },
                  })
                }}
              />
            </>
          )}
        </div>
      )}
    </div>
  )
}
