import { useEffect, useRef, useState } from "react"
import { clampBpm, clampSession } from "./session"
import type { RoutineIncrease, Session } from "./types"

// Commits on blur or Enter; an empty or non-numeric entry is dropped.
function NumberField(props: { id: string; label: string; value: number; onCommit(n: number): void }) {
  const [text, setText] = useState<string | null>(null)
  const ref = useRef<string | null>(null)
  function commit() {
    const typed = ref.current
    setText(null)
    ref.current = null
    if (typed === null || typed.trim() === "") return
    const n = Number(typed)
    if (!Number.isFinite(n) || n === props.value) return
    props.onCommit(n)
  }
  return (
    <div className="increase-field">
      <label htmlFor={props.id}>{props.label}</label>
      <input
        id={props.id}
        inputMode="numeric"
        value={text ?? String(props.value)}
        onFocus={() => { ref.current = String(props.value); setText(String(props.value)) }}
        onChange={(e) => { ref.current = e.target.value; setText(e.target.value) }}
        onBlur={commit}
        onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur() }}
      />
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

  const { routineEnabled, bpm, bpmIncrease, routine } = props.session
  const { increase } = routine

  function setIncrease(patch: Partial<RoutineIncrease>) {
    props.onChange(clampSession({ ...props.session, routine: { ...routine, increase: { ...increase, ...patch } } }))
  }
  const { increaseEvery, targetBpm } = props.session.time

  return (
    <div
      ref={overlayRef}
      inert={!props.open}
      aria-hidden={!props.open}
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
              <div className={`increase-fields${increaseEvery !== "off" ? " increase-fields--active" : ""}`}>
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
              </div>
            </div>
          )}


          {/* Routine mode: same Off/On card as Simple, plus Every. Off steps per round; On climbs to target inside each play */}
          {routineEnabled && (
            <div className="bpm-sheet-card bpm-sheet-target-card">
              <p className="sheet-title">Increase to target</p>
              <div className="increase-toggle" role="group" aria-label="BPM increase">
                {([["round", "Off"], ["target", "On"]] as const).map(([mode, label]) => (
                  <button
                    key={mode}
                    type="button"
                    className="increase-toggle-btn"
                    aria-pressed={mode === "target" ? increase.mode === "target" : increase.mode !== "target"}
                    onClick={() => setIncrease({ mode })}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <div className={`increase-fields${increase.mode === "target" ? " increase-fields--active" : ""}`}>
                <NumberField id="routine-target" label="Target BPM" value={increase.targetBpm} onCommit={(targetBpm) => setIncrease({ targetBpm })} />
                <NumberField id="routine-step" label="Step" value={increase.step} onCommit={(step) => setIncrease({ step })} />
                <NumberField
                  id="routine-every"
                  label={routine.unit === "sec" ? "Every (sec)" : "Every (bars)"}
                  value={increase.every}
                  onCommit={(every) => setIncrease({ every })}
                />
              </div>
              {increase.mode !== "target" && routine.set.enabled && (
                <div className="increase-fields increase-fields--active">
                  <div className="increase-toggle" role="group" aria-label="Next set BPM">
                    {([["reset", "Reset"], ["keep", "Keep"], ["raise", "+N"]] as const).map(([nextSet, label]) => (
                      <button
                        key={nextSet}
                        type="button"
                        className="increase-toggle-btn"
                        aria-pressed={increase.nextSet === nextSet}
                        onClick={() => setIncrease({ nextSet })}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                  {increase.nextSet === "raise" && (
                    <NumberField id="routine-raise" label="Raise each set by" value={increase.raiseBy} onCommit={(raiseBy) => setIncrease({ raiseBy })} />
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
