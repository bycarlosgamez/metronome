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

export function stepIndexAt(segment: Segment, offsetSec: number): number {
  if (!segment.steps?.length) return 0
  let index = 0
  for (let i = 0; i < segment.steps.length; i += 1) {
    if (segment.steps[i].atSec <= offsetSec + 1e-9) index = i
    else break
  }
  return index
}

export function bpmAt(segment: Segment, offsetSec: number): number {
  return segment.steps?.[stepIndexAt(segment, offsetSec)]?.bpm ?? segment.bpm
}

export function clicksInSegment(segment: Segment): ClickMark[] {
  if (segment.kind === "rest") return []
  const beats = segment.kind === "count-in" ? 4 : beatsInMeter(segment.meter)
  const marks: ClickMark[] = []
  let offsetSec = 0
  let index = 0
  while (offsetSec < segment.durationSec - 1e-9) {
    const bpm = bpmAt(segment, offsetSec)
    const beat = (index % beats) + 1
    marks.push({ offsetSec, beat, accent: beat === 1 })
    const next = offsetSec + 60 / bpm
    if (!(next > offsetSec)) break
    offsetSec = next
    index += 1
  }
  return marks
}

function beatAt(segment: Segment, intoSec: number): number {
  const beats = segment.kind === "count-in" ? 4 : beatsInMeter(segment.meter)
  let offsetSec = 0
  let index = 0
  let beat = 1
  while (offsetSec < segment.durationSec - 1e-9) {
    beat = (index % beats) + 1
    const next = offsetSec + 60 / bpmAt(segment, offsetSec)
    if (!(next > offsetSec) || next > intoSec + 1e-9) break
    offsetSec = next
    index += 1
  }
  return beat
}
