import { useEffect, useState } from "react"

const MAX_SEC = 99 * 60 + 59

function split(seconds: number) {
  return { min: String(Math.floor(seconds / 60)), sec: String(seconds % 60).padStart(2, "0") }
}

// MIN : SEC pair. Edits stay local until a field is left (blur or Enter), then commit as seconds.
export function TimeInput(props: { label: string; value: number; min?: number; onCommit(seconds: number): void }) {
  const [draft, setDraft] = useState(() => split(props.value))
  useEffect(() => setDraft(split(props.value)), [props.value])

  function commit() {
    const typed = (parseInt(draft.min, 10) || 0) * 60 + (parseInt(draft.sec, 10) || 0)
    const seconds = Math.min(MAX_SEC, Math.max(props.min ?? 0, typed))
    setDraft(split(seconds))
    if (seconds !== props.value) props.onCommit(seconds)
  }

  const field = (part: "min" | "sec", name: string) => (
    <label className="time-input-box">
      <input
        type="text"
        inputMode="numeric"
        maxLength={2}
        aria-label={`${props.label} ${name}`}
        value={draft[part]}
        onFocus={(event) => event.currentTarget.select()}
        onChange={(event) => setDraft({ ...draft, [part]: event.target.value.replace(/\D/g, "") })}
        onBlur={commit}
        onKeyDown={(event) => { if (event.key === "Enter") event.currentTarget.blur() }}
      />
      <span>{part.toUpperCase()}</span>
    </label>
  )

  return (
    <div className="time-input">
      {field("min", "minutes")}
      <span className="time-input-colon">:</span>
      {field("sec", "seconds")}
    </div>
  )
}
