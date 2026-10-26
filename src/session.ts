import {
  CLICKS,
  COLORS,
  METERS,
  type ClickId,
  type Meter,
  type PracticeSet,
  type Session,
  type SetColor,
} from "./types"

const integer = (value: number) => Math.round(Number.isFinite(value) ? value : 0)

export function sessionTitle(session: Session): string {
  return session.name.trim() || "Practice"
}

export function setTitle(set: PracticeSet): string {
  return set.name.trim() || "Set"
}

export function clampBpm(bpm: number): number {
  return Math.min(300, Math.max(40, integer(bpm)))
}

export function clampSession(session: Session): Session {
  const sets = (session.sets.length > 0 ? session.sets : createDefaultSession().sets).map(clampSet)
  return {
    name: session.name ?? "",
    meter: METERS.includes(session.meter) ? session.meter : "4/4",
    perSetMeter: Boolean(session.perSetMeter),
    bpmIncrease: Math.max(0, integer(session.bpmIncrease)),
    click: CLICKS.includes(session.click) ? session.click : "click-1",
    sets,
  }
}

function clampSet(set: PracticeSet): PracticeSet {
  return {
    id: set.id || crypto.randomUUID(),
    name: set.name ?? "",
    durationSec: Math.max(1, integer(set.durationSec)),
    bpm: clampBpm(set.bpm),
    restSec: Math.max(0, integer(set.restSec)),
    repeats: Math.max(1, integer(set.repeats)),
    color: COLORS.includes(set.color) ? set.color : "red",
    meter: METERS.includes(set.meter) ? set.meter : "4/4",
  }
}

export function createDefaultSession(nextId: () => string = () => crypto.randomUUID()): Session {
  return {
    name: "Practice",
    meter: "4/4",
    perSetMeter: false,
    bpmIncrease: 0,
    click: "click-1",
    sets: [
      {
        id: nextId(),
        name: "Set 1",
        durationSec: 120,
        bpm: 80,
        restSec: 30,
        repeats: 1,
        color: "red",
        meter: "4/4",
      },
    ],
  }
}

export function createSetAfter(previous: PracticeSet, position: number, id: string): PracticeSet {
  const colorIndex = (COLORS.indexOf(previous.color) + 1) % COLORS.length
  return {
    id,
    name: `Set ${position}`,
    durationSec: 60,
    bpm: previous.bpm,
    restSec: previous.restSec,
    repeats: 1,
    color: COLORS[colorIndex] as SetColor,
    meter: previous.meter,
  }
}

export function beatsInMeter(meter: Meter): number {
  return Number(meter.split("/")[0])
}

export function isClickId(value: string): value is ClickId {
  return (CLICKS as readonly string[]).includes(value)
}
