import { describe, expect, it } from "vitest"
import {
  clampSession,
  createDefaultSession,
  createSetAfter,
  sessionTitle,
  setTitle,
} from "./session"

describe("session", () => {
  it("builds the first-visit session", () => {
    const session = createDefaultSession(() => "set-1")
    expect(session).toEqual({
      name: "Practice",
      meter: "4/4",
      perSetMeter: false,
      bpmIncrease: 0,
      click: "click-1",
      sets: [
        {
          id: "set-1",
          name: "Set 1",
          durationSec: 120,
          bpm: 80,
          restSec: 30,
          repeats: 1,
          color: "red",
          meter: "4/4",
        },
      ],
    })
  })

  it("shows Practice and Set for blank names", () => {
    const session = createDefaultSession(() => "set-1")
    session.name = "  "
    session.sets[0].name = ""
    expect(sessionTitle(session)).toBe("Practice")
    expect(setTitle(session.sets[0])).toBe("Set")
  })

  it("snaps fields to the allowed range", () => {
    const session = createDefaultSession(() => "set-1")
    session.bpmIncrease = -4
    session.sets[0].bpm = 12
    session.sets[0].durationSec = 0
    session.sets[0].restSec = -2
    session.sets[0].repeats = 0
    const clamped = clampSession(session)
    expect(clamped.bpmIncrease).toBe(0)
    expect(clamped.sets[0].bpm).toBe(40)
    expect(clamped.sets[0].durationSec).toBe(1)
    expect(clamped.sets[0].restSec).toBe(0)
    expect(clamped.sets[0].repeats).toBe(1)
  })

  it("caps bpm at 300", () => {
    const session = createDefaultSession(() => "set-1")
    session.sets[0].bpm = 900
    expect(clampSession(session).sets[0].bpm).toBe(300)
  })

  it("creates the next set from the previous one", () => {
    const session = createDefaultSession(() => "set-1")
    const next = createSetAfter(session.sets[0], 2, "set-2")
    expect(next).toMatchObject({
      id: "set-2",
      name: "Set 2",
      durationSec: 60,
      bpm: 80,
      restSec: 30,
      repeats: 1,
      color: "orange",
    })
  })

  it("cycles the palette after pink", () => {
    const session = createDefaultSession(() => "set-1")
    session.sets[0].color = "pink"
    expect(createSetAfter(session.sets[0], 2, "set-2").color).toBe("red")
  })
})
