import { describe, expect, it } from "vitest"
import { createDefaultSession, freshTime } from "./session"
import { SESSION_KEY, loadSession, saveSession } from "./store"

function memory(): Storage {
  const values = new Map<string, string>()
  return {
    get length() {
      return values.size
    },
    clear: () => values.clear(),
    getItem: (key) => values.get(key) ?? null,
    key: (index) => [...values.keys()][index] ?? null,
    removeItem: (key) => values.delete(key),
    setItem: (key, value) => values.set(key, value),
  }
}

describe("store", () => {
  it("round-trips a session", () => {
    const storage = memory()
    const session = createDefaultSession(() => "set-1")
    session.name = "Evening practice"
    saveSession(session, storage)
    expect(storage.getItem(SESSION_KEY)).toContain("Evening practice")
    expect(loadSession(storage)).toEqual(session)
  })

  it("loads the first-visit session when the save cannot be read", () => {
    const storage = memory()
    storage.setItem(SESSION_KEY, "{")
    const loaded = loadSession(storage)
    expect(loaded.name).toBe("Practice")
    expect(loaded.type).toBe("time")
    expect(loaded.bpm).toBe(80)
    expect(loaded.simple.length).toEqual({ unit: "time", seconds: 120 })
  })

  it("loads the first-visit session when nothing is saved", () => {
    const loaded = loadSession(memory())
    expect(loaded.type).toBe("time")
    expect(loaded.bpm).toBe(80)
    expect(loaded.simple.length).toEqual({ unit: "time", seconds: 120 })
  })

  it("keeps a saved simple session", () => {
    const storage = memory()
    const session = createDefaultSession(() => "set-1")
    session.type = "simple"
    saveSession(session, storage)
    expect(loadSession(storage).type).toBe("simple")
  })

  it("migrates an old set list", () => {
    const storage = memory()
    storage.setItem(SESSION_KEY, JSON.stringify({
      name: "Evening",
      meter: "3/4",
      perSetMeter: false,
      bpmIncrease: 0,
      click: "click-1",
      sets: [{ id: "set-1", name: "Set 1", durationSec: 90, bpm: 100, restSec: 10, repeats: 1, color: "green", meter: "3/4" }],
    }))
    const loaded = loadSession(storage)
    expect(loaded.type).toBe("complex")
    expect(loaded.name).toBe("Evening")
    expect(loaded.bpm).toBe(100)
    expect(loaded.cycles[0]).toMatchObject({ length: { unit: "time", seconds: 90 }, restSec: 0 })
    expect(loaded.color).toBe("green")
  })

  it("loads a time session and fills a missing time pattern", () => {
    const storage = memory()
    const session = createDefaultSession(() => "cycle-1")
    session.type = "time"
    session.time.seconds = 90
    saveSession(session, storage)
    expect(loadSession(storage)).toMatchObject({ type: "time", time: { seconds: 90 } })

    const { time: _time, ...withoutTime } = createDefaultSession(() => "cycle-1")
    storage.setItem(SESSION_KEY, JSON.stringify(withoutTime))
    const loaded = loadSession(storage)
    expect(loaded.type).toBe("time")
    expect(loaded.time).toEqual(freshTime())
  })
})
