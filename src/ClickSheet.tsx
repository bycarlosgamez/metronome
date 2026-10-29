import { useEffect, useRef } from "react"
import { CLICKS, type ClickId, type Session } from "./types"

export function ClickSheet(props: {
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
    <div
      ref={overlayRef}
      inert={!props.open}
      className={`sheet-overlay${props.open ? " open" : ""}`}
      aria-modal={props.open}
      role="dialog"
      aria-label="Click"
      onClick={(e) => { if (e.target === overlayRef.current) props.onClose() }}
    >
      <div className="sheet">
        <div className="sheet-handle" />
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
        <div className="click-accent-row">
          <span>Accent beat 1</span>
          <button
            type="button"
            className="routine-toggle-btn"
            aria-label="Accent beat 1"
            aria-pressed={props.session.accent}
            onClick={() => props.onChange({ ...props.session, accent: !props.session.accent })}
          >
            {props.session.accent ? "On" : "Off"}
          </button>
        </div>
      </div>
    </div>
  )
}
