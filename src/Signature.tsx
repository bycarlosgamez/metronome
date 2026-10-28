import { SUBDIVISION_SLOTS } from "./session"
import { BEATS, CLICKS, NOTES, SUBDIVISIONS, type Session, type Slot } from "./types"

const labels = {
  quarter: ["Beat"],
  eighth: ["1", "&"],
  triplet: ["1", "trip", "let"],
  sixteenth: ["1", "e", "&", "a"],
  quintuplet: ["1", "ta", "ka", "di", "mi"],
  sextuplet: ["1", "ta", "la", "ta", "li", "ta"],
}

const names = {
  quarter: "Beat",
  eighth: "Eighth",
  triplet: "Triplet",
  sixteenth: "Sixteenth",
  quintuplet: "Quintuplet",
  sextuplet: "Sextuplet",
}

export function Signature(props: { session: Session; onChange(session: Session): void }) {
  const [beats, note] = props.session.meter.split("/")
  function choose(nextBeats: string, nextNote: string) {
    props.onChange({ ...props.session, meter: `${nextBeats}/${nextNote}` })
  }
  return (
    <>
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
      <label>
        Subdivision
        <select
          aria-label="Subdivision"
          value={props.session.subdivision}
          onChange={(event) => {
            const subdivision = event.target.value as Session["subdivision"]
            props.onChange({
              ...props.session,
              subdivision,
              slots: Array.from({ length: SUBDIVISION_SLOTS[subdivision] }, () => props.session.click),
            })
          }}
        >
          {SUBDIVISIONS.map((subdivision) => (
            <option key={subdivision} value={subdivision}>
              {names[subdivision]}
            </option>
          ))}
        </select>
      </label>
      <div className="slot-row">
        {labels[props.session.subdivision].map((label, index) => (
          <div key={`${label}-${index}`} className="slot">
            <select
              aria-label={`${label} click`}
              value={props.session.slots[index]}
              onChange={(event) => {
                const slot = event.target.value as Slot
                const slots = props.session.slots.map((current, slotIndex) => slotIndex === index ? slot : current)
                const click = index === 0 && slot !== "off" ? slot : props.session.click
                props.onChange({ ...props.session, slots, click })
              }}
            >
              {CLICKS.map((click) => (
                <option key={click} value={click}>{`Click ${click.slice(-1)}`}</option>
              ))}
              <option value="off">Off</option>
            </select>
            {props.session.subdivision !== "quarter" && <span aria-hidden="true">{label}</span>}
          </div>
        ))}
      </div>
    </>
  )
}
