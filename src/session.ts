import { BEATS, CLICKS, COLORS, NOTES, SUBDIVISIONS, type BeatPattern, type ClickId, type ComplexPattern, type Cycle, type IncreaseEvery, type Length, type Meter, type RepeatLevel, type RoutineIncrease, type RoutinePattern, type Session, type SetColor, type SimplePattern, type Slot, type Subdivision, type TimePattern } from "./types"

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
    increaseEvery: "interval",
  }
}

export function freshComplex(): ComplexPattern {
  return {
    increaseEvery: "interval",
    repeatRound: false,
    rounds: 2,
    restBetweenSec: 30,
  }
}

export function freshTime(): TimePattern {
  return {
    seconds: 120,
    targetBpm: 120,
    increaseEvery: "off",
    everySec: 30,
    everyBars: 4,
  }
}

export function freshRoutine(): RoutinePattern {
  return {
    unit: "bars",
    playDuration: 4,
    restDuration: 0,
    round:  { enabled: false, count: 4, restDuration: 0 },
    set:    { enabled: false, count: 3, restDuration: 30 },
    increase: { mode: "off", step: 5, nextSet: "reset", raiseBy: 2, targetBpm: 120, every: 4 },
  }
}

function clampIncrease(increase: unknown): RoutineIncrease {
  const fresh = freshRoutine().increase
  const base = (increase && typeof increase === "object" ? increase : {}) as Partial<RoutineIncrease>
  const MODES = ["off", "round", "target"] as const
  const NEXT = ["reset", "keep", "raise"] as const
  return {
    mode: MODES.includes(base.mode as RoutineIncrease["mode"]) ? base.mode as RoutineIncrease["mode"] : fresh.mode,
    step: Math.max(0, integer(base.step ?? fresh.step)),
    nextSet: NEXT.includes(base.nextSet as RoutineIncrease["nextSet"]) ? base.nextSet as RoutineIncrease["nextSet"] : fresh.nextSet,
    raiseBy: Math.max(0, integer(base.raiseBy ?? fresh.raiseBy)),
    targetBpm: clampBpm(base.targetBpm ?? fresh.targetBpm),
    every: Math.max(1, integer(base.every ?? fresh.every)),
  }
}

// Saved routines from before routine.increase existed used bpmIncreaseAt + session.bpmIncrease.
function legacyIncrease(bpmIncreaseAt: unknown, legacyStep: number): RoutineIncrease {
  const fresh = freshRoutine().increase
  if (bpmIncreaseAt === "round") return { ...fresh, mode: "round", step: legacyStep, nextSet: "keep" }
  if (bpmIncreaseAt === "set") return { ...fresh, mode: "round", step: 0, nextSet: "raise", raiseBy: legacyStep }
  return fresh
}

function clampRepeatLevel(level: unknown, defaults: RepeatLevel): RepeatLevel {
  const base = (level && typeof level === "object" ? level : {}) as Partial<RepeatLevel>
  return {
    enabled: Boolean(base.enabled),
    count: Math.max(2, integer(base.count ?? defaults.count)),
    restDuration: Math.max(0, integer(base.restDuration ?? defaults.restDuration)),
  }
}

function clampRoutine(pattern: unknown, legacyStep: number): RoutinePattern {
  const fresh = freshRoutine()
  // Older saves may still carry block / bpmIncreaseAt; block is dropped, bpmIncreaseAt seeds the increase.
  const base = (pattern && typeof pattern === "object" ? pattern : {}) as Partial<RoutinePattern> & { bpmIncreaseAt?: unknown }
  return {
    unit: base.unit === "sec" ? "sec" : "bars",
    playDuration: Math.max(1, integer(base.playDuration ?? fresh.playDuration)),
    restDuration: Math.max(0, integer(base.restDuration ?? fresh.restDuration)),
    round:  clampRepeatLevel(base.round,  fresh.round),
    set:    clampRepeatLevel(base.set,    fresh.set),
    increase: base.increase && typeof base.increase === "object"
      ? clampIncrease(base.increase)
      : legacyIncrease(base.bpmIncreaseAt, Math.max(0, integer(legacyStep))),
  }
}

function clampTime(pattern: TimePattern | undefined): TimePattern {
  const base = pattern ?? freshTime()
  return {
    seconds: Math.max(1, integer(base.seconds)),
    targetBpm: clampBpm(base.targetBpm ?? 120),
    increaseEvery: base.increaseEvery === "bars" ? "bars" : base.increaseEvery === ("time" as string) ? "bars" : "off",
    everySec: Math.max(1, integer(base.everySec)),
    everyBars: Math.max(1, integer(base.everyBars)),
  }
}

export function timeSteps(session: Session): { atSec: number; bpm: number }[] {
  const pattern = clampTime(session.time)
  const startBpm = clampBpm(session.bpm)
  const targetBpm = pattern.targetBpm
  const increase = Math.max(0, integer(session.bpmIncrease))
  if (increase === 0 || startBpm >= targetBpm) {
    return [{ atSec: 0, bpm: startBpm }]
  }
  const steps: { atSec: number; bpm: number }[] = []
  let at = 0
  let index = 0
  while (true) {
    const bpm = Math.min(targetBpm, startBpm + increase * index)
    steps.push({ atSec: at, bpm })
    if (bpm >= targetBpm) break
    const window = pattern.everyBars * beatsInMeter(session.meter) * 60 / bpm
    if (!(window > 0)) break
    at += window
    index += 1
  }
  return steps
}

// One To target play: Start, Start+step, … capped at the target; each BPM lasts one window, the target included.
export function routineClimb(session: Session): { steps: { atSec: number; bpm: number }[]; durationSec: number } {
  const { unit, increase } = session.routine
  const start = clampBpm(session.bpm)
  const target = clampBpm(increase.targetBpm)
  const step = Math.max(0, integer(increase.step))
  const every = Math.max(1, integer(increase.every))
  const windowSec = (bpm: number) => unit === "sec" ? every : every * beatsInMeter(session.meter) * 60 / bpm
  const steps: { atSec: number; bpm: number }[] = []
  let at = 0
  let bpm = start
  while (true) {
    steps.push({ atSec: at, bpm })
    at += windowSec(bpm)
    if (step === 0 || bpm >= target) break
    bpm = Math.min(target, bpm + step)
  }
  return { steps, durationSec: at }
}

export function timeDurationSec(session: Session): number {
  const pattern = clampTime(session.time)
  if (pattern.increaseEvery === "off") return Number.POSITIVE_INFINITY
  const steps = timeSteps(session)
  const lastStep = steps[steps.length - 1]
  const window = pattern.everyBars * beatsInMeter(session.meter) * 60 / lastStep.bpm
  return Math.max(1, Math.round(lastStep.atSec + window))
}

function clampComplex(pattern: ComplexPattern | undefined): ComplexPattern {
  const base = pattern ?? freshComplex()
  return {
    increaseEvery: base.increaseEvery === "round" ? "round" : "interval",
    repeatRound: Boolean(base.repeatRound),
    rounds: Math.max(1, integer(base.rounds)),
    restBetweenSec: Math.max(0, integer(base.restBetweenSec)),
  }
}

export function cycleGroupFromSimple(session: Session, nextId: () => string): Cycle[] {
  const pattern = clampSimple(session.simple)
  const steps = pattern.stepTempo ? pattern.times : 1
  const cycles: Cycle[] = []
  for (let step = 0; step < steps; step += 1) {
    for (let practice = 0; practice < pattern.practices; practice += 1) {
      cycles.push({
        id: nextId(),
        length: { ...pattern.length },
        restSec: pattern.restAfterSec,
      })
    }
  }
  return cycles
}

export function simplePlayedBpm(
  bpm: number,
  increase: number,
  increaseEvery: IncreaseEvery,
  round: number,
  interval: number,
): number {
  const step = increaseEvery === "round" ? round : interval
  return Math.min(300, clampBpm(bpm) + Math.max(0, integer(increase)) * Math.max(0, integer(step)))
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
    beats: Array.from({ length: 4 }, () => ({ subdivision: "quarter" as const, slots: ["click-1" as const] })),
    type: "simple",
    simple: freshSimple(),
    complex: freshComplex(),
    time: freshTime(),
    cycles: [{ id: nextId(), length: { unit: "time", seconds: 120 }, restSec: 30 }],
    routineEnabled: false,
    routine: freshRoutine(),
    countIn: false,
    accent: true,
  }
}

export function ladderBpm(bpm: number, increase: number, every: number, index: number): number {
  const step = Math.max(1, integer(every))
  return Math.min(300, clampBpm(bpm) + Math.max(0, integer(increase)) * Math.floor(index / step))
}

export const SUBDIVISION_SLOTS: Record<Subdivision, number> = {
  quarter: 1,
  eighth: 2,
  triplet: 3,
  sixteenth: 4,
  quintuplet: 5,
  sextuplet: 6,
}

export function clampMeter(meter: string | undefined): Meter {
  const [beats, note] = (meter ?? "").split("/")
  const top = Number(beats)
  const bottom = Number(note)
  if (!BEATS.includes(top as (typeof BEATS)[number])) return "4/4"
  if (!NOTES.includes(bottom as (typeof NOTES)[number])) return "4/4"
  return `${top}/${bottom}`
}

function clampSlot(value: unknown, fallback: ClickId): Slot {
  if (value === "off") return "off"
  return CLICKS.includes(value as ClickId) ? value as ClickId : fallback
}

export function clampSlots(subdivision: Subdivision, slots: unknown, click: ClickId): Slot[] {
  const list = Array.isArray(slots) ? slots : []
  return Array.from({ length: SUBDIVISION_SLOTS[subdivision] }, (_, index) => clampSlot(list[index], click))
}

function clampSubdivision(value: unknown): Subdivision {
  return SUBDIVISIONS.includes(value as Subdivision) ? value as Subdivision : "quarter"
}

function clampBeat(beat: unknown, click: ClickId): BeatPattern {
  const base = (beat && typeof beat === "object" ? beat : {}) as Partial<BeatPattern>
  const subdivision = clampSubdivision(base.subdivision)
  return { subdivision, slots: clampSlots(subdivision, base.slots, click) }
}

// One pattern per beat of the meter. Saved sessions from before per-beat subdivision
// carry a single subdivision + slots, which every beat takes. Extra beats copy the last one.
function clampBeats(session: Session, meter: Meter, click: ClickId): BeatPattern[] {
  const legacy = session as unknown as { subdivision?: unknown; slots?: unknown }
  const saved = Array.isArray(session.beats) && session.beats.length
    ? session.beats.map((beat) => clampBeat(beat, click))
    : [clampBeat({ subdivision: legacy.subdivision, slots: legacy.slots }, click)]
  return Array.from({ length: beatsInMeter(meter) }, (_, index) => {
    const beat = saved[Math.min(index, saved.length - 1)]
    return { subdivision: beat.subdivision, slots: [...beat.slots] }
  })
}

export function sharedSubdivision(beats: BeatPattern[]): Subdivision | null {
  const first = beats[0]?.subdivision
  return first && beats.every((beat) => beat.subdivision === first) ? first : null
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
    increaseEvery: base.increaseEvery === "round" ? "round" : "interval",
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
  const click = CLICKS.includes(session.click) ? session.click : "click-1"
  const meter = clampMeter(session.meter)

  // Migrate legacy time sessions → simple + routineEnabled
  let type: Session["type"] = session.type === "complex" ? "complex" : "simple"
  let routineEnabled = Boolean(session.routineEnabled)
  let routine = clampRoutine(session.routine as unknown, session.bpmIncrease)

  if (session.type === "time") {
    type = "simple"
    routineEnabled = true
    const everyBars = Math.max(1, integer(session.time?.everyBars ?? 4))
    const startBpm = clampBpm(session.bpm)
    const targetBpm = clampBpm(session.time?.targetBpm ?? 120)
    const step = Math.max(0, integer(session.bpmIncrease))
    const fresh = freshRoutine()
    routine = clampRoutine({
      ...fresh,
      unit: "bars",
      playDuration: everyBars,
      increase: {
        ...fresh.increase,
        mode: step > 0 && targetBpm > startBpm ? "target" : "off",
        step,
        targetBpm,
        every: everyBars,
      },
    }, step)
  }

  return {
    name: session.name ?? "",
    color: COLORS.includes(session.color) ? session.color : "red",
    meter,
    bpm: clampBpm(session.bpm),
    bpmIncrease: Math.max(0, integer(session.bpmIncrease)),
    every: Math.max(1, integer(session.every)),
    click,
    beats: clampBeats(session, meter, click),
    type,
    simple: clampSimple(session.simple),
    complex: clampComplex(session.complex),
    time: clampTime(session.time),
    cycles,
    routineEnabled,
    routine,
    countIn: Boolean(session.countIn ?? false),
    accent: session.accent !== false,
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
        const index = cycles.length
        const played = simplePlayedBpm(session.bpm, session.bpmIncrease, pattern.increaseEvery, round, step)
        const ladder = ladderBpm(session.bpm, session.bpmIncrease, pattern.practices, index)
        const cycle: Cycle = {
          id: nextId(),
          length: pattern.length,
          restSec: lastOfSession ? 0 : lastOfRound ? pattern.restBetweenSec : pattern.restAfterSec,
        }
        if (played !== ladder) cycle.bpm = played
        cycles.push(cycle)
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
  countIn?: boolean
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
  const click = CLICKS.includes(legacy.click as ClickId) ? (legacy.click as ClickId) : "click-1"
  return clampSession({
    name: legacy.name ?? "",
    color: COLORS.includes(sets[0].color as SetColor) ? (sets[0].color as SetColor) : "red",
    meter: clampMeter(legacy.meter),
    bpm: firstBpm,
    bpmIncrease: 0,
    every: 1,
    click,
    beats: [{ subdivision: "quarter", slots: [click] }],
    type: "complex",
    simple: freshSimple(),
    complex: freshComplex(),
    time: freshTime(),
    cycles: plays.map((play) => ({
      id: nextId(),
      length: { unit: "time", seconds: play.seconds },
      restSec: play.restSec,
      ...(play.bpm === firstBpm ? {} : { bpm: play.bpm }),
    })),
    routineEnabled: false,
    routine: freshRoutine(),
    countIn: Boolean(legacy.countIn ?? false),
    accent: true,
  })
}

export function isClickId(value: string): value is ClickId {
  return (CLICKS as readonly string[]).includes(value)
}
