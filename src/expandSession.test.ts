import { describe, expect, it } from "vitest"
import { clicksInSegment } from "./clock"
import { expandSession } from "./expandSession"
import { createDefaultSession } from "./session"

function example() {
  const session = createDefaultSession(() => "cycle-1")
  session.type = "simple"
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
    session.type = "simple"
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
    session.type = "simple"
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

  it("plays a time session as one count-in and one climb by clock time", () => {
    const session = createDefaultSession(() => "cycle-1")
    session.type = "time"
    session.bpm = 80
    session.bpmIncrease = 5
    session.time = { seconds: 120, targetBpm: 120, increaseEvery: "time", everySec: 30, everyBars: 4 }
    const segments = expandSession(session)
    expect(segments.map((segment) => segment.kind)).toEqual(["count-in", "play"])
    expect(segments[0]).toMatchObject({ bpm: 80, meter: "4/4", durationSec: 3 })
    expect(segments[1]).toMatchObject({ bpm: 80, durationSec: 270, meter: "4/4" })
    expect(segments[1].steps).toEqual([
      { atSec: 0, bpm: 80 },
      { atSec: 30, bpm: 85 },
      { atSec: 60, bpm: 90 },
      { atSec: 90, bpm: 95 },
      { atSec: 120, bpm: 100 },
      { atSec: 150, bpm: 105 },
      { atSec: 180, bpm: 110 },
      { atSec: 210, bpm: 115 },
      { atSec: 240, bpm: 120 },
    ])
  })

  it("gives a short leftover its own later tempo", () => {
    const session = createDefaultSession(() => "cycle-1")
    session.type = "time"
    session.bpm = 80
    session.bpmIncrease = 5
    session.time = { seconds: 999, targetBpm: 100, increaseEvery: "time", everySec: 30, everyBars: 4 }
    // steps: 80@0, 85@30, 90@60, 95@90, 100@120 → duration = 120 + 30 = 150
    const play = expandSession(session).find((segment) => segment.kind === "play")
    expect(play?.durationSec).toBe(150)
    expect(play?.steps?.at(-1)).toEqual({ atSec: 120, bpm: 100 })
  })

  it("cuts a bar step off when the duration ends", () => {
    const session = createDefaultSession(() => "cycle-1")
    session.type = "time"
    session.bpm = 80
    session.bpmIncrease = 5
    session.meter = "4/4"
    session.time = { seconds: 999, targetBpm: 85, increaseEvery: "bars", everySec: 30, everyBars: 4 }
    // steps: 80@0, 85@12 → window for last step (85): 4*4*60/85 ≈ 11.29 → duration = round(12 + 11.29) = 23
    const play = expandSession(session).find((segment) => segment.kind === "play")
    expect(play?.durationSec).toBe(23)
    expect(play?.steps).toEqual([
      { atSec: 0, bpm: 80 },
      { atSec: 12, bpm: 85 },
    ])
  })

  it("holds the session tempo when the increase is zero", () => {
    const session = createDefaultSession(() => "cycle-1")
    session.type = "time"
    session.bpm = 80
    session.bpmIncrease = 0
    session.time = { seconds: 120, targetBpm: 120, increaseEvery: "time", everySec: 30, everyBars: 4 }
    // increase=0 → single step; duration = 0 + 30 = 30
    const flat = expandSession(session).find((segment) => segment.kind === "play")
    expect(flat?.steps).toEqual([{ atSec: 0, bpm: 80 }])
    expect(flat?.durationSec).toBe(30)

    // already at or above targetBpm → single step too
    session.bpmIncrease = 5
    session.bpm = 120
    const one = expandSession(session).find((segment) => segment.kind === "play")
    expect(one?.steps).toEqual([{ atSec: 0, bpm: 120 }])
  })

  it("plays a time step at 300 once the climb reaches the cap", () => {
    const session = createDefaultSession(() => "cycle-1")
    session.type = "time"
    session.bpm = 290
    session.bpmIncrease = 20
    session.time = { seconds: 120, targetBpm: 300, increaseEvery: "time", everySec: 30, everyBars: 4 }
    // steps: 290@0, 300@30 (reached target) → duration = 30 + 30 = 60
    const play = expandSession(session).find((segment) => segment.kind === "play")
    expect(play?.steps?.map((step) => step.bpm)).toEqual([290, 300])
  })

  it("plays an Off session as a count-in plus one endless play", () => {
    const session = createDefaultSession(() => "cycle-1")
    session.bpm = 60
    const segments = expandSession(session)
    expect(segments.map((segment) => segment.kind)).toEqual(["count-in", "play"])
    expect(clicksInSegment(segments[0])).toHaveLength(4)
    expect(segments[1].durationSec).toBe(Number.POSITIVE_INFINITY)
    expect(segments[1].steps).toEqual([{ atSec: 0, bpm: 60 }])
  })

  it("holds the tempo and stops at the end when the amount is 0", () => {
    const session = createDefaultSession(() => "cycle-1")
    session.type = "time"
    session.bpm = 80
    session.time = { seconds: 10, targetBpm: 120, increaseEvery: "time", everySec: 5, everyBars: 4 }
    session.bpmIncrease = 0
    // increase=0 → single step at session bpm; duration = 0 + everySec = 5
    const play = expandSession(session).find((segment) => segment.kind === "play")!
    expect(play.durationSec).toBe(5)
    expect(play.steps?.every((step) => step.bpm === 80)).toBe(true)
    expect(play.steps?.length).toBe(1)
  })

  it("derives durationSec from targetBpm for a time session with increase", () => {
    const session = createDefaultSession(() => "cycle-1")
    session.type = "time"
    session.bpm = 80
    session.bpmIncrease = 10
    session.time = { seconds: 999, targetBpm: 100, increaseEvery: "time", everySec: 30, everyBars: 4 }
    // steps: 80@0s, 90@30s, 100@60s → duration = 60 + 30 = 90s
    const segments = expandSession(session)
    const play = segments.find((s) => s.kind === "play")!
    expect(play.durationSec).toBe(90)
    expect(play.steps).toEqual([
      { atSec: 0, bpm: 80 },
      { atSec: 30, bpm: 90 },
      { atSec: 60, bpm: 100 },
    ])
  })

  it("uses POSITIVE_INFINITY for a time session with increase off", () => {
    const session = createDefaultSession(() => "cycle-1")
    session.type = "time"
    session.time = { seconds: 120, targetBpm: 120, increaseEvery: "off", everySec: 30, everyBars: 4 }
    const segments = expandSession(session)
    const play = segments.find((s) => s.kind === "play")!
    expect(play.durationSec).toBe(Number.POSITIVE_INFINITY)
  })
})
