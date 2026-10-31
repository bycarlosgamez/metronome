import { useRef, useState } from "react"
import type { ClockSnapshot } from "./clock"
import type { Segment } from "./expandSession"
import { clampBpm, clampSession, sharedSubdivision, toggleAccent, toggleClick } from "./session"
import { Icon } from "./Icon"
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

  // − / + step once on click; held down, they repeat after a short pause. The held run tracks its own BPM
  // because the session prop only catches up after each change renders.
  const hold = useRef<{ bpm: number; held: boolean; delay?: number; repeat?: number }>({ bpm: 0, held: false })
  function nudge(step: number) {
    hold.current.bpm = clampBpm(hold.current.bpm + step)
    props.onChange(clampSession({ ...props.session, bpm: hold.current.bpm }))
  }
  function stopHold() {
    window.clearTimeout(hold.current.delay)
    window.clearInterval(hold.current.repeat)
  }
  function startHold(step: number) {
    stopHold()
    hold.current = { bpm: props.session.bpm, held: false }
    hold.current.delay = window.setTimeout(() => {
      hold.current.held = true
      nudge(step)
      hold.current.repeat = window.setInterval(() => nudge(step), 80)
    }, 400)
  }
  function stepClick(step: number) {
    if (hold.current.held) { hold.current.held = false; return }
    hold.current.bpm = props.session.bpm
    nudge(step)
  }
  const stepProps = (step: number) => ({
    onPointerDown: () => startHold(step),
    onPointerUp: stopHold,
    onPointerLeave: stopHold,
    onPointerCancel: stopHold,
    onClick: () => stepClick(step),
  })

  // The beat dots are one tab stop; arrow keys move between them
  const [dotFocus, setDotFocus] = useState(0)
  function onDotKey(event: React.KeyboardEvent<HTMLButtonElement>, index: number) {
    const move = event.key === "ArrowRight" || event.key === "ArrowDown" ? 1 : event.key === "ArrowLeft" || event.key === "ArrowUp" ? -1 : 0
    if (!move) return
    event.preventDefault()
    const dots = Array.from(event.currentTarget.closest(".beat-grid")?.querySelectorAll<HTMLButtonElement>(".beat-sub") ?? [])
    const next = (index + move + dots.length) % dots.length
    setDotFocus(next)
    dots[next]?.focus()
  }

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

  // Current beat subdivision dot index (0-based within beat)
  // Timed from the same beat as the lit square, so the dot can't drift after rests or tempo steps
  const subs = subsInBeat(Math.max(1, props.snapshot.beat))
  const activeSubSlot = isPlaying ? Math.min(subs - 1, Math.floor(props.snapshot.beatFraction * subs)) : -1

  const { accents } = props.session
  const accentLabel = accents.length === 0 ? "no accent" : `accent beat${accents.length > 1 ? "s" : ""} ${accents.join(", ")}`

  // Position of a dot across the whole bar, for the single tab stop
  const dotIndex = (beatIndex: number, slotIndex: number) =>
    beats.slice(0, beatIndex).reduce((sum, beat) => sum + beat.slots.length, 0) + slotIndex

  function closeSheet() { setSheet(null) }

  return (
    <main className="practice">
      <header className="topbar">
        <h1>Mentronome</h1>
      </header>

      <div className="practice-body">
        <div className="practice-beats">
        <div className="beat-grid" role="region" aria-label="Beat display">
          {Array.from({ length: beatCount }, (_, i) => {
            const beat = i + 1
            const isLit = isPlaying && beat === props.snapshot.beat
            const isAccent = segment.kind !== "count-in" && props.session.accents.includes(beat)
            return (
              <div key={beat} className="beat-col">
                {/* Tap a square to accent that beat (also set in the Sound sheet) */}
                <button
                  type="button"
                  className={`beat-sq${isAccent ? " accent" : ""}${isLit ? " lit" : ""}`}
                  data-testid={`beat-${beat}`}
                  data-current={isLit ? "true" : "false"}
                  data-accent={isAccent ? "true" : "false"}
                  aria-label={`Beat ${beat}`}
                  aria-pressed={props.session.accents.includes(beat)}
                  title="Tap to accent this beat"
                  onClick={() => props.onChange(toggleAccent(props.session, beat))}
                >
                  {beat}
                </button>
                {/* Tap a dot to mute or unmute that click, same as in the Subdivision sheet */}
                <div className="beat-subs">
                  {(beats[i]?.slots ?? []).map((slot, si) => (
                    <button
                      key={si}
                      type="button"
                      className={`beat-sub${slot === "off" ? " muted" : ""}${isLit && si === activeSubSlot ? " lit" : ""}`}
                      aria-label={`Beat ${beat} click ${si + 1}`}
                      aria-pressed={slot !== "off"}
                      title="Tap to mute or unmute this click"
                      tabIndex={dotIndex(i, si) === dotFocus ? 0 : -1}
                      onFocus={() => setDotFocus(dotIndex(i, si))}
                      onKeyDown={(event) => onDotKey(event, dotIndex(i, si))}
                      onClick={() => props.onChange(toggleClick(props.session, i, si))}
                    />
                  ))}
                </div>
              </div>
            )
          })}
        </div>
        </div>

        <div className="pick-row">
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
            <strong className="pick-sound"><Icon name="sound" size={18} /> {CLICKS.indexOf(props.session.click) + 1}</strong>
            {/* One dot per beat; accented beats are blue */}
            <div className="pick-accents" aria-hidden="true">
              {props.session.beats.map((_, index) => <i key={index} className={accents.includes(index + 1) ? "on" : ""} />)}
            </div>
            <span>Sound</span>
          </button>
        </div>

        <PlayerCard
          session={props.session}
          segments={props.segments}
          snapshot={props.snapshot}
          status={props.status}
          clockShiftSec={props.clockShiftSec ?? 0}
          renderTempo={(bpm, live) => (
            <div className="tempo-control">
              <button type="button" className="bpm-round-btn" aria-label="Decrease BPM" {...stepProps(-1)}>−</button>
              <input
                className="bpm-current"
                data-testid="bpm-current"
                inputMode="numeric"
                aria-label={live ? "Playing BPM" : "BPM"}
                readOnly={live}
                value={live ? String(bpm) : bpmText ?? String(bpm)}
                onFocus={() => { if (live) return; bpmRef.current = String(bpm); setBpmText(String(bpm)) }}
                onChange={(e) => { bpmRef.current = e.target.value; setBpmText(e.target.value) }}
                onBlur={commitBpm}
                onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur() }}
              />
              <button type="button" className="bpm-round-btn" aria-label="Increase BPM" {...stepProps(1)}>+</button>
            </div>
          )}
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
        onChange={(meter) => props.onChange(clampSession({ ...props.session, meter }))}
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
