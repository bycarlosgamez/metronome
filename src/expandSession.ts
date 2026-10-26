import { setTitle } from "./session"
import type { Meter, Session, SetColor } from "./types"

export type SegmentKind = "count-in" | "play" | "rest"

export type Segment = {
  kind: SegmentKind
  setId: string
  label: string
  repetition: number
  bpm: number
  meter: Meter
  durationSec: number
  color: SetColor | "slate"
  setIndex: number
}

export function expandSession(session: Session): Segment[] {
  const plays = session.sets.flatMap((set, setIndex) => {
    const meter = session.perSetMeter ? set.meter : session.meter
    return Array.from({ length: set.repeats }, (_, index) => {
      const repetition = index + 1
      const bpm = Math.min(300, set.bpm + index * session.bpmIncrease)
      return { set, setIndex, repetition, bpm, meter }
    })
  })

  return plays.flatMap((play, index) => {
    const label = setTitle(play.set)
    const segments: Segment[] = [
      {
        kind: "count-in",
        setId: play.set.id,
        label,
        repetition: play.repetition,
        bpm: play.bpm,
        meter: "4/4",
        durationSec: (4 * 60) / play.bpm,
        color: play.set.color,
        setIndex: play.setIndex,
      },
      {
        kind: "play",
        setId: play.set.id,
        label,
        repetition: play.repetition,
        bpm: play.bpm,
        meter: play.meter,
        durationSec: play.set.durationSec,
        color: play.set.color,
        setIndex: play.setIndex,
      },
    ]
    const anotherPlayFollows = index < plays.length - 1
    if (anotherPlayFollows && play.set.restSec > 0) {
      segments.push({
        kind: "rest",
        setId: play.set.id,
        label: "Rest",
        repetition: play.repetition,
        bpm: play.bpm,
        meter: play.meter,
        durationSec: play.set.restSec,
        color: "slate",
        setIndex: play.setIndex,
      })
    }
    return segments
  })
}
