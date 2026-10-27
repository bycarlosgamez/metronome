import { useEffect, useRef, useState } from "react"
import type { ClockSnapshot } from "./clock"
import type { Segment } from "./expandSession"
import { formatClock, formatDuration, parseDuration } from "./format"
import { clampSession, sessionTitle } from "./session"
import { METERS, type Meter, type Session } from "./types"

type DraftTarget = {
  segmentIndex: number
  kind: Segment["kind"]
  restRole?: Segment["restRole"]
  cycleIndex: number
  baseline: string
}

function draftTarget(segment: Segment, segmentIndex: number, baseline: string): DraftTarget {
  return {
    segmentIndex,
    kind: segment.kind,
    restRole: segment.restRole,
    cycleIndex: segment.cycleIndex,
    baseline,
  }
}

export type PlaybackStatus = "stopped" | "playing" | "paused" | "no-audio"

export function Practice(props: {
  session: Session
  segments: Segment[]
  snapshot: ClockSnapshot
  status: PlaybackStatus
  onToggle(): void
  onJump(direction: -1 | 1): void
  onReset(): void
  onEdit(): void
  onChange(session: Session): void
  onSeek(index: number): void
}) {
  const segment = props.segments[props.snapshot.segmentIndex]
  const nextPlay = props.segments.slice(props.snapshot.segmentIndex + 1).find((item) => item.kind === "play")
  const beatCount = segment.kind === "count-in" ? 4 : Number(segment.meter.split("/")[0])
  const clock = formatClock(Math.ceil(props.snapshot.segmentRemainingSec - 1e-9))
  const practiceSegment = props.segments.find((item) => item.cycleIndex === segment.cycleIndex && item.kind === "play")
  const storedSeconds = segment.kind === "rest" ? segment.durationSec : (practiceSegment ?? segment).durationSec
  const [timeText, setTimeText] = useState<string | null>(null)
  const [bpmText, setBpmText] = useState<string | null>(null)
  const timeTarget = useRef<DraftTarget | null>(null)
  const bpmTarget = useRef<DraftTarget | null>(null)
  const timeTextRef = useRef(timeText)
  const bpmTextRef = useRef(bpmText)
  timeTextRef.current = timeText
  bpmTextRef.current = bpmText
  const shownTime = timeText ?? clock
  const shownBpm = bpmText ?? String(segment.bpm)
  const stageColor = segment.kind === "rest" ? "yellow" : props.status === "playing" || props.status === "no-audio" ? "green" : "red"

  useEffect(() => {
    if (timeTarget.current && timeTextRef.current === timeTarget.current.baseline) {
      timeTarget.current = null
      setTimeText(null)
    }
    if (bpmTarget.current && bpmTextRef.current === bpmTarget.current.baseline) {
      bpmTarget.current = null
      setBpmText(null)
    }
  }, [props.snapshot.segmentIndex])

  function rememberTime() {
    const baseline = formatDuration(storedSeconds)
    timeTarget.current = draftTarget(segment, props.snapshot.segmentIndex, baseline)
    setTimeText(baseline)
  }

  function rememberBpm() {
    const baseline = String(segment.bpm)
    bpmTarget.current = draftTarget(segment, props.snapshot.segmentIndex, baseline)
    setBpmText(baseline)
  }

  function commitTime() {
    const typed = timeText
    const target = timeTarget.current
    setTimeText(null)
    timeTarget.current = null
    if (typed === null || target === null || typed === target.baseline) return
    const seconds = Math.max(1, parseDuration(typed))
    const session = props.session
    if (target.kind === "rest") {
      if (session.type === "complex") {
        props.onChange(clampSession({
          ...session,
          cycles: session.cycles.map((cycle, index) => index === target.cycleIndex ? { ...cycle, restSec: Math.max(0, parseDuration(typed)) } : cycle),
        }))
        return
      }
      const key = target.restRole === "between" ? "restBetweenSec" : "restAfterSec"
      props.onChange(clampSession({ ...session, simple: { ...session.simple, [key]: Math.max(0, parseDuration(typed)) } }))
      return
    }
    const length = { unit: "time" as const, seconds }
    if (session.type === "complex") {
      props.onChange(clampSession({
        ...session,
        cycles: session.cycles.map((cycle, index) => index === target.cycleIndex ? { ...cycle, length } : cycle),
      }))
      return
    }
    props.onChange(clampSession({ ...session, simple: { ...session.simple, length } }))
  }

  function commitBpm() {
    const typed = bpmText
    const target = bpmTarget.current
    setBpmText(null)
    bpmTarget.current = null
    if (typed === null || target === null || Number(typed) === Number(target.baseline)) return
    const session = props.session
    const cycle = session.cycles[target.cycleIndex]
    if (session.type === "complex" && cycle?.bpm !== undefined) {
      props.onChange(clampSession({
        ...session,
        cycles: session.cycles.map((item, index) => index === target.cycleIndex ? { ...item, bpm: Number(typed) } : item),
      }))
      return
    }
    const every = session.type === "simple" ? session.simple.practices : session.every
    const bpm = Number(typed) - session.bpmIncrease * Math.floor(target.cycleIndex / every)
    props.onChange(clampSession({ ...session, bpm }))
  }

  return (
    <main className="practice">
      <header className="topbar">
        <h1 aria-label="Mentronome">{sessionTitle(props.session)}</h1>
        <button type="button" className="quiet" onClick={props.onEdit}>
          Edit
        </button>
      </header>
      <section className={`stage color-${stageColor}`} data-kind={segment.kind}>
        <p data-testid="stage-label">{segment.label}</p>
        <input
          className="stage-time"
          data-testid="stage-time"
          aria-label="Duration"
          value={shownTime}
          style={{ width: `${Math.max(shownTime.length, 4)}ch` }}
          onFocus={rememberTime}
          onChange={(event) => {
            if (timeTarget.current === null) rememberTime()
            setTimeText(event.target.value)
          }}
          onBlur={commitTime}
          onKeyDown={(event) => {
            if (event.key === "Enter") event.currentTarget.blur()
          }}
        />
        {segment.kind !== "rest" && (
          <>
            <p className="stage-meta">
              <input
                aria-label="BPM"
                inputMode="numeric"
                value={shownBpm}
                onFocus={rememberBpm}
                onChange={(event) => {
                  if (bpmTarget.current === null) rememberBpm()
                  setBpmText(event.target.value)
                }}
                onBlur={commitBpm}
                onKeyDown={(event) => {
                  if (event.key === "Enter") event.currentTarget.blur()
                }}
              />
              BPM
            </p>
            <div className="beats">
              {Array.from({ length: beatCount }, (_, index) => {
                const beat = index + 1
                return (
                  <span
                    key={beat}
                    data-testid={`beat-${beat}`}
                    data-current={beat === props.snapshot.beat ? "true" : "false"}
                    data-accent={beat === 1 ? "true" : "false"}
                  >
                    {beat}
                  </span>
                )
              })}
            </div>
            <select
              className="stage-meter"
              aria-label="Meter"
              value={props.session.meter}
              onChange={(event) => {
                const meter = event.target.value as Meter
                props.onChange(clampSession({ ...props.session, meter }))
              }}
            >
              {METERS.map((meter) => (
                <option key={meter} value={meter}>
                  {meter}
                </option>
              ))}
            </select>
          </>
        )}
        {segment.kind === "rest" && nextPlay && (
          <p data-testid="next-up">
            Next · {nextPlay.label} at {nextPlay.bpm}
          </p>
        )}
        <div className="controls">
          <div className="control-row">
            <button type="button" className="jump" aria-label="Previous" onClick={() => props.onJump(-1)}>‹</button>
            <button
              type="button"
              className="play-toggle"
              aria-label={props.status === "playing" || props.status === "no-audio" ? "Pause" : "Play"}
              onClick={props.onToggle}
            >
              {props.status === "playing" || props.status === "no-audio" ? "❚❚" : "▶"}
            </button>
            <button type="button" className="jump" aria-label="Next" onClick={() => props.onJump(1)}>›</button>
          </div>
          <button type="button" aria-label="Reset" onClick={props.onReset}>Reset</button>
        </div>
        {props.status === "no-audio" && <p role="status">Sound is unavailable. The countdown is still running.</p>}
      </section>
      <footer className="transport">
        <div>
          <span>Elapsed</span>
          <strong>{formatClock(props.snapshot.elapsedSec)}</strong>
        </div>
        <div>
          <span>Set</span>
          <strong data-testid="footer-set">
            {props.snapshot.segmentIndex + 1} / {props.segments.length}
          </strong>
        </div>
        <div>
          <span>Left</span>
          <strong>{formatClock(Math.ceil(props.snapshot.remainingSec - 1e-9))}</strong>
        </div>
      </footer>
      <div className="strip">
        {props.segments.map((item, index) => (
          <button
            type="button"
            key={`${item.setId}-${item.kind}-${index}`}
            className={`color-${item.color}`}
            data-current={index === props.snapshot.segmentIndex}
            aria-current={index === props.snapshot.segmentIndex ? "true" : undefined}
            onClick={() => props.onSeek(index)}
          >
            <strong>{item.label}</strong>
            <span>
              {formatClock(Math.round(item.durationSec))}
              {item.kind === "play" ? ` · ${item.bpm}` : ""}
            </span>
          </button>
        ))}
      </div>
    </main>
  )
}
