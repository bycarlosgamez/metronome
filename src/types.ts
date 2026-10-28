export const METERS = ["3/4", "4/4", "5/4", "6/8", "7/8"] as const
export type Meter = (typeof METERS)[number]

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
  increaseEvery: "time" | "bars"
  everySec: number
  everyBars: number
}

export type Session = {
  name: string
  color: SetColor
  meter: Meter
  bpm: number
  bpmIncrease: number
  every: number
  click: ClickId
  type: "simple" | "complex" | "time"
  simple: SimplePattern
  complex: ComplexPattern
  time: TimePattern
  cycles: Cycle[]
}
