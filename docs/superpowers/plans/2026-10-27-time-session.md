# Time Session Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Time session that plays one duration and raises the BPM by clock time or by bars.

**Architecture:** `Session.time` stores the duration and both step sizes. `expandSession` turns a Time session into one count-in and one play. The play carries `steps`, and the clock walks those windows so each click uses the BPM of the window that contains it. The editor adds a Time pill and swaps Increase every to Time or Bars. Done saves only the type on screen.

**Tech Stack:** Vite 6, React 19, TypeScript, Vitest 3, Testing Library, user-event. `npm test` is `vitest run`.

## Global Constraints

- The type control offers Simple, Complex, and Time.
- A Time session stores a duration, such as 2:00.
- Increase every offers Time or Bars, with a step size for each.
- Playback is one count-in and one play. The tempo changes inside that play. There is no rest.
- Done saves the type on screen. The other types go back to fresh patterns.
- There are no practices, rests, rounds, or a cycle list on a Time session.
- There is still one BPM and one BPM increase.
- Simple and Complex climbing, repeating, and expanding stay as they are.
- The practice page layout stays. The stage, transport, and strip stay where they are.
- The stored `every` field stays. Playback and the editor do not read it.
- No look-ahead scheduling.
- A fresh Time pattern is 120 seconds, `increaseEvery: "time"`, `everySec: 30`, and `everyBars: 4`.
- `seconds` and `everySec` are integers of at least 1. `everyBars` is an integer of at least 1. A missing pattern loads fresh. An unknown `increaseEvery` loads as `"time"`. An unknown session type loads as Simple.
- Played BPM is `min(300, session BPM + BPM increase × step)`. Step starts at 0.
- A Time step lasts `everySec` seconds, or `everyBars` bars at that step's BPM. A shorter remainder still starts that step and stops at the duration.
- The count-in is four beats in 4/4 at the first step's BPM and sits outside the duration.
- Each click uses the BPM of the window that contains it. The gap after that click is `60 / that BPM`. Beats keep counting across steps. Beat 1 of the meter stays the accent.
- The editor remembers the type it opened with. A Simple-opened visit still rebuilds the cycle group from Simple every time Complex is chosen.
- Stay on `feat/restyle` in this checkout. Do not create a git worktree. Do not implement on `main`.
- The working tree already has uncommitted edits in `src/Edit.tsx`, `src/app.css`, `src/tokens.css`, and `src/tokens.test.ts`, plus untracked `.vite/`. Keep the Edit and CSS edits. Do not revert them. Do not stage `src/tokens.css`, `src/tokens.test.ts`, or `.vite/`.

## File structure

- `src/types.ts` — `TimePattern` and `Session.time`. `Session.type` gains `"time"`.
- `src/session.ts` — `freshTime`, `clampTime`, and `timeSteps`. `clampSession` and `createDefaultSession` learn the new pattern. `migrateLegacy` passes a fresh Time pattern through `clampSession`.
- `src/store.ts` — `loadSession` accepts a saved `"time"` type.
- `src/expandSession.ts` — a Time session becomes one count-in and one play. The play's `steps` are the tempo windows.
- `src/clock.ts` — `bpmAt` and `stepIndexAt`. Clicks and beats walk the windows when a segment has `steps`.
- `src/Edit.tsx` — the Time pill, Time/Bars, Duration, and the visit and Done rules.
- `src/Practice.tsx` — the sounding BPM, a duration edit, and a BPM edit that keeps the typed number.
- Tests live beside those files. No new CSS. The type pills already size to their labels.

---

### Task 1: Play one Time stretch

**Files:**
- Modify: `src/types.ts`
- Modify: `src/session.ts`
- Modify: `src/session.test.ts`
- Modify: `src/store.ts`
- Modify: `src/store.test.ts`
- Modify: `src/expandSession.ts`
- Modify: `src/expandSession.test.ts`
- Modify: `src/clock.ts`
- Modify: `src/clock.test.ts`

**Interfaces:**
- Consumes: `clampBpm`, `beatsInMeter`, `clampSession`, `createDefaultSession`, `expandSession`, `clicksInSegment`.
- Produces:
  - `TimePattern = { seconds: number; increaseEvery: "time" | "bars"; everySec: number; everyBars: number }`
  - `Session.type` includes `"time"`
  - `Session.time: TimePattern`
  - `freshTime(): TimePattern`
  - `timeSteps(session: Session): { atSec: number; bpm: number }[]`
  - `Segment.steps?: { atSec: number; bpm: number }[]`
  - `bpmAt(segment: Segment, offsetSec: number): number`
  - `stepIndexAt(segment: Segment, offsetSec: number): number`

- [ ] **Step 1: Write the failing session and store tests**

In `src/session.test.ts`, import `freshTime`. In "builds the first-visit session", add `time: freshTime()` to the expected `createDefaultSession` object, and add:

```ts
expect(freshTime()).toEqual({
  seconds: 120,
  increaseEvery: "time",
  everySec: 30,
  everyBars: 4,
})
```

Add this test:

```ts
it("loads a missing time pattern as fresh and keeps the saved type", () => {
  const session = createDefaultSession(() => "cycle-1")
  delete (session as { time?: unknown }).time
  expect(clampSession(session).type).toBe("simple")
  expect(clampSession(session).time).toEqual(freshTime())

  session.time = freshTime()
  session.type = "time"
  session.time.increaseEvery = "nope" as "time"
  session.time.seconds = 0
  session.time.everySec = 0
  session.time.everyBars = 0
  expect(clampSession(session).time).toEqual({
    seconds: 1,
    increaseEvery: "time",
    everySec: 1,
    everyBars: 1,
  })

  session.type = "nope" as "simple"
  expect(clampSession(session).type).toBe("simple")
})
```

In `src/store.test.ts`, import `freshTime`. Add:

```ts
it("loads a time session and fills a missing time pattern", () => {
  const storage = memory()
  const session = createDefaultSession(() => "cycle-1")
  session.type = "time"
  session.time.seconds = 90
  saveSession(session, storage)
  expect(loadSession(storage)).toMatchObject({ type: "time", time: { seconds: 90 } })

  const { time: _time, ...withoutTime } = createDefaultSession(() => "cycle-1")
  storage.setItem(SESSION_KEY, JSON.stringify(withoutTime))
  const loaded = loadSession(storage)
  expect(loaded.type).toBe("simple")
  expect(loaded.time).toEqual(freshTime())
})
```

- [ ] **Step 2: Run the session and store tests to verify they fail**

Run: `npm test -- src/session.test.ts src/store.test.ts`

Expected: FAIL. `freshTime` is not exported, and a saved `"time"` session is not accepted by `loadSession`.

- [ ] **Step 3: Store and clamp the Time pattern**

In `src/types.ts`, add:

```ts
export type TimePattern = {
  seconds: number
  increaseEvery: "time" | "bars"
  everySec: number
  everyBars: number
}
```

Change `Session.type` to `"simple" | "complex" | "time"` and add `time: TimePattern` after `complex`.

In `src/session.ts`, import `TimePattern`. Add:

```ts
export function freshTime(): TimePattern {
  return {
    seconds: 120,
    increaseEvery: "time",
    everySec: 30,
    everyBars: 4,
  }
}

function clampTime(pattern: TimePattern | undefined): TimePattern {
  const base = pattern ?? freshTime()
  return {
    seconds: Math.max(1, integer(base.seconds)),
    increaseEvery: base.increaseEvery === "bars" ? "bars" : "time",
    everySec: Math.max(1, integer(base.everySec)),
    everyBars: Math.max(1, integer(base.everyBars)),
  }
}

export function timeSteps(session: Session): { atSec: number; bpm: number }[] {
  const pattern = clampTime(session.time)
  const duration = pattern.seconds
  const steps: { atSec: number; bpm: number }[] = []
  let at = 0
  let index = 0
  while (at < duration - 1e-9) {
    const bpm = Math.min(300, clampBpm(session.bpm) + Math.max(0, integer(session.bpmIncrease)) * index)
    steps.push({ atSec: at, bpm })
    const window = pattern.increaseEvery === "bars"
      ? pattern.everyBars * beatsInMeter(session.meter) * 60 / bpm
      : pattern.everySec
    if (!(window > 0)) break
    at += window
    index += 1
  }
  return steps
}
```

`createDefaultSession` sets `time: freshTime()`. `clampSession` uses:

```ts
type: session.type === "complex" || session.type === "time" ? session.type : "simple",
time: clampTime(session.time),
```

`migrateLegacy` includes `time: freshTime()` in the object it passes to `clampSession`.

In `src/store.ts`, accept a saved Time session:

```ts
if (parsed.type === "simple" || parsed.type === "complex" || parsed.type === "time") return clampSession(parsed)
```

- [ ] **Step 4: Run the session and store tests to verify they pass**

Run: `npm test -- src/session.test.ts src/store.test.ts`

Expected: PASS

- [ ] **Step 5: Write the failing playback tests**

In `src/expandSession.test.ts`, add:

```ts
it("plays a time session as one count-in and one climb by clock time", () => {
  const session = createDefaultSession(() => "cycle-1")
  session.type = "time"
  session.bpm = 80
  session.bpmIncrease = 5
  session.time = { seconds: 120, increaseEvery: "time", everySec: 30, everyBars: 4 }
  const segments = expandSession(session)
  expect(segments.map((segment) => segment.kind)).toEqual(["count-in", "play"])
  expect(segments[0]).toMatchObject({ bpm: 80, meter: "4/4", durationSec: 3 })
  expect(segments[1]).toMatchObject({ bpm: 80, durationSec: 120, meter: "4/4" })
  expect(segments[1].steps).toEqual([
    { atSec: 0, bpm: 80 },
    { atSec: 30, bpm: 85 },
    { atSec: 60, bpm: 90 },
    { atSec: 90, bpm: 95 },
  ])
})

it("gives a short leftover its own later tempo", () => {
  const session = createDefaultSession(() => "cycle-1")
  session.type = "time"
  session.bpm = 80
  session.bpmIncrease = 5
  session.time = { seconds: 130, increaseEvery: "time", everySec: 30, everyBars: 4 }
  const play = expandSession(session).find((segment) => segment.kind === "play")
  expect(play?.durationSec).toBe(130)
  expect(play?.steps?.at(-1)).toEqual({ atSec: 120, bpm: 100 })
})

it("cuts a bar step off when the duration ends", () => {
  const session = createDefaultSession(() => "cycle-1")
  session.type = "time"
  session.bpm = 80
  session.bpmIncrease = 5
  session.meter = "4/4"
  session.time = { seconds: 18, increaseEvery: "bars", everySec: 30, everyBars: 4 }
  const play = expandSession(session).find((segment) => segment.kind === "play")
  expect(play?.durationSec).toBe(18)
  expect(play?.steps).toEqual([
    { atSec: 0, bpm: 80 },
    { atSec: 12, bpm: 85 },
  ])
})

it("holds the session tempo when the increase is zero or the step is longer than the duration", () => {
  const session = createDefaultSession(() => "cycle-1")
  session.type = "time"
  session.bpm = 80
  session.bpmIncrease = 0
  session.time = { seconds: 120, increaseEvery: "time", everySec: 30, everyBars: 4 }
  const flat = expandSession(session).find((segment) => segment.kind === "play")
  expect(flat?.steps?.every((step) => step.bpm === 80)).toBe(true)

  session.bpmIncrease = 5
  session.time.everySec = 180
  const one = expandSession(session).find((segment) => segment.kind === "play")
  expect(one?.steps).toEqual([{ atSec: 0, bpm: 80 }])
})

it("plays a time step at 300 once the climb reaches the cap", () => {
  const session = createDefaultSession(() => "cycle-1")
  session.type = "time"
  session.bpm = 290
  session.bpmIncrease = 20
  session.time = { seconds: 120, increaseEvery: "time", everySec: 30, everyBars: 4 }
  const play = expandSession(session).find((segment) => segment.kind === "play")
  expect(play?.steps?.map((step) => step.bpm)).toEqual([290, 300, 300, 300])
})
```

In `src/clock.test.ts`, import `type { Segment }`. Add:

```ts
it("keeps the beat count when a later window uses a new BPM", () => {
  const segment: Segment = {
    kind: "play",
    setId: "time",
    label: "Practice",
    repetition: 1,
    bpm: 80,
    meter: "4/4",
    durationSec: 3,
    color: "red",
    setIndex: 0,
    cycleIndex: 0,
    steps: [
      { atSec: 0, bpm: 80 },
      { atSec: 1, bpm: 85 },
    ],
  }
  const clicks = clicksInSegment(segment)
  expect(clicks[0]).toMatchObject({ offsetSec: 0, beat: 1, accent: true })
  expect(clicks[1]).toMatchObject({ offsetSec: 0.75, beat: 2, accent: false })
  expect(clicks[2].offsetSec).toBeCloseTo(1.5)
  expect(clicks[2].beat).toBe(3)
  expect(clicks[3].offsetSec - clicks[2].offsetSec).toBeCloseTo(60 / 85)
  expect(clicks.at(-1)!.offsetSec).toBeLessThan(3)
})
```

- [ ] **Step 6: Run the playback tests to verify they fail**

Run: `npm test -- src/expandSession.test.ts src/clock.test.ts`

Expected: FAIL. A Time session still expands like Simple, so the segment list is not `["count-in", "play"]` with those steps. The hand-built segment's third click is still spaced at `60 / 80`.

- [ ] **Step 7: Expand Time and walk the tempo windows**

In `src/expandSession.ts`, import `timeSteps`. Add `steps?: { atSec: number; bpm: number }[]` to `Segment` and to the private `Resolved` type.

At the start of `resolved`, before the Complex branch:

```ts
if (session.type === "time") {
  const steps = timeSteps(session)
  return [{
    id: "time",
    bpm: steps[0]?.bpm ?? session.bpm,
    durationSec: Math.max(1, Math.round(session.time.seconds)),
    restSec: 0,
    steps,
  }]
}
```

Copy `steps: play.steps` onto the play segment only. Leave the count-in without `steps`. Simple and Complex plays omit `steps`.

In `src/clock.ts`, add:

```ts
export function stepIndexAt(segment: Segment, offsetSec: number): number {
  if (!segment.steps?.length) return 0
  let index = 0
  for (let i = 0; i < segment.steps.length; i += 1) {
    if (segment.steps[i].atSec <= offsetSec + 1e-9) index = i
    else break
  }
  return index
}

export function bpmAt(segment: Segment, offsetSec: number): number {
  return segment.steps?.[stepIndexAt(segment, offsetSec)]?.bpm ?? segment.bpm
}
```

Replace the constant-BPM loops in `clicksInSegment` and `beatAt` with a walk. A rest still returns no clicks and beat 0. The beat count is 4 for a count-in and `beatsInMeter(segment.meter)` otherwise.

```ts
export function clicksInSegment(segment: Segment): ClickMark[] {
  if (segment.kind === "rest") return []
  const beats = segment.kind === "count-in" ? 4 : beatsInMeter(segment.meter)
  const marks: ClickMark[] = []
  let offsetSec = 0
  let index = 0
  while (offsetSec < segment.durationSec - 1e-9) {
    const bpm = bpmAt(segment, offsetSec)
    const beat = (index % beats) + 1
    marks.push({ offsetSec, beat, accent: beat === 1 })
    const next = offsetSec + 60 / bpm
    if (!(next > offsetSec)) break
    offsetSec = next
    index += 1
  }
  return marks
}

function beatAt(segment: Segment, intoSec: number): number {
  const beats = segment.kind === "count-in" ? 4 : beatsInMeter(segment.meter)
  let offsetSec = 0
  let index = 0
  let beat = 1
  while (offsetSec < segment.durationSec - 1e-9) {
    beat = (index % beats) + 1
    const next = offsetSec + 60 / bpmAt(segment, offsetSec)
    if (!(next > offsetSec) || next > intoSec + 1e-9) break
    offsetSec = next
    index += 1
  }
  return beat
}
```

A segment without `steps` still uses `segment.bpm` for every click, so Simple and Complex keep today's beat grid.

- [ ] **Step 8: Run the playback tests to verify they pass**

Run: `npm test -- src/session.test.ts src/store.test.ts src/expandSession.test.ts src/clock.test.ts`

Expected: PASS

- [ ] **Step 9: Commit**

```bash
git add src/types.ts src/session.ts src/session.test.ts src/store.ts src/store.test.ts src/expandSession.ts src/expandSession.test.ts src/clock.ts src/clock.test.ts
git commit -m "Play a Time session as one stretch that climbs by time or by bars."
```

Do not stage `src/tokens.css`, `src/tokens.test.ts`, `src/Edit.tsx`, `src/app.css`, or `.vite/`.

---

### Task 2: Choose a Time session

**Files:**
- Modify: `src/Edit.tsx`
- Modify: `src/Edit.test.tsx`

**Interfaces:**
- Consumes: `freshTime`, `freshSimple`, `freshComplex`, `cycleGroupFromSimple`, `cyclesFromSimple`, `clampSession`, `Session.type` including `"time"`, `Session.time`.
- Produces: the editor visit behavior. No new exported function. `choose` accepts `"simple" | "complex" | "time"`.

- [ ] **Step 1: Write the failing editor tests**

In `src/Edit.test.tsx`, import `within` from `@testing-library/react` and `freshTime` from `./session`. Add:

```ts
it("edits a time session by clock time or by bars", async () => {
  const user = userEvent.setup()
  const session = createDefaultSession(() => "cycle-1")
  session.simple.practices = 4
  const onChange = vi.fn()
  const { rerender } = render(<Edit session={session} onChange={onChange} onDone={() => {}} />)
  const types = screen.getByRole("group", { name: "Type" })
  await user.click(within(types).getByRole("button", { name: "Time" }))
  const opened = onChange.mock.calls.at(-1)?.[0]
  expect(opened.type).toBe("time")
  expect(opened.time).toEqual(freshTime())
  expect(opened.simple.practices).toBe(4)
  rerender(<Edit session={opened} onChange={onChange} onDone={() => {}} />)

  expect(screen.getByRole("textbox", { name: "Duration" })).toHaveValue("2:00")
  expect(screen.getByText("Total 2:03")).toBeInTheDocument()
  expect(screen.queryByRole("button", { name: "Add cycle" })).not.toBeInTheDocument()
  expect(screen.queryByRole("button", { name: "Repeat the round" })).not.toBeInTheDocument()
  const increase = screen.getByRole("group", { name: "Increase every" })
  expect(within(increase).getByRole("button", { name: "Time" })).toHaveAttribute("aria-pressed", "true")
  expect(within(increase).queryByRole("button", { name: "Interval" })).not.toBeInTheDocument()
  expect(screen.getByRole("textbox", { name: "Every" })).toHaveValue("0:30")

  await user.click(within(increase).getByRole("button", { name: "Bars" }))
  const bars = onChange.mock.calls.at(-1)?.[0]
  expect(bars.time.increaseEvery).toBe("bars")
  expect(bars.time.everySec).toBe(30)
  rerender(<Edit session={bars} onChange={onChange} onDone={() => {}} />)
  expect(screen.getByRole("textbox", { name: "Every" })).toHaveValue("4")

  await user.click(within(screen.getByRole("group", { name: "Increase every" })).getByRole("button", { name: "Time" }))
  const backToTime = onChange.mock.calls.at(-1)?.[0]
  expect(backToTime.time.everySec).toBe(30)
  rerender(<Edit session={backToTime} onChange={onChange} onDone={() => {}} />)
  expect(screen.getByRole("textbox", { name: "Every" })).toHaveValue("0:30")

  await user.click(within(screen.getByRole("group", { name: "Type" })).getByRole("button", { name: "Simple" }))
  const restored = onChange.mock.calls.at(-1)?.[0]
  expect(restored.type).toBe("simple")
  expect(restored.simple.practices).toBe(4)
})

it("keeps a time pattern when the visit opened on time", async () => {
  const user = userEvent.setup()
  const session = createDefaultSession(() => "cycle-1")
  session.type = "time"
  session.time.seconds = 90
  session.cycles = [
    { id: "a", length: { unit: "time", seconds: 30 }, restSec: 5 },
    { id: "b", length: { unit: "time", seconds: 45 }, restSec: 5 },
  ]
  const onChange = vi.fn()
  const onDone = vi.fn()
  const { rerender } = render(<Edit session={session} onChange={onChange} onDone={onDone} />)
  await user.click(within(screen.getByRole("group", { name: "Type" })).getByRole("button", { name: "Complex" }))
  const preview = onChange.mock.calls.at(-1)?.[0]
  expect(preview.type).toBe("complex")
  expect(preview.complex).toEqual(freshComplex())
  expect(preview.cycles).toEqual([
    { id: expect.any(String), length: { unit: "time", seconds: 120 }, restSec: 30 },
  ])
  expect(preview.time.seconds).toBe(90)
  rerender(<Edit session={preview} onChange={onChange} onDone={onDone} />)
  await user.click(within(screen.getByRole("group", { name: "Type" })).getByRole("button", { name: "Time" }))
  const returned = onChange.mock.calls.at(-1)?.[0]
  expect(returned.type).toBe("time")
  expect(returned.time.seconds).toBe(90)

  rerender(<Edit session={returned} onChange={onChange} onDone={onDone} />)
  await user.click(screen.getByRole("button", { name: "Done" }))
  const saved = onChange.mock.calls.at(-1)?.[0]
  expect(saved.type).toBe("time")
  expect(saved.time.seconds).toBe(90)
  expect(saved.simple).toEqual(freshSimple())
  expect(saved.complex).toEqual(freshComplex())
  expect(saved.cycles).toEqual([
    { id: expect.any(String), length: { unit: "time", seconds: 120 }, restSec: 30 },
  ])
  expect(onDone).toHaveBeenCalledOnce()
})
```

In "drops the complex pattern when simple is saved", also expect `saved.time` to equal `freshTime()`.

Add this test so Done on Complex freshens Time and keeps the cycles:

```ts
it("freshens time when complex is saved", async () => {
  const user = userEvent.setup()
  const onChange = vi.fn()
  const session = createDefaultSession(() => "cycle-1")
  session.type = "complex"
  session.time.seconds = 45
  session.cycles = [{ id: "a", length: { unit: "time", seconds: 30 }, restSec: 5 }]
  render(<Edit session={session} onChange={onChange} onDone={() => {}} />)
  await user.click(screen.getByRole("button", { name: "Done" }))
  const saved = onChange.mock.calls.at(-1)?.[0]
  expect(saved.type).toBe("complex")
  expect(saved.time).toEqual(freshTime())
  expect(saved.cycles).toEqual([{ id: "a", length: { unit: "time", seconds: 30 }, restSec: 5 }])
  expect(saved.simple).toEqual(freshSimple())
})
```

`freshSimple` is already available from `./session` if the test file imports it. Import it if it is not already imported.

The existing Simple and Complex tests still expect no textbox named Every, Interval and Round on those types, and the Simple-to-Complex rebuild. Do not weaken them.

- [ ] **Step 2: Run the editor tests to verify they fail**

Run: `npm test -- src/Edit.test.tsx`

Expected: FAIL. The type group has no Time button.

- [ ] **Step 3: Add the Time editor**

In `src/Edit.tsx`, import `freshTime`. Replace `openedAsComplex` with:

```ts
const openedAs = useRef(props.session.type)
const installedFreshSimple = useRef(false)
const installedFreshTime = useRef(false)
const installedFreshComplex = useRef(false)
```

Replace `done` with:

```ts
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
```

Replace `choose` with a function that accepts `"simple" | "complex" | "time"`:

```ts
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
```

Add the Time pill after Complex, inside the group labeled Type:

```tsx
<button type="button" aria-pressed={session.type === "time"} onClick={() => choose("time")}>Time</button>
```

In the Increase every group, render Time and Bars when `session.type === "time"`. Time is pressed when `increaseEvery !== "bars"`. Bars is pressed when `increaseEvery === "bars"`. Each click writes that value onto `session.time` and leaves `everySec` and `everyBars` untouched. Simple and Complex still render Interval and Round, writing `simple.increaseEvery` or `complex.increaseEvery` as they do now.

Under those pills, when the type is Time, render one Every field. Bars uses `String(session.time.everyBars)` and commits `everyBars: Number(text)`. Time uses `formatDuration(session.time.everySec)` and commits `everySec: parseDuration(text)`.

The bottom of the editor becomes three branches. Simple stays the interval builder. Complex stays the cycle list and Repeat the round. Time is only Duration and Total:

```tsx
<section className="editor-builder">
  <DraftField
    label="Duration"
    value={formatDuration(session.time.seconds)}
    onCommit={(text) => commit({ ...session, time: { ...session.time, seconds: parseDuration(text) } })}
  />
  <p className="total">Total {formatClock(totalSec)}</p>
</section>
```

`totalSec` stays the sum of `expandSession(session)`. Do not change `src/app.css`.

- [ ] **Step 4: Run the editor tests to verify they pass**

Run: `npm test -- src/Edit.test.tsx`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/Edit.tsx src/Edit.test.tsx src/app.css
git commit -m "Choose a Time session and set its duration and step."
```

This commit includes the uncommitted editor markup already in `src/Edit.tsx` and the uncommitted editor CSS in `src/app.css`. `src/app.css` uses `--surface-high`. If that variable is missing from committed `src/tokens.css`, add only `--surface-high: #3a3a3a` beside `--surface-raised` and commit that one line with this task. Leave the uncommitted red, yellow, and green values in the working tree. Do not stage `.vite/`.

---

### Task 3: Edit Time from the practice page

**Files:**
- Modify: `src/Practice.tsx`
- Modify: `src/Practice.test.tsx`

**Interfaces:**
- Consumes: `bpmAt(segment, offsetSec)`, `stepIndexAt(segment, offsetSec)`, `Segment.steps`, `Session.time`.
- Produces: no new export. A Time duration edit writes `time.seconds`. A Time BPM edit writes `session.bpm` as `typed - bpmIncrease * step`.

- [ ] **Step 1: Write the failing practice tests**

In `src/Practice.test.tsx`, add:

```ts
it("shows one time play and keeps a later typed BPM on screen", async () => {
  const session = createDefaultSession(() => "cycle-1")
  session.type = "time"
  session.bpm = 80
  session.bpmIncrease = 5
  session.time = { seconds: 120, increaseEvery: "time", everySec: 30, everyBars: 4 }
  const segments = expandSession(session)
  expect(segments.map((segment) => segment.kind)).toEqual(["count-in", "play"])
  const onChange = vi.fn()
  const user = userEvent.setup()
  const { rerender } = render(
    <Practice
      session={session}
      segments={segments}
      snapshot={snapshotAt(segments, 0)}
      status="stopped"
      onToggle={() => {}}
      onJump={() => {}}
      onReset={() => {}}
      onEdit={() => {}}
      onChange={onChange}
      onSeek={() => {}}
    />,
  )
  expect(screen.getByTestId("footer-set")).toHaveTextContent("1 / 2")
  expect(screen.getByRole("textbox", { name: "BPM" })).toHaveValue("80")
  rerender(
    <Practice
      session={session}
      segments={segments}
      snapshot={snapshotAt(segments, 63)}
      status="stopped"
      onToggle={() => {}}
      onJump={() => {}}
      onReset={() => {}}
      onEdit={() => {}}
      onChange={onChange}
      onSeek={() => {}}
    />,
  )
  expect(screen.getByTestId("footer-set")).toHaveTextContent("2 / 2")
  const bpm = screen.getByRole("textbox", { name: "BPM" })
  expect(bpm).toHaveValue("90")
  await user.click(bpm)
  await user.clear(bpm)
  await user.type(bpm, "100")
  await user.tab()
  expect(onChange.mock.calls.at(-1)?.[0].bpm).toBe(90)
})

it("writes a time duration from the practice page", async () => {
  const session = createDefaultSession(() => "cycle-1")
  session.type = "time"
  session.time.seconds = 120
  const segments = expandSession(session)
  const playIndex = segments.findIndex((segment) => segment.kind === "play")
  const elapsed = segments.slice(0, playIndex).reduce((sum, segment) => sum + segment.durationSec, 0)
  const onChange = vi.fn()
  const user = userEvent.setup()
  render(
    <Practice
      session={session}
      segments={segments}
      snapshot={snapshotAt(segments, elapsed)}
      status="stopped"
      onToggle={() => {}}
      onJump={() => {}}
      onReset={() => {}}
      onEdit={() => {}}
      onChange={onChange}
      onSeek={() => {}}
    />,
  )
  const duration = screen.getByRole("textbox", { name: "Duration" })
  await user.click(duration)
  await user.clear(duration)
  await user.type(duration, "1:00")
  await user.tab()
  expect(onChange.mock.calls.at(-1)?.[0].time.seconds).toBe(60)
})
```

- [ ] **Step 2: Run the practice tests to verify they fail**

Run: `npm test -- src/Practice.test.tsx`

Expected: FAIL. The BPM field shows `80`, the first step, at 63 seconds. The duration commit writes `simple.length` instead of `time.seconds`.

- [ ] **Step 3: Show the sounding step and write Time edits**

In `src/Practice.tsx`, import `bpmAt` and `stepIndexAt` from `./clock`. Add `step: number` to `DraftTarget`, and pass it through `draftTarget`.

```ts
function draftTarget(segment: Segment, segmentIndex: number, baseline: string, step: number): DraftTarget {
  return {
    segmentIndex,
    kind: segment.kind,
    restRole: segment.restRole,
    cycleIndex: segment.cycleIndex,
    baseline,
    step,
  }
}
```

`rememberTime` passes `0` for the step. `rememberBpm` passes the sounding step:

```ts
const into = Math.max(0, segment.durationSec - props.snapshot.segmentRemainingSec)
const step = stepIndexAt(segment, into)
bpmTarget.current = draftTarget(segment, props.snapshot.segmentIndex, baseline, step)
```

The BPM on screen uses that same offset:

```ts
const intoSec = Math.max(0, segment.durationSec - props.snapshot.segmentRemainingSec)
const shownBpm = bpmText ?? String(bpmAt(segment, intoSec))
```

At the start of `commitTime`, after the empty-edit return and before the Complex branch:

```ts
if (session.type === "time") {
  props.onChange(clampSession({
    ...session,
    time: { ...session.time, seconds },
  }))
  return
}
```

At the start of `commitBpm`, after the empty-edit return and before the per-cycle BPM branch:

```ts
if (session.type === "time") {
  const bpm = Number(typed) - session.bpmIncrease * target.step
  props.onChange(clampSession({ ...session, bpm }))
  return
}
```

Do not move the stage, the transport, or the strip. Do not change the Simple or Complex commit formulas.

- [ ] **Step 4: Run the practice tests to verify they pass**

Run: `npm test -- src/Practice.test.tsx`

Expected: PASS

- [ ] **Step 5: Run the full suite**

Run: `npm test`

Expected: PASS. `Unknown env config "devdir"` is environment noise, not a failure.

- [ ] **Step 6: Commit**

```bash
git add src/Practice.tsx src/Practice.test.tsx
git commit -m "Edit a Time session's duration and BPM from the practice page."
```

Do not stage `src/tokens.css`, `src/tokens.test.ts`, `src/app.css`, or `.vite/`.
