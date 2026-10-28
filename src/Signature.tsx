import { BEATS, NOTES, type Session } from "./types"

export function Signature(props: { session: Session; onChange(session: Session): void }) {
  const [beats, note] = props.session.meter.split("/")
  function choose(nextBeats: string, nextNote: string) {
    props.onChange({ ...props.session, meter: `${nextBeats}/${nextNote}` })
  }
  return (
    <div className="signature" role="group" aria-label="Time signature">
      <span>Time signature</span>
      <select aria-label="Beats" value={beats} onChange={(event) => choose(event.target.value, note)}>
        {BEATS.map((value) => <option key={value} value={value}>{value}</option>)}
      </select>
      <span aria-hidden="true">/</span>
      <select aria-label="Note" value={note} onChange={(event) => choose(beats, event.target.value)}>
        {NOTES.map((value) => <option key={value} value={value}>{value}</option>)}
      </select>
    </div>
  )
}
