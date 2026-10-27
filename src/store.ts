import { clampSession, createDefaultSession, migrateLegacy } from "./session"
import type { Session } from "./types"

export const SESSION_KEY = "mentronome.session"

export function loadSession(storage: Storage): Session {
  const raw = storage.getItem(SESSION_KEY)
  if (!raw) return createDefaultSession()
  try {
    const parsed = JSON.parse(raw) as Session & { sets?: unknown }
    if (!parsed || typeof parsed !== "object") return createDefaultSession()
    if (parsed.type === "simple" || parsed.type === "complex") return clampSession(parsed)
    return migrateLegacy(parsed) ?? createDefaultSession()
  } catch {
    return createDefaultSession()
  }
}

export function saveSession(session: Session, storage: Storage): void {
  storage.setItem(SESSION_KEY, JSON.stringify(clampSession(session)))
}
