import { useEffect, useRef, useState } from "react"
import { expandSession } from "./expandSession"
import { formatClock, formatDuration, parseDuration } from "./format"
import { clampSession, cycleGroupFromSimple, cyclesFromSimple, freshComplex, freshSimple, freshTime, sessionTitle } from "./session"
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

const CLICK_LABELS: Record<ClickId, string> = {
  "click-1": "Click 1",
  "click-2": "Click 2",
  "click-3": "Click 3",
  "click-4": "Click 4",
}

function DraftField(props: {
  label: string
  value: string
  onCommit(text: string): void
  type?: "text" | "number"
  bare?: boolean
}) {
  const [text, setText] = useState(props.value)
  const textRef = useRef(text)
  const focused = useRef(false)
  const [commitEpoch, setCommitEpoch] = useState(0)
  textRef.current = text

  useEffect(() => {
    if (!focused.current) {
      textRef.current = props.value
      setText(props.value)
    }
  }, [props.value, commitEpoch])

  const input = (
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
        setCommitEpoch((epoch) => epoch + 1)
      }}
      onKeyDown={(event) => {
        if (event.key === "Enter") event.currentTarget.blur()
      }}
    />
  )
  if (props.bare) return input
  return (
    <label>
      {props.label}
      {input}
    </label>
  )
}

function LengthField(props: {
  label: string
  length: Length
  onText(text: string): void
  onUnit(length: Length): void
}) {
  return (
    <div className="stacked-field">
      <span className="field-label">{props.label}</span>
      <div className="length-box">
        <DraftField bare label={props.label} value={lengthText(props.length)} onCommit={props.onText} />
        <select
          aria-label={`${props.label} unit`}
          value={props.length.unit}
          onChange={(event) => {
            const unit = event.target.value === "bars" ? "bars" : "time"
            props.onUnit(lengthWithUnit(props.length, unit))
          }}
        >
          <option value="time">time</option>
          <option value="bars">bars</option>
        </select>
      </div>
    </div>
  )
}

function SimpleFields(props: { session: Session; commit(session: Session): void }) {
  const pattern = props.session.simple

  function patch(partial: Partial<Session["simple"]>) {
    props.commit({ ...props.session, simple: { ...pattern, ...partial } })
  }

  return (
    <>
      <div className="sub-card">
        <p className="card-title">Interval</p>
        <div className="interval-row">
          <DraftField label="Practices" value={String(pattern.practices)} onCommit={(text) => patch({ practices: Number(text) })} />
          <LengthField
            label="Length"
            length={pattern.length}
            onText={(text) => patch({ length: lengthFromText(pattern.length.unit, text) })}
            onUnit={(length) => patch({ length })}
          />
          <DraftField label="Rest after" value={formatDuration(pattern.restAfterSec)} onCommit={(text) => patch({ restAfterSec: parseDuration(text) })} />
        </div>
        <div className="switch-row">
          <span>Repeat interval</span>
          <button type="button" className="switch" aria-label="Repeat interval" aria-pressed={pattern.stepTempo} onClick={() => patch({ stepTempo: !pattern.stepTempo })}>
            {pattern.stepTempo ? "On" : "Off"}
          </button>
        </div>
        {pattern.stepTempo && (
          <DraftField label="Times" value={String(pattern.times)} onCommit={(text) => patch({ times: Number(text) })} />
        )}
      </div>
      <div className="switch-row">
        <span>Repeat the round</span>
        <button type="button" className="switch" aria-label="Repeat the round" aria-pressed={pattern.repeatRound} onClick={() => patch({ repeatRound: !pattern.repeatRound })}>
          {pattern.repeatRound ? "On" : "Off"}
        </button>
      </div>
      {pattern.repeatRound && (
        <div className="pair-row">
          <DraftField label="Rounds" value={String(pattern.rounds)} onCommit={(text) => patch({ rounds: Number(text) })} />
          <DraftField label="Between" value={formatDuration(pattern.restBetweenSec)} onCommit={(text) => patch({ restBetweenSec: parseDuration(text) })} />
        </div>
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
          <div className="cycle-head">
            <span className="cycle-index">{index + 1}</span>
            <div className="cycle-actions">
              <button type="button" aria-label={`Move cycle ${index + 1} up`} disabled={index === 0} onClick={() => move(index, -1)}>
                <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 10 L8 6 L12 10" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
              </button>
              <button type="button" aria-label={`Move cycle ${index + 1} down`} disabled={index === session.cycles.length - 1} onClick={() => move(index, 1)}>
                <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 6 L8 10 L12 6" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
              </button>
              <button
                type="button"
                aria-label={`Remove cycle ${index + 1}`}
                disabled={session.cycles.length === 1}
                onClick={() => {
                  if (session.cycles.length === 1) return
                  commit({ ...session, cycles: session.cycles.filter((_, i) => i !== index) })
                }}
              >
                <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4.5 4.5 L11.5 11.5 M11.5 4.5 L4.5 11.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
              </button>
            </div>
          </div>
          <div className="cycle-fields">
            <div>
              <LengthField
                label="Practice"
                length={cycle.length}
                onText={(text) => replace(index, { ...cycle, length: lengthFromText(cycle.length.unit, text) })}
                onUnit={(length) => replace(index, { ...cycle, length })}
              />
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
          </div>
          {cycle.bpm !== undefined && (
            <button type="button" onClick={() => replace(index, withoutBpm(cycle))}>
              Use session tempo
            </button>
          )}
        </div>
      ))}
      <button type="button" className="add-cycle" onClick={add}>Add cycle</button>
    </>
  )
}

export function Edit(props: {
  session: Session
  onChange(session: Session): void
  onDone(): void
}) {
  const openedAs = useRef(props.session.type)
  const installedFreshSimple = useRef(false)
  const installedFreshTime = useRef(false)
  const installedFreshComplex = useRef(false)
  const [session, setSession] = useState(props.session)

  useEffect(() => {
    setSession(props.session)
  }, [props.session])

  function commit(next: Session) {
    const clamped = clampSession(next)
    setSession(clamped)
    props.onChange(clamped)
  }

  function done() {
    if (session.type === "complex") {
      commit({ ...session, simple: freshSimple(), time: freshTime() })
    } else if (session.type === "time") {
      commit({
        ...session,
        simple: freshSimple(),
        complex: freshComplex(),
        cycles: [{ id: crypto.randomUUID(), length: { unit: "time", seconds: 120 }, restSec: 30 }],
      })
    } else {
      commit({
        ...session,
        cycles: cyclesFromSimple(session, () => crypto.randomUUID()),
        complex: freshComplex(),
        time: freshTime(),
      })
    }
    props.onDone()
  }

  function choose(type: "simple" | "complex" | "time") {
    if (type === session.type) return
    const opened = openedAs.current
    if (type === "time") {
      const time = opened === "time" || installedFreshTime.current ? session.time : freshTime()
      if (opened !== "time") installedFreshTime.current = true
      commit({ ...session, type: "time", time })
      return
    }
    if (type === "complex") {
      if (opened === "simple") {
        const pattern = session.simple
        commit({
          ...session,
          type: "complex",
          cycles: cycleGroupFromSimple(session, () => crypto.randomUUID()),
          complex: {
            increaseEvery: pattern.increaseEvery,
            repeatRound: pattern.repeatRound,
            rounds: pattern.rounds,
            restBetweenSec: pattern.restBetweenSec,
          },
        })
        return
      }
      if (opened === "time" && !installedFreshComplex.current) {
        installedFreshComplex.current = true
        commit({
          ...session,
          type: "complex",
          complex: freshComplex(),
          cycles: [{ id: crypto.randomUUID(), length: { unit: "time", seconds: 120 }, restSec: 30 }],
        })
        return
      }
      commit({ ...session, type: "complex" })
      return
    }
    if (opened === "simple") {
      commit({ ...session, type: "simple" })
      return
    }
    const simple = installedFreshSimple.current ? session.simple : freshSimple()
    installedFreshSimple.current = true
    commit({ ...session, type: "simple", simple })
  }

  const totalSec = expandSession(session).reduce((sum, segment) => sum + segment.durationSec, 0)

  return (
    <main className="editor-screen">
      <header className="topbar">
        <h1 aria-label="Mentronome">{sessionTitle(session)}</h1>
        <button type="button" className="quiet" onClick={done}>Done</button>
      </header>
      <div className="editor-cards">
        <section className="editor-card">
          <p className="card-title">Session</p>
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
            <button type="button" aria-pressed={session.type === "time"} onClick={() => choose("time")}>Time</button>
          </div>
        </section>
        <section className="editor-card">
          <p className="card-title">Tempo</p>
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
          <label>
            Click
            <select
              aria-label="Click"
              value={session.click}
              onChange={(event) => commit({ ...session, click: event.target.value as ClickId })}
            >
              {CLICKS.map((click) => (
                <option key={click} value={click}>{CLICK_LABELS[click]}</option>
              ))}
            </select>
          </label>
        </section>
      </div>
      <section className="editor-card increase-card">
        <DraftField label="BPM increase" value={String(session.bpmIncrease)} onCommit={(text) => commit({ ...session, bpmIncrease: Number(text) })} />
        <div className="type-switch" role="group" aria-label="Increase every">
          {session.type === "time" ? (
            <>
              <button
                type="button"
                aria-pressed={session.time.increaseEvery !== "bars"}
                onClick={() => commit({ ...session, time: { ...session.time, increaseEvery: "time" } })}
              >
                Time
              </button>
              <button
                type="button"
                aria-pressed={session.time.increaseEvery === "bars"}
                onClick={() => commit({ ...session, time: { ...session.time, increaseEvery: "bars" } })}
              >
                Bars
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                aria-pressed={(session.type === "complex" ? session.complex.increaseEvery : session.simple.increaseEvery) !== "round"}
                onClick={() => commit(session.type === "complex"
                  ? { ...session, complex: { ...session.complex, increaseEvery: "interval" } }
                  : { ...session, simple: { ...session.simple, increaseEvery: "interval" } })}
              >
                Interval
              </button>
              <button
                type="button"
                aria-pressed={(session.type === "complex" ? session.complex.increaseEvery : session.simple.increaseEvery) === "round"}
                onClick={() => commit(session.type === "complex"
                  ? { ...session, complex: { ...session.complex, increaseEvery: "round" } }
                  : { ...session, simple: { ...session.simple, increaseEvery: "round" } })}
              >
                Round
              </button>
            </>
          )}
        </div>
        {session.type === "time" && (
          <DraftField
            label="Every"
            value={session.time.increaseEvery === "bars" ? String(session.time.everyBars) : formatDuration(session.time.everySec)}
            onCommit={(text) => commit({
              ...session,
              time: session.time.increaseEvery === "bars"
                ? { ...session.time, everyBars: Number(text) }
                : { ...session.time, everySec: parseDuration(text) },
            })}
          />
        )}
      </section>
      {session.type === "simple" ? (
        <section className="editor-builder">
          <SimpleFields session={session} commit={commit} />
          <p className="total">Total {formatClock(totalSec)}</p>
        </section>
      ) : session.type === "time" ? (
        <section className="editor-builder">
          <DraftField
            label="Duration"
            value={formatDuration(session.time.seconds)}
            onCommit={(text) => commit({ ...session, time: { ...session.time, seconds: parseDuration(text) } })}
          />
          <p className="total">Total {formatClock(totalSec)}</p>
        </section>
      ) : (
        <section className="editor-builder">
          <div className="sub-card">
            <div className="cycle-list">
              <CycleList session={session} commit={commit} />
            </div>
          </div>
          <div className="switch-row">
            <span>Repeat the round</span>
            <button
              type="button"
              className="switch"
              aria-label="Repeat the round"
              aria-pressed={session.complex.repeatRound}
              onClick={() => commit({ ...session, complex: { ...session.complex, repeatRound: !session.complex.repeatRound } })}
            >
              {session.complex.repeatRound ? "On" : "Off"}
            </button>
          </div>
          {session.complex.repeatRound && (
            <div className="pair-row">
              <DraftField label="Rounds" value={String(session.complex.rounds)} onCommit={(text) => commit({ ...session, complex: { ...session.complex, rounds: Number(text) } })} />
              <DraftField label="Between" value={formatDuration(session.complex.restBetweenSec)} onCommit={(text) => commit({ ...session, complex: { ...session.complex, restBetweenSec: parseDuration(text) } })} />
            </div>
          )}
          <p className="total">Total {formatClock(totalSec)}</p>
        </section>
      )}
    </main>
  )
}
