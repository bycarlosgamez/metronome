import { useEffect, useState, type ReactNode } from "react"
import { formatDuration, parseDuration } from "./format"
import { clampSession, createSetAfter, sessionTitle, setTitle } from "./session"
import { CLICKS, COLORS, METERS, type ClickId, type Meter, type PracticeSet, type Session } from "./types"

export function Edit(props: {
  session: Session
  selectedId: string
  onChange(session: Session): void
  onSelect(id: string): void
  onDone(): void
}) {
  const [pane, setPane] = useState<"list" | "form">("list")
  const selected = props.session.sets.find((set) => set.id === props.selectedId) ?? props.session.sets[0]
  const [duration, setDuration] = useState(() => formatDuration(selected.durationSec))
  const [bpm, setBpm] = useState(() => String(selected.bpm))
  const [rest, setRest] = useState(() => String(selected.restSec))
  const [repeats, setRepeats] = useState(() => String(selected.repeats))
  const [bpmIncrease, setBpmIncrease] = useState(() => String(props.session.bpmIncrease))

  useEffect(() => {
    setDuration(formatDuration(selected.durationSec))
    setBpm(String(selected.bpm))
    setRest(String(selected.restSec))
    setRepeats(String(selected.repeats))
    setBpmIncrease(String(props.session.bpmIncrease))
  }, [selected, props.session.bpmIncrease])

  function commit(session: Session) {
    props.onChange(clampSession(session))
  }

  function patchSession(patch: Partial<Session>) {
    commit({ ...props.session, ...patch })
  }

  function patchSet(patch: Partial<PracticeSet>) {
    commit({
      ...props.session,
      sets: props.session.sets.map((set) => (set.id === selected.id ? { ...set, ...patch } : set)),
    })
  }

  return (
    <main>
      <header className="topbar">
        <h1 aria-label="Mentronome">{sessionTitle(props.session)}</h1>
        <button type="button" className="quiet" onClick={props.onDone}>
          Done
        </button>
      </header>
      <div className="editor" data-pane={pane}>
        <section className="editor-list">
          <Field label="Session name">
            <input value={props.session.name} onChange={(event) => patchSession({ name: event.target.value })} />
          </Field>
          {props.session.sets.map((set) => (
            <button
              key={set.id}
              type="button"
              className={`color-${set.color}`}
              aria-current={set.id === selected.id ? "true" : undefined}
              onClick={() => {
                props.onSelect(set.id)
                setPane("form")
              }}
            >
              {setTitle(set)} {set.bpm} {set.restSec} {set.repeats} {formatDuration(set.durationSec)}
            </button>
          ))}
          <button type="button" onClick={() => {
            const last = props.session.sets[props.session.sets.length - 1]
            commit({
              ...props.session,
              sets: [...props.session.sets, createSetAfter(last, props.session.sets.length + 1, crypto.randomUUID())],
            })
          }}>
            Add set
          </button>
          <button type="button" onClick={() => commit({ ...props.session, sets: moveSets(props.session.sets, selected.id, -1) })}>
            Move up
          </button>
          <button type="button" onClick={() => commit({ ...props.session, sets: moveSets(props.session.sets, selected.id, 1) })}>
            Move down
          </button>
          <button
            type="button"
            disabled={props.session.sets.length <= 1}
            onClick={() => {
              const index = props.session.sets.findIndex((set) => set.id === selected.id)
              const sets = props.session.sets.filter((set) => set.id !== selected.id)
              if (sets.length === props.session.sets.length) return
              commit({ ...props.session, sets })
              const neighbor = sets[Math.min(index, sets.length - 1)]
              if (neighbor) props.onSelect(neighbor.id)
            }}
          >
            Delete set
          </button>
          <Field label="Meter">
            <select value={props.session.meter} onChange={(event) => patchSession({ meter: event.target.value as Meter })}>
              {METERS.map((meter) => (
                <option key={meter} value={meter}>
                  {meter}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Different meter per set">
            <input
              type="checkbox"
              checked={props.session.perSetMeter}
              onChange={(event) => patchSession({ perSetMeter: event.target.checked })}
            />
          </Field>
          <Field label="BPM increase">
            <input
              type="number"
              value={bpmIncrease}
              onChange={(event) => setBpmIncrease(event.target.value)}
              onBlur={() => patchSession({ bpmIncrease: Number(bpmIncrease) })}
            />
          </Field>
          <Field label="Click">
            <select value={props.session.click} onChange={(event) => patchSession({ click: event.target.value as ClickId })}>
              {CLICKS.map((click) => (
                <option key={click} value={click}>
                  {click}
                </option>
              ))}
            </select>
          </Field>
        </section>
        <section className="editor-form">
          <button type="button" className="back-to-sets" onClick={() => setPane("list")}>
            Back
          </button>
          <Field label="Name">
            <input value={selected.name} onChange={(event) => patchSet({ name: event.target.value })} />
          </Field>
          <Field label="Duration">
            <input
              value={duration}
              onChange={(event) => setDuration(event.target.value)}
              onBlur={() => patchSet({ durationSec: parseDuration(duration) })}
            />
          </Field>
          <Field label="BPM">
            <input
              type="number"
              value={bpm}
              onChange={(event) => setBpm(event.target.value)}
              onBlur={() => patchSet({ bpm: Number(bpm) })}
            />
          </Field>
          <Field label="Rest">
            <input
              type="number"
              value={rest}
              onChange={(event) => setRest(event.target.value)}
              onBlur={() => patchSet({ restSec: Number(rest) })}
            />
          </Field>
          <Field label="Repeats">
            <input
              type="number"
              value={repeats}
              onChange={(event) => setRepeats(event.target.value)}
              onBlur={() => patchSet({ repeats: Number(repeats) })}
            />
          </Field>
          <div className="color-field">
            <span id="set-color">Color</span>
            <div className="color-dots" role="radiogroup" aria-labelledby="set-color">
              {COLORS.map((color) => (
                <button
                  key={color}
                  type="button"
                  role="radio"
                  aria-label={color}
                  aria-checked={selected.color === color}
                  className={`color-${color}`}
                  onClick={() => patchSet({ color })}
                />
              ))}
            </div>
          </div>
          {props.session.perSetMeter && (
            <Field label="Set meter">
              <select value={selected.meter} onChange={(event) => patchSet({ meter: event.target.value as Meter })}>
                {METERS.map((meter) => (
                  <option key={meter} value={meter}>
                    {meter}
                  </option>
                ))}
              </select>
            </Field>
          )}
        </section>
      </div>
    </main>
  )
}

function Field(props: { label: string; children: ReactNode }) {
  return (
    <label>
      {props.label}
      {props.children}
    </label>
  )
}

function moveSets(sets: PracticeSet[], id: string, direction: -1 | 1): PracticeSet[] {
  const index = sets.findIndex((set) => set.id === id)
  const target = index + direction
  if (index < 0 || target < 0 || target >= sets.length) return sets
  const copy = sets.slice()
  const [item] = copy.splice(index, 1)
  copy.splice(target, 0, item)
  return copy
}
