import { describe, expect, it } from "vitest"
import {
  clampSession,
  createDefaultSession,
  cyclesFromSimple,
  freshSimple,
  ladderBpm,
  lengthSeconds,
  migrateLegacy,
  sessionTitle,
} from "./session"

describe("session", () => {
  it("builds the first-visit session", () => {
    expect(createDefaultSession(() => "cycle-1")).toEqual({
      name: "Practice",
      color: "red",
      meter: "4/4",
      bpm: 80,
      bpmIncrease: 0,
      every: 1,
      click: "click-1",
      type: "simple",
      simple: freshSimple(),
      cycles: [{ id: "cycle-1", length: { unit: "time", seconds: 120 }, restSec: 30 }],
    })
    expect(freshSimple()).toEqual({
      practices: 1,
      length: { unit: "time", seconds: 120 },
      restAfterSec: 30,
      stepTempo: false,
      times: 2,
      repeatRound: false,
      rounds: 2,
      restBetweenSec: 30,
    })
  })

  it("shows Practice for a blank name", () => {
    const session = createDefaultSession(() => "cycle-1")
    session.name = "  "
    expect(sessionTitle(session)).toBe("Practice")
  })

  it("snaps fields to the allowed range", () => {
    const session = createDefaultSession(() => "cycle-1")
    session.bpm = 12
    session.bpmIncrease = -4
    session.every = 0
    session.simple.practices = 0
    session.simple.times = 0
    session.simple.rounds = 0
    session.simple.restAfterSec = -2
    session.simple.length = { unit: "time", seconds: 0 }
    session.cycles[0].restSec = -3
    session.cycles[0].length = { unit: "bars", bars: 0 }
    const clamped = clampSession(session)
    expect(clamped.bpm).toBe(40)
    expect(clamped.bpmIncrease).toBe(0)
    expect(clamped.every).toBe(1)
    expect(clamped.simple.practices).toBe(1)
    expect(clamped.simple.times).toBe(1)
    expect(clamped.simple.rounds).toBe(1)
    expect(clamped.simple.restAfterSec).toBe(0)
    expect(clamped.simple.length).toEqual({ unit: "time", seconds: 1 })
    expect(clamped.cycles[0].restSec).toBe(0)
    expect(clamped.cycles[0].length).toEqual({ unit: "bars", bars: 1 })
  })

  it("caps bpm at 300", () => {
    const session = createDefaultSession(() => "cycle-1")
    session.bpm = 900
    expect(clampSession(session).bpm).toBe(300)
    expect(ladderBpm(290, 20, 1, 2)).toBe(300)
  })

  it("turns bars into seconds from the meter and the played tempo", () => {
    expect(lengthSeconds({ unit: "bars", bars: 8 }, "4/4", 80)).toBe(24)
    expect(lengthSeconds({ unit: "bars", bars: 8 }, "4/4", 85)).toBeLessThan(24)
    expect(lengthSeconds({ unit: "time", seconds: 30 }, "4/4", 85)).toBe(30)
  })

  it("writes the simple pattern out as cycles and keeps the final rest off", () => {
    const session = createDefaultSession(() => "cycle-1")
    session.bpmIncrease = 5
    session.simple = {
      practices: 3,
      length: { unit: "bars", bars: 8 },
      restAfterSec: 5,
      stepTempo: true,
      times: 3,
      repeatRound: true,
      rounds: 3,
      restBetweenSec: 60,
    }
    const cycles = cyclesFromSimple(session, () => "id")
    expect(cycles).toHaveLength(27)
    expect(cycles[0].length).toEqual({ unit: "bars", bars: 8 })
    expect(cycles[0].restSec).toBe(5)
    expect(cycles[8].restSec).toBe(60)
    expect(cycles[26].restSec).toBe(0)
    expect(cycles.every((cycle) => cycle.bpm === undefined)).toBe(true)
  })

  it("migrates one old set to one cycle at the same tempo", () => {
    const migrated = migrateLegacy({
      name: "Practice",
      meter: "4/4",
      perSetMeter: false,
      bpmIncrease: 0,
      click: "click-1",
      sets: [{ id: "set-1", name: "Set 1", durationSec: 120, bpm: 80, restSec: 30, repeats: 1, color: "red", meter: "4/4" }],
    }, () => "cycle-1")
    expect(migrated).toMatchObject({
      type: "complex",
      bpm: 80,
      bpmIncrease: 0,
      every: 1,
      color: "red",
      cycles: [{ id: "cycle-1", length: { unit: "time", seconds: 120 }, restSec: 0 }],
    })
  })

  it("keeps a later old repetition's own tempo", () => {
    const migrated = migrateLegacy({
      name: "Scales",
      meter: "4/4",
      perSetMeter: true,
      bpmIncrease: 5,
      click: "click-2",
      sets: [
        { id: "a", name: "Scales", durationSec: 120, bpm: 80, restSec: 30, repeats: 3, color: "blue", meter: "6/8" },
        { id: "b", name: "Piece", durationSec: 60, bpm: 100, restSec: 20, repeats: 1, color: "green", meter: "3/4" },
      ],
    }, () => "cycle")
    expect(migrated?.cycles.map((cycle) => cycle.bpm ?? migrated.bpm)).toEqual([80, 85, 90, 100])
    expect(migrated?.cycles.map((cycle) => cycle.restSec)).toEqual([30, 30, 30, 0])
    expect(migrated?.meter).toBe("4/4")
    expect(migrated?.color).toBe("blue")
    expect(migrated?.click).toBe("click-2")
  })
})
