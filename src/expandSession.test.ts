import { describe, expect, it } from "vitest"
import { expandSession } from "./expandSession"
import { createDefaultSession } from "./session"

describe("expandSession (Simple mode)", () => {
  it("produces no count-in by default (countIn defaults to false)", () => {
    const session = createDefaultSession(() => "s1")
    const segments = expandSession(session)
    expect(segments[0].kind).toBe("play")
  })

  it("produces a count-in segment when countIn is true", () => {
    const session = createDefaultSession(() => "s1")
    session.countIn = true
    const segments = expandSession(session)
    expect(segments.map((segment) => segment.kind)).toEqual(["count-in", "play"])
    expect(segments[0]).toMatchObject({ meter: "4/4", durationSec: 3 })
  })

  it("plays one endless stretch at the session tempo", () => {
    const session = createDefaultSession(() => "s1")
    session.bpm = 96
    const segments = expandSession(session)
    expect(segments).toHaveLength(1)
    expect(segments[0]).toMatchObject({ kind: "play", bpm: 96, durationSec: Number.POSITIVE_INFINITY })
    expect(segments[0].steps).toEqual([{ atSec: 0, bpm: 96 }])
  })

  it("ignores the step amount while the increase is Off", () => {
    const session = createDefaultSession(() => "s1")
    session.bpmIncrease = 10
    session.time = { ...session.time, increaseEvery: "off", targetBpm: 120 }
    expect(expandSession(session)[0].steps).toEqual([{ atSec: 0, bpm: 80 }])
  })

  it("ramps every N bars up to the target, then holds there until stopped", () => {
    const session = createDefaultSession(() => "s1")
    session.bpm = 80
    session.bpmIncrease = 10
    session.time = { ...session.time, increaseEvery: "bars", everyBars: 4, targetBpm: 100 }
    const segments = expandSession(session)
    expect(segments).toHaveLength(1)
    expect(segments[0].durationSec).toBe(Number.POSITIVE_INFINITY)
    expect(segments[0].steps?.map((step) => step.bpm)).toEqual([80, 90, 100])
    expect(segments[0].steps?.[1].atSec).toBe(12)
  })

  it("ignores legacy interval and complex patterns", () => {
    const session = createDefaultSession(() => "s1")
    session.type = "complex"
    session.simple = { ...session.simple, practices: 3, repeatRound: true }
    session.cycles = [
      { id: "a", length: { unit: "time", seconds: 30 }, restSec: 10 },
      { id: "b", length: { unit: "time", seconds: 30 }, restSec: 10 },
    ]
    expect(expandSession(session).map((segment) => segment.kind)).toEqual(["play"])
  })
})

describe("routine", () => {
  function makeRoutineSession() {
    const session = createDefaultSession()
    session.routineEnabled = true
    session.bpm = 80
    session.bpmIncrease = 5
    session.meter = "4/4"
    session.routine = {
      unit: "bars",
      playDuration: 4,
      restDuration: 0,
      round:  { enabled: false, count: 4, restDuration: 0 },
      set:    { enabled: false, count: 3, restDuration: 30 },
      block:  { enabled: false, count: 2, restDuration: 60 },
      bpmIncreaseAt: "off",
    }
    return session
  }

  it("produces a single play segment when no repeats are enabled", () => {
    const session = makeRoutineSession()
    const segments = expandSession(session)
    expect(segments.map((s) => s.kind)).toEqual(["play"])
    expect(segments[0].bpm).toBe(80)
    // 4 bars × 4 beats × 60 / 80 = 12s
    expect(segments[0].durationSec).toBe(12)
  })

  it("produces count-in only on first segment", () => {
    const session = makeRoutineSession()
    session.countIn = true
    const segments = expandSession(session)
    expect(segments[0].kind).toBe("count-in")
    expect(segments[1].kind).toBe("play")
    expect(segments.filter((s) => s.kind === "count-in")).toHaveLength(1)
  })

  it("round repeat: repeats play with rest between, no trailing rest", () => {
    const session = makeRoutineSession()
    session.routine = { ...session.routine, restDuration: 2, round: { enabled: true, count: 3, restDuration: 0 } }
    const segments = expandSession(session)
    // play rest play rest play (no trailing rest)
    expect(segments.map((s) => s.kind)).toEqual(["play", "rest", "play", "rest", "play"])
    const plays = segments.filter((s) => s.kind === "play")
    expect(plays).toHaveLength(3)
    // restDuration is in bars: 2 bars × 4 beats × 60 / 80 = 6s
    expect(segments[1].durationSec).toBe(6)
  })

  it("round repeat with sec unit", () => {
    const session = makeRoutineSession()
    session.routine = {
      ...session.routine,
      unit: "sec",
      playDuration: 30,
      restDuration: 10,
      round: { enabled: true, count: 2, restDuration: 0 },
    }
    const segments = expandSession(session)
    expect(segments.map((s) => s.kind)).toEqual(["play", "rest", "play"])
    expect(segments[0].durationSec).toBe(30)
    expect(segments[1].durationSec).toBe(10)
  })

  it("set repeat: rest between sets uses set.restDuration (seconds)", () => {
    const session = makeRoutineSession()
    session.routine = {
      ...session.routine,
      restDuration: 0,
      round: { enabled: true, count: 2, restDuration: 0 },
      set:   { enabled: true, count: 2, restDuration: 30 },
    }
    const segments = expandSession(session)
    const plays = segments.filter((s) => s.kind === "play")
    const rests = segments.filter((s) => s.kind === "rest")
    expect(plays).toHaveLength(4)  // 2 rounds × 2 sets
    // Between the two sets there should be a rest of set.restDuration (30s)
    // The last play of set 1 should be followed by a 30s rest
    expect(rests.some((r) => r.durationSec === 30)).toBe(true)
    // Last segment is play (no trailing rest)
    expect(segments.at(-1)?.kind).toBe("play")
  })

  it("block repeat: rest between blocks uses block.restDuration (seconds)", () => {
    const session = makeRoutineSession()
    session.routine = {
      ...session.routine,
      restDuration: 0,
      round: { enabled: true, count: 2, restDuration: 0 },
      set:   { enabled: true, count: 2, restDuration: 10 },
      block: { enabled: true, count: 2, restDuration: 60 },
    }
    const segments = expandSession(session)
    const plays = segments.filter((s) => s.kind === "play")
    expect(plays).toHaveLength(8)  // 2 rounds × 2 sets × 2 blocks
    // There should be a rest of 60s (block rest)
    expect(segments.some((s) => s.kind === "rest" && s.durationSec === 60)).toBe(true)
    expect(segments.at(-1)?.kind).toBe("play")
  })

  it("BPM increases at round boundary", () => {
    const session = makeRoutineSession()
    session.bpm = 80
    session.bpmIncrease = 5
    session.routine = {
      ...session.routine,
      round: { enabled: true, count: 3, restDuration: 0 },
      bpmIncreaseAt: "round",
    }
    const plays = expandSession(session).filter((s) => s.kind === "play")
    expect(plays.map((s) => s.bpm)).toEqual([80, 85, 90])
  })

  it("BPM increases at set boundary", () => {
    const session = makeRoutineSession()
    session.bpm = 80
    session.bpmIncrease = 10
    session.routine = {
      ...session.routine,
      round: { enabled: true, count: 2, restDuration: 0 },
      set:   { enabled: true, count: 3, restDuration: 0 },
      bpmIncreaseAt: "set",
    }
    const plays = expandSession(session).filter((s) => s.kind === "play")
    // Set 1: [80, 80], Set 2: [90, 90], Set 3: [100, 100]
    expect(plays.map((s) => s.bpm)).toEqual([80, 80, 90, 90, 100, 100])
  })

  it("caps BPM at 300", () => {
    const session = makeRoutineSession()
    session.bpm = 290
    session.bpmIncrease = 20
    session.routine = {
      ...session.routine,
      round: { enabled: true, count: 3, restDuration: 0 },
      bpmIncreaseAt: "round",
    }
    const plays = expandSession(session).filter((s) => s.kind === "play")
    expect(plays.map((s) => s.bpm)).toEqual([290, 300, 300])
  })

  it("setIndex increments across all segments for progress tracking", () => {
    const session = makeRoutineSession()
    session.routine = {
      ...session.routine,
      round: { enabled: true, count: 2, restDuration: 0 },
    }
    const plays = expandSession(session).filter((s) => s.kind === "play")
    expect(plays[0].setIndex).toBe(0)
    expect(plays[1].setIndex).toBe(1)
  })

  it("BPM increases at block boundary", () => {
    const session = makeRoutineSession()
    session.bpm = 80
    session.bpmIncrease = 10
    session.routine = {
      ...session.routine,
      round: { enabled: true, count: 2, restDuration: 0 },
      set:   { enabled: true, count: 2, restDuration: 0 },
      block: { enabled: true, count: 3, restDuration: 0 },
      bpmIncreaseAt: "block",
    }
    const plays = expandSession(session).filter((s) => s.kind === "play")
    // Block 1: [80,80,80,80], Block 2: [90,90,90,90], Block 3: [100,100,100,100]
    expect(plays.map((s) => s.bpm)).toEqual([80,80,80,80,90,90,90,90,100,100,100,100])
  })

  it("set-boundary rest stacks round rest on top of set rest", () => {
    const session = makeRoutineSession()
    // restDuration: 2 bars @ 80bpm 4/4 = 6s per bar * 2 = ... let's use sec unit for simplicity
    session.routine = {
      ...session.routine,
      unit: "sec",
      playDuration: 10,
      restDuration: 5,  // 5s round rest
      round: { enabled: true, count: 2, restDuration: 0 },
      set:   { enabled: true, count: 2, restDuration: 30 },  // 30s set rest
    }
    const segments = expandSession(session)
    const rests = segments.filter((s) => s.kind === "rest")
    // Between set 1 and set 2: the last round's rest (5s) + set rest (30s) = 35s
    expect(rests.some((r) => r.durationSec === 35)).toBe(true)
    // Within each set, round-to-round rest is 5s
    expect(rests.filter((r) => r.durationSec === 5).length).toBeGreaterThan(0)
  })
})
