import { describe, expect, it } from "vitest"
import { scheduleSegment, type ClickSounds } from "./audio"
import { expandSession } from "./expandSession"
import { createDefaultSession } from "./session"

function fakeContext() {
  const started: { when: number; name: string }[] = []
  const sounds: ClickSounds = {
    restCue: { name: "cue" } as unknown as AudioBuffer,
    clicks: {
      "click-1": {
        normal: { name: "normal" } as unknown as AudioBuffer,
        accent: { name: "accent" } as unknown as AudioBuffer,
      },
      "click-2": {
        normal: { name: "click-2-normal" } as unknown as AudioBuffer,
        accent: { name: "click-2-accent" } as unknown as AudioBuffer,
      },
      "click-3": {
        normal: { name: "click-3-normal" } as unknown as AudioBuffer,
        accent: { name: "click-3-accent" } as unknown as AudioBuffer,
      },
      "click-4": {
        normal: { name: "click-4-normal" } as unknown as AudioBuffer,
        accent: { name: "click-4-accent" } as unknown as AudioBuffer,
      },
    },
  }
  return {
    started,
    sounds,
    ctx: {
      currentTime: 0,
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
    session.type = "simple"
    session.bpm = 60
    session.simple.practices = 2
    session.simple.restAfterSec = 30
    const segments = expandSession(session)
    const { ctx, sounds, started } = fakeContext()
    scheduleSegment(ctx, sounds, segments[0], 10)
    expect(started.map((click) => click.when)).toEqual([10, 11, 12, 13])
    expect(started[0].name).toBe("accent")
    expect(started[1].name).toBe("normal")

    started.length = 0
    const rest = segments.find((segment) => segment.kind === "rest")!
    scheduleSegment(ctx, sounds, rest, 20)
    expect(started).toEqual([{ when: 20, name: "cue" }])
  })

  it("plays an eighth slot from that slot's normal buffer", () => {
    const session = createDefaultSession(() => "set-1")
    session.bpm = 80
    session.time.increaseEvery = "time"
    session.subdivision = "eighth"
    session.slots = ["click-1", "click-2"]
    const play = expandSession(session).find((segment) => segment.kind === "play")!
    const { ctx, sounds, started } = fakeContext()
    scheduleSegment(ctx, sounds, play, 0)
    expect(started[0]).toEqual({ when: 0, name: "accent" })
    expect(started[1].when).toBeCloseTo(0.375)
    expect(started[1].name).toBe("click-2-normal")
  })
})
