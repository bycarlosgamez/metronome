import { Sheet } from "./Sheet"
import { BEATS, NOTES } from "./types"

export function MeterSheet(props: {
  meter: string
  open: boolean
  onClose(): void
  onChange(meter: string): void
}) {
  const [beats, note] = props.meter.split("/")

  return (
    <Sheet label="Time Signature" open={props.open} onClose={props.onClose}>
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
    </Sheet>
  )
}
