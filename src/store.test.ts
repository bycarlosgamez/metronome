import { describe, expect, it } from "vitest"
import { createDefaultSession } from "./session"
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
    expect(loaded.sets).toHaveLength(1)
    expect(loaded.sets[0].name).toBe("Set 1")
  })

  it("loads the first-visit session when nothing is saved", () => {
    expect(loadSession(memory()).sets[0].bpm).toBe(80)
  })
})
