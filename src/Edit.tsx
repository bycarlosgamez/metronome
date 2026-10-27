import { useEffect, useRef, useState } from "react"
import { expandSession } from "./expandSession"
import { formatClock, formatDuration, parseDuration } from "./format"
import { clampSession, cyclesFromSimple, freshSimple, sessionTitle } from "./session"
import { CLICKS, COLORS, METERS, type ClickId, type Cycle, type Length, type Meter, type Session } from "./types"

function lengthText(length: Length): string {
  return length.unit === "time" ? formatDuration(length.seconds) : String(length.bars)
}

function lengthFromText(unit: Length["unit"], text: string): Length {
  if (unit === "bars") return { unit: "bars", bars: Number(text) }
  return { unit: "time", seconds: parseDuration(text) }
}

function lengthWithUnit(length: Length, unit: "time" | "bars"): Length {
  if (length.unit === unit) return length
  if (unit === "bars") return { unit: "bars", bars: 1 }
  return { unit: "time", seconds: 1 }
}

function DraftField(props: {
  label: string
  value: string
  onCommit(text: string): void
  type?: "text" | "number"
}) {
  const [text, setText] = useState(props.value)
  const textRef = useRef(text)
  const focused = useRef(false)
  textRef.current = text

  useEffect(() => {
    if (!focused.current) {
      textRef.current = props.value
      setText(props.value)
    }
  }, [props.value])

  return (
    <label>
      {props.label}
      <input
        type={props.type ?? "text"}
        aria-label={props.label}
        value={text}
        onFocus={() => {
          focused.current = true
        }}
        onChange={(event) => {
          textRef.current = event.target.value
          setText(event.target.value)
        }}
        onBlur={() => {
          focused.current = false
          props.onCommit(textRef.current)
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter") event.currentTarget.blur()
        }}
      />
    </label>
  )
}

function LengthUnitSelect(props: { length: Length; onChange(length: Length): void }) {
  return (
    <label>
      Length unit
      <select
        aria-label="Length unit"
        value={props.length.unit}
        onChange={(event) => {
          const unit = event.target.value === "bars" ? "bars" : "time"
          props.onChange(lengthWithUnit(props.length, unit))
        }}
      >
        <option value="time">time</option>
        <option value="bars">bars</option>
      </select>
    </label>
  )
}

function SimpleFields(props: { session: Session; commit(session: Session): void }) {
  const pattern = props.session.simple

  function patch(partial: Partial<Session["simple"]>) {
    props.commit({ ...props.session, simple: { ...pattern, ...partial } })
  }

  return (
    <>
      <DraftField label="Practices" value={String(pattern.practices)} onCommit={(text) => patch({ practices: Number(text) })} />
      <DraftField label="Length" value={lengthText(pattern.length)} onCommit={(text) => patch({ length: lengthFromText(pattern.length.unit, text) })} />
      <LengthUnitSelect length={pattern.length} onChange={(length) => patch({ length })} />
      <DraftField label="Rest after" value={formatDuration(pattern.restAfterSec)} onCommit={(text) => patch({ restAfterSec: parseDuration(text) })} />
      <button type="button" aria-pressed={pattern.stepTempo} onClick={() => patch({ stepTempo: !pattern.stepTempo })}>
        Step the tempo
      </button>
      {pattern.stepTempo && (
        <DraftField label="Times" value={String(pattern.times)} onCommit={(text) => patch({ times: Number(text) })} />
      )}
      <button type="button" aria-pressed={pattern.repeatRound} onClick={() => patch({ repeatRound: !pattern.repeatRound })}>
        Repeat the round
      </button>
      {pattern.repeatRound && (
        <>
          <DraftField label="Rounds" value={String(pattern.rounds)} onCommit={(text) => patch({ rounds: Number(text) })} />
          <DraftField label="Between" value={formatDuration(pattern.restBetweenSec)} onCommit={(text) => patch({ restBetweenSec: parseDuration(text) })} />
        </>
      )}
    </>
  )
}

function withoutBpm(cycle: Cycle): Cycle {
  const next = { ...cycle }
  delete next.bpm
  return next
}

function CycleList(props: { session: Session; commit(session: Session): void }) {
  const { session, commit } = props

  function replace(index: number, cycle: Cycle) {
    commit({
      ...session,
      cycles: session.cycles.map((item, i) => i === index ? cycle : item),
    })
  }

  function move(index: number, direction: -1 | 1) {
    const target = index + direction
    if (target < 0 || target >= session.cycles.length) return
    const cycles = session.cycles.slice()
    const [cycle] = cycles.splice(index, 1)
    cycles.splice(target, 0, cycle)
    commit({ ...session, cycles })
  }

  function add() {
    const last = session.cycles[session.cycles.length - 1]
    commit({
      ...session,
      cycles: [
        ...session.cycles,
        { id: crypto.randomUUID(), length: { ...last.length }, restSec: last.restSec },
      ],
    })
  }

  return (
    <>
      {session.cycles.map((cycle, index) => (
        <div className="cycle-row" key={cycle.id}>
          <span>{index + 1}</span>
          <div>
            <DraftField
              label="Length"
              value={lengthText(cycle.length)}
              onCommit={(text) => replace(index, { ...cycle, length: lengthFromText(cycle.length.unit, text) })}
            />
            <LengthUnitSelect length={cycle.length} onChange={(length) => replace(index, { ...cycle, length })} />
            {cycle.bpm !== undefined && (
              <DraftField
                label={`Cycle ${index + 1} BPM`}
                value={String(cycle.bpm)}
                type="number"
                onCommit={(text) => replace(index, { ...cycle, bpm: Number(text) })}
              />
            )}
          </div>
          <DraftField
            label="Rest"
            value={formatDuration(cycle.restSec)}
            onCommit={(text) => replace(index, { ...cycle, restSec: parseDuration(text) })}
          />
          <div className="cycle-actions">
            {cycle.bpm !== undefined && (
              <button type="button" onClick={() => replace(index, withoutBpm(cycle))}>
                Use session tempo
              </button>
            )}
            <button type="button" disabled={index === 0} onClick={() => move(index, -1)}>
              {`Move cycle ${index + 1} up`}
            </button>
            <button type="button" disabled={index === session.cycles.length - 1} onClick={() => move(index, 1)}>
              {`Move cycle ${index + 1} down`}
            </button>
            <button
              type="button"
              disabled={session.cycles.length === 1}
              onClick={() => {
                if (session.cycles.length === 1) return
                commit({ ...session, cycles: session.cycles.filter((_, i) => i !== index) })
              }}
            >
              {`Remove cycle ${index + 1}`}
            </button>
          </div>
        </div>
      ))}
      <button type="button" onClick={add}>Add cycle</button>
    </>
  )
}

export function Edit(props: {
  session: Session
  onChange(session: Session): void
  onDone(): void
}) {
  const openedAsComplex = useRef(props.session.type === "complex")
  const installedFreshSimple = useRef(false)
  const [session, setSession] = useState(props.session)

  useEffect(() => {
    setSession(props.session)
  }, [props.session])

  function commit(next: Session) {
    const clamped = clampSession(next)
    setSession(clamped)
    props.onChange(clamped)
  }

  function choose(type: "simple" | "complex") {
    if (type === session.type) return
    if (openedAsComplex.current) {
      if (type === "simple") {
        const simple = installedFreshSimple.current ? session.simple : freshSimple()
        installedFreshSimple.current = true
        commit({ ...session, type: "simple", simple })
        return
      }
      commit({ ...session, type: "complex" })
      return
    }
    if (type === "complex") {
      commit({
        ...session,
        type: "complex",
        every: session.simple.practices,
        cycles: cyclesFromSimple(session, () => crypto.randomUUID()),
      })
      return
    }
    commit({ ...session, type: "simple" })
  }

  const totalSec = expandSession(session).reduce((sum, segment) => sum + segment.durationSec, 0)

  return (
    <main className="editor-screen">
      <header className="topbar">
        <h1 aria-label="Mentronome">{sessionTitle(session)}</h1>
        <button type="button" className="quiet" onClick={props.onDone}>Done</button>
      </header>
      <div className="editor-cards">
        <section className="editor-card">
          <label>
            Name
            <input
              value={session.name}
              onChange={(event) => commit({ ...session, name: event.target.value })}
            />
          </label>
          <div className="color-field">
            <span id="session-color">Color</span>
            <div className="color-dots" role="radiogroup" aria-labelledby="session-color">
              {COLORS.map((color) => (
                <button
                  key={color}
                  type="button"
                  role="radio"
                  aria-label={color}
                  aria-checked={session.color === color}
                  className={`color-${color}`}
                  onClick={() => commit({ ...session, color })}
                />
              ))}
            </div>
          </div>
          <div className="type-switch" role="group" aria-label="Type">
            <button type="button" aria-pressed={session.type === "simple"} onClick={() => choose("simple")}>Simple</button>
            <button type="button" aria-pressed={session.type === "complex"} onClick={() => choose("complex")}>Complex</button>
          </div>
        </section>
        <section className="editor-card">
          <DraftField label="BPM" value={String(session.bpm)} onCommit={(text) => commit({ ...session, bpm: Number(text) })} />
          <label>
            Meter
            <select
              aria-label="Meter"
              value={session.meter}
              onChange={(event) => commit({ ...session, meter: event.target.value as Meter })}
            >
              {METERS.map((meter) => (
                <option key={meter} value={meter}>{meter}</option>
              ))}
            </select>
          </label>
          <DraftField label="BPM increase" value={String(session.bpmIncrease)} onCommit={(text) => commit({ ...session, bpmIncrease: Number(text) })} />
          {session.type === "complex" && (
            <DraftField label="Every" value={String(session.every)} onCommit={(text) => commit({ ...session, every: Number(text) })} />
          )}
          <label>
            Click
            <select
              aria-label="Click"
              value={session.click}
              onChange={(event) => commit({ ...session, click: event.target.value as ClickId })}
            >
              {CLICKS.map((click) => (
                <option key={click} value={click}>{click}</option>
              ))}
            </select>
          </label>
        </section>
      </div>
      <section className="editor-builder">
        {session.type === "simple" ? <SimpleFields session={session} commit={commit} /> : <CycleList session={session} commit={commit} />}
        <p>Total {formatClock(totalSec)}</p>
      </section>
    </main>
  )
}
