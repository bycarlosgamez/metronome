import { useEffect, useRef, useState } from "react"
import { formatClock } from "./format"
import { clampBpm, clampSession, timeDurationSec } from "./session"
import type { Session } from "./types"

function DerivedDuration(props: { session: Session }) {
  if (props.session.time.increaseEvery === "off") return null
  const sec = timeDurationSec(props.session)
  if (!Number.isFinite(sec)) return null
  return (
    <div className="increase-derived">
      Estimated duration <span>~{formatClock(sec)}</span>
    </div>
  )
}

export function BpmSheet(props: {
  session: Session
  open: boolean
  onClose(): void
  onChange(session: Session): void
}) {
  const overlayRef = useRef<HTMLDivElement>(null)
  const [bpmText, setBpmText] = useState<string | null>(null)
  const [targetText, setTargetText] = useState<string | null>(null)
  const [stepText, setStepText] = useState<string | null>(null)
  const [everyText, setEveryText] = useState<string | null>(null)
  const bpmRef = useRef<string | null>(null)
  const targetRef = useRef<string | null>(null)
  const stepRef = useRef<string | null>(null)
  const everyRef = useRef<string | null>(null)

  useEffect(() => {
    if (!props.open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") props.onClose()
    }
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [props.open, props.onClose])

  function commitBpm() {
    const typed = bpmRef.current
    setBpmText(null)
    bpmRef.current = null
    if (typed === null) return
    const next = clampBpm(Number(typed))
    if (next === props.session.bpm) return
    props.onChange(clampSession({ ...props.session, bpm: next }))
  }

  function commitTarget() {
    const typed = targetRef.current
    setTargetText(null)
    targetRef.current = null
    if (typed === null) return
    const next = clampBpm(Number(typed))
    if (next === props.session.time.targetBpm) return
    props.onChange(clampSession({
      ...props.session,
      time: { ...props.session.time, targetBpm: next },
    }))
  }

  function chooseMode(mode: "off" | "bars") {
    props.onChange(clampSession({
      ...props.session,
      time: { ...props.session.time, increaseEvery: mode },
    }))
  }

  const { increaseEvery, targetBpm, everyBars } = props.session.time

  return (
    <div
      ref={overlayRef}
      inert={!props.open}
      className={`sheet-overlay${props.open ? " open" : ""}`}
      aria-modal={props.open}
      role="dialog"
      aria-label="BPM settings"
      onClick={(e) => { if (e.target === overlayRef.current) props.onClose() }}
    >
      <div className="sheet">
        <div className="sheet-handle" />

        <div className="bpm-sheet-cols">
          {/* BPM card */}
          <div className="bpm-sheet-card">
            <p className="sheet-title">BPM</p>
            <div className="bpm-input-row">
              <input
                className="bpm-sheet-input"
                aria-label="BPM"
                inputMode="numeric"
                value={bpmText ?? String(props.session.bpm)}
                onFocus={() => {
                  bpmRef.current = String(props.session.bpm)
                  setBpmText(String(props.session.bpm))
                }}
                onChange={(e) => {
                  bpmRef.current = e.target.value
                  setBpmText(e.target.value)
                }}
                onBlur={commitBpm}
                onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur() }}
              />
              <div className="bpm-steppers">
                <button
                  type="button"
                  className="bpm-stepper"
                  aria-label="Increase BPM"
                  onClick={() => props.onChange(clampSession({ ...props.session, bpm: props.session.bpm + 1 }))}
                >+</button>
                <button
                  type="button"
                  className="bpm-stepper"
                  aria-label="Decrease BPM"
                  onClick={() => props.onChange(clampSession({ ...props.session, bpm: props.session.bpm - 1 }))}
                >−</button>
              </div>
            </div>
          </div>

          {/* Increase to target card */}
          <div className="bpm-sheet-card bpm-sheet-target-card">
            <p className="sheet-title">Increase to target</p>
            <div className="increase-mode-row">
              {(["off", "bars"] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  className="increase-mode-btn"
                  aria-pressed={increaseEvery === mode}
                  onClick={() => chooseMode(mode)}
                >
                  {mode === "off" ? "Off" : "Bars"}
                </button>
              ))}
            </div>

            {increaseEvery !== "off" && (
              <div className="increase-content">
                <div className="increase-fields">
                  <div className="increase-field target">
                    <label htmlFor="bpm-sheet-target">Target BPM</label>
                    <input
                      id="bpm-sheet-target"
                      inputMode="numeric"
                      value={targetText ?? String(targetBpm)}
                      onFocus={() => {
                        targetRef.current = String(targetBpm)
                        setTargetText(String(targetBpm))
                      }}
                      onChange={(e) => {
                        targetRef.current = e.target.value
                        setTargetText(e.target.value)
                      }}
                      onBlur={commitTarget}
                      onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur() }}
                    />
                  </div>
                  <div className="increase-field">
                    <label htmlFor="bpm-sheet-step">Step</label>
                    <input
                      id="bpm-sheet-step"
                      inputMode="numeric"
                      value={stepText ?? String(props.session.bpmIncrease)}
                      onChange={(e) => { stepRef.current = e.target.value; setStepText(e.target.value) }}
                      onBlur={() => {
                        const typed = stepRef.current
                        setStepText(null)
                        stepRef.current = null
                        if (typed === null) return
                        const n = Math.max(0, Math.round(Number(typed)))
                        if (Number.isFinite(n) && n !== props.session.bpmIncrease) {
                          props.onChange(clampSession({ ...props.session, bpmIncrease: n }))
                        }
                      }}
                      onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur() }}
                    />
                  </div>
                  <div className="increase-field">
                    <label htmlFor="bpm-sheet-every">Every (bars)</label>
                    <input
                      id="bpm-sheet-every"
                      inputMode="numeric"
                      value={everyText ?? String(everyBars)}
                      onChange={(e) => { everyRef.current = e.target.value; setEveryText(e.target.value) }}
                      onBlur={() => {
                        const typed = everyRef.current
                        setEveryText(null)
                        everyRef.current = null
                        if (typed === null) return
                        const n = Math.max(1, Math.round(Number(typed)))
                        if (!Number.isFinite(n)) return
                        if (n !== everyBars) {
                          props.onChange(clampSession({
                            ...props.session,
                            time: { ...props.session.time, everyBars: n },
                          }))
                        }
                      }}
                      onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur() }}
                    />
                  </div>
                </div>
                <DerivedDuration session={props.session} />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
