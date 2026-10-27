import { useEffect, useMemo, useRef, useState } from "react"
import { createClickBuffers, scheduleSegment, type ClickBuffers } from "./audio"
import { clicksInSegment, snapshotAt } from "./clock"
import { Edit } from "./Edit"
import { expandSession, type Segment } from "./expandSession"
import { Practice, type PlaybackStatus } from "./Practice"
import { loadSession, saveSession } from "./store"
import type { Session } from "./types"

export function App() {
  const [session, setSession] = useState(() => loadSession(window.localStorage))
  const [view, setView] = useState<"practice" | "edit">("practice")
  const segments = useMemo(() => expandSession(session), [session])
  const { elapsed, status, setStatus, elapsedRef, setElapsed } = usePlayback(segments)
  const snapshot = snapshotAt(segments, elapsed)
  const audioRef = useRef<AudioContext | null>(null)
  const buffersRef = useRef<ClickBuffers | null>(null)
  const clickRef = useRef(session.click)
  const nodesRef = useRef<AudioBufferSourceNode[]>([])
  const viewRef = useRef(view)
  const playGen = useRef(0)
  const toggleRef = useRef<() => void>(() => {})
  const [seekCount, setSeekCount] = useState(0)
  const segmentsRef = useRef(segments)
  const remainingRef = useRef(snapshot.segmentRemainingSec)
  const clickIdRef = useRef(session.click)
  viewRef.current = view
  segmentsRef.current = segments
  remainingRef.current = snapshot.segmentRemainingSec
  clickIdRef.current = session.click

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
    const click = clickIdRef.current
    if (!buffersRef.current || clickRef.current !== click) {
      buffersRef.current = createClickBuffers(audio, click)
      clickRef.current = click
    }
    const segment = segmentsRef.current[snapshot.segmentIndex]
    const into = segment.durationSec - remainingRef.current
    const idealWhen = audio.currentTime - into
    const boundarySlackSec = 0.05
    const scheduled = scheduleSegment(audio, buffersRef.current, segment, idealWhen)
    const marks = segment.kind === "rest" ? [{ offsetSec: 0 }] : clicksInSegment(segment)
    const kept: AudioBufferSourceNode[] = []
    scheduled.forEach((node, index) => {
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
    nodesRef.current = kept
    return () => {
      stopNodes()
    }
  }, [snapshot.segmentIndex, status, segments, seekCount])

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== " " || event.repeat || viewRef.current === "edit") return
      const target = event.target
      if (
        target instanceof HTMLElement &&
        (target.isContentEditable || target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT")
      ) {
        return
      }
      event.preventDefault()
      toggleRef.current()
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
      if (gen !== playGen.current || viewRef.current === "edit") return
      setStatus("no-audio")
      return
    }
    if (gen !== playGen.current || viewRef.current === "edit") return
    setStatus(audioRef.current.state === "running" ? "playing" : "no-audio")
  }

  toggleRef.current = () => {
    void onToggle()
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
    setStatus("stopped")
  }

  function onEdit() {
    playGen.current += 1
    stopNodes()
    writeElapsed(0)
    setStatus("stopped")
    setView("edit")
  }

  function onChange(next: Session) {
    setSession(next)
    saveSession(next, window.localStorage)
  }

  if (view === "edit") {
    return (
      <Edit session={session} onChange={onChange} onDone={() => setView("practice")} />
    )
  }

  return (
    <Practice
      session={session}
      segments={segments}
      snapshot={snapshot}
      status={status}
      onToggle={() => {
        void onToggle()
      }}
      onJump={onJump}
      onReset={onReset}
      onEdit={onEdit}
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
