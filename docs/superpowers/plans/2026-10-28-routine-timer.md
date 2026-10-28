# Routine Timer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "Routine" mode to the Practice page — a structured BPM-ramp timer accessible via a segmented control, while keeping the current Simple mode completely unchanged.

**Architecture:** A new `RoutinePattern` type is added to `Session`. When `session.routineEnabled` is true, `expandSession` generates discrete play/rest segments (one per BPM level per repeat). The Practice page shows a `Simple | Routine` segmented control; selecting Routine reveals a timer block with cycle/level/rep progress and inline config fields. Old `type: "time"` sessions auto-migrate in `clampSession`.

**Tech Stack:** React 19, TypeScript, Vitest 3 + Testing Library. CSS custom properties in `tokens.css`, all styles in `app.css`. No new dependencies.

---

## File Map

| File | Change |
|------|--------|
| `src/types.ts` | Add `RoutinePattern` type; add `routineEnabled` + `routine` to `Session` |
| `src/session.ts` | Add `freshRoutine`, `clampRoutine`; update `createDefaultSession`, `clampSession` |
| `src/session.test.ts` | Update first-visit test; add routine migration test |
| `src/expandSession.ts` | Add routine expansion path; update count-in logic |
| `src/expandSession.test.ts` | Add routine expansion tests |
| `src/Practice.tsx` | Add segmented control; add routine timer block; simplify BPM block |
| `src/Practice.test.tsx` | Add routine UI tests |
| `src/BpmSheet.tsx` | Remove target/every fields; show Step only in routine mode; add derived summary |
| `src/Edit.tsx` | Remove Time and Complex from type switcher and builder sections |
| `src/Edit.test.tsx` | Remove Time-specific tests |
| `src/app.css` | Add `.mode-seg`, `.mode-seg-btn`, `.routine-timer` and related styles |

---

## Task 1: Data model — RoutinePattern type + session helpers

**Files:**
- Modify: `src/types.ts`
- Modify: `src/session.ts`
- Modify: `src/session.test.ts`

- [ ] **Step 1: Write failing tests for the new session shape**

In `src/session.test.ts`, update the `"builds the first-visit session"` test and add a migration test. Replace the existing `it("builds the first-visit session"` block and add one new test:

```ts
// Replace existing "builds the first-visit session" test:
it("builds the first-visit session", () => {
  expect(createDefaultSession(() => "cycle-1")).toEqual({
    name: "Practice",
    color: "red",
    meter: "4/4",
    bpm: 80,
    bpmIncrease: 0,
    every: 1,
    click: "click-1",
    subdivision: "quarter",
    slots: ["click-1"],
    type: "simple",          // was "time"
    simple: freshSimple(),
    complex: freshComplex(),
    time: freshTime(),
    cycles: [{ id: "cycle-1", length: { unit: "time", seconds: 120 }, restSec: 30 }],
    routineEnabled: false,   // NEW
    routine: freshRoutine(), // NEW
  })
  // freshSimple / freshTime assertions stay unchanged
  expect(freshSimple()).toEqual({
    practices: 1,
    length: { unit: "time", seconds: 120 },
    restAfterSec: 30,
    stepTempo: false,
    times: 2,
    repeatRound: false,
    rounds: 2,
    restBetweenSec: 30,
    increaseEvery: "interval",
  })
  expect(freshTime()).toEqual({
    seconds: 120,
    targetBpm: 120,
    increaseEvery: "off",
    everySec: 30,
    everyBars: 4,
  })
})

// Add new test after the above:
it("migrates a saved time session to simple with routineEnabled", () => {
  const session = createDefaultSession(() => "cycle-1")
  session.type = "time" as Session["type"]
  session.bpm = 80
  session.bpmIncrease = 10
  session.time = { seconds: 120, targetBpm: 100, increaseEvery: "bars", everySec: 30, everyBars: 4 }
  const clamped = clampSession(session)
  expect(clamped.type).toBe("simple")
  expect(clamped.routineEnabled).toBe(true)
  // numLevels = ceil((100 - 80) / 10) = 2
  expect(clamped.routine.numLevels).toBe(2)
  expect(clamped.routine.barsPerLevel).toBe(4)
  expect(clamped.routine.repeatCount).toBe(1)
})
```

Also import `freshRoutine` and `Session` at the top of `session.test.ts`:
```ts
import {
  clampSession,
  createDefaultSession,
  cycleGroupFromSimple,
  cyclesFromSimple,
  freshComplex,
  freshRoutine,  // ADD
  freshSimple,
  freshTime,
  ladderBpm,
  lengthSeconds,
  migrateLegacy,
  sessionTitle,
  simplePlayedBpm,
  timeDurationSec,
  timeSteps,
} from "./session"
import type { Session } from "./types"  // ADD
```

- [ ] **Step 2: Run the test to confirm it fails**

```bash
npm run test -- src/session.test.ts
```

Expected: FAIL — `freshRoutine is not a function` and type mismatch on `"time"` vs `"simple"`.

- [ ] **Step 3: Add `RoutinePattern` to `src/types.ts`**

Add after the `TimePattern` type (line 55):

```ts
export type RoutinePattern = {
  barsPerLevel: number   // bars at each BPM step before advancing
  numLevels: number      // how many BPM steps (1 = no ramp)
  repeatCount: number    // how many times to run the full level sequence
  restAfterSec: number   // rest between levels and between repeats
  loop: boolean          // reserved; not yet implemented
}
```

Add `routineEnabled` and `routine` to `Session` (after line 71, `time: TimePattern`):

```ts
export type Session = {
  name: string
  color: SetColor
  meter: Meter
  bpm: number
  bpmIncrease: number
  every: number
  click: ClickId
  subdivision: Subdivision
  slots: Slot[]
  type: "simple" | "complex" | "time"
  simple: SimplePattern
  complex: ComplexPattern
  time: TimePattern
  cycles: Cycle[]
  routineEnabled: boolean      // NEW
  routine: RoutinePattern      // NEW
}
```

- [ ] **Step 4: Add `freshRoutine` and `clampRoutine` to `src/session.ts`**

Add after `freshTime()` (after line 44):

```ts
export function freshRoutine(): RoutinePattern {
  return {
    barsPerLevel: 8,
    numLevels: 4,
    repeatCount: 1,
    restAfterSec: 10,
    loop: false,
  }
}

function clampRoutine(pattern: RoutinePattern | undefined): RoutinePattern {
  const base = pattern ?? freshRoutine()
  return {
    barsPerLevel: Math.max(1, integer(base.barsPerLevel)),
    numLevels: Math.max(1, integer(base.numLevels)),
    repeatCount: Math.max(1, integer(base.repeatCount)),
    restAfterSec: Math.max(0, integer(base.restAfterSec)),
    loop: Boolean(base.loop),
  }
}
```

Update the import at the top of `session.ts` to include `RoutinePattern`:

```ts
import { BEATS, CLICKS, COLORS, NOTES, SUBDIVISIONS, type ClickId, type ComplexPattern, type Cycle, type IncreaseEvery, type Length, type Meter, type RoutinePattern, type Session, type SetColor, type SimplePattern, type Slot, type Subdivision, type TimePattern } from "./types"
```

- [ ] **Step 5: Update `createDefaultSession` to include the new fields**

Change the function body so `type` is `"simple"` and add `routineEnabled` and `routine`:

```ts
export function createDefaultSession(nextId: () => string = () => crypto.randomUUID()): Session {
  return {
    name: "Practice",
    color: "red",
    meter: "4/4",
    bpm: 80,
    bpmIncrease: 0,
    every: 1,
    click: "click-1",
    subdivision: "quarter",
    slots: ["click-1"],
    type: "simple",
    simple: freshSimple(),
    complex: freshComplex(),
    time: freshTime(),
    cycles: [{ id: nextId(), length: { unit: "time", seconds: 120 }, restSec: 30 }],
    routineEnabled: false,
    routine: freshRoutine(),
  }
}
```

- [ ] **Step 6: Update `clampSession` to handle migration and clamp routine**

Replace the `clampSession` function body (lines 220–241 in the current file):

```ts
export function clampSession(session: Session): Session {
  const fallback = createDefaultSession()
  const cycles = (session.cycles?.length ? session.cycles : fallback.cycles).map(clampCycle)
  const click = CLICKS.includes(session.click) ? session.click : "click-1"
  const subdivision = SUBDIVISIONS.includes(session.subdivision) ? session.subdivision : "quarter"

  // Migrate legacy time sessions → simple + routineEnabled
  let type: Session["type"] = session.type === "complex" ? "complex" : "simple"
  let routineEnabled = Boolean(session.routineEnabled)
  let routine = clampRoutine(session.routine)

  if (session.type === "time") {
    type = "simple"
    routineEnabled = true
    const everyBars = Math.max(1, integer(session.time?.everyBars ?? 4))
    const startBpm = clampBpm(session.bpm)
    const targetBpm = clampBpm(session.time?.targetBpm ?? 120)
    const step = Math.max(0, integer(session.bpmIncrease))
    const numLevels = step > 0 && targetBpm > startBpm
      ? Math.max(1, Math.ceil((targetBpm - startBpm) / step))
      : 1
    routine = clampRoutine({
      barsPerLevel: everyBars,
      numLevels,
      repeatCount: 1,
      restAfterSec: Math.max(0, integer((session.simple as SimplePattern | undefined)?.restAfterSec ?? 10)),
      loop: false,
    })
  }

  return {
    name: session.name ?? "",
    color: COLORS.includes(session.color) ? session.color : "red",
    meter: clampMeter(session.meter),
    bpm: clampBpm(session.bpm),
    bpmIncrease: Math.max(0, integer(session.bpmIncrease)),
    every: Math.max(1, integer(session.every)),
    click,
    subdivision,
    slots: clampSlots(subdivision, session.slots, click),
    type,
    simple: clampSimple(session.simple),
    complex: clampComplex(session.complex),
    time: clampTime(session.time),
    cycles,
    routineEnabled,
    routine,
  }
}
```

- [ ] **Step 7: Run the tests and fix any remaining failures**

```bash
npm run test -- src/session.test.ts
```

Expected: The test `"loads a missing time pattern as fresh and keeps the saved type"` will still fail because it asserts `clampSession(session).type === "time"`. Update that test — change the assertion from `type === "time"` to just verify the time field clamping still works (migration behavior is now covered by the new test):

```ts
it("clamps a time pattern and migrates type to simple", () => {
  const session = createDefaultSession(() => "cycle-1")
  // time field still gets clamped regardless
  session.time = freshTime()
  session.type = "time" as Session["type"]
  session.time.increaseEvery = "nope" as "off"
  session.time.seconds = 0
  session.time.everySec = 0
  session.time.everyBars = 0
  const clamped = clampSession(session)
  expect(clamped.time).toEqual({
    seconds: 1,
    targetBpm: 120,
    increaseEvery: "off",
    everySec: 1,
    everyBars: 1,
  })
  // type migrates to simple
  expect(clamped.type).toBe("simple")
  expect(clamped.routineEnabled).toBe(true)

  // "time" as string legacy value in increaseEvery stays internal to clampTime
  session.time.increaseEvery = "time" as "bars"
  expect(clampSession(session).time.increaseEvery).toBe("bars")
  session.time.increaseEvery = "bars"
  expect(clampSession(session).time.increaseEvery).toBe("bars")

  // unknown type falls back to simple (not time, not complex)
  session.type = "nope" as "simple"
  expect(clampSession(session).type).toBe("simple")
})
```

Also update the "snaps fields to the allowed range" test — it doesn't set `type` explicitly, so the default ("simple") is fine. But the `toEqual` chain no longer applies since we switched to spot checks. Verify it still passes.

- [ ] **Step 8: Run all tests**

```bash
npm run test
```

Expected: all pass. Fix any remaining failures before proceeding.

- [ ] **Step 9: Commit**

```bash
git add src/types.ts src/session.ts src/session.test.ts
git commit -m "feat: add RoutinePattern type and session model; migrate time sessions"
```

---

## Task 2: Routine expansion in expandSession

**Files:**
- Modify: `src/expandSession.ts`
- Modify: `src/expandSession.test.ts`

The routine expansion generates one play segment per level per repeat, each at a discrete BPM. Count-in is only added for the very first segment (index 0) in a routine, vs. every segment in simple/complex.

- [ ] **Step 1: Write failing tests**

Add to `src/expandSession.test.ts` (after the existing tests):

```ts
describe("routine", () => {
  it("generates count-in once then play/rest pairs per level", () => {
    const session = createDefaultSession()
    session.routineEnabled = true
    session.bpm = 80
    session.bpmIncrease = 5
    session.meter = "4/4"
    session.routine = { barsPerLevel: 4, numLevels: 3, repeatCount: 1, restAfterSec: 10, loop: false }
    const segments = expandSession(session)
    // count-in, play@80, rest, play@85, rest, play@90 (no trailing rest)
    expect(segments.map((s) => s.kind)).toEqual(["count-in", "play", "rest", "play", "rest", "play"])
    const plays = segments.filter((s) => s.kind === "play")
    expect(plays.map((s) => s.bpm)).toEqual([80, 85, 90])
    // durationSec = barsPerLevel * beats * 60 / bpm = 4*4*60/80 = 12
    expect(plays[0].durationSec).toBe(12)
    const rests = segments.filter((s) => s.kind === "rest")
    expect(rests.every((r) => r.durationSec === 10)).toBe(true)
    // each play has a constant steps array
    expect(plays[0].steps).toEqual([{ atSec: 0, bpm: 80 }])
    expect(plays[1].steps).toEqual([{ atSec: 0, bpm: 85 }])
  })

  it("repeats the full level sequence repeatCount times", () => {
    const session = createDefaultSession()
    session.routineEnabled = true
    session.bpm = 80
    session.bpmIncrease = 5
    session.routine = { barsPerLevel: 4, numLevels: 2, repeatCount: 2, restAfterSec: 10, loop: false }
    const segments = expandSession(session)
    const plays = segments.filter((s) => s.kind === "play")
    expect(plays).toHaveLength(4)
    expect(plays.map((s) => s.bpm)).toEqual([80, 85, 80, 85])
    // last segment has no rest
    expect(segments.at(-1)?.kind).toBe("play")
  })

  it("produces one play segment when numLevels is 1 (no ramp)", () => {
    const session = createDefaultSession()
    session.routineEnabled = true
    session.bpm = 100
    session.bpmIncrease = 5
    session.routine = { barsPerLevel: 8, numLevels: 1, repeatCount: 1, restAfterSec: 10, loop: false }
    const segments = expandSession(session)
    expect(segments.map((s) => s.kind)).toEqual(["count-in", "play"])
    expect(segments[1].bpm).toBe(100)
  })

  it("caps BPM at 300 in routine levels", () => {
    const session = createDefaultSession()
    session.routineEnabled = true
    session.bpm = 290
    session.bpmIncrease = 20
    session.routine = { barsPerLevel: 4, numLevels: 3, repeatCount: 1, restAfterSec: 0, loop: false }
    const plays = expandSession(session).filter((s) => s.kind === "play")
    expect(plays.map((s) => s.bpm)).toEqual([290, 300, 300])
  })
})
```

- [ ] **Step 2: Run the test to confirm it fails**

```bash
npm run test -- src/expandSession.test.ts
```

Expected: FAIL — routine tests fail, existing tests pass.

- [ ] **Step 3: Add routine resolution to `resolved()` in `src/expandSession.ts`**

Add this block at the very beginning of the `resolved` function, before the `if (session.type === "time")` check:

```ts
function resolved(session: Session): Resolved[] {
  if (session.routineEnabled) {
    const { barsPerLevel, numLevels, repeatCount, restAfterSec } = session.routine
    const items: Resolved[] = []
    for (let repeat = 0; repeat < repeatCount; repeat++) {
      for (let level = 0; level < numLevels; level++) {
        const bpm = Math.min(300, clampBpm(session.bpm + level * session.bpmIncrease))
        const durationSec = barsPerLevel * beatsInMeter(session.meter) * 60 / bpm
        const isLast = repeat === repeatCount - 1 && level === numLevels - 1
        items.push({
          id: `routine-${repeat}-${level}`,
          bpm,
          durationSec,
          restSec: isLast ? 0 : restAfterSec,
          restRole: isLast ? undefined : "after",
          steps: [{ atSec: 0, bpm }],
        })
      }
    }
    return items
  }
  // ... rest of existing code unchanged
```

- [ ] **Step 4: Update count-in logic in `expandSession()` to only fire once for routines**

Change the condition on line 97 (currently `if (session.type !== "time")`) to:

```ts
const addCountIn = session.routineEnabled ? index === 0 : session.type !== "time"
if (addCountIn) {
  segments.push({
    kind: "count-in",
    setId: play.id,
    label,
    repetition: index + 1,
    bpm: play.bpm,
    meter: "4/4",
    durationSec: (4 * 60) / play.bpm,
    color: session.color,
    setIndex: index,
    cycleIndex: index,
    click: session.click,
  })
}
```

- [ ] **Step 5: Run the tests**

```bash
npm run test -- src/expandSession.test.ts
```

Expected: all pass.

- [ ] **Step 6: Run all tests**

```bash
npm run test
```

Expected: all pass. Fix any regressions before proceeding.

- [ ] **Step 7: Commit**

```bash
git add src/expandSession.ts src/expandSession.test.ts
git commit -m "feat: expand routine sessions into discrete BPM-level segments"
```

---

## Task 3: Practice page — segmented control + routine timer

**Files:**
- Modify: `src/Practice.tsx`
- Modify: `src/Practice.test.tsx`
- Modify: `src/app.css`

The segmented control (`Simple | Routine`) sits at the top of `.practice-body`. Selecting Routine replaces the BPM block's endless view with a simpler view and inserts a routine timer block below it. All routine config fields live in the timer block (no sheet needed).

- [ ] **Step 1: Write failing tests**

Add to `src/Practice.test.tsx`:

```ts
it("renders Simple and Routine mode buttons", () => {
  render(<Practice {...makeProps()} />)
  expect(screen.getByRole("button", { name: "Simple" })).toBeInTheDocument()
  expect(screen.getByRole("button", { name: "Routine" })).toBeInTheDocument()
})

it("Simple is pressed by default", () => {
  render(<Practice {...makeProps()} />)
  expect(screen.getByRole("button", { name: "Simple" })).toHaveAttribute("aria-pressed", "true")
  expect(screen.getByRole("button", { name: "Routine" })).toHaveAttribute("aria-pressed", "false")
})

it("toggling to Routine calls onChange with routineEnabled true and stops play", async () => {
  const props = { ...makeProps(), status: "playing" as const }
  const user = userEvent.setup()
  render(<Practice {...props} />)
  await user.click(screen.getByRole("button", { name: "Routine" }))
  expect(props.onChange).toHaveBeenCalledWith(
    expect.objectContaining({ routineEnabled: true })
  )
  expect(props.onReset).toHaveBeenCalledOnce()
})

it("routine timer block is hidden in Simple mode", () => {
  render(<Practice {...makeProps()} />)
  expect(document.querySelector(".routine-timer")).not.toBeInTheDocument()
})

it("routine timer block shows when routineEnabled is true", () => {
  const props = makeProps({ routineEnabled: true })
  render(<Practice {...props} />)
  expect(document.querySelector(".routine-timer")).toBeInTheDocument()
})

it("routine timer shows cycle/level/rep labels", () => {
  const props = makeProps({ routineEnabled: true })
  render(<Practice {...props} />)
  expect(screen.getByText(/Cycle/)).toBeInTheDocument()
  expect(screen.getByText(/Level/)).toBeInTheDocument()
})

it("routine timer fields are rendered with correct values", () => {
  const props = makeProps({
    routineEnabled: true,
    routine: { barsPerLevel: 8, numLevels: 4, repeatCount: 3, restAfterSec: 10, loop: false },
  })
  render(<Practice {...props} />)
  expect(screen.getByRole("spinbutton", { name: "Bars / level" })).toHaveValue(8)
  expect(screen.getByRole("spinbutton", { name: "Levels" })).toHaveValue(4)
  expect(screen.getByRole("spinbutton", { name: "Repeat ×" })).toHaveValue(3)
  expect(screen.getByRole("spinbutton", { name: "Rest (sec)" })).toHaveValue(10)
})
```

Also update `makeProps` to accept a full `Session` override (it already does via `overrides: Partial<Session>`). The `makeProps` call pattern stays the same.

- [ ] **Step 2: Run the test to confirm it fails**

```bash
npm run test -- src/Practice.test.tsx
```

Expected: FAIL on the new tests; existing tests pass.

- [ ] **Step 3: Update `src/Practice.tsx` — add segmented control and routine timer**

Replace the entire file with this updated version:

```tsx
import { useRef, useState } from "react"
import { bpmAt, stepIndexAt, type ClockSnapshot } from "./clock"
import type { Segment } from "./expandSession"
import { formatClock } from "./format"
import { clampSession, sessionTitle, SUBDIVISION_SLOTS } from "./session"
import { SubdivIcon } from "./SubdivIcon"
import { BpmSheet } from "./BpmSheet"
import { MeterSheet } from "./MeterSheet"
import { SubdivisionSheet } from "./SubdivisionSheet"
import type { Session } from "./types"

export type PlaybackStatus = "stopped" | "playing" | "paused" | "no-audio"

export function Practice(props: {
  session: Session
  segments: Segment[]
  snapshot: ClockSnapshot
  status: PlaybackStatus
  onToggle(): void
  onJump(direction: -1 | 1): void
  onReset(): void
  onEdit(): void
  onChange(session: Session): void
  onSeek(index: number): void
}) {
  const [sheet, setSheet] = useState<"bpm" | "meter" | "subdiv" | null>(null)

  // Refs for routine inline fields (same pattern as BpmSheet inputs)
  const barsRef = useRef<string | null>(null)
  const levelsRef = useRef<string | null>(null)
  const repeatRef = useRef<string | null>(null)
  const restRef = useRef<string | null>(null)
  const [barsText, setBarsText] = useState<string | null>(null)
  const [levelsText, setLevelsText] = useState<string | null>(null)
  const [repeatText, setRepeatText] = useState<string | null>(null)
  const [restText, setRestText] = useState<string | null>(null)

  const segment = props.segments[props.snapshot.segmentIndex]
  const isPlaying = props.status === "playing" || props.status === "no-audio"
  const beatCount = segment.kind === "count-in" ? 4 : Number(props.session.meter.split("/")[0])
  const subCount = SUBDIVISION_SLOTS[props.session.subdivision]
  const intoSec = Math.max(0, segment.durationSec - props.snapshot.segmentRemainingSec)
  const currentBpm = bpmAt(segment, intoSec)
  const elapsedSec = props.snapshot.elapsedSec
  const beatDur = currentBpm > 0 ? 60 / currentBpm : 1
  const subDur = beatDur / subCount
  const posInBeat = elapsedSec % beatDur
  const activeSubSlot = isPlaying ? Math.floor(posInBeat / subDur) : -1

  // Routine progress
  const { routineEnabled, routine } = props.session
  const { numLevels, repeatCount } = routine
  const setIdx = segment.setIndex
  const cycleN = Math.floor(setIdx / numLevels) + 1
  const levelN = (setIdx % numLevels) + 1
  const levelProgress = segment.kind === "play" && Number.isFinite(segment.durationSec) && segment.durationSec > 0
    ? Math.min(1, intoSec / segment.durationSec)
    : 0

  // Derived target BPM for display
  const derivedTarget = props.session.bpm + (numLevels - 1) * props.session.bpmIncrease

  function closeSheet() { setSheet(null) }

  function commitRoutine(partial: Partial<Session["routine"]>) {
    props.onChange(clampSession({ ...props.session, routine: { ...routine, ...partial } }))
  }

  function switchMode(enable: boolean) {
    if (enable === routineEnabled) return
    props.onChange(clampSession({ ...props.session, routineEnabled: enable }))
    if (isPlaying) props.onReset()
  }

  return (
    <main className="practice">
      <header className="topbar">
        <h1 aria-label="Mentronome">{sessionTitle(props.session)}</h1>
        <button type="button" className="quiet" onClick={props.onEdit}>Edit</button>
      </header>

      <div className="practice-body">
        {/* Simple | Routine segmented control */}
        <div className="mode-seg" role="group" aria-label="Session mode">
          {(["Simple", "Routine"] as const).map((label) => {
            const isRoutine = label === "Routine"
            const active = isRoutine === routineEnabled
            return (
              <button
                key={label}
                type="button"
                className="mode-seg-btn"
                aria-pressed={active}
                onClick={() => switchMode(isRoutine)}
              >
                {label}
              </button>
            )
          })}
        </div>

        {/* Beat grid */}
        <div className="beat-grid" role="region" aria-label="Beat display">
          {Array.from({ length: beatCount }, (_, i) => {
            const beat = i + 1
            const isLit = isPlaying && beat === props.snapshot.beat
            return (
              <div key={beat} className="beat-col">
                <div
                  className={`beat-sq${beat === 1 ? " accent" : ""}${isLit ? " lit" : ""}`}
                  data-testid={`beat-${beat}`}
                  data-current={isLit ? "true" : "false"}
                  data-accent={beat === 1 ? "true" : "false"}
                >
                  {beat}
                </div>
                <div className="beat-subs">
                  {Array.from({ length: subCount }, (_, si) => (
                    <div
                      key={si}
                      className={`beat-sub${isLit && si === activeSubSlot ? " lit" : ""}`}
                    />
                  ))}
                </div>
              </div>
            )
          })}
        </div>

        {/* BPM block */}
        <button
          type="button"
          className="bpm-block"
          aria-label="Edit BPM settings"
          onClick={() => setSheet("bpm")}
        >
          <div className="bpm-endless">
            <div className="bpm-endless__left">
              <div className="bpm-current" data-testid="bpm-current">{currentBpm}</div>
              <div className="bpm-label">
                {routineEnabled && props.session.bpmIncrease > 0
                  ? `BPM · → ${derivedTarget}`
                  : "BPM · endless"}
              </div>
            </div>
            {!routineEnabled && (
              <div className="bpm-endless__right">
                <div className="bpm-elapsed" data-testid="bpm-elapsed">
                  {isPlaying ? formatClock(elapsedSec) : "0:00"}
                </div>
                <div className="bpm-hint">Tap to edit ›</div>
              </div>
            )}
          </div>
        </button>

        {/* Routine timer block (only in Routine mode) */}
        {routineEnabled && (
          <div className="routine-timer">
            <div className="routine-progress-row">
              <div className="routine-elapsed" data-testid="routine-elapsed">
                {isPlaying ? formatClock(elapsedSec) : "0:00"}
              </div>
              <div className="routine-cycle-info">
                <div>Cycle {cycleN}/{repeatCount}</div>
                <div>Level {levelN}/{numLevels}</div>
              </div>
            </div>
            <div className="routine-progress-bar-wrap">
              <div
                className="routine-progress-bar-fill"
                style={{ width: `${Math.round(levelProgress * 100)}%` }}
              />
            </div>
            <div className="routine-fields">
              <div className="routine-field">
                <label htmlFor="routine-bars">Bars / level</label>
                <input
                  id="routine-bars"
                  type="number"
                  aria-label="Bars / level"
                  inputMode="numeric"
                  value={barsText ?? String(routine.barsPerLevel)}
                  onFocus={() => { barsRef.current = String(routine.barsPerLevel); setBarsText(String(routine.barsPerLevel)) }}
                  onChange={(e) => { barsRef.current = e.target.value; setBarsText(e.target.value) }}
                  onBlur={() => {
                    const v = barsRef.current; setBarsText(null); barsRef.current = null
                    if (v !== null) commitRoutine({ barsPerLevel: Math.max(1, Math.round(Number(v))) })
                  }}
                  onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur() }}
                />
              </div>
              <div className="routine-field">
                <label htmlFor="routine-levels">Levels</label>
                <input
                  id="routine-levels"
                  type="number"
                  aria-label="Levels"
                  inputMode="numeric"
                  value={levelsText ?? String(routine.numLevels)}
                  onFocus={() => { levelsRef.current = String(routine.numLevels); setLevelsText(String(routine.numLevels)) }}
                  onChange={(e) => { levelsRef.current = e.target.value; setLevelsText(e.target.value) }}
                  onBlur={() => {
                    const v = levelsRef.current; setLevelsText(null); levelsRef.current = null
                    if (v !== null) commitRoutine({ numLevels: Math.max(1, Math.round(Number(v))) })
                  }}
                  onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur() }}
                />
              </div>
              <div className="routine-field">
                <label htmlFor="routine-repeat">Repeat ×</label>
                <input
                  id="routine-repeat"
                  type="number"
                  aria-label="Repeat ×"
                  inputMode="numeric"
                  value={repeatText ?? String(routine.repeatCount)}
                  onFocus={() => { repeatRef.current = String(routine.repeatCount); setRepeatText(String(routine.repeatCount)) }}
                  onChange={(e) => { repeatRef.current = e.target.value; setRepeatText(e.target.value) }}
                  onBlur={() => {
                    const v = repeatRef.current; setRepeatText(null); repeatRef.current = null
                    if (v !== null) commitRoutine({ repeatCount: Math.max(1, Math.round(Number(v))) })
                  }}
                  onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur() }}
                />
              </div>
              <div className="routine-field">
                <label htmlFor="routine-rest">Rest (sec)</label>
                <input
                  id="routine-rest"
                  type="number"
                  aria-label="Rest (sec)"
                  inputMode="numeric"
                  value={restText ?? String(routine.restAfterSec)}
                  onFocus={() => { restRef.current = String(routine.restAfterSec); setRestText(String(routine.restAfterSec)) }}
                  onChange={(e) => { restRef.current = e.target.value; setRestText(e.target.value) }}
                  onBlur={() => {
                    const v = restRef.current; setRestText(null); restRef.current = null
                    if (v !== null) commitRoutine({ restAfterSec: Math.max(0, Math.round(Number(v))) })
                  }}
                  onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur() }}
                />
              </div>
            </div>
          </div>
        )}

        {/* Pick row */}
        <div className="pick-row">
          <button
            type="button"
            className="pick-btn"
            aria-label={`Time signature: ${props.session.meter}`}
            onClick={() => setSheet("meter")}
          >
            <strong>{props.session.meter}</strong>
            <span>Time Signature</span>
          </button>
          <button
            type="button"
            className="pick-btn"
            aria-label={`Subdivision: ${props.session.subdivision}`}
            onClick={() => setSheet("subdiv")}
          >
            <SubdivIcon subdivision={props.session.subdivision} size="sm" />
            <span>Subdivision</span>
          </button>
        </div>

        {/* Play controls */}
        <div className="play-controls">
          <button
            type="button"
            className={`play-btn${isPlaying ? " playing" : ""}`}
            aria-label={isPlaying ? "Pause" : "Play"}
            onClick={props.onToggle}
          >
            {isPlaying ? "❚❚" : "▶"}
          </button>
          <button
            type="button"
            className="stop-link"
            aria-label="Stop"
            onClick={props.onReset}
          >
            ■ Stop
          </button>
        </div>

        {props.status === "no-audio" && (
          <p role="status">Sound is unavailable. The countdown is still running.</p>
        )}
      </div>

      <MeterSheet
        meter={props.session.meter}
        open={sheet === "meter"}
        onClose={closeSheet}
        onChange={(meter) => {
          props.onChange(clampSession({ ...props.session, meter }))
          closeSheet()
        }}
      />
      <SubdivisionSheet
        session={props.session}
        open={sheet === "subdiv"}
        onClose={closeSheet}
        onChange={(next) => { props.onChange(clampSession(next)); closeSheet() }}
      />
      <BpmSheet
        session={props.session}
        open={sheet === "bpm"}
        onClose={closeSheet}
        onChange={(next) => props.onChange(next)}
      />
    </main>
  )
}
```

- [ ] **Step 4: Add CSS for mode segmented control and routine timer**

In `src/app.css`, add these rules (place them in a logical section, e.g. after the BPM block styles):

```css
/* ── Mode segmented control ── */
.mode-seg {
  display: flex;
  gap: 2px;
  background: var(--surface-raised);
  border: 1.5px solid var(--line);
  border-radius: var(--radius-pill);
  padding: 2px;
}

.mode-seg-btn {
  flex: 1;
  border: none;
  background: transparent;
  border-radius: calc(var(--radius-pill) - 2px);
  padding: 6px 0;
  font-size: 14px;
  font-weight: 500;
  color: var(--ink-muted);
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
}

.mode-seg-btn[aria-pressed="true"] {
  background: var(--surface-high);
  color: var(--ink);
}

/* ── Routine timer block ── */
.routine-timer {
  background: var(--surface-raised);
  border: 1.5px solid var(--line);
  border-radius: var(--radius-card);
  padding: 14px 16px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.routine-progress-row {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
}

.routine-elapsed {
  font-size: 28px;
  font-weight: 700;
  letter-spacing: -0.02em;
  font-variant-numeric: tabular-nums;
}

.routine-cycle-info {
  text-align: right;
  font-size: 12px;
  color: var(--ink-muted);
  line-height: 1.6;
}

.routine-progress-bar-wrap {
  height: 3px;
  background: var(--surface-high);
  border-radius: 2px;
  overflow: hidden;
}

.routine-progress-bar-fill {
  height: 100%;
  background: var(--ink);
  border-radius: 2px;
  transition: width 0.3s linear;
}

.routine-fields {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}

.routine-field {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.routine-field label {
  font-size: 11px;
  color: var(--ink-muted);
  font-weight: 500;
}

.routine-field input {
  background: var(--surface-high);
  border: 1.5px solid var(--line);
  border-radius: var(--radius-field);
  color: var(--ink);
  font-size: 14px;
  padding: 6px 10px;
  text-align: center;
  width: 100%;
  box-sizing: border-box;
}
```

- [ ] **Step 5: Run the tests**

```bash
npm run test -- src/Practice.test.tsx
```

Expected: new tests pass. If any existing tests fail (e.g. the BPM ramp tests that referenced `session.type === "time"`), fix them:

The test `"shows target BPM and progress bar in ramp mode"` currently uses `increaseEvery: "bars"` inside the `time` field. Since `isRamping` is no longer checked, this test needs to check that the routine timer shows instead. Replace it:

```ts
it("shows routine timer when routineEnabled is true", () => {
  const props = makeProps({
    routineEnabled: true,
    bpm: 80,
    bpmIncrease: 10,
    routine: { barsPerLevel: 4, numLevels: 3, repeatCount: 1, restAfterSec: 10, loop: false },
  })
  render(<Practice {...props} />)
  expect(document.querySelector(".routine-timer")).toBeInTheDocument()
  expect(screen.getByTestId("routine-elapsed")).toBeInTheDocument()
})
```

Also check `"does not show strip for time sessions"` — this test doesn't reference any routine-specific DOM so should still pass. Verify.

- [ ] **Step 6: Run all tests**

```bash
npm run test
```

Expected: all pass.

- [ ] **Step 7: Commit**

```bash
git add src/Practice.tsx src/Practice.test.tsx src/app.css
git commit -m "feat: add Simple/Routine segmented control and routine timer to Practice page"
```

---

## Task 4: Simplify BpmSheet for routine mode

**Files:**
- Modify: `src/BpmSheet.tsx`

In Simple mode (routineEnabled=false): only show BPM input + steppers. In Routine mode (routineEnabled=true): also show Step input and a read-only derived target line. Remove the Off/Bars toggle, Target BPM field, and Every (bars) field entirely.

- [ ] **Step 1: Update `src/BpmSheet.tsx`**

Replace the full file:

```tsx
import { useEffect, useRef, useState } from "react"
import { clampBpm, clampSession } from "./session"
import type { Session } from "./types"

export function BpmSheet(props: {
  session: Session
  open: boolean
  onClose(): void
  onChange(session: Session): void
}) {
  const overlayRef = useRef<HTMLDivElement>(null)
  const [bpmText, setBpmText] = useState<string | null>(null)
  const [stepText, setStepText] = useState<string | null>(null)
  const bpmRef = useRef<string | null>(null)
  const stepRef = useRef<string | null>(null)

  useEffect(() => {
    if (!props.open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") props.onClose()
    }
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [props.open, props.onClose])

  function commitBpm() {
    const typed = bpmRef.current
    setBpmText(null)
    bpmRef.current = null
    if (typed === null) return
    const next = clampBpm(Number(typed))
    if (next === props.session.bpm) return
    props.onChange(clampSession({ ...props.session, bpm: next }))
  }

  function commitStep() {
    const typed = stepRef.current
    setStepText(null)
    stepRef.current = null
    if (typed === null) return
    const n = Math.max(0, Math.round(Number(typed)))
    if (!Number.isFinite(n) || n === props.session.bpmIncrease) return
    props.onChange(clampSession({ ...props.session, bpmIncrease: n }))
  }

  const { routineEnabled, routine, bpm, bpmIncrease } = props.session
  const derivedTarget = bpm + (routine.numLevels - 1) * bpmIncrease

  return (
    <div
      ref={overlayRef}
      inert={!props.open}
      className={`sheet-overlay${props.open ? " open" : ""}`}
      aria-modal={props.open}
      role="dialog"
      aria-label="BPM settings"
      onClick={(e) => { if (e.target === overlayRef.current) props.onClose() }}
    >
      <div className="sheet">
        <div className="sheet-handle" />

        <div className="bpm-sheet-cols">
          {/* BPM card */}
          <div className="bpm-sheet-card">
            <p className="sheet-title">BPM</p>
            <div className="bpm-input-row">
              <input
                className="bpm-sheet-input"
                aria-label="BPM"
                inputMode="numeric"
                value={bpmText ?? String(bpm)}
                onFocus={() => { bpmRef.current = String(bpm); setBpmText(String(bpm)) }}
                onChange={(e) => { bpmRef.current = e.target.value; setBpmText(e.target.value) }}
                onBlur={commitBpm}
                onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur() }}
              />
              <div className="bpm-steppers">
                <button
                  type="button"
                  className="bpm-stepper"
                  aria-label="Increase BPM"
                  onClick={() => props.onChange(clampSession({ ...props.session, bpm: bpm + 1 }))}
                >+</button>
                <button
                  type="button"
                  className="bpm-stepper"
                  aria-label="Decrease BPM"
                  onClick={() => props.onChange(clampSession({ ...props.session, bpm: bpm - 1 }))}
                >−</button>
              </div>
            </div>
          </div>

          {/* Step + derived target (only in Routine mode) */}
          {routineEnabled && (
            <div className="bpm-sheet-card bpm-sheet-target-card">
              <p className="sheet-title">BPM step</p>
              <div className="increase-fields">
                <div className="increase-field">
                  <label htmlFor="bpm-sheet-step">Step</label>
                  <input
                    id="bpm-sheet-step"
                    inputMode="numeric"
                    value={stepText ?? String(bpmIncrease)}
                    onFocus={() => { stepRef.current = String(bpmIncrease); setStepText(String(bpmIncrease)) }}
                    onChange={(e) => { stepRef.current = e.target.value; setStepText(e.target.value) }}
                    onBlur={commitStep}
                    onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur() }}
                  />
                </div>
              </div>
              {bpmIncrease > 0 && (
                <div className="increase-derived">
                  {bpm} → <span>{derivedTarget} BPM</span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Run the tests**

```bash
npm run test -- src/Practice.test.tsx
```

The test `"opens BPM sheet when BPM block is clicked"` should still pass (the sheet overlay aria-label is still `"BPM settings"`).

- [ ] **Step 3: Run all tests**

```bash
npm run test
```

Expected: all pass.

- [ ] **Step 4: Commit**

```bash
git add src/BpmSheet.tsx
git commit -m "feat: simplify BpmSheet — show Step and derived target only in Routine mode"
```

---

## Task 5: Edit page — remove Time and Complex type options

**Files:**
- Modify: `src/Edit.tsx`
- Modify: `src/Edit.test.tsx`

Remove Time and Complex from the type switcher. Simplify `done()` and remove the `choose()` function. The Edit page will only ever show Simple session settings.

- [ ] **Step 1: Update `src/Edit.tsx`**

Key changes:
1. Remove `openedAs`, `installedFreshSimple`, `installedFreshTime`, `installedFreshComplex` refs
2. Replace the `done()` function with a simpler version
3. Remove the `choose()` function entirely
4. Remove the Time/Complex type buttons from the type switcher
5. Remove the Time-specific fields from the increase-card
6. Remove the Complex builder section

Replace the `Edit` component function (lines 245–482) with:

```tsx
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
```

Also remove unused imports: `freshTime`, `freshComplex`, `cycleGroupFromSimple` may no longer be used — check and remove if so. Keep `freshComplex` and `freshTime` if still referenced in `done()`.

- [ ] **Step 2: Run the tests**

```bash
npm run test -- src/Edit.test.tsx
```

Expected: Tests that referenced Time-specific UI (e.g. "edits a time session by bars", "commits typed Every and Duration values") will fail. Remove or rewrite them.

Find and remove any test in `Edit.test.tsx` that:
- Clicks a "Time" button
- Clicks an "Off" or "Bars" mode button
- Checks for "Every" or "Duration" fields that were Time-specific
- References `"Total 0:12"` from Time session timing

Keep tests that verify:
- Session name and color editing
- BPM field editing
- Simple session fields (Practices, Length, Rest after)
- Done button navigates back

If tests reference `session.type = "time"`, change to `session.type = "simple"` with `routineEnabled = true` where appropriate, or remove if the test was only about Time-mode UI.

- [ ] **Step 3: Run all tests**

```bash
npm run test
```

Expected: all pass.

- [ ] **Step 4: Commit**

```bash
git add src/Edit.tsx src/Edit.test.tsx
git commit -m "feat: remove Time and Complex from Edit page; simplify to Simple only"
```

---

## Self-Review Checklist

After all tasks are committed:

- [ ] Run full test suite: `npm run test` — all pass
- [ ] Run build: `npm run build` — no TypeScript errors
- [ ] Manual check: start dev server (`npm run dev`), toggle Simple ↔ Routine, verify timer shows/hides and fields commit correctly
- [ ] Manual check: old localStorage data (if any) auto-migrates without crashing

