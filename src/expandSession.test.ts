import { describe, expect, it } from "vitest"
import { expandSession } from "./expandSession"
import { createDefaultSession } from "./session"

function example() {
  const session = createDefaultSession(() => "cycle-1")
  session.bpm = 80
  session.bpmIncrease = 5
  session.simple = {
    practices: 3,
    length: { unit: "time", seconds: 30 },
    restAfterSec: 5,
    stepTempo: true,
    times: 3,
    repeatRound: true,
    rounds: 3,
    restBetweenSec: 60,
    increaseEvery: "interval",
  }
  return session
}

describe("expandSession", () => {
  it("builds the 30 second session and does not end on a rest", () => {
    const segments = expandSession(example())
    const plays = segments.filter((segment) => segment.kind === "play")
    expect(plays).toHaveLength(27)
    expect(plays.map((segment) => segment.bpm)).toEqual(
      Array.from({ length: 3 }, () => [80, 80, 80, 85, 85, 85, 90, 90, 90]).flat(),
    )
    const rests = segments.filter((segment) => segment.kind === "rest")
    expect(rests.filter((segment) => segment.durationSec === 5)).toHaveLength(24)
    expect(rests.filter((segment) => segment.durationSec === 60)).toHaveLength(2)
    expect(segments.at(-1)?.kind).toBe("play")
    expect(segments[0]).toMatchObject({ kind: "count-in", meter: "4/4", durationSec: 3, color: "red" })
  })

  it("shortens a later bar practice when the tempo steps up", () => {
    const session = example()
    session.simple.length = { unit: "bars", bars: 8 }
    const plays = expandSession(session).filter((segment) => segment.kind === "play")
    expect(plays[0].durationSec).toBe(24)
    expect(plays[3].durationSec).toBeLessThan(24)
  })

  it("omits a 0 second rest and still counts in", () => {
    const session = createDefaultSession(() => "cycle-1")
    session.type = "complex"
    session.cycles = [
      { id: "a", length: { unit: "time", seconds: 30 }, restSec: 0 },
      { id: "b", length: { unit: "time", seconds: 30 }, restSec: 0 },
    ]
    expect(expandSession(session).map((segment) => segment.kind)).toEqual([
      "count-in", "play", "count-in", "play",
    ])
  })

  it("plays a cycle's own tempo instead of the ladder", () => {
    const session = createDefaultSession(() => "cycle-1")
    session.type = "complex"
    session.bpm = 80
    session.cycles = [
      { id: "a", length: { unit: "time", seconds: 30 }, restSec: 1 },
      { id: "b", length: { unit: "time", seconds: 30 }, restSec: 0, bpm: 100 },
    ]
    const plays = expandSession(session).filter((segment) => segment.kind === "play")
    expect(plays.map((segment) => segment.bpm)).toEqual([80, 100])
  })

  it("holds one bpm for a round and steps on the next round", () => {
    const session = example()
    session.simple.practices = 1
    session.simple.increaseEvery = "round"
    const plays = expandSession(session).filter((segment) => segment.kind === "play")
    expect(plays.map((segment) => segment.bpm)).toEqual([
      80, 80, 80, 85, 85, 85, 90, 90, 90,
    ])
  })

  it("shares one bpm across the practices in an interval", () => {
    const session = createDefaultSession(() => "cycle-1")
    session.bpmIncrease = 5
    session.simple.practices = 3
    session.simple.stepTempo = true
    session.simple.times = 2
    session.simple.increaseEvery = "interval"
    const plays = expandSession(session).filter((segment) => segment.kind === "play")
    expect(plays.map((segment) => segment.bpm)).toEqual([80, 80, 80, 85, 85, 85])
  })

  it("caps a stepped simple bpm at 300", () => {
    const session = createDefaultSession(() => "cycle-1")
    session.bpm = 290
    session.bpmIncrease = 20
    session.simple.stepTempo = true
    session.simple.times = 3
    session.simple.increaseEvery = "interval"
    const plays = expandSession(session).filter((segment) => segment.kind === "play")
    expect(plays.map((segment) => segment.bpm)).toEqual([290, 300, 300])
  })

  it("restarts a complex interval climb and uses between for the round", () => {
    const session = createDefaultSession(() => "cycle-1")
    session.type = "complex"
    session.bpm = 80
    session.bpmIncrease = 5
    session.complex = {
      increaseEvery: "interval",
      repeatRound: true,
      rounds: 2,
      restBetweenSec: 60,
    }
    session.cycles = [0, 1, 2].map((index) => ({
      id: `cycle-${index}`,
      length: { unit: "time" as const, seconds: 30 },
      restSec: 5,
    }))
    const segments = expandSession(session)
    const plays = segments.filter((segment) => segment.kind === "play")
    expect(plays.map((segment) => segment.bpm)).toEqual([80, 85, 90, 80, 85, 90])
    const rests = segments.filter((segment) => segment.kind === "rest")
    expect(rests.map((segment) => segment.durationSec)).toEqual([5, 5, 60, 5, 5])
    expect(segments.at(-1)?.kind).toBe("play")
  })

  it("holds one bpm across a complex round", () => {
    const session = createDefaultSession(() => "cycle-1")
    session.type = "complex"
    session.bpm = 80
    session.bpmIncrease = 5
    session.complex.increaseEvery = "round"
    session.complex.repeatRound = true
    session.complex.rounds = 3
    session.cycles = [0, 1, 2].map((index) => ({
      id: `cycle-${index}`,
      length: { unit: "time" as const, seconds: 30 },
      restSec: 0,
    }))
    const plays = expandSession(session).filter((segment) => segment.kind === "play")
    expect(plays.map((segment) => segment.bpm)).toEqual([
      80, 80, 80, 85, 85, 85, 90, 90, 90,
    ])
  })

  it("keeps one cycle tempo and steps the neighbors", () => {
    const session = createDefaultSession(() => "cycle-1")
    session.type = "complex"
    session.bpm = 80
    session.bpmIncrease = 5
    session.cycles = [
      { id: "a", length: { unit: "time", seconds: 30 }, restSec: 0 },
      { id: "b", length: { unit: "time", seconds: 30 }, restSec: 0, bpm: 100 },
      { id: "c", length: { unit: "time", seconds: 30 }, restSec: 0 },
    ]
    const plays = expandSession(session).filter((segment) => segment.kind === "play")
    expect(plays.map((segment) => segment.bpm)).toEqual([80, 100, 90])
  })

  it("caps a stepped complex bpm at 300", () => {
    const session = createDefaultSession(() => "cycle-1")
    session.type = "complex"
    session.bpm = 290
    session.bpmIncrease = 20
    session.cycles = [0, 1, 2].map((index) => ({
      id: `cycle-${index}`,
      length: { unit: "time" as const, seconds: 30 },
      restSec: 0,
    }))
    const plays = expandSession(session).filter((segment) => segment.kind === "play")
    expect(plays.map((segment) => segment.bpm)).toEqual([290, 300, 300])
  })
})
