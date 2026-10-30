import { describe, expect, it } from "vitest"
import {
  sharedSubdivision,
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
      beats: [1, 2, 3, 4].map(() => ({ subdivision: "quarter", slots: ["click-1"] })),
      type: "simple",
      simple: freshSimple(),
      complex: freshComplex(),
      time: freshTime(),
      cycles: [{ id: "cycle-1", length: { unit: "time", seconds: 120 }, restSec: 30 }],
      routineEnabled: false,
      routine: freshRoutine(),
      countIn: false,
      accent: true,
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

  it("freshRoutine returns the new 3-level shape", () => {
    expect(freshRoutine()).toEqual({
      unit: "bars",
      playDuration: 4,
      restDuration: 0,
      round:  { enabled: false, count: 4, restDuration: 0 },
      set:    { enabled: false, count: 3, restDuration: 30 },
      block:  { enabled: false, count: 2, restDuration: 60 },
      bpmIncreaseAt: "off",
      increase: { mode: "off", step: 5, nextSet: "reset", raiseBy: 2, targetBpm: 120, every: 4 },
    })
  })

  it("migrates a saved time session to a To target routine", () => {
    const session = createDefaultSession(() => "cycle-1")
    session.type = "time" as Session["type"]
    session.bpm = 80
    session.bpmIncrease = 10
    session.time = { seconds: 120, targetBpm: 100, increaseEvery: "bars", everySec: 30, everyBars: 4 }
    const clamped = clampSession(session)
    expect(clamped.type).toBe("simple")
    expect(clamped.routineEnabled).toBe(true)
    expect(clamped.routine.unit).toBe("bars")
    expect(clamped.routine.round.enabled).toBe(false)
    expect(clamped.routine.increase).toMatchObject({ mode: "target", step: 10, targetBpm: 100, every: 4 })

    session.bpmIncrease = 0
    expect(clampSession(session).routine.increase.mode).toBe("off")
  })

  it("clampSession falls back to freshRoutine defaults when routine has old shape", () => {
    const session = createDefaultSession(() => "s1")
    session.routineEnabled = true
    // Old shape — TypeScript cast needed since type changed
    ;(session as any).routine = { barsPerLevel: 8, numLevels: 4, repeatCount: 3, restAfterSec: 10, loop: false }
    const clamped = clampSession(session)
    expect(clamped.routine.unit).toBe("bars")
    expect(clamped.routine.playDuration).toBe(4)  // freshRoutine default
    expect(clamped.routine.round.enabled).toBe(false)
  })

  it("clampSession enforces minimums on RepeatLevel fields", () => {
    const session = createDefaultSession(() => "s1")
    session.routineEnabled = true
    session.routine = {
      unit: "sec",
      playDuration: 0,
      restDuration: -1,
      round:  { enabled: true,  count: 1,  restDuration: -5 },
      set:    { enabled: true,  count: 0,  restDuration: 0  },
      block:  { enabled: false, count: 2,  restDuration: 60 },
      bpmIncreaseAt: "round",
      increase: freshRoutine().increase,
    }
    const r = clampSession(session).routine
    expect(r.playDuration).toBe(1)
    expect(r.restDuration).toBe(0)
    expect(r.round.count).toBe(2)
    expect(r.round.restDuration).toBe(0)
    expect(r.set.count).toBe(2)
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
      session.time = { seconds: 120, targetBpm: 120, increaseEvery: "bars", everySec: 30, everyBars: 4 }
      const steps = timeSteps(session)
      expect(steps).toEqual([{ atSec: 0, bpm: 80 }])
    })

    it("returns single step when startBpm already meets targetBpm", () => {
      const session = createDefaultSession()
      session.bpm = 120
      session.bpmIncrease = 5
      session.time = { seconds: 120, targetBpm: 100, increaseEvery: "bars", everySec: 30, everyBars: 4 }
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
  })

  describe("per-beat subdivision", () => {
    const legacy = (fields: Record<string, unknown>) => {
      const session = createDefaultSession(() => "cycle-1") as unknown as Record<string, unknown>
      delete session.beats
      return clampSession({ ...session, ...fields } as unknown as Session)
    }

    it("gives every beat a saved session's old subdivision and slots", () => {
      const loaded = legacy({ subdivision: "eighth", slots: ["click-3", "off"], click: "click-2" })
      expect(loaded.beats).toEqual([1, 2, 3, 4].map(() => ({ subdivision: "eighth", slots: ["click-3", "off"] })))
    })

    it("falls back to quarter beats with the session click", () => {
      expect(legacy({ click: "click-2" }).beats).toEqual([1, 2, 3, 4].map(() => ({ subdivision: "quarter", slots: ["click-2"] })))
      expect(legacy({ subdivision: "nope", slots: ["click-3", "off"] }).beats[0]).toEqual({ subdivision: "quarter", slots: ["click-3"] })
    })

    it("pads and trims each beat's slots to its subdivision", () => {
      const session = createDefaultSession(() => "cycle-1")
      session.click = "click-2"
      session.beats = [
        { subdivision: "triplet", slots: ["off"] },
        { subdivision: "eighth", slots: ["click-1", "nope" as "off", "click-1"] },
        { subdivision: "nope" as "quarter", slots: [] },
        { subdivision: "sixteenth", slots: ["click-1", "off", "click-1", "click-1"] },
      ]
      expect(clampSession(session).beats).toEqual([
        { subdivision: "triplet", slots: ["off", "click-2", "click-2"] },
        { subdivision: "eighth", slots: ["click-1", "click-2"] },
        { subdivision: "quarter", slots: ["click-2"] },
        { subdivision: "sixteenth", slots: ["click-1", "off", "click-1", "click-1"] },
      ])
    })

    it("keeps beats when the meter shrinks and copies the last beat when it grows", () => {
      const session = createDefaultSession(() => "cycle-1")
      session.beats = [
        { subdivision: "triplet", slots: ["click-1", "click-1", "click-1"] },
        { subdivision: "triplet", slots: ["click-1", "off", "click-1"] },
        { subdivision: "sixteenth", slots: ["click-1", "click-1", "click-1", "click-1"] },
        { subdivision: "eighth", slots: ["click-1", "off"] },
      ]
      const three = clampSession({ ...session, meter: "3/4" })
      expect(three.beats.map((beat) => beat.subdivision)).toEqual(["triplet", "triplet", "sixteenth"])
      const five = clampSession({ ...session, meter: "5/4" })
      expect(five.beats.map((beat) => beat.subdivision)).toEqual(["triplet", "triplet", "sixteenth", "eighth", "eighth"])
      expect(five.beats[4].slots).toEqual(["click-1", "off"])
    })

    it("reports a shared subdivision or null when beats differ", () => {
      const session = createDefaultSession(() => "cycle-1")
      expect(sharedSubdivision(session.beats)).toBe("quarter")
      session.beats[2] = { subdivision: "triplet", slots: ["click-1", "click-1", "click-1"] }
      expect(sharedSubdivision(session.beats)).toBeNull()
    })
  })

  it("keeps the beat-1 accent on unless a session turned it off", () => {
    const session = createDefaultSession(() => "cycle-1")
    delete (session as { accent?: boolean }).accent
    expect(clampSession(session).accent).toBe(true)
    expect(clampSession({ ...session, accent: false }).accent).toBe(false)
  })
})

describe("routine increase", () => {
  function withRoutine(routine: Record<string, unknown>, bpmIncrease = 0): Session {
    const session = createDefaultSession(() => "s1")
    session.routineEnabled = true
    session.bpmIncrease = bpmIncrease
    ;(session as { routine: unknown }).routine = routine
    return session
  }
  const defaults = { mode: "off", step: 5, nextSet: "reset", raiseBy: 2, targetBpm: 120, every: 4 }

  it("defaults to Off with step 5, Reset, +2, target 120, every 4", () => {
    expect(freshRoutine().increase).toEqual(defaults)
  })

  it("clamps out-of-range and unknown values", () => {
    const session = withRoutine({
      ...freshRoutine(),
      increase: { mode: "bogus", step: -3, nextSet: "x", raiseBy: -1, targetBpm: 999, every: 0 },
    })
    expect(clampSession(session).routine.increase).toEqual({
      mode: "off", step: 0, nextSet: "reset", raiseBy: 0, targetBpm: 300, every: 1,
    })
  })

  it("migrates legacy bpmIncreaseAt round to Per round with Keep", () => {
    const { increase, ...legacy } = freshRoutine()
    void increase
    const session = withRoutine({ ...legacy, bpmIncreaseAt: "round" }, 5)
    expect(clampSession(session).routine.increase).toEqual({ ...defaults, mode: "round", step: 5, nextSet: "keep" })
  })

  it("migrates legacy bpmIncreaseAt set to Per round with +N", () => {
    const { increase, ...legacy } = freshRoutine()
    void increase
    const session = withRoutine({ ...legacy, bpmIncreaseAt: "set" }, 10)
    expect(clampSession(session).routine.increase).toEqual({
      ...defaults, mode: "round", step: 0, nextSet: "raise", raiseBy: 10,
    })
  })

  it("migrates legacy block and off to Off without throwing", () => {
    const { increase, ...legacy } = freshRoutine()
    void increase
    const block = withRoutine({ ...legacy, block: { enabled: true, count: 3, restDuration: 60 }, bpmIncreaseAt: "block" }, 5)
    expect(clampSession(block).routine.increase.mode).toBe("off")
    const off = withRoutine({ ...legacy, bpmIncreaseAt: "off" }, 5)
    expect(clampSession(off).routine.increase.mode).toBe("off")
  })

  it("keeps an existing increase over a legacy bpmIncreaseAt", () => {
    const session = withRoutine({ ...freshRoutine(), bpmIncreaseAt: "round", increase: { ...defaults, mode: "target" } }, 5)
    expect(clampSession(session).routine.increase.mode).toBe("target")
  })
})
