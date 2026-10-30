import { climbProgress } from "./climb"
import { bpmAt, type ClockSnapshot } from "./clock"
import type { Segment } from "./expandSession"
import { formatClock } from "./format"
import type { PlaybackStatus } from "./Practice"
import { beatsInMeter, choosePractice, clampSession } from "./session"
import { TimeInput } from "./TimeInput"
import type { Practice, Session } from "./types"

const PRACTICES: { value: Practice; label: string }[] = [
  { value: "steady", label: "Steady" },
  { value: "climb", label: "Climb" },
  { value: "routine", label: "Routine" },
]

// Player for every way to practice: a darker panel (label + Count-in, big number, progress, Play/Stop),
// then the Steady | Climb | Routine switch and the chosen option's settings
export function PlayerCard(props: {
  session: Session
  segments: Segment[]
  snapshot: ClockSnapshot
  status: PlaybackStatus
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

  const roundPasses = round.enabled ? round.count : 1
  const setPasses = set.enabled ? set.count : 1
  const roundN = (segment.setIndex % roundPasses) + 1
  const setN = Math.floor(segment.setIndex / roundPasses) + 1

  // Climb: where you are in the steps; during the count-in you're at the start of the first step
  const play = segment.kind === "play" ? segment : props.segments.find((s) => s.kind === "play")
  const climb = practice === "climb" && play?.steps
    ? climbProgress(play.steps, segment.kind === "play" ? intoSec : 0)
    : null
  const atTarget = climb !== null && !Number.isFinite(climb.nextInSec)

  const phaseLabel = segment.kind === "count-in" ? "Ready"
    : practice === "routine" ? (isRest ? "Rest" : "Play")
    : props.status === "playing" || props.status === "no-audio" ? "Playing"
    : props.status === "paused" ? "Paused"
    : "Stopped"

  let bigNumber: string
  let subLine: string | null = null
  let info: React.ReactNode = null
  let progress: number | null = null
  if (practice === "routine") {
    bigNumber = formatClock(Math.ceil(snapshot.segmentRemainingSec))
    subLine = `${formatClock(Math.ceil(snapshot.remainingSec))} left`
    info = (<><div>Round {roundN}/{roundPasses}</div>{round.enabled && <div>Set {setN}/{setPasses}</div>}</>)
    progress = Number.isFinite(segment.durationSec) && segment.durationSec > 0 ? Math.min(1, intoSec / segment.durationSec) : 0
  } else {
    bigNumber = formatClock(snapshot.elapsedSec)
    if (climb) {
      const target = session.time.targetBpm
      if (atTarget) {
        subLine = "At target"
        info = String(currentBpm)
      } else {
        const barSec = beatsInMeter(session.meter) * 60 / currentBpm
        const nextIn = session.time.everyUnit === "bars"
          ? `${Math.ceil(climb.nextInSec / barSec - 1e-9)} bars`
          : formatClock(Math.ceil(climb.nextInSec))
        subLine = `Next +${session.bpmIncrease} in ${nextIn}`
        info = `${currentBpm} → ${target}`
        progress = climb.fraction
      }
    }
  }

  function choose(next: Practice) {
    if (next === practice) return
    props.onChange(choosePractice(session, next))
    if (isPlaying) props.onReset()
  }

  function setRoutine(next: Partial<Session["routine"]>) {
    props.onChange(clampSession({ ...session, routine: { ...routine, ...next } }))
  }

  return (
    <div className="player-card">
      <div className="player-panel">
        <div className="routine-progress-row">
          {/* Shrinks to the big number's width so Count-in ends where the number ends */}
          <div className="routine-countdown-col">
            <div className="routine-phase-row">
              <div className={`routine-phase${isRest ? " is-rest" : ""}`} data-testid="player-phase">{phaseLabel}</div>
              <button
                type="button"
                className="count-in-toggle"
                aria-label="Count-in"
                aria-pressed={session.countIn}
                onClick={() => props.onChange(clampSession({ ...session, countIn: !session.countIn }))}
              >
                Count-in
              </button>
            </div>
            <div className={`routine-countdown${isRest ? " is-rest" : ""}`} data-testid="player-number">{bigNumber}</div>
            {subLine && <div className="routine-total-left" data-testid="player-sub">{subLine}</div>}
          </div>
          {info !== null && <div className="routine-cycle-info" data-testid="player-info">{info}</div>}
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
          <button key={value} type="button" className="routine-seg-btn" aria-pressed={practice === value} onClick={() => choose(value)}>
            {label}
          </button>
        ))}
      </div>

      {practice === "routine" && (
        <>
          <div className="routine-unit-row">
            <span className="routine-unit-label">Duration</span>
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

          <div className="routine-section">
            <div className="routine-section-title">Round</div>
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
            <div className="routine-row">
              <span className="routine-row-label">Repeat</span>
              <div className="routine-row-controls">
                <button type="button" className="routine-toggle-btn" aria-label="Toggle round repeat" aria-pressed={round.enabled}
                  onClick={() => setRoutine({
                    round: { ...round, enabled: !round.enabled },
                    set: round.enabled ? { ...set, enabled: false } : set,
                    increase: round.enabled && increase.mode === "round" ? { ...increase, mode: "off" } : increase,
                  })}>
                  {round.enabled ? "On" : "Off"}
                </button>
                {round.enabled && (
                  <div className="routine-stepper">
                    <button type="button" aria-label="Decrease round count"
                      onClick={() => setRoutine({ round: { ...round, count: Math.max(2, round.count - 1) } })}>−</button>
                    <span className="routine-stepper-val">{round.count}</span>
                    <button type="button" aria-label="Increase round count"
                      onClick={() => setRoutine({ round: { ...round, count: round.count + 1 } })}>+</button>
                  </div>
                )}
              </div>
            </div>
            {round.enabled && (
              <div className="routine-row">
                <span className="routine-row-label">Increase</span>
                <div className="routine-row-controls">
                  <button type="button" className="routine-toggle-btn" aria-label="Toggle round increase" aria-pressed={increase.mode === "round"}
                    onClick={() => setRoutine({ increase: { ...increase, mode: increase.mode === "round" ? "off" : "round" } })}>
                    {increase.mode === "round" ? "On" : "Off"}
                  </button>
                  {increase.mode === "round" && (
                    <div className="routine-stepper">
                      <button type="button" aria-label="Decrease round increase"
                        onClick={() => setRoutine({ increase: { ...increase, roundStep: Math.max(1, increase.roundStep - 1) } })}>−</button>
                      <span className="routine-stepper-val" data-testid="round-step">+{increase.roundStep}</span>
                      <button type="button" aria-label="Increase round increase"
                        onClick={() => setRoutine({ increase: { ...increase, roundStep: increase.roundStep + 1 } })}>+</button>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {round.enabled && (
            <div className="routine-section routine-section--set">
              <div className="routine-section-title">Set</div>
              <div className="routine-row">
                <span className="routine-row-label">Rest between</span>
                <TimeInput label="Set rest" value={set.restDuration}
                  onCommit={(seconds) => setRoutine({ set: { ...set, restDuration: seconds } })} />
              </div>
              <div className="routine-row">
                <span className="routine-row-label">Repeat</span>
                <div className="routine-row-controls">
                  <button type="button" className="routine-toggle-btn" aria-label="Toggle set repeat" aria-pressed={set.enabled}
                    onClick={() => setRoutine({ set: { ...set, enabled: !set.enabled } })}>
                    {set.enabled ? "On" : "Off"}
                  </button>
                  {set.enabled && (
                    <div className="routine-stepper">
                      <button type="button" aria-label="Decrease set count"
                        onClick={() => setRoutine({ set: { ...set, count: Math.max(2, set.count - 1) } })}>−</button>
                      <span className="routine-stepper-val">{set.count}</span>
                      <button type="button" aria-label="Increase set count"
                        onClick={() => setRoutine({ set: { ...set, count: set.count + 1 } })}>+</button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
