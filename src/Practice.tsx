import { useRef, useState } from "react"
import { bpmAt, type ClockSnapshot } from "./clock"
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

  // Routine inline field state
  const barsRef = useRef<string | null>(null)
  const levelsRef = useRef<string | null>(null)
  const repeatRef = useRef<string | null>(null)
  const restRef = useRef<string | null>(null)
  const [barsText, setBarsText] = useState<string | null>(null)
  const [levelsText, setLevelsText] = useState<string | null>(null)
  const [repeatText, setRepeatText] = useState<string | null>(null)
  const [restText, setRestText] = useState<string | null>(null)

  const segment = props.segments[props.snapshot.segmentIndex]
  const isPlaying = props.status === "playing" || props.status === "no-audio"
  const beatCount = segment.kind === "count-in" ? 4 : Number(props.session.meter.split("/")[0])
  const subCount = SUBDIVISION_SLOTS[props.session.subdivision]
  const intoSec = Math.max(0, segment.durationSec - props.snapshot.segmentRemainingSec)
  const currentBpm = bpmAt(segment, intoSec)

  // Elapsed time (always counting up, always finite)
  const elapsedSec = props.snapshot.elapsedSec

  // Current beat subdivision dot index (0-based within beat)
  // Use elapsedSec — intoSec is Infinity for endless sessions and breaks % math
  const beatDur = currentBpm > 0 ? 60 / currentBpm : 1
  const subDur = beatDur / subCount
  const posInBeat = elapsedSec % beatDur
  const activeSubSlot = isPlaying ? Math.floor(posInBeat / subDur) : -1

  // Routine state
  const { routineEnabled, routine } = props.session
  const { numLevels, repeatCount } = routine
  const setIdx = segment.setIndex
  const cycleN = Math.floor(setIdx / numLevels) + 1
  const levelN = (setIdx % numLevels) + 1
  const levelProgress = segment.kind === "play" && Number.isFinite(segment.durationSec) && segment.durationSec > 0
    ? Math.min(1, intoSec / segment.durationSec)
    : 0

  function closeSheet() { setSheet(null) }

  function switchMode(enable: boolean) {
    if (enable === routineEnabled) return
    props.onChange(clampSession({ ...props.session, routineEnabled: enable }))
    if (isPlaying) props.onReset()
  }

  function commitRoutine(partial: Partial<Session["routine"]>) {
    props.onChange(clampSession({ ...props.session, routine: { ...routine, ...partial } }))
  }

  return (
    <main className="practice">
      <header className="topbar">
        <h1 aria-label="Mentronome">{sessionTitle(props.session)}</h1>
        <button type="button" className="quiet" onClick={props.onEdit}>Edit</button>
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

        {/* BPM + time sig/subdiv side by side */}
        <div className="bpm-pick-row">
          <button
            type="button"
            className="bpm-block"
            aria-label="Edit BPM settings"
            onClick={() => setSheet("bpm")}
          >
            <div className="bpm-endless">
              <div className="bpm-endless__left">
                <div className="bpm-current" data-testid="bpm-current">{currentBpm}</div>
                <div className="bpm-label">BPM</div>
              </div>
              <div className="bpm-endless__right">
                {!routineEnabled && (
                  <div className="bpm-elapsed" data-testid="bpm-elapsed">
                    {isPlaying ? formatClock(elapsedSec) : "0:00"}
                  </div>
                )}
                <div className="bpm-hint">Tap ›</div>
              </div>
            </div>
          </button>
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
              aria-label={`Subdivision: ${props.session.subdivision}`}
              onClick={() => setSheet("subdiv")}
            >
              <SubdivIcon subdivision={props.session.subdivision} size="sm" />
              <span>Subdiv</span>
            </button>
          </div>
        </div>

        {/* Routine timer block */}
        {routineEnabled && (
          <div className="routine-timer">
            <div className="routine-progress-row">
              <div className="routine-elapsed" data-testid="routine-elapsed">
                {isPlaying ? formatClock(elapsedSec) : "0:00"}
              </div>
              <div className="routine-cycle-info">
                <div>Cycle {cycleN}/{repeatCount}</div>
                <div>Level {levelN}/{numLevels}</div>
              </div>
            </div>
            <div className="routine-progress-bar-wrap">
              <div
                className="routine-progress-bar-fill"
                style={{ width: `${Math.round(levelProgress * 100)}%` }}
              />
            </div>
            <div className="routine-fields">
              <div className="routine-field">
                <label htmlFor="routine-bars">Bars / level</label>
                <input
                  id="routine-bars"
                  type="number"
                  aria-label="Bars / level"
                  inputMode="numeric"
                  value={barsText ?? String(routine.barsPerLevel)}
                  onFocus={() => { barsRef.current = String(routine.barsPerLevel); setBarsText(String(routine.barsPerLevel)) }}
                  onChange={(e) => { barsRef.current = e.target.value; setBarsText(e.target.value) }}
                  onBlur={() => {
                    const v = barsRef.current; setBarsText(null); barsRef.current = null
                    if (v !== null) commitRoutine({ barsPerLevel: Math.max(1, Math.round(Number(v))) })
                  }}
                  onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur() }}
                />
              </div>
              <div className="routine-field">
                <label htmlFor="routine-levels">Levels</label>
                <input
                  id="routine-levels"
                  type="number"
                  aria-label="Levels"
                  inputMode="numeric"
                  value={levelsText ?? String(routine.numLevels)}
                  onFocus={() => { levelsRef.current = String(routine.numLevels); setLevelsText(String(routine.numLevels)) }}
                  onChange={(e) => { levelsRef.current = e.target.value; setLevelsText(e.target.value) }}
                  onBlur={() => {
                    const v = levelsRef.current; setLevelsText(null); levelsRef.current = null
                    if (v !== null) commitRoutine({ numLevels: Math.max(1, Math.round(Number(v))) })
                  }}
                  onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur() }}
                />
              </div>
              <div className="routine-field">
                <label htmlFor="routine-repeat">Repeat ×</label>
                <input
                  id="routine-repeat"
                  type="number"
                  aria-label="Repeat ×"
                  inputMode="numeric"
                  value={repeatText ?? String(routine.repeatCount)}
                  onFocus={() => { repeatRef.current = String(routine.repeatCount); setRepeatText(String(routine.repeatCount)) }}
                  onChange={(e) => { repeatRef.current = e.target.value; setRepeatText(e.target.value) }}
                  onBlur={() => {
                    const v = repeatRef.current; setRepeatText(null); repeatRef.current = null
                    if (v !== null) commitRoutine({ repeatCount: Math.max(1, Math.round(Number(v))) })
                  }}
                  onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur() }}
                />
              </div>
              <div className="routine-field">
                <label htmlFor="routine-rest">Rest (sec)</label>
                <input
                  id="routine-rest"
                  type="number"
                  aria-label="Rest (sec)"
                  inputMode="numeric"
                  value={restText ?? String(routine.restAfterSec)}
                  onFocus={() => { restRef.current = String(routine.restAfterSec); setRestText(String(routine.restAfterSec)) }}
                  onChange={(e) => { restRef.current = e.target.value; setRestText(e.target.value) }}
                  onBlur={() => {
                    const v = restRef.current; setRestText(null); restRef.current = null
                    if (v !== null) commitRoutine({ restAfterSec: Math.max(0, Math.round(Number(v))) })
                  }}
                  onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur() }}
                />
              </div>
            </div>
          </div>
        )}

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
