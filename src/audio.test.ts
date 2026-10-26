import { describe, expect, it } from "vitest"
import { scheduleSegment } from "./audio"
import { expandSession } from "./expandSession"
import { createDefaultSession } from "./session"

function fakeContext() {
  const started: { when: number; name: string }[] = []
  const buffers = {
    normal: { name: "normal" },
    accent: { name: "accent" },
    restCue: { name: "cue" },
  }
  return {
    started,
    buffers,
    ctx: {
      createBufferSource() {
        let chosen = ""
        return {
          set buffer(value: { name: string }) {
            chosen = value.name
          },
          connect() {},
          start(when: number) {
            started.push({ when, name: chosen })
          },
        }
      },
    } as unknown as AudioContext,
  }
}

describe("scheduleSegment", () => {
  it("schedules four count-in clicks and one rest cue", () => {
    const session = createDefaultSession(() => "set-1")
    session.sets[0].bpm = 60
    session.sets[0].repeats = 2
    const segments = expandSession(session)
    const { ctx, buffers, started } = fakeContext()
    scheduleSegment(ctx, buffers as never, segments[0], 10)
    expect(started.map((click) => click.when)).toEqual([10, 11, 12, 13])
    expect(started[0].name).toBe("accent")
    expect(started[1].name).toBe("normal")

    started.length = 0
    const rest = segments.find((segment) => segment.kind === "rest")!
    scheduleSegment(ctx, buffers as never, rest, 20)
    expect(started).toEqual([{ when: 20, name: "cue" }])
  })
})
