import { useEffect, useMemo, useRef, useState } from "react"
import { createClickSounds, scheduleClicks, scheduleSegment, type ClickSounds } from "./audio"
import { carryClimbPosition } from "./climb"
import { clickWindow, clicksInSegment, scheduleOrigin, snapshotAt } from "./clock"
import { expandSession, type Segment } from "./expandSession"
import { Practice, type PlaybackStatus } from "./Practice"
import { clampSession } from "./session"
import { loadSession, saveSession } from "./store"
import type { Session } from "./types"

export function App() {
  const [session, setSession] = useState(() => loadSession(window.localStorage))
  const segments = useMemo(() => expandSession(session), [session])
  const { elapsed, status, setStatus, elapsedRef, setElapsed } = usePlayback(segments)
  const snapshot = snapshotAt(segments, elapsed)
  // Climb edits move the playhead to keep your step; this keeps the shown practice clock counting on regardless
  const [clockShiftSec, setClockShiftSec] = useState(0)
  const audioRef = useRef<AudioContext | null>(null)
  const buffersRef = useRef<ClickSounds | null>(null)
  const nodesRef = useRef<AudioBufferSourceNode[]>([])
  const playGen = useRef(0)
  const toggleRef = useRef<() => void>(() => {})
  const nudgeRef = useRef<(step: number) => void>(() => {})
  const tapRef = useRef<() => void>(() => {})
  const tapsRef = useRef<number[]>([])
  const [seekCount, setSeekCount] = useState(0)
  const segmentsRef = useRef(segments)
  const remainingRef = useRef(snapshot.segmentRemainingSec)
  segmentsRef.current = segments
  remainingRef.current = snapshot.segmentRemainingSec

  function stopNodes() {
    for (const node of nodesRef.current) {
      try {
        node.stop()
      } catch {
        // already stopped
      }
    }
    nodesRef.current = []
  }

  function writeElapsed(next: number) {
    elapsedRef.current = next
    setElapsed(next)
  }

  useEffect(() => {
    if (status !== "playing") {
      stopNodes()
      return
    }
    const audio = audioRef.current
    if (!audio) return
    if (!buffersRef.current) buffersRef.current = createClickSounds(audio)
    const segment = segmentsRef.current[snapshot.segmentIndex]
    const before = segmentsRef.current
      .slice(0, snapshot.segmentIndex)
      .reduce((sum, item) => sum + item.durationSec, 0)
    const into = Number.isFinite(segment.durationSec)
      ? Math.max(0, segment.durationSec - remainingRef.current)
      : Math.max(0, elapsedRef.current - before)
    const idealWhen = audio.currentTime - into
    const boundarySlackSec = 0.05
    const sounds = buffersRef.current
    const keep = (nodes: AudioBufferSourceNode[], marks: { offsetSec: number }[]) => {
      const kept: AudioBufferSourceNode[] = []
      nodes.forEach((node, index) => {
        const idealStart = idealWhen + marks[index].offsetSec
        if (idealStart < audio.currentTime - boundarySlackSec) {
          try {
            node.stop()
          } catch {
            // click already in the past
          }
          return
        }
        kept.push(node)
      })
      return kept
    }
    if (Number.isFinite(segment.durationSec)) {
      const scheduled = scheduleSegment(audio, sounds, segment, idealWhen)
      const marks = segment.kind === "rest" ? [{ offsetSec: 0 }] : clicksInSegment(segment)
      nodesRef.current = keep(scheduled, marks)
      return () => stopNodes()
    }
    let until = scheduleOrigin(into)
    const place = () => {
      const from = until
      const window = clickWindow(segment, from)
      const scheduled = scheduleClicks(audio, sounds, window.marks, idealWhen)
      nodesRef.current = nodesRef.current.concat(keep(scheduled, window.marks))
      until = window.untilSec
    }
    place()
    const timer = window.setInterval(() => {
      const played = audio.currentTime - idealWhen
      if (until - played < 1) place()
    }, 250)
    return () => {
      window.clearInterval(timer)
      stopNodes()
    }
  }, [snapshot.segmentIndex, status, segments, seekCount])

  useEffect(() => {
    // Space plays/pauses, ↑/↓ nudge the BPM (±5 with Shift), T taps the tempo; typing in a field is left alone
    function onKeyDown(event: KeyboardEvent) {
      const target = event.target
      if (
        event.defaultPrevented ||
        event.metaKey || event.ctrlKey || event.altKey ||
        (target instanceof HTMLElement &&
          (target.isContentEditable || target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT"))
      ) {
        return
      }
      if (event.key === " ") {
        // Space presses a focused control as usual, and does nothing behind an open popup
        if (target instanceof Element && target.closest("button, a, [role=switch], [role=dialog]")) return
        if (document.querySelector(".sheet-overlay.open")) return
        event.preventDefault()
        if (!event.repeat) toggleRef.current()
      } else if (event.key === "ArrowUp" || event.key === "ArrowDown") {
        event.preventDefault()
        nudgeRef.current((event.key === "ArrowUp" ? 1 : -1) * (event.shiftKey ? 5 : 1))
      } else if ((event.key === "t" || event.key === "T") && !event.repeat) {
        tapRef.current()
      }
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [])

  async function onToggle() {
    if (status === "playing" || status === "no-audio") {
      playGen.current += 1
      stopNodes()
      setStatus("paused")
      return
    }
    const total = segmentsRef.current.reduce((sum, segment) => sum + segment.durationSec, 0)
    if (elapsedRef.current >= total) writeElapsed(0)
    const gen = (playGen.current += 1)
    try {
      if (!audioRef.current) {
        audioRef.current = new AudioContext()
      }
      await audioRef.current.resume()
    } catch {
      if (gen !== playGen.current) return
      setStatus("no-audio")
      return
    }
    if (gen !== playGen.current) return
    setStatus(audioRef.current.state === "running" ? "playing" : "no-audio")
  }

  toggleRef.current = () => {
    void onToggle()
  }
  nudgeRef.current = (step) => onChange(clampSession({ ...session, bpm: session.bpm + step }))
  // Tap tempo: the average gap between the last few taps sets the BPM; a pause over 2s starts a new count
  tapRef.current = () => {
    const now = performance.now()
    const taps = [...tapsRef.current.filter((at) => now - at < 2000), now].slice(-5)
    tapsRef.current = taps
    if (taps.length < 2) return
    const gap = (taps[taps.length - 1] - taps[0]) / (taps.length - 1)
    if (gap > 0) onChange(clampSession({ ...session, bpm: Math.round(60000 / gap) }))
  }

  function onSeek(index: number) {
    if (index < 0 || index >= segments.length) return
    const start = segments.slice(0, index).reduce((sum, segment) => sum + segment.durationSec, 0)
    stopNodes()
    writeElapsed(start)
    setSeekCount((count) => count + 1)
  }

  function onJump(direction: -1 | 1) {
    const index = snapshotAt(segments, elapsedRef.current).segmentIndex + direction
    if (index < 0 || index >= segments.length) return
    const start = segments.slice(0, index).reduce((sum, segment) => sum + segment.durationSec, 0)
    stopNodes()
    writeElapsed(start)
  }

  function onReset() {
    playGen.current += 1
    stopNodes()
    writeElapsed(0)
    setClockShiftSec(0)
    setStatus("stopped")
  }

  function onChange(next: Session) {
    const climbEdited = session.practice === "climb" && next.practice === "climb" && (
      next.bpm !== session.bpm || next.bpmIncrease !== session.bpmIncrease || next.meter !== session.meter ||
      JSON.stringify(next.time) !== JSON.stringify(session.time)
    )
    if (climbEdited) {
      // Keep your place in the current Climb step instead of letting the same elapsed time land on a different step
      const current = snapshotAt(segments, elapsedRef.current)
      const currentSegment = segments[current.segmentIndex]
      const nextSegments = expandSession(next)
      const nextCountIn = nextSegments.find((segment) => segment.kind === "count-in")
      const nextPlay = nextSegments.find((segment) => segment.kind === "play")
      let nextElapsed = elapsedRef.current
      if (currentSegment.kind === "play" && nextPlay) {
        const steps = currentSegment.steps ?? [{ atSec: 0, bpm: currentSegment.bpm }]
        const nextSteps = nextPlay.steps ?? [{ atSec: 0, bpm: nextPlay.bpm }]
        nextElapsed = (nextCountIn?.durationSec ?? 0) + carryClimbPosition(steps, current.segmentElapsedSec, nextSteps)
      } else if (currentSegment.kind === "count-in" && currentSegment.durationSec > 0) {
        nextElapsed = (current.segmentElapsedSec / currentSegment.durationSec) * (nextCountIn?.durationSec ?? 0)
      }
      stopNodes()
      const carried = Math.max(0, nextElapsed)
      setClockShiftSec((shift) => shift + elapsedRef.current - carried)
      writeElapsed(carried)
    }
    if (next.practice !== session.practice) setClockShiftSec(0)
    setSession(next)
    saveSession(next, window.localStorage)
  }

  return (
    <Practice
      session={session}
      segments={segments}
      snapshot={snapshot}
      clockShiftSec={clockShiftSec}
      status={status}
      onToggle={() => {
        void onToggle()
      }}
      onJump={onJump}
      onReset={onReset}
      onChange={onChange}
      onSeek={onSeek}
    />
  )
}

function usePlayback(segments: Segment[]) {
  const [elapsed, setElapsed] = useState(0)
  const [status, setStatus] = useState<PlaybackStatus>("stopped")
  const elapsedRef = useRef(0)
  const statusRef = useRef(status)
  statusRef.current = status
  const totalRef = useRef(0)
  totalRef.current = segments.reduce((sum, segment) => sum + segment.durationSec, 0)

  useEffect(() => {
    if (elapsedRef.current > totalRef.current) {
      elapsedRef.current = totalRef.current
      setElapsed(totalRef.current)
    }
  }, [segments])

  function assignStatus(next: PlaybackStatus) {
    statusRef.current = next
    setStatus(next)
  }

  useEffect(() => {
    let frame = 0
    let last = performance.now()
    const tick = (now: number) => {
      if (statusRef.current === "playing" || statusRef.current === "no-audio") {
        const next = Math.min(totalRef.current, elapsedRef.current + (now - last) / 1000)
        elapsedRef.current = next
        setElapsed(next)
        if (next >= totalRef.current) {
          statusRef.current = "stopped"
          setStatus("stopped")
        }
      }
      last = now
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [])

  return { elapsed, status, setStatus: assignStatus, elapsedRef, setElapsed }
}
