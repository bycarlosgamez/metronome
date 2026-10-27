import { useState } from "react"
import { formatDuration, parseDuration } from "./format"
import { clampSession, sessionTitle } from "./session"
import type { Session } from "./types"

export function Edit(props: {
  session: Session
  onChange(session: Session): void
  onDone(): void
}) {
  const length = props.session.simple.length
  const [text, setText] = useState(() => formatDuration(length.unit === "time" ? length.seconds : length.bars))

  return (
    <main className="editor-screen">
      <header className="topbar">
        <h1 aria-label="Mentronome">{sessionTitle(props.session)}</h1>
        <button type="button" className="quiet" onClick={props.onDone}>
          Done
        </button>
      </header>
      <input
        aria-label="Length"
        value={text}
        onChange={(event) => setText(event.target.value)}
        onBlur={() => {
          props.onChange(clampSession({
            ...props.session,
            simple: {
              ...props.session.simple,
              length: { unit: "time", seconds: Math.max(1, parseDuration(text)) },
            },
          }))
        }}
      />
    </main>
  )
}
