import { snapshotAt } from "./clock"
import { expandSession } from "./expandSession"
import { Practice } from "./Practice"
import { createDefaultSession } from "./session"

export function App() {
  const session = createDefaultSession()
  const segments = expandSession(session)
  return (
    <Practice
      session={session}
      segments={segments}
      snapshot={snapshotAt(segments, 0)}
      status="stopped"
      onToggle={() => {}}
      onJump={() => {}}
      onReset={() => {}}
      onEdit={() => {}}
    />
  )
}
