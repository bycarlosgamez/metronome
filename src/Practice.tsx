import { useRef, useState } from "react"
import { bpmAt, type ClockSnapshot } from "./clock"
import type { Segment } from "./expandSession"
import { clampBpm, clampSession, sessionTitle, sharedSubdivision, toggleClick } from "./session"
import { SubdivIcon } from "./SubdivIcon"
import { ClickSheet } from "./ClickSheet"
import { MeterSheet } from "./MeterSheet"
import { PlayerCard } from "./PlayerCard"
import { SubdivisionSheet } from "./SubdivisionSheet"
import { CLICKS, type Session } from "./types"

export type PlaybackStatus = "stopped" | "playing" | "paused" | "no-audio"

export function Practice(props: {
  session: Session
  segments: Segment[]
  snapshot: ClockSnapshot
  status: PlaybackStatus
  clockShiftSec?: number // how far the shown practice clock is ahead of the playhead after Climb edits moved it
  onToggle(): void
  onJump(direction: -1 | 1): void
  onReset(): void
  onChange(session: Session): void
  onSeek(index: number): void
}) {
  const [sheet, setSheet] = useState<"meter" | "subdiv" | "click" | null>(null)

  // Inline BPM editing
  const bpmRef = useRef<string | null>(null)
  const [bpmText, setBpmText] = useState<string | null>(null)

  function commitBpm() {
    const v = bpmRef.current; setBpmText(null); bpmRef.current = null
    if (v === null || v.trim() === "") return
    const next = clampBpm(Number(v))
    if (next !== props.session.bpm) props.onChange(clampSession({ ...props.session, bpm: next }))
  }

  const segment = props.segments[props.snapshot.segmentIndex]
  const isPlaying = props.status === "playing" || props.status === "no-audio"
  const beatCount = segment.kind === "count-in" ? 4 : Number(props.session.meter.split("/")[0])
  const { beats } = props.session
  const subsInBeat = (beat: number) => beats[Math.min(beat, beats.length) - 1]?.slots.length ?? 1
  const shared = sharedSubdivision(beats)
  const intoSec = props.snapshot.segmentElapsedSec
  const currentBpm = bpmAt(segment, intoSec)

  // Elapsed time (always counting up, always finite)
  const elapsedSec = props.snapshot.elapsedSec

  // Current beat subdivision dot index (0-based within beat)
  // Use elapsedSec — intoSec is Infinity for endless sessions and breaks % math
  const beatDur = currentBpm > 0 ? 60 / currentBpm : 1
  const subDur = beatDur / subsInBeat(Math.max(1, props.snapshot.beat))
  const posInBeat = elapsedSec % beatDur
  const activeSubSlot = isPlaying ? Math.floor(posInBeat / subDur) : -1

  // Routine Now: stopped (including after the routine ends) shows where it will start; during a rest, the play coming up
  const { increase } = props.session.routine
  const routineEnabled = props.session.practice === "routine"
  const showNow = props.session.practice === "climb" || (routineEnabled && increase.mode !== "off")
  const nowBpm = props.status === "stopped"
    ? props.segments.find((s) => s.kind === "play")?.steps?.[0]?.bpm ?? props.session.bpm
    : segment.kind === "rest"
    ? props.segments.slice(props.snapshot.segmentIndex + 1).find((s) => s.kind === "play")?.steps?.[0]?.bpm ?? currentBpm
    : currentBpm

  const { accents } = props.session
  const accentLabel = accents.length === 0 ? "no accent" : `accent beat${accents.length > 1 ? "s" : ""} ${accents.join(", ")}`

  function closeSheet() { setSheet(null) }

  return (
    <main className="practice">
      <header className="topbar">
        <h1 aria-label="Mentronome">{sessionTitle(props.session)}</h1>
      </header>

      <div className="practice-body">
        {/* Beat grid */}
        <div className="beat-grid" role="region" aria-label="Beat display">
          {Array.from({ length: beatCount }, (_, i) => {
            const beat = i + 1
            const isLit = isPlaying && beat === props.snapshot.beat
            const isAccent = segment.kind !== "count-in" && props.session.accents.includes(beat)
            return (
              <div key={beat} className="beat-col">
                <div
                  className={`beat-sq${isAccent ? " accent" : ""}${isLit ? " lit" : ""}`}
                  data-testid={`beat-${beat}`}
                  data-current={isLit ? "true" : "false"}
                  data-accent={isAccent ? "true" : "false"}
                >
                  {beat}
                </div>
                {/* Tap a dot to mute or unmute that click, same as in the Subdivision sheet */}
                <div className="beat-subs">
                  {(beats[i]?.slots ?? []).map((slot, si) => (
                    <button
                      key={si}
                      type="button"
                      className={`beat-sub${slot === "off" ? " muted" : ""}${isLit && si === activeSubSlot ? " lit" : ""}`}
                      aria-label={`Beat ${beat} click ${si + 1}`}
                      aria-pressed={slot !== "off"}
                      onClick={() => props.onChange(toggleClick(props.session, i, si))}
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
                  value={bpmText ?? String(props.session.bpm)}
                  onFocus={() => { bpmRef.current = String(props.session.bpm); setBpmText(String(props.session.bpm)) }}
                  onChange={(e) => { bpmRef.current = e.target.value; setBpmText(e.target.value) }}
                  onBlur={commitBpm}
                  onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur() }}
                />
                <span className="bpm-label">{props.session.practice === "steady" ? "BPM" : "Start BPM"}</span>
              </div>
              {showNow && (
                <div className="bpm-right bpm-now">
                  <span className="bpm-now-value" data-testid="bpm-now">{nowBpm}</span>
                  <span className="bpm-field-label">Now</span>
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
              aria-label={`Click: Sound ${CLICKS.indexOf(props.session.click) + 1}, ${accentLabel}`}
              onClick={() => setSheet("click")}
            >
              <strong>{CLICKS.indexOf(props.session.click) + 1}</strong>
              <span>Click</span>
            </button>
          </div>
        </div>

        <PlayerCard
          session={props.session}
          segments={props.segments}
          snapshot={props.snapshot}
          status={props.status}
          clockShiftSec={props.clockShiftSec ?? 0}
          onToggle={props.onToggle}
          onReset={props.onReset}
          onChange={props.onChange}
        />

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
    </main>
  )
}
