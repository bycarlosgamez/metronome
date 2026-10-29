import { describe, expect, it } from "vitest"
import {
  clampSession,
  createDefaultSession,
  cycleGroupFromSimple,
  cyclesFromSimple,
  freshComplex,
  freshRoutine,
  freshSimple,
  freshTime,
  ladderBpm,
  lengthSeconds,
  migrateLegacy,
  sessionTitle,
  simplePlayedBpm,
  timeDurationSec,
  timeSteps,
} from "./session"
import type { Session } from "./types"

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
      subdivision: "quarter",
      slots: ["click-1"],
      type: "simple",
      simple: freshSimple(),
      complex: freshComplex(),
      time: freshTime(),
      cycles: [{ id: "cycle-1", length: { unit: "time", seconds: 120 }, restSec: 30 }],
      routineEnabled: false,
      routine: freshRoutine(),
    })
    // freshSimple / freshTime assertions stay unchanged
    expect(freshSimple()).toEqual({
      practices: 1,
      length: { unit: "time", seconds: 120 },
      restAfterSec: 30,
      stepTempo: false,
      times: 2,
      repeatRound: false,
      rounds: 2,
      restBetweenSec: 30,
      increaseEvery: "interval",
    })
    expect(freshTime()).toEqual({
      seconds: 120,
      targetBpm: 120,
      increaseEvery: "off",
      everySec: 30,
      everyBars: 4,
    })
  })

  it("migrates a saved time session to simple with routineEnabled", () => {
    const session = createDefaultSession(() => "cycle-1")
    session.type = "time" as Session["type"]
    session.bpm = 80
    session.bpmIncrease = 10
    session.time = { seconds: 120, targetBpm: 100, increaseEvery: "bars", everySec: 30, everyBars: 4 }
    const clamped = clampSession(session)
    expect(clamped.type).toBe("simple")
    expect(clamped.routineEnabled).toBe(true)
    // numLevels = ceil((100 - 80) / 10) = 2
    expect(clamped.routine.numLevels).toBe(2)
    expect(clamped.routine.barsPerLevel).toBe(4)
    expect(clamped.routine.repeatCount).toBe(1)
  })

  it("clamps a time pattern and migrates type to simple", () => {
    const session = createDefaultSession(() => "cycle-1")
    // time field still gets clamped regardless
    session.time = freshTime()
    session.type = "time" as Session["type"]
    session.time.increaseEvery = "nope" as "off"
    session.time.seconds = 0
    session.time.everySec = 0
    session.time.everyBars = 0
    const clamped = clampSession(session)
    expect(clamped.time).toEqual({
      seconds: 1,
      targetBpm: 120,
      increaseEvery: "off",
      everySec: 1,
      everyBars: 1,
    })
    // type migrates to simple
    expect(clamped.type).toBe("simple")
    expect(clamped.routineEnabled).toBe(true)

    // "time" as string legacy value in increaseEvery stays internal to clampTime
    session.time.increaseEvery = "time" as "bars"
    expect(clampSession(session).time.increaseEvery).toBe("bars")
    session.time.increaseEvery = "bars"
    expect(clampSession(session).time.increaseEvery).toBe("bars")

    // unknown type falls back to simple
    session.type = "nope" as "simple"
    expect(clampSession(session).type).toBe("simple")
  })

  it("loads a missing complex choice as interval and builds one round of repeated intervals", () => {
    const session = createDefaultSession(() => "cycle-1")
    delete (session as { complex?: unknown }).complex
    expect(clampSession(session).complex).toEqual(freshComplex())
    session.complex = freshComplex()
    session.complex.increaseEvery = "nope" as "interval"
    expect(clampSession(session).complex.increaseEvery).toBe("interval")
    session.simple = {
      practices: 2,
      length: { unit: "time", seconds: 30 },
      restAfterSec: 5,
      stepTempo: true,
      times: 3,
      repeatRound: true,
      rounds: 2,
      restBetweenSec: 60,
      increaseEvery: "round",
    }
    const cycles = cycleGroupFromSimple(session, () => "id")
    expect(cycles).toHaveLength(6)
    expect(cycles.every((cycle) => cycle.bpm === undefined)).toBe(true)
    expect(cycles.every((cycle) => cycle.restSec === 5)).toBe(true)
    expect(cycles[0].length).toEqual({ unit: "time", seconds: 30 })
  })

  it("restarts an interval climb and stores the bpm a ladder would miss", () => {
    const session = createDefaultSession(() => "cycle-1")
    session.bpm = 80
    session.bpmIncrease = 5
    session.simple = {
      practices: 1,
      length: { unit: "time", seconds: 30 },
      restAfterSec: 5,
      stepTempo: true,
      times: 3,
      repeatRound: true,
      rounds: 2,
      restBetweenSec: 60,
      increaseEvery: "interval",
    }
    expect(simplePlayedBpm(80, 5, "interval", 0, 2)).toBe(90)
    expect(simplePlayedBpm(80, 5, "round", 2, 0)).toBe(90)
    expect(simplePlayedBpm(290, 20, "interval", 0, 2)).toBe(300)
    const cycles = cyclesFromSimple(session, () => "id")
    expect(cycles.map((cycle) => cycle.bpm)).toEqual([
      undefined, undefined, undefined, 80, 85, 90,
    ])
    const raw = createDefaultSession(() => "cycle-1")
    delete (raw.simple as { increaseEvery?: string }).increaseEvery
    expect(clampSession(raw).simple.increaseEvery).toBe("interval")
    raw.simple.increaseEvery = "nope" as "interval"
    expect(clampSession(raw).simple.increaseEvery).toBe("interval")
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
      increaseEvery: "interval",
    }
    const cycles = cyclesFromSimple(session, () => "id")
    expect(cycles).toHaveLength(27)
    expect(cycles[0].length).toEqual({ unit: "bars", bars: 8 })
    expect(cycles[0].restSec).toBe(5)
    expect(cycles[8].restSec).toBe(60)
    expect(cycles[26].restSec).toBe(0)
    expect(cycles.map((cycle) => cycle.bpm)).toEqual([
      ...Array(9).fill(undefined),
      ...[80, 80, 80, 85, 85, 85, 90, 90, 90],
      ...[80, 80, 80, 85, 85, 85, 90, 90, 90],
    ])
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

  describe("timeSteps", () => {
    it("returns single step when increase is off", () => {
      const session = createDefaultSession()
      session.bpm = 80
      session.bpmIncrease = 0
      session.time = { seconds: 120, targetBpm: 120, increaseEvery: "off", everySec: 30, everyBars: 4 }
      const steps = timeSteps(session)
      expect(steps).toEqual([{ atSec: 0, bpm: 80 }])
    })

    it("returns single step when bpmIncrease is 0", () => {
      const session = createDefaultSession()
      session.bpm = 80
      session.bpmIncrease = 0
      session.time = { seconds: 120, targetBpm: 120, increaseEvery: "time", everySec: 30, everyBars: 4 }
      const steps = timeSteps(session)
      expect(steps).toEqual([{ atSec: 0, bpm: 80 }])
    })

    it("returns single step when startBpm already meets targetBpm", () => {
      const session = createDefaultSession()
      session.bpm = 120
      session.bpmIncrease = 5
      session.time = { seconds: 120, targetBpm: 100, increaseEvery: "time", everySec: 30, everyBars: 4 }
      const steps = timeSteps(session)
      expect(steps).toEqual([{ atSec: 0, bpm: 120 }])
    })

    it("ramps up to targetBpm every N bars", () => {
      const session = createDefaultSession()
      session.bpm = 80
      session.bpmIncrease = 10
      session.meter = "4/4"
      session.time = { seconds: 120, targetBpm: 100, increaseEvery: "bars", everySec: 30, everyBars: 4 }
      const steps = timeSteps(session)
      // window at 80bpm = 4*4*60/80 = 12s; window at 90bpm = 4*4*60/90 ≈ 10.67s
      expect(steps).toHaveLength(3)
      expect(steps[0]).toEqual({ atSec: 0, bpm: 80 })
      expect(steps[1]).toEqual({ atSec: 12, bpm: 90 })
      expect(steps[2].bpm).toBe(100)
      expect(steps[2].atSec).toBeCloseTo(12 + 4 * 4 * 60 / 90)
    })

    it("caps final bpm at targetBpm not above", () => {
      const session = createDefaultSession()
      session.bpm = 80
      session.bpmIncrease = 15
      session.time = { seconds: 120, targetBpm: 100, increaseEvery: "bars", everySec: 30, everyBars: 4 }
      const steps = timeSteps(session)
      expect(steps[steps.length - 1].bpm).toBe(100)
    })
  })

  describe("timeDurationSec", () => {
    it("returns POSITIVE_INFINITY when increaseEvery is off", () => {
      const session = createDefaultSession()
      session.time = { seconds: 120, targetBpm: 120, increaseEvery: "off", everySec: 30, everyBars: 4 }
      expect(timeDurationSec(session)).toBe(Number.POSITIVE_INFINITY)
    })

    it("returns last step atSec plus one window", () => {
      const session = createDefaultSession()
      session.bpm = 80
      session.bpmIncrease = 10
      session.meter = "4/4"
      session.time = { seconds: 120, targetBpm: 100, increaseEvery: "bars", everySec: 30, everyBars: 4 }
      // window at 80bpm = 12s, at 90bpm ≈ 10.67s, final window at 100bpm = 9.6s
      // steps: [80@0, 90@12, 100@~22.67], duration = round(~22.67 + 9.6) = 32
      expect(timeDurationSec(session)).toBe(32)
    })
  })

  it("keeps a known time signature and rejects an unknown bottom number", () => {
    const session = createDefaultSession(() => "cycle-1")
    session.meter = "5/4"
    expect(clampSession(session).meter).toBe("5/4")
    session.meter = "16/8"
    expect(clampSession(session).meter).toBe("16/8")
    session.meter = "7/16"
    expect(clampSession(session).meter).toBe("4/4")
    session.meter = "0/4"
    expect(clampSession(session).meter).toBe("4/4")
    delete (session as { subdivision?: unknown }).subdivision
    delete (session as { slots?: unknown }).slots
    session.click = "click-2"
    const loaded = clampSession(session)
    expect(loaded.subdivision).toBe("quarter")
    expect(loaded.slots).toEqual(["click-2"])
    session.subdivision = "nope" as "quarter"
    session.slots = ["click-3", "off", "click-4", "click-1"]
    const unknown = clampSession(session)
    expect(unknown.subdivision).toBe("quarter")
    expect(unknown.slots).toEqual(["click-3"])
    session.subdivision = "eighth"
    session.click = "click-2"
    session.slots = ["click-3"]
    expect(clampSession(session).slots).toEqual(["click-3", "click-2"])
    session.slots = ["off", "nope"]
    expect(clampSession(session).slots).toEqual(["off", "click-2"])
    session.subdivision = "quintuplet"
    session.slots = ["click-1"]
    session.click = "click-3"
    expect(clampSession(session).slots).toEqual(["click-1", "click-3", "click-3", "click-3", "click-3"])
    session.subdivision = "sextuplet"
    session.slots = ["off", "click-1", "click-1", "click-1", "click-1", "click-1", "click-4"]
    expect(clampSession(session).slots).toEqual(["off", "click-1", "click-1", "click-1", "click-1", "click-1"])
  })
})
