import { useEffect, useRef, useState } from "react"
import { clampBpm, clampSession } from "./session"
import type { Session } from "./types"

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
  const bpmRef = useRef<string | null>(null)
  const targetRef = useRef<string | null>(null)
  const stepRef = useRef<string | null>(null)

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
    props.onChange(clampSession({ ...props.session, time: { ...props.session.time, targetBpm: next } }))
  }

  function commitStep() {
    const typed = stepRef.current
    setStepText(null)
    stepRef.current = null
    if (typed === null) return
    const n = Math.max(0, Math.round(Number(typed)))
    if (!Number.isFinite(n) || n === props.session.bpmIncrease) return
    props.onChange(clampSession({ ...props.session, bpmIncrease: n }))
  }

  function chooseMode(mode: "off" | "bars") {
    props.onChange(clampSession({ ...props.session, time: { ...props.session.time, increaseEvery: mode } }))
  }

  const { routineEnabled, routine, bpm, bpmIncrease } = props.session
  const { increaseEvery, targetBpm } = props.session.time
  const derivedTarget = Math.min(300, bpm + (routine.numLevels - 1) * bpmIncrease)

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
                value={bpmText ?? String(bpm)}
                onFocus={() => { bpmRef.current = String(bpm); setBpmText(String(bpm)) }}
                onChange={(e) => { bpmRef.current = e.target.value; setBpmText(e.target.value) }}
                onBlur={commitBpm}
                onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur() }}
              />
              <div className="bpm-steppers">
                <button
                  type="button"
                  className="bpm-stepper"
                  aria-label="Increase BPM"
                  onClick={() => props.onChange(clampSession({ ...props.session, bpm: bpm + 1 }))}
                >+</button>
                <button
                  type="button"
                  className="bpm-stepper"
                  aria-label="Decrease BPM"
                  onClick={() => props.onChange(clampSession({ ...props.session, bpm: bpm - 1 }))}
                >−</button>
              </div>
            </div>
          </div>

          {/* Simple mode: Off/Bars toggle + Target BPM + Step */}
          {!routineEnabled && (
            <div className="bpm-sheet-card bpm-sheet-target-card">
              <p className="sheet-title">Increase to target</p>
              <div className="increase-toggle" role="group" aria-label="BPM increase">
                {(["off", "bars"] as const).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    className="increase-toggle-btn"
                    aria-pressed={increaseEvery === mode}
                    onClick={() => chooseMode(mode)}
                  >
                    {mode === "off" ? "Off" : "On"}
                  </button>
                ))}
              </div>
              <div className="increase-fields">
                <div className="increase-field target">
                  <label htmlFor="bpm-sheet-target">Target BPM</label>
                  <input
                    id="bpm-sheet-target"
                    inputMode="numeric"
                    value={targetText ?? String(targetBpm)}
                    onFocus={() => { targetRef.current = String(targetBpm); setTargetText(String(targetBpm)) }}
                    onChange={(e) => { targetRef.current = e.target.value; setTargetText(e.target.value) }}
                    onBlur={commitTarget}
                    onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur() }}
                  />
                </div>
                <div className="increase-field">
                  <label htmlFor="bpm-sheet-step">Step</label>
                  <input
                    id="bpm-sheet-step"
                    inputMode="numeric"
                    value={stepText ?? String(bpmIncrease)}
                    onFocus={() => { stepRef.current = String(bpmIncrease); setStepText(String(bpmIncrease)) }}
                    onChange={(e) => { stepRef.current = e.target.value; setStepText(e.target.value) }}
                    onBlur={commitStep}
                    onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur() }}
                  />
                </div>
                {increaseEvery !== "off" && bpmIncrease > 0 && targetBpm > bpm && (
                  <div className="increase-derived">
                    {bpm} → <span>{Math.min(300, targetBpm)} BPM</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Routine mode: Step + derived target */}
          {routineEnabled && (
            <div className="bpm-sheet-card bpm-sheet-target-card">
              <p className="sheet-title">BPM step</p>
              <div className="increase-fields">
                <div className="increase-field">
                  <label htmlFor="bpm-sheet-step">Step</label>
                  <input
                    id="bpm-sheet-step"
                    inputMode="numeric"
                    value={stepText ?? String(bpmIncrease)}
                    onFocus={() => { stepRef.current = String(bpmIncrease); setStepText(String(bpmIncrease)) }}
                    onChange={(e) => { stepRef.current = e.target.value; setStepText(e.target.value) }}
                    onBlur={commitStep}
                    onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur() }}
                  />
                </div>
              </div>
              {bpmIncrease > 0 && (
                <div className="increase-derived">
                  {bpm} → <span>{derivedTarget} BPM</span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
