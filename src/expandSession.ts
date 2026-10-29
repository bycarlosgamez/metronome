import { beatsInMeter, clampBpm, lengthSeconds, sessionTitle, simplePlayedBpm, timeDurationSec, timeSteps } from "./session"
import type { ClickId, Meter, Session, SetColor, Slot } from "./types"

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
  click: ClickId
  slots?: Slot[]
  restRole?: "after" | "between"
  steps?: { atSec: number; bpm: number }[]
}

type Resolved = {
  id: string
  bpm: number
  durationSec: number
  restSec: number
  restRole?: "after" | "between"
  steps?: { atSec: number; bpm: number }[]
}

function resolved(session: Session): Resolved[] {
  if (session.routineEnabled) {
    const { barsPerLevel, numLevels, repeatCount, restAfterSec } = session.routine
    const items: Resolved[] = []
    for (let repeat = 0; repeat < repeatCount; repeat++) {
      for (let level = 0; level < numLevels; level++) {
        const bpm = clampBpm(session.bpm + level * session.bpmIncrease)
        const durationSec = barsPerLevel * beatsInMeter(session.meter) * 60 / bpm
        const isLast = repeat === repeatCount - 1 && level === numLevels - 1
        items.push({
          id: `routine-${repeat}-${level}`,
          bpm,
          durationSec,
          restSec: isLast ? 0 : restAfterSec,
          restRole: isLast ? undefined : "after",
          steps: [{ atSec: 0, bpm }],
        })
      }
    }
    return items
  }
  if (session.type === "time") {
    const steps = timeSteps(session)
    return [{
      id: "time",
      bpm: steps[0]?.bpm ?? session.bpm,
      durationSec: timeDurationSec(session),
      restSec: 0,
      steps,
    }]
  }
  if (session.type === "complex") {
    const pattern = session.complex
    const rounds = pattern.repeatRound ? pattern.rounds : 1
    const items: Resolved[] = []
    for (let round = 0; round < rounds; round += 1) {
      session.cycles.forEach((cycle, index) => {
        const lastOfRound = index === session.cycles.length - 1
        const lastOfSession = round === rounds - 1 && lastOfRound
        const bpm = cycle.bpm ?? simplePlayedBpm(session.bpm, session.bpmIncrease, pattern.increaseEvery, round, index)
        items.push({
          id: cycle.id,
          bpm,
          durationSec: lengthSeconds(cycle.length, session.meter, bpm),
          restSec: lastOfSession ? 0 : lastOfRound ? pattern.restBetweenSec : cycle.restSec,
          restRole: lastOfSession ? undefined : lastOfRound ? "between" : "after",
        })
      })
    }
    return items
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
    const segments: Segment[] = []
    const addCountIn = session.routineEnabled ? index === 0 : session.type !== "time"
    if (addCountIn) {
      segments.push({
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
        click: session.click,
      })
    }
    segments.push({
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
      click: session.click,
      slots: session.slots,
      ...(play.steps ? { steps: play.steps } : {}),
    })
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
        click: session.click,
        restRole: play.restRole,
      })
    }
    return segments
  })
}
