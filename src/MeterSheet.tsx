import { useEffect, useRef } from "react"
import { BEATS, NOTES } from "./types"

export function MeterSheet(props: {
  meter: string
  open: boolean
  onClose(): void
  onChange(meter: string): void
}) {
  const [beats, note] = props.meter.split("/")
  const overlayRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!props.open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") props.onClose()
    }
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [props.open, props.onClose])

  return (
    <div
      ref={overlayRef}
      className={`sheet-overlay${props.open ? " open" : ""}`}
      aria-modal={props.open}
      role="dialog"
      aria-label="Time Signature"
      onClick={(e) => { if (e.target === overlayRef.current) props.onClose() }}
    >
      <div className="sheet">
        <div className="sheet-handle" />
        <p className="sheet-title">Time Signature</p>
        <div className="meter-selects">
          <select
            className="meter-select"
            aria-label="Beats"
            value={beats}
            onChange={(e) => props.onChange(`${e.target.value}/${note}`)}
          >
            {BEATS.map((b) => <option key={b} value={b}>{b}</option>)}
          </select>
          <span className="meter-slash" aria-hidden="true">/</span>
          <select
            className="meter-select"
            aria-label="Note value"
            value={note}
            onChange={(e) => props.onChange(`${beats}/${e.target.value}`)}
          >
            {NOTES.map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </div>
      </div>
    </div>
  )
}
