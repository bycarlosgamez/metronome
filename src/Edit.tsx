import { useEffect, useRef, useState } from "react"
import { expandSession } from "./expandSession"
import { formatClock, formatDuration, parseDuration } from "./format"
import { clampSession, sessionTitle } from "./session"
import { Signature } from "./Signature"
import { COLORS, type Length, type Session } from "./types"

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

export function Edit(props: {
  session: Session
  onChange(session: Session): void
  onDone(): void
}) {
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
    commit(session)
    props.onDone()
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
          <div className="switch-row">
            <span>Count-in</span>
            <button
              type="button"
              className="switch"
              aria-label="Count-in"
              aria-pressed={session.countIn}
              onClick={() => commit({ ...session, countIn: !session.countIn })}
            >
              {session.countIn ? "On" : "Off"}
            </button>
          </div>
        </section>
        <section className="editor-card">
          <p className="card-title">Tempo</p>
          <DraftField label="BPM" value={String(session.bpm)} onCommit={(text) => commit({ ...session, bpm: Number(text) })} />
          <Signature session={session} onChange={commit} />
        </section>
      </div>
      <section className="editor-builder">
        <SimpleFields session={session} commit={commit} />
        <p className="total">Total {formatClock(Number.isFinite(totalSec) ? totalSec : 0)}</p>
      </section>
    </main>
  )
}
