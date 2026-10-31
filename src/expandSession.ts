import { beatsInMeter, clampBpm, sessionTitle, timeSteps } from "./session"
import type { BeatPattern, ClickId, Meter, Session, SetColor } from "./types"

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
  accents?: number[] // accented beat numbers (default [1]); a count-in accents its beat 1 when any beat is accented
  beats?: BeatPattern[] // per-beat clicks for play segments; count-in and rest have none
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
  if (session.practice === "routine") {
    const { unit, playDuration, restDuration, round, set, increase } = session.routine
    const items: Resolved[] = []
    const setPasses   = set.enabled   ? set.count   : 1
    const roundPasses = round.enabled ? round.count : 1
    const barSec = (bars: number, bpm: number) => bars * beatsInMeter(session.meter) * 60 / bpm

    for (let s = 0; s < setPasses; s++) {
      const isLastSet = s === setPasses - 1
      for (let r = 0; r < roundPasses; r++) {
        const isLastRound = r === roundPasses - 1
        const bpm = clampBpm(increase.mode === "round" ? session.bpm + r * increase.roundStep : session.bpm)
        const steps = [{ atSec: 0, bpm }]
        const durationSec = unit === "bars" ? barSec(playDuration, bpm) : playDuration
        // A bars rest is measured at the BPM the play ended on
        const roundRestSec = unit === "bars" ? barSec(restDuration, steps[steps.length - 1].bpm) : restDuration

        let restSec = 0
        let restRole: "after" | "between" | undefined
        if (!isLastRound) {
          restSec = roundRestSec
          restRole = "after"
        } else if (!isLastSet) {
          restSec = roundRestSec + set.restDuration
          restRole = "between"
        }

        items.push({ id: `routine-${s}-${r}`, bpm: steps[0].bpm, durationSec, restSec, restRole, steps })
      }
    }
    return items
  }
  // Steady and Climb: one endless stretch; Climb ramps up to the target and holds there.
  const steps = session.practice === "climb" ? timeSteps(session) : [{ atSec: 0, bpm: session.bpm }]
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
        accents: session.accents,
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
      accents: session.accents,
      beats: session.beats,
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
