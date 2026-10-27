import { ladderBpm, lengthSeconds, sessionTitle, simplePlayedBpm } from "./session"
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
  cycleIndex: number
  restRole?: "after" | "between"
}

type Resolved = {
  id: string
  bpm: number
  durationSec: number
  restSec: number
  restRole?: "after" | "between"
}

function resolved(session: Session): Resolved[] {
  if (session.type === "complex") {
    return session.cycles.map((cycle, index) => {
      const bpm = cycle.bpm ?? ladderBpm(session.bpm, session.bpmIncrease, session.every, index)
      return { id: cycle.id, bpm, durationSec: lengthSeconds(cycle.length, session.meter, bpm), restSec: cycle.restSec }
    })
  }
  const steps = session.simple.stepTempo ? session.simple.times : 1
  const rounds = session.simple.repeatRound ? session.simple.rounds : 1
  const items: Resolved[] = []
  for (let round = 0; round < rounds; round += 1) {
    for (let step = 0; step < steps; step += 1) {
      for (let practice = 0; practice < session.simple.practices; practice += 1) {
        const index = items.length
        const bpm = simplePlayedBpm(
          session.bpm,
          session.bpmIncrease,
          session.simple.increaseEvery,
          round,
          step,
        )
        const lastOfRound = step === steps - 1 && practice === session.simple.practices - 1
        const lastOfSession = round === rounds - 1 && lastOfRound
        items.push({
          id: `simple-${index}`,
          bpm,
          durationSec: lengthSeconds(session.simple.length, session.meter, bpm),
          restSec: lastOfSession ? 0 : lastOfRound ? session.simple.restBetweenSec : session.simple.restAfterSec,
          restRole: lastOfSession ? undefined : lastOfRound ? "between" : "after",
        })
      }
    }
  }
  return items
}

export function expandSession(session: Session): Segment[] {
  const label = sessionTitle(session)
  const plays = resolved(session)
  return plays.flatMap((play, index) => {
    const segments: Segment[] = [
      {
        kind: "count-in",
        setId: play.id,
        label,
        repetition: index + 1,
        bpm: play.bpm,
        meter: "4/4",
        durationSec: (4 * 60) / play.bpm,
        color: session.color,
        setIndex: index,
        cycleIndex: index,
      },
      {
        kind: "play",
        setId: play.id,
        label,
        repetition: index + 1,
        bpm: play.bpm,
        meter: session.meter,
        durationSec: play.durationSec,
        color: session.color,
        setIndex: index,
        cycleIndex: index,
      },
    ]
    if (index < plays.length - 1 && play.restSec > 0) {
      segments.push({
        kind: "rest",
        setId: play.id,
        label: "Rest",
        repetition: index + 1,
        bpm: play.bpm,
        meter: session.meter,
        durationSec: play.restSec,
        color: "slate",
        setIndex: index,
        cycleIndex: index,
        restRole: play.restRole,
      })
    }
    return segments
  })
}
