export type Meter = string

export const BEATS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16] as const
export const NOTES = [1, 2, 4, 8] as const

export const SUBDIVISIONS = ["quarter", "eighth", "triplet", "sixteenth", "quintuplet", "sextuplet"] as const
export type Subdivision = (typeof SUBDIVISIONS)[number]

export type Slot = ClickId | "off"

export const COLORS = ["red", "orange", "yellow", "green", "blue", "pink"] as const
export type SetColor = (typeof COLORS)[number]

export const CLICKS = ["click-1", "click-2", "click-3", "click-4"] as const
export type ClickId = (typeof CLICKS)[number]

export type Length =
  | { unit: "time"; seconds: number }
  | { unit: "bars"; bars: number }

export type Cycle = {
  id: string
  length: Length
  restSec: number
  bpm?: number
}

export type IncreaseEvery = "interval" | "round"

export type SimplePattern = {
  practices: number
  length: Length
  restAfterSec: number
  stepTempo: boolean
  times: number
  repeatRound: boolean
  rounds: number
  restBetweenSec: number
  increaseEvery: IncreaseEvery
}

export type ComplexPattern = {
  increaseEvery: IncreaseEvery
  repeatRound: boolean
  rounds: number
  restBetweenSec: number
}

export type TimePattern = {
  seconds: number
  targetBpm: number
  increaseEvery: "off" | "bars"
  everySec: number
  everyBars: number
}

export type RoutinePattern = {
  barsPerLevel: number   // bars at each BPM step before advancing
  numLevels: number      // how many BPM steps (1 = no ramp)
  repeatCount: number    // how many times to run the full level sequence
  restAfterSec: number   // rest between levels and between repeats
  loop: boolean          // reserved; not yet implemented
}

export type Session = {
  name: string
  color: SetColor
  meter: Meter
  bpm: number
  bpmIncrease: number
  every: number
  click: ClickId
  subdivision: Subdivision
  slots: Slot[]
  type: "simple" | "complex" | "time"
  simple: SimplePattern
  complex: ComplexPattern
  time: TimePattern
  cycles: Cycle[]
  routineEnabled: boolean      // NEW
  routine: RoutinePattern      // NEW
}
