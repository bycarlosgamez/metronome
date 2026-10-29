import type { Segment } from "./expandSession"
import { beatsInMeter } from "./session"
import type { ClickId } from "./types"

export type ClockSnapshot = {
  segmentIndex: number
  beat: number
  segmentRemainingSec: number
  elapsedSec: number
  remainingSec: number
}

export type ClickMark = { offsetSec: number; beat: number; accent: boolean; click: ClickId }

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

export function clicksInSegment(segment: Segment, fromSec = 0, untilSec = segment.durationSec): ClickMark[] {
  const end = Math.min(
    Number.isFinite(segment.durationSec) ? segment.durationSec : Number.POSITIVE_INFINITY,
    Number.isFinite(untilSec) ? untilSec : 0,
  )
  const start = Math.max(0, fromSec)
  if (segment.kind === "rest" || !(end > start)) return []
  const pattern = segment.kind === "count-in" || !segment.beats?.length ? [] : segment.beats
  const beats = segment.kind === "count-in" ? 4 : beatsInMeter(segment.meter)
  const marks: ClickMark[] = []
  let offsetSec = 0
  let beatIndex = 0
  while (offsetSec < end - 1e-9) {
    const beatDur = 60 / bpmAt(segment, offsetSec)
    if (!(beatDur > 0)) break
    const beat = (beatIndex % beats) + 1
    const slots = pattern.length ? pattern[Math.min(beat, pattern.length) - 1].slots : [segment.click]
    const slotDur = beatDur / slots.length
    slots.forEach((slot, index) => {
      const at = offsetSec + index * slotDur
      if (at < start - 1e-9 || at >= end - 1e-9 || slot === "off") return
      marks.push({ offsetSec: at, beat, accent: beat === 1, click: slot })
    })
    offsetSec += beatDur
    beatIndex += 1
  }
  return marks
}

export function scheduleOrigin(intoSec: number): number {
  return Math.max(0, intoSec - 0.05)
}

export function clickWindow(segment: Segment, fromSec: number): { untilSec: number; marks: ClickMark[] } {
  let untilSec = Math.max(0, fromSec)
  let guard = 0
  while (untilSec < fromSec + 2 - 1e-9 && guard < 64) {
    const beat = 60 / bpmAt(segment, untilSec)
    if (!(beat > 0)) break
    untilSec += beat
    guard += 1
  }
  if (Number.isFinite(segment.durationSec)) untilSec = Math.min(untilSec, segment.durationSec)
  return { untilSec, marks: clicksInSegment(segment, fromSec, untilSec) }
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
