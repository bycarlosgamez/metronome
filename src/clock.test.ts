import { describe, expect, it } from "vitest"
import { clicksInSegment, snapshotAt } from "./clock"
import { expandSession } from "./expandSession"
import { createDefaultSession } from "./session"

describe("clock", () => {
  it("starts on the first count-in beat and enters the playing stretch after that bar", () => {
    const session = createDefaultSession(() => "set-1")
    const segments = expandSession(session)
    const countIn = (4 * 60) / 80
    const start = snapshotAt(segments, 0)
    expect(start.segmentIndex).toBe(0)
    expect(start.beat).toBe(1)
    expect(segments[start.segmentIndex].kind).toBe("count-in")

    const playing = snapshotAt(segments, countIn)
    expect(playing.segmentIndex).toBe(1)
    expect(playing.beat).toBe(1)
    expect(segments[playing.segmentIndex].kind).toBe("play")
  })

  it("reports no beat during a rest", () => {
    const session = createDefaultSession(() => "set-1")
    session.simple.practices = 2
    session.simple.restAfterSec = 30
    const segments = expandSession(session)
    const restIndex = segments.findIndex((segment) => segment.kind === "rest")
    const restStart = segments.slice(0, restIndex).reduce((sum, segment) => sum + segment.durationSec, 0)
    expect(snapshotAt(segments, restStart).beat).toBe(0)
  })

  it("places four accented-on-one count-in clicks and no rest clicks", () => {
    const session = createDefaultSession(() => "set-1")
    session.simple.practices = 2
    session.simple.restAfterSec = 30
    const segments = expandSession(session)
    const countIn = clicksInSegment(segments[0])
    expect(countIn).toHaveLength(4)
    expect(countIn.map((click) => click.beat)).toEqual([1, 2, 3, 4])
    expect(countIn[0].accent).toBe(true)
    expect(countIn[1].accent).toBe(false)
    expect(countIn[0].offsetSec).toBe(0)
    expect(countIn[1].offsetSec).toBeCloseTo(60 / 80)

    const rest = segments.find((segment) => segment.kind === "rest")!
    expect(clicksInSegment(rest)).toEqual([])
  })
})
