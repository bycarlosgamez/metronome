import { describe, expect, it } from "vitest"
import { expandSession } from "./expandSession"
import { createDefaultSession, freshRoutine } from "./session"
import type { RoutineIncrease, Session } from "./types"

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
      increase: freshRoutine().increase,
    }
    return session
  }

  // 110 BPM, 2:00 play, 0:15 rest, 4 rounds × N sets
  function practiceSets(increase: Partial<RoutineIncrease>, sets = 2, bpm = 110): Session {
    const session = makeRoutineSession()
    session.bpm = bpm
    session.routine = {
      ...session.routine,
      unit: "sec",
      playDuration: 120,
      restDuration: 15,
      round: { enabled: true, count: 4, restDuration: 0 },
      set:   { enabled: true, count: sets, restDuration: 60 },
      increase: { ...session.routine.increase, ...increase },
    }
    return session
  }
  const playBpms = (session: Session) => expandSession(session).filter((s) => s.kind === "play").map((s) => s.bpm)

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

  it("Off plays every round at Start, ignoring the step", () => {
    expect(playBpms(practiceSets({ mode: "off", step: 5 }))).toEqual(Array(8).fill(110))
  })

  it("ignores the legacy bpmIncreaseAt and session.bpmIncrease", () => {
    const session = practiceSets({ mode: "off" })
    ;(session.routine as unknown as { bpmIncreaseAt: string }).bpmIncreaseAt = "round"
    session.bpmIncrease = 10
    expect(playBpms(session)).toEqual(Array(8).fill(110))
  })

  it("to target in seconds: climbs inside each play, holds target one window, restarts each round", () => {
    const session = makeRoutineSession()
    session.routine = {
      ...session.routine,
      unit: "sec",
      round: { enabled: true, count: 2, restDuration: 0 },
      increase: { ...session.routine.increase, mode: "target", step: 4, targetBpm: 125, every: 30 },
    }
    const plays = expandSession(session).filter((s) => s.kind === "play")
    expect(plays).toHaveLength(2)
    for (const play of plays) {
      expect(play.bpm).toBe(80)
      expect(play.steps?.map((step) => step.bpm)).toEqual([80, 84, 88, 92, 96, 100, 104, 108, 112, 116, 120, 124, 125])
      expect(play.steps?.[12].atSec).toBe(360)
      expect(play.durationSec).toBe(390)
    }
  })

  it("to target in bars: windows follow each step's BPM and the rest uses the BPM the play ended at", () => {
    const session = makeRoutineSession()
    session.routine = {
      ...session.routine,
      restDuration: 2,
      round: { enabled: true, count: 2, restDuration: 0 },
      increase: { ...session.routine.increase, mode: "target", step: 10, targetBpm: 90, every: 4 },
    }
    const segments = expandSession(session)
    expect(segments.map((s) => s.kind)).toEqual(["play", "rest", "play"])
    expect(segments[0].steps).toEqual([{ atSec: 0, bpm: 80 }, { atSec: 12, bpm: 90 }])
    expect(segments[0].durationSec).toBeCloseTo(12 + 640 / 60)
    expect(segments[1].durationSec).toBeCloseTo((2 * 4 * 60) / 90)
  })

  it("to target with Start at or above Target, or step 0, is a single window at Start", () => {
    const session = makeRoutineSession()
    session.bpm = 130
    session.routine = {
      ...session.routine,
      unit: "sec",
      increase: { ...session.routine.increase, mode: "target", step: 4, targetBpm: 120, every: 30 },
    }
    let play = expandSession(session)[0]
    expect(play.steps).toEqual([{ atSec: 0, bpm: 130 }])
    expect(play.durationSec).toBe(30)

    session.bpm = 80
    session.routine.increase.step = 0
    play = expandSession(session)[0]
    expect(play.steps).toEqual([{ atSec: 0, bpm: 80 }])
    expect(play.durationSec).toBe(30)
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

  it("set-boundary rest stacks round rest on top of set rest, with no block level", () => {
    const session = makeRoutineSession()
    session.routine = {
      ...session.routine,
      unit: "sec",
      playDuration: 10,
      restDuration: 5,  // 5s round rest
      round: { enabled: true, count: 2, restDuration: 0 },
      set:   { enabled: true, count: 2, restDuration: 30 },  // 30s set rest
    }
    const segments = expandSession(session)
    expect(segments.map((s) => s.kind === "rest" ? `rest${s.durationSec}` : s.kind))
      .toEqual(["play", "rest5", "play", "rest35", "play", "rest5", "play"])
  })
})
