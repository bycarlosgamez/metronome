import { beatsInMeter, clampBpm, sessionTitle, timeSteps } from "./session"
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
    const { unit, playDuration, restDuration, round, set, block, bpmIncreaseAt } = session.routine
    const items: Resolved[] = []
    const blockPasses = block.enabled ? block.count : 1
    const setPasses   = set.enabled   ? set.count   : 1
    const roundPasses = round.enabled ? round.count  : 1
    let crossings = 0

    for (let b = 0; b < blockPasses; b++) {
      const isLastBlock = b === blockPasses - 1
      for (let s = 0; s < setPasses; s++) {
        const isLastSet = s === setPasses - 1
        for (let r = 0; r < roundPasses; r++) {
          const isLastRound = r === roundPasses - 1
          const isLast = isLastRound && isLastSet && isLastBlock
          const bpm = clampBpm(session.bpm + crossings * session.bpmIncrease)
          const durationSec = unit === "bars"
            ? playDuration * beatsInMeter(session.meter) * 60 / bpm
            : playDuration
          const roundRestSec = unit === "bars"
            ? restDuration * beatsInMeter(session.meter) * 60 / bpm
            : restDuration

          let restSec = 0
          let restRole: "after" | "between" | undefined
          if (!isLast) {
            if (!isLastRound) {
              restSec = roundRestSec
              restRole = "after"
            } else if (!isLastSet) {
              restSec = roundRestSec + set.restDuration
              restRole = "between"
            } else {
              restSec = roundRestSec + block.restDuration
              restRole = "between"
            }
          }

          items.push({
            id: `routine-${b}-${s}-${r}`,
            bpm,
            durationSec,
            restSec,
            restRole,
            steps: [{ atSec: 0, bpm }],
          })

          if (bpmIncreaseAt === "round") crossings++
        }
        if (bpmIncreaseAt === "set") crossings++
      }
      if (bpmIncreaseAt === "block") crossings++
    }
    return items
  }
  // Simple mode: one endless stretch; an active increase ramps up to the target and holds there.
  const steps = session.time.increaseEvery === "off" ? [{ atSec: 0, bpm: session.bpm }] : timeSteps(session)
  return [{
    id: "simple",
    bpm: steps[0].bpm,
    durationSec: Number.POSITIVE_INFINITY,
    restSec: 0,
    steps,
  }]
}

export function expandSession(session: Session): Segment[] {
  const label = sessionTitle(session)
  const plays = resolved(session)
  return plays.flatMap((play, index) => {
    const segments: Segment[] = []
    const addCountIn = session.countIn && index === 0
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
