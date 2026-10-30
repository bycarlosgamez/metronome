export type Meter = string

export const BEATS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16] as const
export const NOTES = [1, 2, 4, 8] as const

export const SUBDIVISIONS = ["quarter", "eighth", "triplet", "sixteenth", "quintuplet", "sextuplet"] as const
export type Subdivision = (typeof SUBDIVISIONS)[number]

export type Slot = ClickId | "off"

export type BeatPattern = {
  subdivision: Subdivision
  slots: Slot[] // one entry per click in the beat; "off" is muted
}

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

export type RepeatLevel = {
  enabled: boolean
  count: number        // number of repetitions (min 2)
  restDuration: number // rest before next repetition, always seconds
}

export type RoutineIncrease = {
  mode: "off" | "round" | "target"
  step: number                          // BPM added per window (target)
  targetBpm: number
  every: number                         // target window: bars when unit is "bars", seconds when "sec"
  roundStep: number                     // BPM added each round (round); every set starts back at Start
}

export type RoutinePattern = {
  unit: "bars" | "sec"   // applies to playDuration and restDuration only; "sec" is shown as Time
  playDuration: number   // one round's play duration (bars, or seconds when unit is "sec")
  restDuration: number   // one round's rest duration (bars, or seconds when unit is "sec")
  round: RepeatLevel     // repeat the round (play + rest)
  set: RepeatLevel       // repeat the full round sequence
  increase: RoutineIncrease
}

export type Session = {
  name: string
  color: SetColor
  meter: Meter
  bpm: number
  bpmIncrease: number
  every: number
  click: ClickId
  beats: BeatPattern[] // one entry per beat of the session meter
  type: "simple" | "complex" | "time"
  simple: SimplePattern
  complex: ComplexPattern
  time: TimePattern
  cycles: Cycle[]
  routineEnabled: boolean      // NEW
  routine: RoutinePattern      // NEW
  countIn: boolean
  accent: boolean // beat 1 plays the accent tone
}
