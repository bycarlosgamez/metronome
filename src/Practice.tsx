import { useRef, useState } from "react"
import { bpmAt, type ClockSnapshot } from "./clock"
import type { Segment } from "./expandSession"
import { formatClock } from "./format"
import { clampBpm, clampSession, sessionTitle, sharedSubdivision } from "./session"
import { SubdivIcon } from "./SubdivIcon"
import { BpmSheet } from "./BpmSheet"
import { ClickSheet } from "./ClickSheet"
import { MeterSheet } from "./MeterSheet"
import { SubdivisionSheet } from "./SubdivisionSheet"
import { TimeInput } from "./TimeInput"
import { CLICKS, type Session } from "./types"

export type PlaybackStatus = "stopped" | "playing" | "paused" | "no-audio"

export function Practice(props: {
  session: Session
  segments: Segment[]
  snapshot: ClockSnapshot
  status: PlaybackStatus
  onToggle(): void
  onJump(direction: -1 | 1): void
  onReset(): void
  onChange(session: Session): void
  onSeek(index: number): void
}) {
  const [sheet, setSheet] = useState<"bpm" | "meter" | "subdiv" | "click" | null>(null)

  // Inline BPM editing
  const bpmRef = useRef<string | null>(null)
  const [bpmText, setBpmText] = useState<string | null>(null)

  // Inline target / step editing
  const targetRef = useRef<string | null>(null)
  const stepRef = useRef<string | null>(null)
  const [targetText, setTargetText] = useState<string | null>(null)
  const [stepText, setStepText] = useState<string | null>(null)

  function commitBpm() {
    const v = bpmRef.current; setBpmText(null); bpmRef.current = null
    if (v === null || v.trim() === "") return
    const next = clampBpm(Number(v))
    if (next !== props.session.bpm) props.onChange(clampSession({ ...props.session, bpm: next }))
  }

  function commitTarget() {
    const v = targetRef.current; setTargetText(null); targetRef.current = null
    if (v === null || v.trim() === "") return
    const next = clampBpm(Number(v))
    if (next !== props.session.time.targetBpm) props.onChange(clampSession({ ...props.session, time: { ...props.session.time, targetBpm: next } }))
  }

  function commitStep() {
    const v = stepRef.current; setStepText(null); stepRef.current = null
    if (v === null || v.trim() === "") return
    const n = Math.max(0, Math.round(Number(v)))
    if (!Number.isFinite(n) || n === props.session.bpmIncrease) return
    props.onChange(clampSession({ ...props.session, bpmIncrease: n }))
  }

  const segment = props.segments[props.snapshot.segmentIndex]
  const isPlaying = props.status === "playing" || props.status === "no-audio"
  const beatCount = segment.kind === "count-in" ? 4 : Number(props.session.meter.split("/")[0])
  const { beats } = props.session
  const subsInBeat = (beat: number) => beats[Math.min(beat, beats.length) - 1]?.slots.length ?? 1
  const shared = sharedSubdivision(beats)
  const intoSec = Math.max(0, segment.durationSec - props.snapshot.segmentRemainingSec)
  const currentBpm = bpmAt(segment, intoSec)

  // Elapsed time (always counting up, always finite)
  const elapsedSec = props.snapshot.elapsedSec

  // Current beat subdivision dot index (0-based within beat)
  // Use elapsedSec — intoSec is Infinity for endless sessions and breaks % math
  const beatDur = currentBpm > 0 ? 60 / currentBpm : 1
  const subDur = beatDur / subsInBeat(Math.max(1, props.snapshot.beat))
  const posInBeat = elapsedSec % beatDur
  const activeSubSlot = isPlaying ? Math.floor(posInBeat / subDur) : -1

  // Routine state
  const { routineEnabled, routine } = props.session
  const { round, set, block } = routine
  const roundPasses = round.enabled ? round.count : 1
  const setPasses   = set.enabled   ? set.count   : 1
  const blockPasses = block.enabled ? block.count  : 1
  const setIdx  = segment.setIndex
  const roundN  = (setIdx % roundPasses) + 1
  const setN    = (Math.floor(setIdx / roundPasses) % setPasses) + 1
  const blockN  = Math.floor(setIdx / (roundPasses * setPasses)) + 1
  const levelProgress = Number.isFinite(segment.durationSec) && segment.durationSec > 0
    ? Math.min(1, intoSec / segment.durationSec)
    : 0
  const isRest = segment.kind === "rest"
  const phaseLabel = segment.kind === "count-in" ? "Count-in" : isRest ? "Rest" : "Play"

  const transport = (
    <div className="play-controls">
      {isPlaying && !routineEnabled && (
        <div className="play-elapsed" data-testid="play-elapsed">{formatClock(elapsedSec)}</div>
      )}
      <button
        type="button"
        className={`play-btn${isPlaying ? " playing" : ""}`}
        aria-label={isPlaying ? "Pause" : "Play"}
        onClick={props.onToggle}
      >
        {isPlaying ? "❚❚" : "▶"}
      </button>
      <button
        type="button"
        className="stop-link"
        aria-label="Stop"
        onClick={props.onReset}
      >
        ■ Stop
      </button>
      <button
        type="button"
        className="count-in-toggle"
        aria-label="Count-in"
        aria-pressed={props.session.countIn}
        onClick={() => props.onChange(clampSession({ ...props.session, countIn: !props.session.countIn }))}
      >
        Count-in
      </button>
    </div>
  )

  function closeSheet() { setSheet(null) }

  function switchMode(enable: boolean) {
    if (enable === routineEnabled) return
    props.onChange(clampSession({ ...props.session, routineEnabled: enable }))
    if (isPlaying) props.onReset()
  }

  return (
    <main className="practice">
      <header className="topbar">
        <h1 aria-label="Mentronome">{sessionTitle(props.session)}</h1>
      </header>

      <div className="practice-body">
        {/* Simple | Routine segmented control */}
        <div className="mode-seg" role="group" aria-label="Session mode">
          {(["Simple", "Routine"] as const).map((label) => {
            const isRoutine = label === "Routine"
            const active = isRoutine === routineEnabled
            return (
              <button
                key={label}
                type="button"
                className="mode-seg-btn"
                aria-pressed={active}
                onClick={() => switchMode(isRoutine)}
              >
                {label}
              </button>
            )
          })}
        </div>

        {/* Beat grid */}
        <div className="beat-grid" role="region" aria-label="Beat display">
          {Array.from({ length: beatCount }, (_, i) => {
            const beat = i + 1
            const isLit = isPlaying && beat === props.snapshot.beat
            return (
              <div key={beat} className="beat-col">
                <div
                  className={`beat-sq${beat === 1 ? " accent" : ""}${isLit ? " lit" : ""}`}
                  data-testid={`beat-${beat}`}
                  data-current={isLit ? "true" : "false"}
                  data-accent={beat === 1 ? "true" : "false"}
                >
                  {beat}
                </div>
                <div className="beat-subs">
                  {Array.from({ length: subsInBeat(beat) }, (_, si) => (
                    <div
                      key={si}
                      className={`beat-sub${isLit && si === activeSubSlot ? " lit" : ""}`}
                    />
                  ))}
                </div>
              </div>
            )
          })}
        </div>

        {/* BPM + pick */}
        <div className="bpm-pick-row">
          <div className="bpm-block">
            <div className="bpm-top">
              <div className="bpm-left">
                <input
                  className="bpm-current"
                  data-testid="bpm-current"
                  inputMode="numeric"
                  aria-label="BPM"
                  value={bpmText ?? String(currentBpm)}
                  onFocus={() => { bpmRef.current = String(props.session.bpm); setBpmText(String(props.session.bpm)) }}
                  onChange={(e) => { bpmRef.current = e.target.value; setBpmText(e.target.value) }}
                  onBlur={commitBpm}
                  onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur() }}
                />
                <span className="bpm-label">BPM</span>
              </div>
              {!routineEnabled && props.session.time.increaseEvery !== "off" && (
                <div className="bpm-right">
                  <div className="bpm-target-group">
                    <span className="bpm-field-label">Target</span>
                    <input
                      className="bpm-field-value"
                      inputMode="numeric"
                      aria-label="Target BPM"
                      value={targetText ?? String(props.session.time.targetBpm)}
                      onFocus={() => { targetRef.current = String(props.session.time.targetBpm); setTargetText(String(props.session.time.targetBpm)) }}
                      onChange={(e) => { targetRef.current = e.target.value; setTargetText(e.target.value) }}
                      onBlur={commitTarget}
                      onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur() }}
                    />
                  </div>
                  <div className="bpm-target-group">
                    <span className="bpm-field-label">Step</span>
                    <input
                      className="bpm-field-value"
                      inputMode="numeric"
                      aria-label="BPM step"
                      value={stepText ?? String(props.session.bpmIncrease)}
                      onFocus={() => { stepRef.current = String(props.session.bpmIncrease); setStepText(String(props.session.bpmIncrease)) }}
                      onChange={(e) => { stepRef.current = e.target.value; setStepText(e.target.value) }}
                      onBlur={commitStep}
                      onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur() }}
                    />
                  </div>
                </div>
              )}
            </div>
            <div className="bpm-step-bar">
              <button
                type="button"
                className="bpm-bar-btn"
                aria-label="Decrease BPM"
                onClick={() => props.onChange(clampSession({ ...props.session, bpm: props.session.bpm - 1 }))}
              >−</button>
              <button
                type="button"
                className="bpm-bar-btn"
                aria-label="Increase BPM"
                onClick={() => props.onChange(clampSession({ ...props.session, bpm: props.session.bpm + 1 }))}
              >+</button>
            </div>
            <div className="bpm-more-bar">
              <button
                type="button"
                className="bpm-more-link"
                aria-label="More BPM settings"
                onClick={() => setSheet("bpm")}
              >More ›</button>
            </div>
          </div>

          <div className="pick-col">
            <button
              type="button"
              className="pick-btn"
              aria-label={`Time signature: ${props.session.meter}`}
              onClick={() => setSheet("meter")}
            >
              <strong>{props.session.meter}</strong>
              <span>Time Sig</span>
            </button>
            <button
              type="button"
              className="pick-btn"
              aria-label={`Subdivision: ${shared ?? "mixed"}`}
              onClick={() => setSheet("subdiv")}
            >
              {shared ? <SubdivIcon subdivision={shared} size="sm" /> : <strong className="pick-mixed">Mixed</strong>}
              <span>Subdiv</span>
            </button>
            <button
              type="button"
              className="pick-btn"
              aria-label={`Click: Sound ${CLICKS.indexOf(props.session.click) + 1}, accent ${props.session.accent ? "on" : "off"}`}
              onClick={() => setSheet("click")}
            >
              <strong>{CLICKS.indexOf(props.session.click) + 1}</strong>
              <span>Click</span>
            </button>
          </div>
        </div>

        {/* Routine card */}
        {routineEnabled && (
          <div className="routine-card">
            {/* Countdown */}
            <div className="routine-progress-row">
              <div>
                <div className={`routine-phase${isRest ? " is-rest" : ""}`} data-testid="routine-phase">{phaseLabel}</div>
                <div className={`routine-countdown${isRest ? " is-rest" : ""}`} data-testid="routine-countdown">
                  {formatClock(Math.ceil(props.snapshot.segmentRemainingSec))}
                </div>
                <div className="routine-total-left" data-testid="routine-total-left">
                  {formatClock(Math.ceil(props.snapshot.remainingSec))} left
                </div>
              </div>
              <div className="routine-cycle-info">
                <div>Round {roundN}/{roundPasses}</div>
                {round.enabled && <div>Set {setN}/{setPasses}</div>}
                {set.enabled && <div>Block {blockN}/{blockPasses}</div>}
              </div>
            </div>
            <div className="routine-progress-bar-wrap">
              <div className={`routine-progress-bar-fill${isRest ? " is-rest" : ""}`} style={{ width: `${Math.round(levelProgress * 100)}%` }} />
            </div>
            {transport}

            {/* Unit toggle */}
            <div className="routine-unit-row">
              <span className="routine-unit-label">Duration</span>
              <div className="routine-seg">
                {(["bars", "sec"] as const).map((u) => (
                  <button key={u} type="button" className="routine-seg-btn" aria-pressed={routine.unit === u}
                    onClick={() => {
                      if (routine.unit === u) return
                      const reset = u === "bars"
                        ? { unit: u, playDuration: 4, restDuration: 0 }
                        : { unit: u, playDuration: 60, restDuration: 0 }
                      props.onChange(clampSession({ ...props.session, routine: { ...routine, ...reset } }))
                    }}>
                    {u === "bars" ? "Bars" : "Time"}
                  </button>
                ))}
              </div>
            </div>

            {/* Round section */}
            <div className="routine-section">
              <div className="routine-section-title">Round</div>
              {([
                { key: "play", label: "Play", durationKey: "playDuration", min: 1 },
                { key: "rest", label: "Rest", durationKey: "restDuration", min: 0 },
              ] as const).map(({ key, label, durationKey, min }) => {
                const value = routine[durationKey]
                const update = (next: number) =>
                  props.onChange(clampSession({ ...props.session, routine: { ...routine, [durationKey]: Math.max(min, next) } }))
                return (
                  <div className="routine-row" key={key}>
                    <span className="routine-row-label">{label}</span>
                    {routine.unit === "bars" ? (
                      <div className="routine-stepper">
                        <button type="button" aria-label={`Decrease ${key} duration`} onClick={() => update(value - 1)}>−</button>
                        <span className="routine-stepper-val">{value} {value === 1 ? "bar" : "bars"}</span>
                        <button type="button" aria-label={`Increase ${key} duration`} onClick={() => update(value + 1)}>+</button>
                      </div>
                    ) : (
                      <TimeInput label={label} value={value} min={min} onCommit={update} />
                    )}
                  </div>
                )
              })}
              <div className="routine-row">
                <span className="routine-row-label">Repeat</span>
                <div className="routine-row-controls">
                  <button type="button" className="routine-toggle-btn" aria-label="Toggle round repeat" aria-pressed={round.enabled}
                    onClick={() => {
                      const nextRound = { ...round, enabled: !round.enabled }
                      const nextSet   = round.enabled ? { ...set,   enabled: false } : set
                      const nextBlock = round.enabled ? { ...block, enabled: false } : block
                      props.onChange(clampSession({ ...props.session, routine: { ...routine, round: nextRound, set: nextSet, block: nextBlock } }))
                    }}>
                    {round.enabled ? "On" : "Off"}
                  </button>
                  {round.enabled && (
                    <div className="routine-stepper">
                      <button type="button" aria-label="Decrease round count"
                        onClick={() => props.onChange(clampSession({ ...props.session, routine: { ...routine, round: { ...round, count: Math.max(2, round.count - 1) } } }))}>−</button>
                      <span className="routine-stepper-val">{round.count}</span>
                      <button type="button" aria-label="Increase round count"
                        onClick={() => props.onChange(clampSession({ ...props.session, routine: { ...routine, round: { ...round, count: round.count + 1 } } }))}>+</button>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Set section — visible when round.enabled */}
            {round.enabled && (
              <div className="routine-section routine-section--set">
                <div className="routine-section-title">Set</div>
                <div className="routine-row">
                  <span className="routine-row-label">Rest between</span>
                  <TimeInput label="Set rest" value={set.restDuration}
                    onCommit={(seconds) => props.onChange(clampSession({ ...props.session, routine: { ...routine, set: { ...set, restDuration: seconds } } }))} />
                </div>
                <div className="routine-row">
                  <span className="routine-row-label">Repeat</span>
                  <div className="routine-row-controls">
                    <button type="button" className="routine-toggle-btn" aria-label="Toggle set repeat" aria-pressed={set.enabled}
                      onClick={() => {
                        const nextSet   = { ...set,   enabled: !set.enabled }
                        const nextBlock = set.enabled ? { ...block, enabled: false } : block
                        props.onChange(clampSession({ ...props.session, routine: { ...routine, set: nextSet, block: nextBlock } }))
                      }}>
                      {set.enabled ? "On" : "Off"}
                    </button>
                    {set.enabled && (
                      <div className="routine-stepper">
                        <button type="button" aria-label="Decrease set count"
                          onClick={() => props.onChange(clampSession({ ...props.session, routine: { ...routine, set: { ...set, count: Math.max(2, set.count - 1) } } }))}>−</button>
                        <span className="routine-stepper-val">{set.count}</span>
                        <button type="button" aria-label="Increase set count"
                          onClick={() => props.onChange(clampSession({ ...props.session, routine: { ...routine, set: { ...set, count: set.count + 1 } } }))}>+</button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Block section — visible when set.enabled */}
            {set.enabled && (
              <div className="routine-section routine-section--block">
                <div className="routine-section-title">Block</div>
                <div className="routine-row">
                  <span className="routine-row-label">Rest between</span>
                  <TimeInput label="Block rest" value={block.restDuration}
                    onCommit={(seconds) => props.onChange(clampSession({ ...props.session, routine: { ...routine, block: { ...block, restDuration: seconds } } }))} />
                </div>
                <div className="routine-row">
                  <span className="routine-row-label">Repeat</span>
                  <div className="routine-row-controls">
                    <button type="button" className="routine-toggle-btn" aria-label="Toggle block repeat" aria-pressed={block.enabled}
                      onClick={() => props.onChange(clampSession({ ...props.session, routine: { ...routine, block: { ...block, enabled: !block.enabled } } }))}>
                      {block.enabled ? "On" : "Off"}
                    </button>
                    {block.enabled && (
                      <div className="routine-stepper">
                        <button type="button" aria-label="Decrease block count"
                          onClick={() => props.onChange(clampSession({ ...props.session, routine: { ...routine, block: { ...block, count: Math.max(2, block.count - 1) } } }))}>−</button>
                        <span className="routine-stepper-val">{block.count}</span>
                        <button type="button" aria-label="Increase block count"
                          onClick={() => props.onChange(clampSession({ ...props.session, routine: { ...routine, block: { ...block, count: block.count + 1 } } }))}>+</button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* BPM increase row — only when bpmIncrease > 0 */}
            {props.session.bpmIncrease > 0 && (
              <div className="routine-bpm-row">
                <span className="routine-bpm-label">BPM +{props.session.bpmIncrease} every</span>
                <div className="routine-seg">
                  {(["round", "set", "block", "off"] as const).map((opt) => (
                    <button key={opt} type="button" className="routine-seg-btn" aria-pressed={routine.bpmIncreaseAt === opt}
                      onClick={() => props.onChange(clampSession({ ...props.session, routine: { ...routine, bpmIncreaseAt: opt } }))}>
                      {opt}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Play controls (Routine mode shows them inside the card) */}
        {!routineEnabled && transport}

        {props.status === "no-audio" && (
          <p role="status">Sound is unavailable. The countdown is still running.</p>
        )}
      </div>

      <MeterSheet
        meter={props.session.meter}
        open={sheet === "meter"}
        onClose={closeSheet}
        onChange={(meter) => {
          props.onChange(clampSession({ ...props.session, meter }))
          closeSheet()
        }}
      />
      <SubdivisionSheet
        session={props.session}
        open={sheet === "subdiv"}
        onClose={closeSheet}
        onChange={(next) => props.onChange(clampSession(next))}
      />
      <ClickSheet
        session={props.session}
        open={sheet === "click"}
        onClose={closeSheet}
        onChange={(next) => props.onChange(clampSession(next))}
      />
      <BpmSheet
        session={props.session}
        open={sheet === "bpm"}
        onClose={closeSheet}
        onChange={(next) => props.onChange(next)}
      />
    </main>
  )
}
