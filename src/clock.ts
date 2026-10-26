import type { Segment } from "./expandSession"
import { beatsInMeter } from "./session"

export type ClockSnapshot = {
  segmentIndex: number
  beat: number
  segmentRemainingSec: number
  elapsedSec: number
  remainingSec: number
}

export type ClickMark = { offsetSec: number; beat: number; accent: boolean }

export function snapshotAt(segments: Segment[], elapsedSec: number): ClockSnapshot {
  const total = segments.reduce((sum, segment) => sum + segment.durationSec, 0)
  const elapsed = Math.min(Math.max(0, elapsedSec), total)
  let cursor = 0
  for (let index = 0; index < segments.length; index++) {
    const segment = segments[index]
    const end = cursor + segment.durationSec
    const isLast = index === segments.length - 1
    if (elapsed < end || isLast) {
      const into = elapsed - cursor
      return {
        segmentIndex: index,
        beat: segment.kind === "rest" ? 0 : beatAt(segment, into),
        segmentRemainingSec: Math.max(0, segment.durationSec - into),
        elapsedSec: elapsed,
        remainingSec: Math.max(0, total - elapsed),
      }
    }
    cursor = end
  }
  throw new Error("expandSession always returns at least one segment")
}

export function clicksInSegment(segment: Segment): ClickMark[] {
  if (segment.kind === "rest") return []
  const secondsPerBeat = 60 / segment.bpm
  const beats = segment.kind === "count-in" ? 4 : beatsInMeter(segment.meter)
  const marks: ClickMark[] = []
  for (let index = 0; ; index++) {
    const offsetSec = index * secondsPerBeat
    if (offsetSec >= segment.durationSec - 1e-9) break
    const beat = (index % beats) + 1
    marks.push({ offsetSec, beat, accent: beat === 1 })
  }
  return marks
}

function beatAt(segment: Segment, intoSec: number): number {
  const secondsPerBeat = 60 / segment.bpm
  const beats = segment.kind === "count-in" ? 4 : beatsInMeter(segment.meter)
  const index = Math.floor(intoSec / secondsPerBeat)
  return (index % beats) + 1
}
