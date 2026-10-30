import { describe, expect, it } from "vitest"
import { carryClimbPosition, climbProgress } from "./climb"

const s = (atSec: number, bpm: number) => ({ atSec, bpm })

describe("climbProgress", () => {
  it("finds the step, the time to the next one and how far through it you are", () => {
    expect(climbProgress([s(0, 110), s(120, 115), s(240, 120)], 150)).toEqual({ index: 1, nextInSec: 90, fraction: 0.25 })
  })

  it("on the last step there is no next step", () => {
    expect(climbProgress([s(0, 110), s(120, 115), s(240, 120)], 300)).toEqual({ index: 2, nextInSec: Infinity, fraction: 0 })
  })
})

describe("carryClimbPosition", () => {
  it("keeps the step and the fraction through it when the windows change", () => {
    expect(carryClimbPosition([s(0, 110), s(120, 115), s(240, 120)], 150, [s(0, 110), s(60, 115), s(120, 120)])).toBe(75)
  })

  it("moves to the target hold when the target drops below the current step", () => {
    const old = [s(0, 100), s(60, 105), s(120, 110), s(180, 115)]
    expect(carryClimbPosition(old, 150, [s(0, 100), s(60, 105)])).toBe(60)
  })

  it("keeps the time already held at the target", () => {
    expect(carryClimbPosition([s(0, 110), s(120, 115), s(240, 120)], 300, [s(0, 110), s(60, 115), s(120, 120)])).toBe(180)
  })

  it("starts the single step when Start reaches Target", () => {
    expect(carryClimbPosition([s(0, 110), s(120, 115), s(240, 120)], 30, [s(0, 130)])).toBe(0)
  })
})
