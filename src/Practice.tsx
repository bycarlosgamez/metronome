import type { ClockSnapshot } from "./clock"
import type { Segment } from "./expandSession"
import { formatClock } from "./format"
import { sessionTitle } from "./session"
import type { Session } from "./types"

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
}) {
  const segment = props.segments[props.snapshot.segmentIndex]
  const nextPlay = props.segments.slice(props.snapshot.segmentIndex + 1).find((item) => item.kind === "play")
  const beatCount = segment.kind === "count-in" ? 4 : Number(segment.meter.split("/")[0])
  return (
    <main className="practice">
      <header className="topbar">
        <h1 aria-label="Mentronome">
          MENTRO<span>NOME</span>
        </h1>
        <p className="session-name">{sessionTitle(props.session)}</p>
        <button type="button" onClick={props.onEdit}>
          Edit
        </button>
      </header>
      <section className={`stage color-${segment.color}`} data-kind={segment.kind}>
        <p data-testid="stage-label">{segment.label}</p>
        <p className="stage-time" data-testid="stage-time">
          {formatClock(Math.ceil(props.snapshot.segmentRemainingSec - 1e-9))}
        </p>
        {segment.kind !== "rest" && (
          <>
            <p>{segment.bpm} BPM</p>
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
            <p>{segment.kind === "count-in" ? "4/4" : segment.meter}</p>
          </>
        )}
        {segment.kind === "rest" && nextPlay && (
          <p data-testid="next-up">
            Next · {nextPlay.label} at {nextPlay.bpm}
          </p>
        )}
        {props.status === "no-audio" && <p role="status">Sound is unavailable. The countdown is still running.</p>}
      </section>
      <div className="strip">
        {props.segments.map((item, index) => (
          <article key={`${item.setId}-${item.kind}-${index}`} data-current={index === props.snapshot.segmentIndex}>
            <strong>{item.label}</strong>
            <span>
              {formatClock(Math.round(item.durationSec))}
              {item.kind === "play" ? ` · ${item.bpm}` : ""}
            </span>
          </article>
        ))}
      </div>
      <footer className="transport">
        <div>
          <span>Elapsed</span>
          <strong>{formatClock(props.snapshot.elapsedSec)}</strong>
        </div>
        <div>
          <span>Set</span>
          <strong data-testid="footer-set">
            {segment.setIndex + 1} / {props.session.sets.length}
          </strong>
        </div>
        <div>
          <span>Left</span>
          <strong>{formatClock(Math.ceil(props.snapshot.remainingSec - 1e-9))}</strong>
        </div>
        <div className="controls">
          <button type="button" aria-label="Previous" onClick={() => props.onJump(-1)}>‹</button>
          <button
            type="button"
            aria-label={props.status === "playing" || props.status === "no-audio" ? "Pause" : "Play"}
            onClick={props.onToggle}
          >
            {props.status === "playing" || props.status === "no-audio" ? "Pause" : "Play"}
          </button>
          <button type="button" aria-label="Next" onClick={() => props.onJump(1)}>›</button>
          <button type="button" aria-label="Reset" onClick={props.onReset}>Reset</button>
        </div>
      </footer>
    </main>
  )
}
