# Time Increase Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A Time session plays one tempo until it is stopped, and a third stage button turns on a climb by time or by bars with an end.

**Architecture:** `increaseEvery` gains `"off"`. An Off play has an infinite duration, so the clock counts elapsed time into the play and the app places the next two seconds of whole beats, then the next stretch before those run out. Time and Bars keep the existing step walk. The practice stage hides its cards only for Time, and the third square button edits the climb.

**Tech Stack:** Vite 6, React 19, TypeScript, Vitest 3, Testing Library, user-event. `npm test` is `vitest run`.

## Global Constraints

- A fresh Time pattern has `increaseEvery: "off"`. End stays 120, Every stays 30 and 4, and the amount stays 0.
- `"time"` and `"bars"` load unchanged. `"off"`, a missing value, and any unknown value load as `"off"`.
- Choosing Off keeps the amount, both Every numbers, and the end. Choosing Time or Bars uses those stored values.
- End is at least 1 second. Every is at least 1 second or 1 bar. The amount is a whole number of 0 or more. Played tempo is still `min(300, session BPM + amount × step)`.
- An Off play does not end. The count-in stays four beats in 4/4.
- One beat still lasts `60 / BPM` from the beat start. A beat is never split.
- The Off play places enough whole beats to cover at least the next 2 seconds, and places another stretch when less than 1 second of placed clicks remains.
- While Off, the stage clock counts up during the play. Its accessible name is Played. Focusing it does not write an end. The count-in clock still counts down, stays named Duration, and is not editable while Off.
- While Time or Bars, the stage clock counts down and writes `time.seconds`. Its accessible name stays Duration.
- The cards under the footer are absent only when the session type is Time.
- Left is shown only while the increase is Time or Bars.
- The third button's accessible name is BPM increase. Its description is Off, Time, or Bars. Off shows ∞, Time shows a clock, and Bars shows two barlines. No visible caption on the button.
- The panel lists Off, Time, and Bars. Off closes it. Time or Bars leaves it open and shows Amount, Every, and End.
- One panel is open at a time. Escape or a click outside closes it.
- The editor choices are Off, Time, and Bars. Every and Duration are hidden for Off. Simple and Complex keep Interval and Round.
- Stay on `feat/restyle` in this checkout. Do not create a git worktree. Do not implement on `main`.
- Do not stage `src/tokens.css`, `src/tokens.test.ts`, or `.vite/`. Do not push. Do not start `npm run dev`.
- `Unknown env config "devdir"` is environment noise, not a failure.

## File structure

- `src/types.ts` — `TimePattern.increaseEvery` includes `"off"`.
- `src/session.ts` — `freshTime()` and `clampTime`.
- `src/expandSession.ts` — an Off play has infinite duration and one tempo step.
- `src/clock.ts` — `clicksInSegment` accepts a range. `clickWindow` covers the next 2 seconds of whole beats.
- `src/audio.ts` — `scheduleClicks` places an explicit list of marks.
- `src/App.tsx` — an endless play refills its clicks and a BPM edit keeps the elapsed time into the play.
- `src/StagePicks.tsx` — the third button and its panel, only for Time.
- `src/Practice.tsx` — hide the strip, hide Left while Off, and count the Off play upward.
- `src/Edit.tsx` — Off, Time, and Bars, with Every and Duration hidden while Off.
- `src/app.css` — the clock and barline marks use the button color.
- Tests live beside those files.

---

### Task 1: Store an Off climb

**Files:**
- Modify: `src/types.ts`
- Modify: `src/session.ts`
- Modify: `src/session.test.ts`

**Interfaces:**
- Consumes: `freshTime`, `clampTime`, `TimePattern`.
- Produces: `TimePattern.increaseEvery` is `"off" | "time" | "bars"`. `freshTime().increaseEvery` is `"off"`.

- [ ] **Step 1: Write the failing tests**

In `src/session.test.ts`, change the `freshTime()` expectation to:

```ts
expect(freshTime()).toEqual({
  seconds: 120,
  increaseEvery: "off",
  everySec: 30,
  everyBars: 4,
})
```

In "loads a missing time pattern as fresh and keeps the saved type", replace the unknown-increase expectation with:

```ts
session.time.increaseEvery = "nope" as "off"
session.time.seconds = 0
session.time.everySec = 0
session.time.everyBars = 0
expect(clampSession(session).time).toEqual({
  seconds: 1,
  increaseEvery: "off",
  everySec: 1,
  everyBars: 1,
})
session.time.increaseEvery = "time"
expect(clampSession(session).time.increaseEvery).toBe("time")
session.time.increaseEvery = "bars"
expect(clampSession(session).time.increaseEvery).toBe("bars")
```

- [ ] **Step 2: Run the session tests to verify they fail**

Run: `npm test -- src/session.test.ts`

Expected: FAIL. `freshTime()` still returns `"time"`, and the unknown value still clamps to `"time"`.

- [ ] **Step 3: Accept off**

In `src/types.ts`, change the Time pattern field to:

```ts
increaseEvery: "off" | "time" | "bars"
```

In `src/session.ts`, set `freshTime().increaseEvery` to `"off"`. Change `clampTime` so `"bars"` stays `"bars"`, `"time"` stays `"time"`, and every other value, including a missing pattern's fallback after `freshTime()`, stays `"off"`:

```ts
increaseEvery: base.increaseEvery === "bars" || base.increaseEvery === "time" ? base.increaseEvery : "off",
```

`freshTime()` is the fallback, and its value is already `"off"`, so a missing pattern still equals `freshTime()`. Do not change `timeSteps` or `expandSession` in this task.

- [ ] **Step 4: Run the session tests to verify they pass**

Run: `npm test -- src/session.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/types.ts src/session.ts src/session.test.ts
git commit -m "Store an Off climb that keeps the saved end."
```

Do not stage `src/tokens.css`, `src/tokens.test.ts`, or `.vite/`.

---

### Task 2: Play an Off session without an end

**Files:**
- Modify: `src/expandSession.ts`
- Modify: `src/clock.ts`
- Modify: `src/audio.ts`
- Modify: `src/App.tsx`
- Modify: `src/expandSession.test.ts`
- Modify: `src/clock.test.ts`
- Modify: `src/App.test.tsx`
- Modify: `src/Edit.test.tsx`

**Interfaces:**
- Consumes: `TimePattern.increaseEvery`, `bpmAt`, `clicksInSegment`, `scheduleSegment`.
- Produces: `clickWindow(segment: Segment, fromSec: number): { untilSec: number; marks: ClickMark[] }`. `scheduleClicks(ctx: AudioContext, sounds: ClickSounds, marks: ClickMark[], when: number): AudioBufferSourceNode[]`. An Off play has `durationSec` of `Number.POSITIVE_INFINITY` and `steps: [{ atSec: 0, bpm }]`.

- [ ] **Step 1: Write the failing tests**

In `src/expandSession.test.ts`, add:

```ts
it("plays an Off session as a count-in plus one endless play", () => {
  const session = createDefaultSession(() => "cycle-1")
  session.bpm = 60
  const segments = expandSession(session)
  expect(segments.map((segment) => segment.kind)).toEqual(["count-in", "play"])
  expect(clicksInSegment(segments[0])).toHaveLength(4)
  expect(segments[1].durationSec).toBe(Number.POSITIVE_INFINITY)
  expect(segments[1].steps).toEqual([{ atSec: 0, bpm: 60 }])
})

it("holds the tempo and stops at the end when the amount is 0", () => {
  const session = createDefaultSession(() => "cycle-1")
  session.time.increaseEvery = "time"
  session.time.seconds = 10
  session.time.everySec = 5
  session.bpmIncrease = 0
  const play = expandSession(session).find((segment) => segment.kind === "play")!
  expect(play.durationSec).toBe(10)
  expect(play.steps?.every((step) => step.bpm === 80)).toBe(true)
  expect(play.steps?.length).toBeGreaterThan(1)
})
```

Import `clicksInSegment` from `./clock`.

In `src/clock.test.ts`, add:

```ts
it("places the next two seconds of an endless play and then the following stretch", () => {
  const session = createDefaultSession(() => "cycle-1")
  session.bpm = 60
  const play = expandSession(session).find((segment) => segment.kind === "play")!
  const first = clickWindow(play, 0)
  expect(first.untilSec).toBe(2)
  expect(first.marks.map((mark) => mark.offsetSec)).toEqual([0, 1])
  const second = clickWindow(play, first.untilSec)
  expect(second.marks.map((mark) => mark.offsetSec)).toEqual([2, 3])
  expect(clicksInSegment(play)).toEqual([])
})
```

Import `clickWindow`.

In `src/App.test.tsx`, add:

```ts
it("keeps playing an Off session and keeps a typed BPM at the same moment", async () => {
  vi.stubGlobal("AudioContext", FakeAudioContext)
  vi.spyOn(performance, "now").mockReturnValue(0)
  let tick: FrameRequestCallback | null = null
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
    tick ??= callback
    return 1
  })
  vi.stubGlobal("cancelAnimationFrame", () => {})
  const session = createDefaultSession(() => "cycle-1")
  session.bpm = 80
  window.localStorage.setItem(SESSION_KEY, JSON.stringify(session))
  const user = userEvent.setup()
  render(<App />)
  await user.click(screen.getByRole("button", { name: "Play" }))
  const countInSec = (4 * 60) / 80
  await act(async () => {
    tick?.((countInSec + 10) * 1000)
  })
  expect(screen.getByRole("button", { name: "Pause" })).toBeInTheDocument()
  const bpm = screen.getByRole("textbox", { name: "BPM" })
  await user.click(bpm)
  await user.clear(bpm)
  await user.type(bpm, "100")
  await user.tab()
  expect(screen.getByRole("textbox", { name: "BPM" })).toHaveValue("100")
  expect(screen.getByText("Elapsed").nextElementSibling).toHaveTextContent("0:13")
  expect(screen.getByRole("button", { name: "Pause" })).toBeInTheDocument()
})
```

In `src/Edit.test.tsx`, inside "edits a time session by clock time or by bars", after `expect(opened.time).toEqual(freshTime())`, set the mode before the rerender that looks for Duration and Total:

```ts
opened.time = { ...opened.time, increaseEvery: "time" }
```

The fresh session is Off, so the rest of that test still has to opt into a finite Time session until the editor grows an Off choice.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test -- src/expandSession.test.ts src/clock.test.ts src/App.test.tsx`

Expected: FAIL. `clickWindow` is not defined, and the default play still lasts 120 seconds.

- [ ] **Step 3: Expand and schedule an endless play**

In `src/expandSession.ts`, before the `timeSteps` call, return early for Off:

```ts
if (session.type === "time" && session.time.increaseEvery === "off") {
  return [{
    id: "time",
    bpm: session.bpm,
    durationSec: Number.POSITIVE_INFINITY,
    restSec: 0,
    steps: [{ atSec: 0, bpm: session.bpm }],
  }]
}
```

In `src/clock.ts`, change `clicksInSegment` so it walks from `fromSec` to `untilSec`. The defaults keep every existing call on a finite segment:

```ts
export function clicksInSegment(segment: Segment, fromSec = 0, untilSec = segment.durationSec): ClickMark[] {
  const end = Math.min(
    Number.isFinite(segment.durationSec) ? segment.durationSec : Number.POSITIVE_INFINITY,
    Number.isFinite(untilSec) ? untilSec : 0,
  )
  const start = Math.max(0, fromSec)
  if (segment.kind === "rest" || !(end > start)) return []
  const slots = segment.kind === "count-in" || !segment.slots?.length ? [segment.click] : segment.slots
  const beats = segment.kind === "count-in" ? 4 : beatsInMeter(segment.meter)
  const marks: ClickMark[] = []
  let offsetSec = 0
  let beatIndex = 0
  while (offsetSec < end - 1e-9) {
    const beatDur = 60 / bpmAt(segment, offsetSec)
    if (!(beatDur > 0)) break
    const beat = (beatIndex % beats) + 1
    const slotDur = beatDur / slots.length
    slots.forEach((slot, index) => {
      const at = offsetSec + index * slotDur
      if (at < start - 1e-9 || at >= end - 1e-9 || slot === "off") return
      marks.push({ offsetSec: at, beat, accent: beat === 1 && index === 0, click: slot })
    })
    offsetSec += beatDur
    beatIndex += 1
  }
  return marks
}

export function clickWindow(segment: Segment, fromSec: number): { untilSec: number; marks: ClickMark[] } {
  let untilSec = Math.max(0, fromSec)
  let guard = 0
  while (untilSec < fromSec + 2 - 1e-9 && guard < 64) {
    const beat = 60 / bpmAt(segment, untilSec)
    if (!(beat > 0)) break
    untilSec += beat
    guard += 1
  }
  if (Number.isFinite(segment.durationSec)) untilSec = Math.min(untilSec, segment.durationSec)
  return { untilSec, marks: clicksInSegment(segment, fromSec, untilSec) }
}
```

`beatAt` already stops when the next beat would pass the elapsed moment, so an infinite duration does not make it loop forever.

In `src/audio.ts`, add `scheduleClicks` and use it from `scheduleSegment`:

```ts
import type { ClickMark } from "./clock"

export function scheduleClicks(ctx: AudioContext, sounds: ClickSounds, marks: ClickMark[], when: number) {
  return marks.map((mark) => {
    const buffers = sounds.clicks[mark.click]
    return startBuffer(ctx, mark.accent ? buffers.accent : buffers.normal, when + mark.offsetSec)
  })
}
```

`scheduleSegment` returns the rest cue for a rest, and otherwise `scheduleClicks(ctx, sounds, clicksInSegment(segment), when)`.

In `src/App.tsx`, import `clickWindow` and `scheduleClicks`. Replace the body of the playing effect. A finite segment keeps the current one-shot schedule. An endless segment places one window at the elapsed moment inside the play, then another window whenever less than 1 second of that window remains. `durationSec - remainingSec` is `NaN` when both are infinite, so the elapsed time into an endless play comes from the session elapsed minus the finite segments before it.

```ts
useEffect(() => {
  if (status !== "playing") {
    stopNodes()
    return
  }
  const audio = audioRef.current
  if (!audio) return
  if (!buffersRef.current) buffersRef.current = createClickSounds(audio)
  const segment = segmentsRef.current[snapshot.segmentIndex]
  const before = segmentsRef.current
    .slice(0, snapshot.segmentIndex)
    .reduce((sum, item) => sum + item.durationSec, 0)
  const into = Number.isFinite(segment.durationSec)
    ? Math.max(0, segment.durationSec - remainingRef.current)
    : Math.max(0, elapsedRef.current - before)
  const idealWhen = audio.currentTime - into
  const boundarySlackSec = 0.05
  const sounds = buffersRef.current
  const keep = (nodes: AudioBufferSourceNode[], marks: { offsetSec: number }[]) => {
    const kept: AudioBufferSourceNode[] = []
    nodes.forEach((node, index) => {
      const idealStart = idealWhen + marks[index].offsetSec
      if (idealStart < audio.currentTime - boundarySlackSec) {
        try {
          node.stop()
        } catch {
          // click already in the past
        }
        return
      }
      kept.push(node)
    })
    return kept
  }
  if (Number.isFinite(segment.durationSec)) {
    const scheduled = scheduleSegment(audio, sounds, segment, idealWhen)
    const marks = segment.kind === "rest" ? [{ offsetSec: 0 }] : clicksInSegment(segment)
    nodesRef.current = keep(scheduled, marks)
    return () => stopNodes()
  }
  let until = into
  const place = () => {
    const from = until
    const window = clickWindow(segment, from)
    const scheduled = scheduleClicks(audio, sounds, window.marks, idealWhen)
    nodesRef.current = nodesRef.current.concat(keep(scheduled, window.marks))
    until = window.untilSec
  }
  place()
  const timer = window.setInterval(() => {
    const played = audio.currentTime - idealWhen
    if (until - played < 1) place()
  }, 250)
  return () => {
    window.clearInterval(timer)
    stopNodes()
  }
}, [snapshot.segmentIndex, status, segments, seekCount])
```

In `onChange`, before the finite step-fraction math, keep the elapsed moment of an endless play:

```ts
if (currentSegment.kind === "play" && !Number.isFinite(currentSegment.durationSec)) {
  const nextCountIn = nextSegments.find((segment) => segment.kind === "count-in")
  const played = Math.max(0, elapsedRef.current - segments.slice(0, current.segmentIndex).reduce((sum, segment) => sum + segment.durationSec, 0))
  nextElapsed = (nextCountIn?.durationSec ?? 0) + played
} else if (currentSegment.kind === "play") {
```

Leave the existing `else if` count-in branch in place. `Math.min(total, nextElapsed)` keeps `nextElapsed` when `total` is infinite.

`usePlayback` already refuses to stop when `total` is infinite, because `next >= Infinity` is false. Do not add a look-ahead that moves a click off its beat time.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test`

Expected: PASS. The Edit time test still finds Duration and Total `2:03` because it opts back into `"time"` before that render.

- [ ] **Step 5: Commit**

```bash
git add src/expandSession.ts src/clock.ts src/audio.ts src/App.tsx src/expandSession.test.ts src/clock.test.ts src/App.test.tsx src/Edit.test.tsx
git commit -m "Play an Off session until it is stopped."
```

Stage only files this task changed. Do not stage `src/tokens.css`, `src/tokens.test.ts`, or `.vite/`.

---

### Task 3: Pick the climb from a third stage button

**Files:**
- Modify: `src/StagePicks.tsx`
- Modify: `src/Practice.tsx`
- Modify: `src/app.css`
- Modify: `src/Practice.test.tsx`

**Interfaces:**
- Consumes: `Session.time.increaseEvery`, `StagePicks`, `formatClock`, `formatDuration`, `parseDuration`.
- Produces: a button named BPM increase. Its panel writes `time.increaseEvery`, `bpmIncrease`, `time.everySec`, `time.everyBars`, and `time.seconds`.

- [ ] **Step 1: Write the failing practice tests**

In "shows the first count-in while stopped", replace the strip assertion with:

```ts
expect(document.querySelector(".strip")).not.toBeInTheDocument()
expect(screen.queryByText("Left")).not.toBeInTheDocument()
expect(screen.getByText("Elapsed")).toBeInTheDocument()
expect(screen.getByTestId("footer-set")).toHaveTextContent("1 / 2")
```

In "orders the clock, the two buttons, BPM, the dots, and Play", insert the increase button between Subdivision and BPM:

```ts
screen.getByRole("button", { name: "Subdivision" }),
screen.getByRole("button", { name: "BPM increase" }),
screen.getByRole("textbox", { name: "BPM" }),
```

Add:

```ts
it("hides the cards only for a Time session", () => {
  const session = createDefaultSession(() => "cycle-1")
  session.type = "simple"
  const segments = expandSession(session)
  render(
    <Practice
      session={session}
      segments={segments}
      snapshot={snapshotAt(segments, 0)}
      status="stopped"
      onToggle={() => {}}
      onJump={() => {}}
      onReset={() => {}}
      onEdit={() => {}}
      onChange={() => {}}
      onSeek={() => {}}
    />,
  )
  expect(document.querySelector(".strip")).toBeInTheDocument()
  expect(screen.queryByRole("button", { name: "BPM increase" })).not.toBeInTheDocument()
})

it("counts an Off play upward and edits the climb from the third button", async () => {
  const user = userEvent.setup()
  const session = createDefaultSession(() => "cycle-1")
  session.bpm = 80
  const segments = expandSession(session)
  const countIn = segments[0].durationSec
  const onChange = vi.fn()
  const { rerender } = render(
    <Practice
      session={session}
      segments={segments}
      snapshot={snapshotAt(segments, countIn + 2)}
      status="stopped"
      onToggle={() => {}}
      onJump={() => {}}
      onReset={() => {}}
      onEdit={() => {}}
      onChange={onChange}
      onSeek={() => {}}
    />,
  )
  const clock = screen.getByTestId("stage-time")
  expect(clock).toHaveAccessibleName("Played")
  expect(clock).toHaveValue("0:02")
  await user.click(clock)
  await user.tab()
  expect(onChange).not.toHaveBeenCalled()
  const increase = screen.getByRole("button", { name: "BPM increase" })
  expect(increase).toHaveAccessibleDescription("Off")
  expect(increase).toHaveTextContent("∞")
  await user.click(increase)
  await user.click(screen.getByRole("button", { name: "Time", exact: true }))
  const timed = onChange.mock.calls.at(-1)?.[0]
  expect(timed.time.increaseEvery).toBe("time")
  expect(timed.time.seconds).toBe(120)
  rerender(
    <Practice
      session={timed}
      segments={expandSession(timed)}
      snapshot={snapshotAt(expandSession(timed), 0)}
      status="stopped"
      onToggle={() => {}}
      onJump={() => {}}
      onReset={() => {}}
      onEdit={() => {}}
      onChange={onChange}
      onSeek={() => {}}
    />,
  )
  expect(screen.getByRole("button", { name: "Time", exact: true })).toHaveAttribute("aria-pressed", "true")
  expect(screen.getByRole("textbox", { name: "Amount" })).toHaveValue("0")
  expect(screen.getByRole("textbox", { name: "Every" })).toHaveValue("0:30")
  expect(screen.getByRole("textbox", { name: "End" })).toHaveValue("2:00")
  expect(screen.getByText("Left")).toBeInTheDocument()
  await user.click(screen.getByRole("button", { name: "Off", exact: true }))
  const stopped = onChange.mock.calls.at(-1)?.[0]
  expect(stopped.time.increaseEvery).toBe("off")
  expect(stopped.time.seconds).toBe(120)
  expect(screen.queryByRole("button", { name: "Time", exact: true })).not.toBeInTheDocument()
})
```

The Off click closes the panel on the same render because the panel state is local. The Time click leaves it open across the rerender.

- [ ] **Step 2: Run the practice tests to verify they fail**

Run: `npm test -- src/Practice.test.tsx`

Expected: FAIL. The strip is still present, and there is no BPM increase button.

- [ ] **Step 3: Add the button and the Off clock**

In `src/StagePicks.tsx`, extend `open` with `"increase"`. Render the third button only when `props.session.type === "time"`, after the Subdivision button. Its accessible name is BPM increase. A visually hidden span, outside the button, holds Off, Time, or Bars, and the button points at it with `aria-describedby`. The visible mark is `∞` for Off. Time and Bars use these icons, with `currentColor` and `aria-hidden`:

```tsx
function ClockIcon() {
  return (
    <svg viewBox="0 0 24 24" width="28" height="28" aria-hidden="true">
      <circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" strokeWidth="2" />
      <path d="M12 8v4l3 2" fill="none" stroke="currentColor" strokeWidth="2" />
    </svg>
  )
}

function BarsIcon() {
  return (
    <svg viewBox="0 0 24 24" width="28" height="28" aria-hidden="true">
      <path d="M8 5v14M16 5v14" fill="none" stroke="currentColor" strokeWidth="2" />
    </svg>
  )
}
```

The increase panel is in the same `.stage-panel` flow. It lists Off, Time, and Bars, and the current one has `aria-pressed`. Choosing Off writes `increaseEvery: "off"` and calls `setOpen(null)`. Choosing Time or Bars writes that mode and does not close the panel. When the mode is Time or Bars, the panel also shows three text boxes:

- Amount writes `bpmIncrease` with `Math.max(0, Math.round(Number(value)))`.
- Every writes `everySec` through `parseDuration` when the mode is Time, and `everyBars` through `Math.max(1, Math.round(Number(value)))` when the mode is Bars. The Time value is `formatDuration(session.time.everySec)`. The Bars value is `String(session.time.everyBars)`.
- End writes `time.seconds` through `parseDuration`. Its shown value is `formatDuration(session.time.seconds)`.

Opening the meter or subdivision panel still clears `open`, so only one panel is open. The existing outside click and Escape listener stays on `open`.

In `src/Practice.tsx`:

```tsx
const endless = props.session.type === "time" && props.session.time.increaseEvery === "off"
const playedSec = Math.max(0, props.snapshot.elapsedSec - props.segments.slice(0, props.snapshot.segmentIndex).reduce((sum, item) => sum + (Number.isFinite(item.durationSec) ? item.durationSec : 0), 0))
const countingUp = endless && segment.kind === "play"
const clock = countingUp ? formatClock(playedSec) : formatClock(Math.ceil(props.snapshot.segmentRemainingSec - 1e-9))
```

The stage clock's accessible name is Played while `countingUp`, and Duration otherwise. While `endless`, `onFocus` and `onChange` do nothing, and `readOnly` is set, so a click cannot write `time.seconds`.

Render the strip only when `props.session.type !== "time"`. Render the Left footer cell only when `!endless`.

In `src/app.css`, the new icons inherit the button color through `currentColor`. No extra button size is required. The three squares already share `.stage-pick-row > button`.

- [ ] **Step 4: Run the practice tests to verify they pass**

Run: `npm test -- src/Practice.test.tsx`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/StagePicks.tsx src/Practice.tsx src/app.css src/Practice.test.tsx
git commit -m "Pick a Time climb from a third stage button."
```

Do not stage `src/tokens.css`, `src/tokens.test.ts`, or `.vite/`.

---

### Task 4: Choose Off from the editor

**Files:**
- Modify: `src/Edit.tsx`
- Modify: `src/Edit.test.tsx`

**Interfaces:**
- Consumes: `time.increaseEvery` of `"off" | "time" | "bars"`.
- Produces: the editor group Increase every contains Off, Time, and Bars. Every and Duration render only for Time and Bars.

- [ ] **Step 1: Write the failing editor test**

Replace the start of "edits a time session by clock time or by bars", from the Time click through the first Every expectation, with this. Remove the `opened.time = { ...opened.time, increaseEvery: "time" }` line added in Task 2.

```ts
await user.click(within(types).getByRole("button", { name: "Time" }))
const opened = onChange.mock.calls.at(-1)?.[0]
expect(opened.type).toBe("time")
expect(opened.time).toEqual(freshTime())
expect(opened.simple.practices).toBe(4)
rerender(<Edit session={opened} onChange={onChange} onDone={() => {}} />)
expect(screen.queryByRole("textbox", { name: "Duration" })).not.toBeInTheDocument()
expect(screen.queryByRole("textbox", { name: "Every" })).not.toBeInTheDocument()
expect(screen.queryByText(/^Total /)).not.toBeInTheDocument()
const increase = screen.getByRole("group", { name: "Increase every" })
expect(within(increase).getByRole("button", { name: "Off" })).toHaveAttribute("aria-pressed", "true")
await user.click(within(increase).getByRole("button", { name: "Time" }))
const timed = onChange.mock.calls.at(-1)?.[0]
expect(timed.time.increaseEvery).toBe("time")
expect(timed.time.seconds).toBe(120)
rerender(<Edit session={timed} onChange={onChange} onDone={() => {}} />)
expect(screen.getByRole("textbox", { name: "Duration" })).toHaveValue("2:00")
expect(screen.getByText("Total 2:03")).toBeInTheDocument()
expect(screen.getByRole("textbox", { name: "Every" })).toHaveValue("0:30")
```

Leave the Bars click and the return to Simple in place, using `timed` where the old test used the first opened session.

In "commits typed Every and Duration values on a time session", the fresh session is Off. After the first render, click Time and rerender the returned session before looking for Every:

```ts
const increase = screen.getByRole("group", { name: "Increase every" })
await user.click(within(increase).getByRole("button", { name: "Time", exact: true }))
const timed = onChange.mock.calls.at(-1)?.[0]
rerender(<Edit session={timed} onChange={onChange} onDone={() => {}} />)
```

- [ ] **Step 2: Run the editor test to verify it fails**

Run: `npm test -- src/Edit.test.tsx`

Expected: FAIL. The increase group has no Off button, and Duration is still shown for an Off session.

- [ ] **Step 3: Add Off beside Time and Bars**

In `src/Edit.tsx`, the Time branch of the Increase every group becomes three buttons. Off is pressed when `increaseEvery === "off"` and writes `"off"`. Time is pressed only when `increaseEvery === "time"`. Bars stays pressed only for `"bars"`.

Render the Every field when `session.type === "time" && session.time.increaseEvery !== "off"`. Render the Time builder's Duration field and its Total line only in that same case. While Off, that builder is empty. The BPM increase amount field stays where it is.

- [ ] **Step 4: Run the full suite to verify it passes**

Run: `npm test`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/Edit.tsx src/Edit.test.tsx
git commit -m "Choose Off, Time, or Bars for a Time climb."
```

Do not stage `src/tokens.css`, `src/tokens.test.ts`, or `.vite/`.

---
