export const METERS = ["3/4", "4/4", "5/4", "6/8", "7/8"] as const
export type Meter = (typeof METERS)[number]

export const COLORS = ["red", "orange", "yellow", "green", "blue", "pink"] as const
export type SetColor = (typeof COLORS)[number]

export const CLICKS = ["click-1", "click-2", "click-3", "click-4"] as const
export type ClickId = (typeof CLICKS)[number]

export type PracticeSet = {
  id: string
  name: string
  durationSec: number
  bpm: number
  restSec: number
  repeats: number
  color: SetColor
  meter: Meter
}

export type Session = {
  name: string
  meter: Meter
  perSetMeter: boolean
  bpmIncrease: number
  click: ClickId
  sets: PracticeSet[]
}
