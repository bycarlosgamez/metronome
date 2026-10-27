# Simple BPM Increase Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let Simple raise the BPM on each interval or each round, and keep those tempos when the pattern becomes Complex.

**Architecture:** `SimplePattern.increaseEvery` selects the step. `simplePlayedBpm` is the only formula for a Simple practice. `expandSession` and `cyclesFromSimple` both call it. The editor shows Interval and Round beside BPM increase, and hides that choice in Complex.

**Tech Stack:** Vite 6, React 19, TypeScript, Vitest 3, Testing Library, user-event. `npm test` is `vitest run`.

## Global Constraints

- Beside BPM increase, Simple offers Interval or Round.
- Practices inside one interval share one BPM.
- An interval climb restarts when the round repeats.
- A round climb holds one BPM for every interval in that round, then steps on the next round.
- Switching from Simple to Complex keeps the tempos that would have played.
- A second increase amount is out of scope. There is still one BPM increase.
- Complex still uses Every. This choice stays hidden there.
- Rests, count-in, the 300 cap, and the practice page stay as they are.
- `increaseEvery` missing or unknown loads as `"interval"`. Fresh Simple uses `"interval"`.
- Played BPM is `min(300, session BPM + BPM increase × step)`. Step is the interval index within the round, or the round index. Both indexes start at 0.
- Every becomes the Practices count. A cycle stores its played BPM only when that differs from `min(300, session BPM + BPM increase × floor(cycle index / Practices))`.

## File structure

- `src/types.ts` — `IncreaseEvery` and `SimplePattern.increaseEvery`.
- `src/session.ts` — clamp, `simplePlayedBpm`, and cycle BPM when the ladder differs.
- `src/session.test.ts` — default, clamp, played BPM, and stored cycle BPM.
- `src/expandSession.ts` — Simple playback uses `simplePlayedBpm`.
- `src/expandSession.test.ts` — the restarted 30-second session and the round climb.
- `src/Edit.tsx` — Increase every, beside BPM increase, Simple only.
- `src/Edit.test.tsx` — the choice is visible in Simple and hidden in Complex.

Do not stage `src/tokens.css`, `src/tokens.test.ts`, or `.vite/`. Leave the uncommitted editor label and spacing work in place. Do not revert Repeat interval, the Session and Tempo cards, or the select padding.

---

### Task 1: Play the interval or the round

**Files:**
- Modify: `src/types.ts`
- Modify: `src/session.ts`
- Modify: `src/session.test.ts`
- Modify: `src/expandSession.ts`
- Modify: `src/expandSession.test.ts`

**Interfaces:**
- Consumes: `clampBpm`, `ladderBpm`, `clampSimple`, `cyclesFromSimple`, `expandSession`.
- Produces:
  - `IncreaseEvery = "interval" | "round"`
  - `SimplePattern.increaseEvery: IncreaseEvery`
  - `simplePlayedBpm(bpm: number, increase: number, increaseEvery: IncreaseEvery, round: number, interval: number): number`

- [ ] **Step 1: Write the failing session tests**

In `src/session.test.ts`, add `increaseEvery: "interval"` to the `freshSimple()` object in "builds the first-visit session".

Add this test:

```ts
it("restarts an interval climb and stores the bpm a ladder would miss", () => {
  const session = createDefaultSession(() => "cycle-1")
  session.bpm = 80
  session.bpmIncrease = 5
  session.simple = {
    practices: 1,
    length: { unit: "time", seconds: 30 },
    restAfterSec: 5,
    stepTempo: true,
    times: 3,
    repeatRound: true,
    rounds: 2,
    restBetweenSec: 60,
    increaseEvery: "interval",
  }
  expect(simplePlayedBpm(80, 5, "interval", 0, 2)).toBe(90)
  expect(simplePlayedBpm(80, 5, "round", 2, 0)).toBe(90)
  expect(simplePlayedBpm(290, 20, "interval", 0, 2)).toBe(300)
  const cycles = cyclesFromSimple(session, () => "id")
  expect(cycles.map((cycle) => cycle.bpm)).toEqual([
    undefined, undefined, undefined, 80, 85, 90,
  ])
  const raw = createDefaultSession(() => "cycle-1")
  delete (raw.simple as { increaseEvery?: string }).increaseEvery
  expect(clampSession(raw).simple.increaseEvery).toBe("interval")
  raw.simple.increaseEvery = "nope" as "interval"
  expect(clampSession(raw).simple.increaseEvery).toBe("interval")
})
```

Import `simplePlayedBpm` from `./session`.

- [ ] **Step 2: Run the session test to verify it fails**

Run: `npx vitest run src/session.test.ts`

Expected: FAIL. `freshSimple()` has no `increaseEvery`, or `simplePlayedBpm` is not exported.

- [ ] **Step 3: Add the field and the formula**

In `src/types.ts`, add:

```ts
export type IncreaseEvery = "interval" | "round"
```

Add `increaseEvery: IncreaseEvery` to `SimplePattern`.

In `src/session.ts`, import `IncreaseEvery`. Add `increaseEvery: "interval"` to `freshSimple()`.

Add:

```ts
export function simplePlayedBpm(
  bpm: number,
  increase: number,
  increaseEvery: IncreaseEvery,
  round: number,
  interval: number,
): number {
  const step = increaseEvery === "round" ? round : interval
  return Math.min(300, clampBpm(bpm) + Math.max(0, integer(increase)) * Math.max(0, integer(step)))
}
```

In `clampSimple`, add:

```ts
increaseEvery: base.increaseEvery === "round" ? "round" : "interval",
```

In `cyclesFromSimple`, inside the practice loop, after `lastOfSession`:

```ts
const index = cycles.length
const played = simplePlayedBpm(session.bpm, session.bpmIncrease, pattern.increaseEvery, round, step)
const ladder = ladderBpm(session.bpm, session.bpmIncrease, pattern.practices, index)
const cycle: Cycle = {
  id: nextId(),
  length: pattern.length,
  restSec: lastOfSession ? 0 : lastOfRound ? pattern.restBetweenSec : pattern.restAfterSec,
}
if (played !== ladder) cycle.bpm = played
cycles.push(cycle)
```

Replace the existing `cycles.push({ ... })` with that block. `step` in this loop is the interval index. `round` is the round index.

- [ ] **Step 4: Run the session tests**

Run: `npx vitest run src/session.test.ts`

Expected: PASS.

- [ ] **Step 5: Write the failing expansion tests**

In `src/expandSession.test.ts`, add `increaseEvery: "interval"` to `example()`.

Replace the played-BPM expectation in "builds the 30 second session and does not end on a rest" with one round of 80, 85, 90, each played three times, repeated for all three rounds:

```ts
expect(plays.map((segment) => segment.bpm)).toEqual(
  Array.from({ length: 3 }, () => [80, 80, 80, 85, 85, 85, 90, 90, 90]).flat(),
)
```

Leave the rest counts, the final play, and the count-in assertion as they are.

Add:

```ts
it("holds one bpm for a round and steps on the next round", () => {
  const session = example()
  session.simple.practices = 1
  session.simple.increaseEvery = "round"
  const plays = expandSession(session).filter((segment) => segment.kind === "play")
  expect(plays.map((segment) => segment.bpm)).toEqual([
    80, 80, 80, 85, 85, 85, 90, 90, 90,
  ])
})
```

`example()` uses Times 3 and Rounds 3, so one practice per interval makes nine plays.

Add:

```ts
it("shares one bpm across the practices in an interval", () => {
  const session = createDefaultSession(() => "cycle-1")
  session.bpmIncrease = 5
  session.simple.practices = 3
  session.simple.stepTempo = true
  session.simple.times = 2
  session.simple.increaseEvery = "interval"
  const plays = expandSession(session).filter((segment) => segment.kind === "play")
  expect(plays.map((segment) => segment.bpm)).toEqual([80, 80, 80, 85, 85, 85])
})

it("caps a stepped simple bpm at 300", () => {
  const session = createDefaultSession(() => "cycle-1")
  session.bpm = 290
  session.bpmIncrease = 20
  session.simple.stepTempo = true
  session.simple.times = 3
  session.simple.increaseEvery = "interval"
  const plays = expandSession(session).filter((segment) => segment.kind === "play")
  expect(plays.map((segment) => segment.bpm)).toEqual([290, 300, 300])
})
```

- [ ] **Step 6: Run the expansion test to verify it fails**

Run: `npx vitest run src/expandSession.test.ts`

Expected: FAIL. The 30-second plays still climb through 120, or `increaseEvery` is missing on the type.

- [ ] **Step 7: Play Simple from simplePlayedBpm**

In `src/expandSession.ts`, import `simplePlayedBpm`. Replace the Simple `ladderBpm(...)` line with:

```ts
const bpm = simplePlayedBpm(
  session.bpm,
  session.bpmIncrease,
  session.simple.increaseEvery,
  round,
  step,
)
```

`step` is the interval index in that loop. Do not change Complex playback.

- [ ] **Step 8: Run the expansion tests**

Run: `npx vitest run src/expandSession.test.ts src/session.test.ts`

Expected: PASS. The bar-length test still sees 24 seconds at 80 and a shorter practice at index 3.

- [ ] **Step 9: Commit**

```bash
git add src/types.ts src/session.ts src/session.test.ts src/expandSession.ts src/expandSession.test.ts
git commit -m "$(cat <<'EOF'
Raise the Simple BPM on each interval or each round.

EOF
)"
```

Do not stage unrelated dirty files.

---

### Task 2: Choose Interval or Round

**Files:**
- Modify: `src/Edit.tsx`
- Modify: `src/Edit.test.tsx`

**Interfaces:**
- Consumes: `SimplePattern.increaseEvery` from Task 1. `commit` already runs `clampSession`.
- Produces: a group named Increase every with buttons Interval and Round, rendered only when `session.type === "simple"`.

- [ ] **Step 1: Write the failing editor test**

Add to `src/Edit.test.tsx`:

```ts
it("chooses a round increase and hides that choice on complex", async () => {
  const user = userEvent.setup()
  const onChange = vi.fn()
  render(<Edit session={createDefaultSession(() => "cycle-1")} onChange={onChange} onDone={() => {}} />)
  expect(screen.getByRole("group", { name: "Increase every" })).toBeInTheDocument()
  expect(screen.getByRole("button", { name: "Interval" })).toHaveAttribute("aria-pressed", "true")
  expect(screen.queryByRole("textbox", { name: "Every" })).not.toBeInTheDocument()
  await user.click(screen.getByRole("button", { name: "Round" }))
  expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({
    simple: expect.objectContaining({ increaseEvery: "round" }),
  }))
  await user.click(screen.getByRole("button", { name: "Complex" }))
  expect(screen.queryByRole("group", { name: "Increase every" })).not.toBeInTheDocument()
  expect(screen.getByRole("textbox", { name: "Every" })).toBeInTheDocument()
})
```

- [ ] **Step 2: Run the editor test to verify it fails**

Run: `npx vitest run src/Edit.test.tsx`

Expected: FAIL. Simple has no group named Increase every.

- [ ] **Step 3: Render the choice beside BPM increase**

In `src/Edit.tsx`, replace the complex-only Every block inside `.increase-row` with:

```tsx
{session.type === "complex" ? (
  <DraftField label="Every" value={String(session.every)} onCommit={(text) => commit({ ...session, every: Number(text) })} />
) : (
  <div className="type-switch" role="group" aria-label="Increase every">
    <button
      type="button"
      aria-pressed={session.simple.increaseEvery !== "round"}
      onClick={() => commit({ ...session, simple: { ...session.simple, increaseEvery: "interval" } })}
    >
      Interval
    </button>
    <button
      type="button"
      aria-pressed={session.simple.increaseEvery === "round"}
      onClick={() => commit({ ...session, simple: { ...session.simple, increaseEvery: "round" } })}
    >
      Round
    </button>
  </div>
)}
```

Keep BPM increase as the other child of `.increase-row`. Do not show both Every and Increase every. Reuse `.type-switch` so the pressed button matches Simple and Complex. No new CSS.

- [ ] **Step 4: Run the editor tests and the suite**

Run: `npx vitest run src/Edit.test.tsx`

Expected: PASS.

Run: `npm test`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/Edit.tsx src/Edit.test.tsx
git commit -m "$(cat <<'EOF'
Choose whether Simple raises the BPM each interval or each round.

EOF
)"
```

`src/Edit.tsx` and `src/Edit.test.tsx` may already contain the uncommitted Repeat interval label and editor layout. Those belong in this commit. Do not stage `src/app.css` unless this task changed it. Do not stage `src/tokens.css`, `src/tokens.test.ts`, or `.vite/`.
