import { Sheet } from "./Sheet"
import { toggleAccent } from "./session"
import { CLICKS, type ClickId, type Session } from "./types"

export function ClickSheet(props: {
  session: Session
  open: boolean
  onClose(): void
  onChange(session: Session): void
}) {


  // One sound for the whole bar: every sounding click switches, muted clicks stay muted.
  function chooseSound(click: ClickId) {
    props.onChange({
      ...props.session,
      click,
      beats: props.session.beats.map((beat) => ({
        ...beat,
        slots: beat.slots.map((slot) => slot === "off" ? "off" : click),
      })),
    })
  }

  return (
    <Sheet label="Click" open={props.open} onClose={props.onClose}>
      <p className="sheet-title">Click</p>
      <div className="click-sounds">
        {CLICKS.map((click, index) => (
          <button
            key={click}
            type="button"
            className="subdiv-opt"
            aria-label={`Sound ${index + 1}`}
            aria-pressed={props.session.click === click}
            onClick={() => chooseSound(click)}
          >
            <strong>{index + 1}</strong>
            <span className="subdiv-opt__name">Sound {index + 1}</span>
          </button>
        ))}
      </div>
      {/* Tap a beat to accent it, tap again to make it normal; any number of beats can be accented */}
      <p className="beat-tiles-label click-accent-label">Accent</p>
      <div className="accent-beats">
        {props.session.beats.map((_, index) => (
          <button
            key={index}
            type="button"
            className="accent-beat"
            aria-label={`Accent beat ${index + 1}`}
            aria-pressed={props.session.accents.includes(index + 1)}
            onClick={() => props.onChange(toggleAccent(props.session, index + 1))}
          >
            {index + 1}
          </button>
        ))}
      </div>
    </Sheet>
  )
}
