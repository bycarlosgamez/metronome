import { useState } from "react"
import { bpmAt, stepIndexAt, type ClockSnapshot } from "./clock"
import type { Segment } from "./expandSession"
import { formatClock } from "./format"
import { clampSession, sessionTitle, SUBDIVISION_SLOTS } from "./session"
import { SubdivIcon } from "./SubdivIcon"
import { BpmSheet } from "./BpmSheet"
import { MeterSheet } from "./MeterSheet"
import { SubdivisionSheet } from "./SubdivisionSheet"
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
  onChange(session: Session): void
  onSeek(index: number): void
}) {
  const [sheet, setSheet] = useState<"bpm" | "meter" | "subdiv" | null>(null)

  const segment = props.segments[props.snapshot.segmentIndex]
  const isPlaying = props.status === "playing" || props.status === "no-audio"
  const isRamping = props.session.type === "time" && props.session.time.increaseEvery !== "off"
  const beatCount = segment.kind === "count-in" ? 4 : Number(props.session.meter.split("/")[0])
  const subCount = SUBDIVISION_SLOTS[props.session.subdivision]
  const intoSec = Math.max(0, segment.durationSec - props.snapshot.segmentRemainingSec)
  const currentBpm = bpmAt(segment, intoSec)

  // Current beat subdivision dot index (0-based within beat)
  const beatDur = currentBpm > 0 ? 60 / currentBpm : 1
  const subDur = beatDur / subCount
  const posInBeat = intoSec % beatDur
  const activeSubSlot = isPlaying ? Math.floor(posInBeat / subDur) : -1

  // Elapsed time (always counting up)
  const elapsedSec = props.snapshot.elapsedSec

  // BPM ramp info
  const startBpm = props.session.bpm
  const targetBpm = props.session.time.targetBpm ?? startBpm
  const progressPct = isRamping && targetBpm > startBpm
    ? Math.min(100, ((currentBpm - startBpm) / (targetBpm - startBpm)) * 100)
    : 0
  const stepIndex = stepIndexAt(segment, intoSec)
  const nextStepAtSec = segment.steps?.[stepIndex + 1]?.atSec
  const timeUntilNext = nextStepAtSec !== undefined ? nextStepAtSec - intoSec : null

  function closeSheet() { setSheet(null) }

  return (
    <main className="practice">
      <header className="topbar">
        <h1 aria-label="Mentronome">{sessionTitle(props.session)}</h1>
        <button type="button" className="quiet" onClick={props.onEdit}>Edit</button>
      </header>

      <div className="practice-body">
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
                  {Array.from({ length: subCount }, (_, si) => (
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

        {/* BPM block */}
        <button
          type="button"
          className="bpm-block"
          aria-label="Edit BPM settings"
          onClick={() => setSheet("bpm")}
        >
          {isRamping ? (
            <div className="bpm-ramp">
              <div className="bpm-ramp__top">
                <div>
                  <div className="bpm-current" data-testid="bpm-current">{currentBpm}</div>
                  <div className="bpm-label">
                    BPM · +{props.session.bpmIncrease} every{" "}
                    {props.session.time.increaseEvery === "bars"
                      ? `${props.session.time.everyBars} bars`
                      : `${props.session.time.everySec}s`}
                  </div>
                </div>
                <div className="bpm-ramp__right">
                  <div className="bpm-target" data-testid="bpm-target">{targetBpm}</div>
                  <div className="bpm-target-label">Target</div>
                </div>
              </div>
              <div className="bpm-progress-wrap">
                <div className="bpm-progress-bar">
                  <div className="bpm-progress-fill" style={{ width: `${progressPct}%` }} />
                </div>
                <div className="bpm-progress-labels">
                  <span>{startBpm} BPM</span>
                  <span className="bpm-step-info" data-testid="bpm-step-info">
                    {isPlaying && timeUntilNext !== null
                      ? `next ↑ in ${formatClock(Math.max(0, timeUntilNext))}`
                      : formatClock(elapsedSec)}
                  </span>
                  <span>→ {targetBpm}</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="bpm-endless">
              <div className="bpm-endless__left">
                <div className="bpm-current" data-testid="bpm-current">{currentBpm}</div>
                <div className="bpm-label">BPM · endless</div>
              </div>
              <div className="bpm-endless__right">
                <div className="bpm-elapsed" data-testid="bpm-elapsed">
                  {isPlaying ? formatClock(elapsedSec) : "0:00"}
                </div>
                <div className="bpm-hint">Tap to edit ›</div>
              </div>
            </div>
          )}
        </button>

        {/* Pick row */}
        <div className="pick-row">
          <button
            type="button"
            className="pick-btn"
            aria-label={`Time signature: ${props.session.meter}`}
            onClick={() => setSheet("meter")}
          >
            <strong>{props.session.meter}</strong>
            <span>Meter</span>
          </button>
          <button
            type="button"
            className="pick-btn"
            aria-label={`Subdivision: ${props.session.subdivision}`}
            onClick={() => setSheet("subdiv")}
          >
            <SubdivIcon subdivision={props.session.subdivision} size="sm" />
            <span>Subdivision</span>
          </button>
        </div>

        {/* Play controls */}
        <div className="play-controls">
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
        </div>

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
        onChange={(next) => { props.onChange(clampSession(next)); closeSheet() }}
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
