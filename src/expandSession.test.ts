import { describe, expect, it } from "vitest"
import { expandSession } from "./expandSession"
import { createDefaultSession } from "./session"
import type { Session } from "./types"

function example(): Session {
  const session = createDefaultSession(() => "scales")
  session.bpmIncrease = 5
  session.sets[0] = {
    id: "scales",
    name: "Scales",
    durationSec: 120,
    bpm: 80,
    restSec: 30,
    repeats: 3,
    color: "red",
    meter: "6/8",
  }
  session.sets.push({
    id: "piece",
    name: "Piece",
    durationSec: 60,
    bpm: 100,
    restSec: 20,
    repeats: 1,
    color: "green",
    meter: "3/4",
  })
  return session
}

describe("expandSession", () => {
  it("builds the 80 BPM example and does not end on a rest", () => {
    const segments = expandSession(example())
    expect(segments.map((segment) => segment.kind)).toEqual([
      "count-in", "play", "rest",
      "count-in", "play", "rest",
      "count-in", "play", "rest",
      "count-in", "play",
    ])
    expect(segments.map((segment) => segment.bpm)).toEqual([
      80, 80, 80,
      85, 85, 85,
      90, 90, 90,
      100, 100,
    ])
    expect(segments[0].durationSec).toBeCloseTo(3)
    expect(segments[3].durationSec).toBeCloseTo((4 * 60) / 85)
    expect(segments[9].durationSec).toBeCloseTo(2.4)
    expect(segments.at(-1)?.kind).toBe("play")
    expect(segments.at(-1)?.durationSec).toBe(60)
  })

  it("uses the session meter unless per-set meter is on", () => {
    const session = example()
    session.perSetMeter = false
    session.meter = "4/4"
    const off = expandSession(session)
    expect(off[0].meter).toBe("4/4")
    expect(off[1].meter).toBe("4/4")

    session.perSetMeter = true
    const on = expandSession(session)
    expect(on[0].meter).toBe("4/4")
    expect(on[1].meter).toBe("6/8")
    expect(on.at(-1)?.meter).toBe("3/4")
  })

  it("keeps every repetition at the typed BPM when increase is 0", () => {
    const session = example()
    session.bpmIncrease = 0
    const bpms = expandSession(session).filter((segment) => segment.kind === "play").map((segment) => segment.bpm)
    expect(bpms).toEqual([80, 80, 80, 100])
  })

  it("caps a repetition at 300 and holds later repetitions of that set", () => {
    const session = createDefaultSession(() => "fast")
    session.bpmIncrease = 20
    session.sets[0].bpm = 290
    session.sets[0].repeats = 3
    session.sets[0].restSec = 0
    const plays = expandSession(session).filter((segment) => segment.kind === "play")
    expect(plays.map((segment) => segment.bpm)).toEqual([290, 300, 300])
  })

  it("omits a 0 second rest and still counts in", () => {
    const session = example()
    session.sets[0].restSec = 0
    session.sets[0].repeats = 2
    session.sets.pop()
    const kinds = expandSession(session).map((segment) => segment.kind)
    expect(kinds).toEqual(["count-in", "play", "count-in", "play"])
  })
})
