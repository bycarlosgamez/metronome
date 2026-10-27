import { CLICKS, COLORS, METERS, type ClickId, type Cycle, type Length, type Meter, type Session, type SetColor, type SimplePattern } from "./types"

const integer = (value: number) => Math.round(Number.isFinite(value) ? value : 0)

export function sessionTitle(session: Session): string {
  return session.name.trim() || "Practice"
}

export function clampBpm(bpm: number): number {
  return Math.min(300, Math.max(40, integer(bpm)))
}

export function freshSimple(): SimplePattern {
  return {
    practices: 1,
    length: { unit: "time", seconds: 120 },
    restAfterSec: 30,
    stepTempo: false,
    times: 2,
    repeatRound: false,
    rounds: 2,
    restBetweenSec: 30,
  }
}

export function createDefaultSession(nextId: () => string = () => crypto.randomUUID()): Session {
  return {
    name: "Practice",
    color: "red",
    meter: "4/4",
    bpm: 80,
    bpmIncrease: 0,
    every: 1,
    click: "click-1",
    type: "simple",
    simple: freshSimple(),
    cycles: [{ id: nextId(), length: { unit: "time", seconds: 120 }, restSec: 30 }],
  }
}

export function ladderBpm(bpm: number, increase: number, every: number, index: number): number {
  const step = Math.max(1, integer(every))
  return Math.min(300, clampBpm(bpm) + Math.max(0, integer(increase)) * Math.floor(index / step))
}

export function beatsInMeter(meter: Meter): number {
  return Number(meter.split("/")[0])
}

export function lengthSeconds(length: Length, meter: Meter, bpm: number): number {
  if (length.unit === "time") return Math.max(1, integer(length.seconds))
  return (Math.max(1, integer(length.bars)) * beatsInMeter(meter) * 60) / clampBpm(bpm)
}

function clampLength(length: Length): Length {
  if (!length || length.unit === "bars") {
    const bars = length && length.unit === "bars" ? length.bars : 1
    return { unit: "bars", bars: Math.max(1, integer(bars)) }
  }
  return { unit: "time", seconds: Math.max(1, integer(length.seconds)) }
}

function clampSimple(pattern: SimplePattern | undefined): SimplePattern {
  const base = pattern ?? freshSimple()
  return {
    practices: Math.max(1, integer(base.practices)),
    length: clampLength(base.length),
    restAfterSec: Math.max(0, integer(base.restAfterSec)),
    stepTempo: Boolean(base.stepTempo),
    times: Math.max(1, integer(base.times)),
    repeatRound: Boolean(base.repeatRound),
    rounds: Math.max(1, integer(base.rounds)),
    restBetweenSec: Math.max(0, integer(base.restBetweenSec)),
  }
}

function clampCycle(cycle: Cycle): Cycle {
  const next: Cycle = {
    id: cycle.id || crypto.randomUUID(),
    length: clampLength(cycle.length),
    restSec: Math.max(0, integer(cycle.restSec)),
  }
  if (cycle.bpm !== undefined) next.bpm = clampBpm(cycle.bpm)
  return next
}

export function clampSession(session: Session): Session {
  const fallback = createDefaultSession()
  const cycles = (session.cycles?.length ? session.cycles : fallback.cycles).map(clampCycle)
  return {
    name: session.name ?? "",
    color: COLORS.includes(session.color) ? session.color : "red",
    meter: METERS.includes(session.meter) ? session.meter : "4/4",
    bpm: clampBpm(session.bpm),
    bpmIncrease: Math.max(0, integer(session.bpmIncrease)),
    every: Math.max(1, integer(session.every)),
    click: CLICKS.includes(session.click) ? session.click : "click-1",
    type: session.type === "complex" ? "complex" : "simple",
    simple: clampSimple(session.simple),
    cycles,
  }
}

export function cyclesFromSimple(session: Session, nextId: () => string): Cycle[] {
  const pattern = clampSimple(session.simple)
  const steps = pattern.stepTempo ? pattern.times : 1
  const rounds = pattern.repeatRound ? pattern.rounds : 1
  const cycles: Cycle[] = []
  for (let round = 0; round < rounds; round += 1) {
    for (let step = 0; step < steps; step += 1) {
      for (let practice = 0; practice < pattern.practices; practice += 1) {
        const lastOfRound = step === steps - 1 && practice === pattern.practices - 1
        const lastOfSession = round === rounds - 1 && lastOfRound
        cycles.push({
          id: nextId(),
          length: pattern.length,
          restSec: lastOfSession ? 0 : lastOfRound ? pattern.restBetweenSec : pattern.restAfterSec,
        })
      }
    }
  }
  return cycles
}

type LegacySet = {
  durationSec?: number
  bpm?: number
  restSec?: number
  repeats?: number
  color?: SetColor
  meter?: Meter
}

type LegacySession = {
  name?: string
  meter?: Meter
  bpmIncrease?: number
  click?: ClickId
  sets?: LegacySet[]
}

export function migrateLegacy(raw: unknown, nextId: () => string = () => crypto.randomUUID()): Session | null {
  if (!raw || typeof raw !== "object" || !Array.isArray((raw as LegacySession).sets)) return null
  const legacy = raw as LegacySession
  const sets = legacy.sets ?? []
  if (sets.length === 0) return null
  const increase = Math.max(0, integer(legacy.bpmIncrease ?? 0))
  const plays = sets.flatMap((set) => {
    const repeats = Math.max(1, integer(set.repeats ?? 1))
    return Array.from({ length: repeats }, (_, index) => ({
      seconds: Math.max(1, integer(set.durationSec ?? 1)),
      bpm: Math.min(300, clampBpm(set.bpm ?? 80) + index * increase),
      restSec: Math.max(0, integer(set.restSec ?? 0)),
      color: set.color,
    }))
  })
  plays[plays.length - 1].restSec = 0
  const firstBpm = plays[0].bpm
  return clampSession({
    name: legacy.name ?? "",
    color: COLORS.includes(sets[0].color as SetColor) ? (sets[0].color as SetColor) : "red",
    meter: METERS.includes(legacy.meter as Meter) ? (legacy.meter as Meter) : "4/4",
    bpm: firstBpm,
    bpmIncrease: 0,
    every: 1,
    click: CLICKS.includes(legacy.click as ClickId) ? (legacy.click as ClickId) : "click-1",
    type: "complex",
    simple: freshSimple(),
    cycles: plays.map((play) => ({
      id: nextId(),
      length: { unit: "time", seconds: play.seconds },
      restSec: play.restSec,
      ...(play.bpm === firstBpm ? {} : { bpm: play.bpm }),
    })),
  })
}

export function isClickId(value: string): value is ClickId {
  return (CLICKS as readonly string[]).includes(value)
}
