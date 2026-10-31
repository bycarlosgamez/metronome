import { useRef, useState } from "react"
import { climbProgress } from "./climb"
import { bpmAt, type ClockSnapshot } from "./clock"
import type { Segment } from "./expandSession"
import { formatClock } from "./format"
import type { PlaybackStatus } from "./Practice"
import { beatsInMeter, choosePractice, clampBpm, clampSession } from "./session"
import { TimeInput } from "./TimeInput"
import type { Practice, Session } from "./types"

const PRACTICES: { value: Practice; label: string }[] = [
  { value: "steady", label: "Steady" },
  { value: "climb", label: "Climb" },
  { value: "routine", label: "Routine" },
]

// A settings row whose number commits on blur or Enter; an empty or non-numeric entry is dropped
function NumberRow(props: { id: string; label: string; value: number; onCommit(n: number): void }) {
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
    <div className="routine-row">
      <label className="routine-row-label" htmlFor={props.id}>{props.label}</label>
      <input
        id={props.id}
        className="climb-input"
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

// Player for every way to practice: a darker panel (label, big number, progress, Play/Stop), the Count-in switch,
// then the Steady | Climb | Routine switch and the chosen option's settings
export function PlayerCard(props: {
  session: Session
  segments: Segment[]
  snapshot: ClockSnapshot
  status: PlaybackStatus
  clockShiftSec: number
  onToggle(): void
  onReset(): void
  onChange(session: Session): void
}) {
  const { session, snapshot } = props
  const { practice, routine } = session
  const { round, set, increase } = routine
  const segment = props.segments[snapshot.segmentIndex]
  const isPlaying = props.status === "playing" || props.status === "no-audio"
  const intoSec = snapshot.segmentElapsedSec
  const currentBpm = bpmAt(segment, intoSec)
  const isRest = segment.kind === "rest"

  const roundStep = increase.mode === "round" ? increase.roundStep : 0
  const roundPasses = round.enabled ? round.count : 1
  const setPasses = set.enabled ? set.count : 1
  const roundN = (segment.setIndex % roundPasses) + 1
  const setN = Math.floor(segment.setIndex / roundPasses) + 1

  // Climb: where you are in the steps; during the count-in you're at the start of the first step.
  // A Climb with one step (Step 0, or Start at or above Target) plays like Steady and shows no climb line.
  const play = segment.kind === "play" ? segment : props.segments.find((s) => s.kind === "play")
  const climb = practice === "climb" && play?.steps && play.steps.length > 1
    ? climbProgress(play.steps, segment.kind === "play" ? intoSec : 0)
    : null
  const atTarget = climb !== null && !Number.isFinite(climb.nextInSec)

  const phaseLabel = props.status === "paused" ? "Paused"
    : !isPlaying ? "Stopped"
    : segment.kind === "count-in" ? "Ready"
    : practice === "routine" ? (isRest ? "Rest" : "Play")
    : "Playing"

  let bigNumber: string
  let subLine: string | null = null
  // The BPM playing now: stopped (including after a routine ends) it's where playback will start; during a rest, the play coming up
  const playingBpm = props.status === "stopped"
    ? props.segments.find((s) => s.kind === "play")?.steps?.[0]?.bpm ?? session.bpm
    : isRest
    ? props.segments.slice(snapshot.segmentIndex + 1).find((s) => s.kind === "play")?.steps?.[0]?.bpm ?? currentBpm
    : currentBpm

  let roundLine: string | null = null
  let target: number | null = null
  let progress: number | null = null
  if (practice === "routine") {
    bigNumber = formatClock(Math.ceil(snapshot.segmentRemainingSec))
    subLine = `${formatClock(Math.ceil(snapshot.remainingSec))} left`
    roundLine = `Round ${roundN}/${roundPasses}${round.enabled ? ` · Set ${setN}/${setPasses}` : ""}`
    progress = Number.isFinite(segment.durationSec) && segment.durationSec > 0 ? Math.min(1, intoSec / segment.durationSec) : 0
  } else {
    bigNumber = formatClock(snapshot.elapsedSec + props.clockShiftSec)
    if (climb) {
      if (atTarget) {
        subLine = "At target"
      } else {
        const barSec = beatsInMeter(session.meter) * 60 / currentBpm
        const nextIn = session.time.everyUnit === "bars"
          ? `${Math.ceil(climb.nextInSec / barSec - 1e-9)} bars`
          : formatClock(Math.ceil(climb.nextInSec))
        subLine = `Next +${session.bpmIncrease} in ${nextIn}`
        target = session.time.targetBpm
        progress = climb.fraction
      }
    }
  }

  // The switch is locked while playing, so a misclick can't end the session
  function choose(next: Practice) {
    if (next === practice || isPlaying) return
    props.onChange(choosePractice(session, next))
  }

  // Routine in one line: rounds, sets, tempo range and total time, so the plan can be checked without adding it up
  function routineSummary(): string {
    const length = (n: number) => routine.unit === "bars" ? `${n} bar${n === 1 ? "" : "s"}` : formatClock(n)
    const plays = props.segments.filter((s) => s.kind === "play")
    const first = plays[0]?.bpm ?? session.bpm
    const top = plays.reduce((max, s) => Math.max(max, s.bpm), first)
    const total = props.segments.filter((s) => s.kind !== "count-in").reduce((sum, s) => sum + s.durationSec, 0)
    const rest = round.enabled && routine.restDuration > 0 ? ` + ${length(routine.restDuration)} rest` : ""
    return [
      round.enabled ? `${round.count} rounds of ${length(routine.playDuration)}${rest}` : length(routine.playDuration),
      round.enabled && set.enabled ? `${set.count} sets` : null,
      top > first ? `${first} → ${top} BPM` : `${first} BPM`,
      `${formatClock(Math.round(total))} total`,
    ].filter(Boolean).join(" · ")
  }

  function setTime(next: Partial<Session["time"]>) {
    props.onChange(clampSession({ ...session, time: { ...session.time, ...next } }))
  }

  function setRoutine(next: Partial<Session["routine"]>) {
    props.onChange(clampSession({ ...session, routine: { ...routine, ...next } }))
  }

  return (
    <div className="player-card">
      {/* Screen readers hear phase, tempo and round changes, not every tick of the timer */}
      <div className="visually-hidden" aria-live="polite" data-testid="player-announce">
        {isPlaying ? [phaseLabel, `${playingBpm} BPM`, practice === "routine" ? `Round ${roundN} of ${roundPasses}` : null].filter(Boolean).join(", ") : ""}
      </div>
      {/* Live state, sized to read from the music stand: phase and round, then time and tempo side by side */}
      <div className={`player-panel${isRest ? " is-rest" : ""}`}>
        <div className="player-status">
          <span className="player-phase" data-testid="player-phase">{phaseLabel}</span>
          {roundLine && <span className="player-round" data-testid="player-round">{roundLine}</span>}
        </div>
        <div className="player-readout">
          <div className="player-time">
            <div className="player-number" data-testid="player-number">{bigNumber}</div>
            {subLine && <div className="player-sub" data-testid="player-sub">{subLine}</div>}
          </div>
          <div className="player-tempo">
            <div className="player-bpm" data-testid="player-bpm">{playingBpm}</div>
            <div className="player-sub">
              BPM{target !== null && <> <span data-testid="player-target">→ {target}</span></>}
            </div>
          </div>
        </div>
        {progress !== null && (
          <div className="routine-progress-bar-wrap">
            <div className={`routine-progress-bar-fill${isRest ? " is-rest" : ""}`} style={{ width: `${Math.round(progress * 100)}%` }} />
          </div>
        )}
        <div className="play-controls">
          <button
            type="button"
            className={`play-btn${isPlaying ? " playing" : ""}`}
            aria-label={isPlaying ? "Pause" : "Play"}
            onClick={props.onToggle}
          >
            {isPlaying ? "❚❚" : "▶"}
          </button>
          <button type="button" className="stop-link" aria-label="Stop" onClick={props.onReset}>■ Stop</button>
        </div>
      </div>

      <div className="routine-seg player-switch" role="group" aria-label="How to practice">
        {PRACTICES.map(({ value, label }) => (
          <button key={value} type="button" className="routine-seg-btn" aria-pressed={practice === value} disabled={isPlaying}
            title={isPlaying ? "Stop to change how you practise" : undefined} onClick={() => choose(value)}>
            {label}
          </button>
        ))}
      </div>

      {/* Applies to every practice: one 4-beat bar before the first play */}
      <div className="routine-row count-in-row">
        <span className="routine-row-label">Count-in</span>
        <button type="button" role="switch" className="switch" aria-label="Count-in" aria-checked={session.countIn}
          onClick={() => props.onChange(clampSession({ ...session, countIn: !session.countIn }))} />
      </div>

      {practice === "climb" && (
        <div className="routine-box climb-settings">
          <NumberRow id="climb-target" label="Target BPM" value={session.time.targetBpm} onCommit={(n) => setTime({ targetBpm: clampBpm(n) })} />
          <NumberRow id="climb-step" label="Step" value={session.bpmIncrease}
            onCommit={(n) => props.onChange(clampSession({ ...session, bpmIncrease: Math.max(0, Math.round(n)) }))} />
          <div className="routine-row">
            <span className="routine-row-label">Every</span>
            <div className="routine-row-controls">
              {session.time.everyUnit === "bars" ? (
                <div className="routine-stepper">
                  <button type="button" aria-label="Decrease every" onClick={() => setTime({ everyBars: Math.max(1, session.time.everyBars - 1) })}>−</button>
                  <span className="routine-stepper-val" data-testid="climb-every-bars">{session.time.everyBars} {session.time.everyBars === 1 ? "bar" : "bars"}</span>
                  <button type="button" aria-label="Increase every" onClick={() => setTime({ everyBars: session.time.everyBars + 1 })}>+</button>
                </div>
              ) : (
                <TimeInput label="Every" value={session.time.everySec} min={1} onCommit={(everySec) => setTime({ everySec })} />
              )}
              <div className="routine-seg" role="group" aria-label="Every unit">
                {(["bars", "sec"] as const).map((unit) => (
                  <button key={unit} type="button" className="routine-seg-btn" aria-pressed={session.time.everyUnit === unit}
                    onClick={() => {
                      if (session.time.everyUnit === unit) return
                      setTime(unit === "bars" ? { everyUnit: unit, everyBars: 4 } : { everyUnit: unit, everySec: 120 })
                    }}>
                    {unit === "bars" ? "Bars" : "Time"}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {practice === "routine" && (
        <>
          <p className="routine-summary" data-testid="routine-summary">{routineSummary()}</p>
          {/* Each section is a bordered box; settings a Repeat switch controls open in a panel under it */}
          <div className="routine-box" data-testid="round-box">
            <div className="routine-section-title">Round</div>
            <p className="routine-section-hint">One play and the rest after it</p>
            {/* Duration sets the units Play and Rest are measured in */}
            <div className="routine-row">
              <span className="routine-row-label">Duration</span>
              <div className="routine-seg">
                {(["bars", "sec"] as const).map((u) => (
                  <button key={u} type="button" className="routine-seg-btn" aria-pressed={routine.unit === u}
                    onClick={() => {
                      if (routine.unit === u) return
                      setRoutine(u === "bars"
                        ? { unit: u, playDuration: 4, restDuration: 0 }
                        : { unit: u, playDuration: 60, restDuration: 0 })
                    }}>
                    {u === "bars" ? "Bars" : "Time"}
                  </button>
                ))}
              </div>
            </div>
            {([
              { key: "play", label: "Play", durationKey: "playDuration", min: 1 },
              { key: "rest", label: "Rest", durationKey: "restDuration", min: 0 },
            ] as const).map(({ key, label, durationKey, min }) => {
              const value = routine[durationKey]
              const update = (next: number) => setRoutine({ [durationKey]: Math.max(min, next) })
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
            <div className="routine-row routine-repeat-row">
              <span className="routine-row-label">Repeat</span>
              <button type="button" role="switch" className="switch" aria-label="Round repeat" aria-checked={round.enabled}
                onClick={() => setRoutine({
                  round: { ...round, enabled: !round.enabled },
                  set: round.enabled ? { ...set, enabled: false } : set,
                  increase: round.enabled && increase.mode === "round" ? { ...increase, mode: "off" } : increase,
                })} />
            </div>
            {round.enabled && (
              <div className="repeat-panel" data-testid="round-repeat-panel">
                <div className="routine-row">
                  <span className="routine-row-label">Times</span>
                  <div className="routine-stepper">
                    <button type="button" aria-label="Decrease round count"
                      onClick={() => setRoutine({ round: { ...round, count: Math.max(2, round.count - 1) } })}>−</button>
                    <span className="routine-stepper-val">{round.count}</span>
                    <button type="button" aria-label="Increase round count"
                      onClick={() => setRoutine({ round: { ...round, count: round.count + 1 } })}>+</button>
                  </div>
                </div>
                <div className="routine-row">
                  <span className="routine-row-label">Increase</span>
                  {/* +0 means no increase; each round plays this many BPM faster than the one before */}
                  <div className="routine-stepper">
                    <button type="button" aria-label="Decrease round increase"
                      onClick={() => {
                        if (roundStep === 0) return
                        setRoutine({ increase: roundStep === 1 ? { ...increase, mode: "off" } : { mode: "round", roundStep: roundStep - 1 } })
                      }}>−</button>
                    <span className="routine-stepper-val" data-testid="round-step">+{roundStep} BPM</span>
                    <button type="button" aria-label="Increase round increase"
                      onClick={() => setRoutine({ increase: { mode: "round", roundStep: roundStep + 1 } })}>+</button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {round.enabled && (
            <div className="routine-box" data-testid="set-box">
              <div className="routine-section-title">Set</div>
              <p className="routine-section-hint">All the rounds, played again</p>
              <div className="routine-row routine-repeat-row">
                <span className="routine-row-label">Repeat</span>
                <button type="button" role="switch" className="switch" aria-label="Set repeat" aria-checked={set.enabled}
                  onClick={() => setRoutine({ set: { ...set, enabled: !set.enabled } })} />
              </div>
              {set.enabled && (
                <div className="repeat-panel" data-testid="set-repeat-panel">
                  <div className="routine-row">
                    <span className="routine-row-label">Times</span>
                    <div className="routine-stepper">
                      <button type="button" aria-label="Decrease set count"
                        onClick={() => setRoutine({ set: { ...set, count: Math.max(2, set.count - 1) } })}>−</button>
                      <span className="routine-stepper-val">{set.count}</span>
                      <button type="button" aria-label="Increase set count"
                        onClick={() => setRoutine({ set: { ...set, count: set.count + 1 } })}>+</button>
                    </div>
                  </div>
                  <div className="routine-row">
                    <span className="routine-row-label">Rest between</span>
                    <TimeInput label="Set rest" value={set.restDuration}
                      onCommit={(seconds) => setRoutine({ set: { ...set, restDuration: seconds } })} />
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}
