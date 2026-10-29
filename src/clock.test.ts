import { describe, expect, it } from "vitest"
import { clickWindow, clicksInSegment, scheduleOrigin, snapshotAt } from "./clock"
import { expandSession, type Segment } from "./expandSession"
import { createDefaultSession } from "./session"

describe("clock", () => {
  it("starts on the first count-in beat and enters the playing stretch after that bar", () => {
    const session = createDefaultSession(() => "set-1")
    session.type = "simple"
    session.countIn = true
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
    session.routineEnabled = true
    session.routine = { ...session.routine, unit: "sec", playDuration: 60, round: { enabled: true, count: 2, restDuration: 0 }, restDuration: 30 }
    const segments = expandSession(session)
    const restIndex = segments.findIndex((segment) => segment.kind === "rest")
    const restStart = segments.slice(0, restIndex).reduce((sum, segment) => sum + segment.durationSec, 0)
    expect(snapshotAt(segments, restStart).beat).toBe(0)
  })

  it("places four accented-on-one count-in clicks and no rest clicks", () => {
    const session = createDefaultSession(() => "set-1")
    session.countIn = true
    session.routineEnabled = true
    session.routine = { ...session.routine, unit: "sec", playDuration: 60, round: { enabled: true, count: 2, restDuration: 0 }, restDuration: 30 }
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

  it("keeps the beat count when a later window uses a new BPM", () => {
    const segment: Segment = {
      kind: "play",
      setId: "time",
      label: "Practice",
      repetition: 1,
      bpm: 80,
      meter: "4/4",
      durationSec: 3,
      color: "red",
      setIndex: 0,
      cycleIndex: 0,
      click: "click-1",
      steps: [
        { atSec: 0, bpm: 80 },
        { atSec: 1, bpm: 85 },
      ],
    }
    const clicks = clicksInSegment(segment)
    expect(clicks[0]).toMatchObject({ offsetSec: 0, beat: 1, accent: true })
    expect(clicks[1]).toMatchObject({ offsetSec: 0.75, beat: 2, accent: false })
    expect(clicks[2].offsetSec).toBeCloseTo(1.5)
    expect(clicks[2].beat).toBe(3)
    expect(clicks[3].offsetSec - clicks[2].offsetSec).toBeCloseTo(60 / 85)
    expect(clicks.at(-1)!.offsetSec).toBeLessThan(3)
    expect(snapshotAt([segment], 1.5).beat).toBe(3)
    expect(snapshotAt([segment], 1 + 1e-6).beat).toBe(2)
    expect(snapshotAt([segment], 1.5 + 1e-6).beat).toBe(3)
  })

  it("divides a beat into eighths and skips an off slot", () => {
    const session = createDefaultSession(() => "cycle-1")
    session.bpm = 80
    session.meter = "4/4"
    session.time.increaseEvery = "bars"
    session.subdivision = "eighth"
    session.slots = ["click-1", "click-1"]
    const segments = expandSession(session)

    const play = segments.find((segment) => segment.kind === "play")!
    const clicks = clicksInSegment(play, 0, 4)
    expect(clicks[0]).toMatchObject({ offsetSec: 0, beat: 1, accent: true, click: "click-1" })
    expect(clicks[1].offsetSec).toBeCloseTo(0.375)
    expect(clicks[1]).toMatchObject({ beat: 1, accent: true, click: "click-1" })
    expect(clicks[2].offsetSec).toBeCloseTo(0.75)
    expect(clicks[2]).toMatchObject({ beat: 2, accent: false })
    expect(snapshotAt(segments, 0.4).beat).toBe(1)

    session.slots = ["click-1", "off"]
    const beatsOnly = clicksInSegment(expandSession(session).find((segment) => segment.kind === "play")!, 0, 4)
    expect(beatsOnly.slice(0, 4).map((click) => click.offsetSec)).toEqual([0, 0.75, 1.5, 2.25])

    session.meter = "6/8"
    session.subdivision = "quarter"
    session.slots = ["click-1"]
    const six = clicksInSegment(expandSession(session).find((segment) => segment.kind === "play")!, 0, 4)
    expect(six.slice(0, 6).map((click) => click.beat)).toEqual([1, 2, 3, 4, 5, 6])
    expect(six[1].offsetSec - six[0].offsetSec).toBeCloseTo(60 / 80)

    session.meter = "4/8"
    const fourEight = clicksInSegment(expandSession(session).find((segment) => segment.kind === "play")!, 0, 4)
    expect(fourEight[1].offsetSec - fourEight[0].offsetSec).toBeCloseTo(60 / 80)
  })

  it("splits one beat into five quintuplet clicks", () => {
    const session = createDefaultSession(() => "cycle-1")
    session.bpm = 60
    session.time.increaseEvery = "bars"
    session.subdivision = "quintuplet"
    session.slots = ["click-1", "click-1", "click-1", "click-1", "click-1"]
    const segments = expandSession(session)
    const play = segments.find((segment) => segment.kind === "play")!
    expect(clicksInSegment(play, 0, 4).slice(0, 5).map((click) => click.offsetSec)).toEqual([0, 0.2, 0.4, expect.closeTo(0.6), 0.8])
    expect(clicksInSegment(play, 0, 4)[0].accent).toBe(true)
    expect(clicksInSegment(play, 0, 4)[1].accent).toBe(true)
  })

  it("places the next two seconds of an endless play and then the following stretch", () => {
    const session = createDefaultSession(() => "cycle-1")
    session.type = "time"
    session.bpm = 60
    const play = expandSession(session).find((segment) => segment.kind === "play")!
    const first = clickWindow(play, 0)
    expect(first.untilSec).toBe(2)
    expect(first.marks.map((mark) => mark.offsetSec)).toEqual([0, 1])
    const second = clickWindow(play, first.untilSec)
    expect(second.marks.map((mark) => mark.offsetSec)).toEqual([2, 3])
    expect(clicksInSegment(play)).toEqual([])
  })

  it("includes a downbeat that is still inside the scheduling grace", () => {
    const session = createDefaultSession(() => "cycle-1")
    session.bpm = 80
    const play = expandSession(session).find((segment) => segment.kind === "play")!
    const origin = scheduleOrigin(0.02)
    expect(origin).toBe(0)
    expect(clickWindow(play, origin).marks[0].offsetSec).toBe(0)
  })
})
