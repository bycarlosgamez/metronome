# Complex BPM Increase Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Complex raise the BPM on each cycle or each round, and repeat the cycle group with Repeat the round.

**Architecture:** `Session.complex` stores the same increase and round fields Simple already has for its own pattern. One pass through `cycles` is the group Simple builds by repeating an interval. `expandSession` steps with `simplePlayedBpm`. The editor shows one Increase every control for both types, and puts Repeat the round outside the cycle group.

**Tech Stack:** Vite 6, React 19, TypeScript, Vitest 3, Testing Library, user-event. `npm test` is `vitest run`.

## Global Constraints

- Complex shows the same BPM increase card as Simple: the amount, then Interval or Round.
- The cycles are one group. That group is what Repeat interval produces in Simple. Cycles can still be added, removed, and moved up and down.
- Repeat the round repeats the group. Off means the group plays once. On shows Rounds and Between.
- An interval climb steps once per cycle and restarts when the round repeats. A round climb holds one BPM for every cycle in the group, then steps on the next round.
- A cycle that already has its own BPM keeps that BPM.
- Between replaces the rest of the last cycle of a round that is not the last round. The session still does not end on a rest.
- Repeat interval and Times stay Simple-only.
- There is still one BPM increase.
- Simple's own pattern, count-in, the 300 cap, and the practice page layout stay as they are.
- The stored `every` field stays. Playback and the editor do not read it.
- A missing or unknown `complex.increaseEvery` loads as `"interval"`. Fresh Complex uses `"interval"`, `repeatRound: false`, `rounds: 2`, and `restBetweenSec: 30`.
- Played BPM is `cycle.bpm` when set, otherwise `min(300, session BPM + BPM increase × step)`. Step is the cycle index within the round, or the round index. Both indexes start at 0.
- Switching from a Simple-opened visit builds one cycle per practice in a single round, including Times, copies the round settings, and does not set a cycle BPM. Practices that shared a BPM become neighboring cycles and climb one by one in Interval mode.
- The cycle sub-card is not titled Interval.
- Done on Complex sets Simple to `freshSimple()`. Done on Simple replaces cycles with `cyclesFromSimple` and sets `complex` to `freshComplex()`.

## File structure

- `src/types.ts` — `ComplexPattern` and `Session.complex`.
- `src/session.ts` — `freshComplex`, `clampComplex`, `cycleGroupFromSimple`. `cyclesFromSimple` stays the full Simple expansion used by Done.
- `src/session.test.ts` — default, clamp, and the one-round group.
- `src/expandSession.ts` — Complex playback repeats the group and steps with `simplePlayedBpm`.
- `src/expandSession.test.ts` — interval restart, round climb, own BPM, and the 300 cap.
- `src/Edit.tsx` — one Increase every control, the cycle group, and Repeat the round.
- `src/Edit.test.tsx` — the switch, the choice, and Repeat the round.
- `src/Practice.tsx` — Complex BPM and Between edits use the new step.
- `src/Practice.test.tsx` — the later-practice BPM edit and a Between edit.
- `src/app.css` — the nested cycle list has no outer page margin.

Do not stage `src/tokens.css`, `src/tokens.test.ts`, or `.vite/`. The working tree already has the increase card, the raised sub-card, and `--surface-raised`. Build on that. Do not revert it.

---

### Task 1: Play the cycle group

**Files:**
- Modify: `src/types.ts`
- Modify: `src/session.ts`
- Modify: `src/session.test.ts`
- Modify: `src/expandSession.ts`
- Modify: `src/expandSession.test.ts`

**Interfaces:**
- Consumes: `simplePlayedBpm(bpm, increase, increaseEvery, round, interval)`, `clampSimple`, `cyclesFromSimple`.
- Produces:
  - `ComplexPattern = { increaseEvery: IncreaseEvery; repeatRound: boolean; rounds: number; restBetweenSec: number }`
  - `Session.complex: ComplexPattern`
  - `freshComplex(): ComplexPattern`
  - `cycleGroupFromSimple(session: Session, nextId: () => string): Cycle[]`

- [ ] **Step 1: Write the failing session tests**

In `src/session.test.ts`, add `complex: freshComplex()` to the expected object in "builds the first-visit session". Import `freshComplex`.

Add this test:

```ts
it("loads a missing complex choice as interval and builds one round of repeated intervals", () => {
  const session = createDefaultSession(() => "cycle-1")
  delete (session as { complex?: unknown }).complex
  expect(clampSession(session).complex).toEqual(freshComplex())
  session.complex = freshComplex()
  session.complex.increaseEvery = "nope" as "interval"
  expect(clampSession(session).complex.increaseEvery).toBe("interval")
  session.simple = {
    practices: 2,
    length: { unit: "time", seconds: 30 },
    restAfterSec: 5,
    stepTempo: true,
    times: 3,
    repeatRound: true,
    rounds: 2,
    restBetweenSec: 60,
    increaseEvery: "round",
  }
  const cycles = cycleGroupFromSimple(session, () => "id")
  expect(cycles).toHaveLength(6)
  expect(cycles.every((cycle) => cycle.bpm === undefined)).toBe(true)
  expect(cycles.every((cycle) => cycle.restSec === 5)).toBe(true)
  expect(cycles[0].length).toEqual({ unit: "time", seconds: 30 })
})
```

- [ ] **Step 2: Run the session test to verify it fails**

Run: `npx vitest run src/session.test.ts`

Expected: FAIL because `freshComplex` and `cycleGroupFromSimple` are not exported, and `createDefaultSession()` has no `complex`.

- [ ] **Step 3: Add the complex pattern and the one-round group**

In `src/types.ts`, after `SimplePattern`:

```ts
export type ComplexPattern = {
  increaseEvery: IncreaseEvery
  repeatRound: boolean
  rounds: number
  restBetweenSec: number
}
```

Add `complex: ComplexPattern` to `Session`, after `simple`.

In `src/session.ts`, import `ComplexPattern`. Add:

```ts
export function freshComplex(): ComplexPattern {
  return {
    increaseEvery: "interval",
    repeatRound: false,
    rounds: 2,
    restBetweenSec: 30,
  }
}

function clampComplex(pattern: ComplexPattern | undefined): ComplexPattern {
  const base = pattern ?? freshComplex()
  return {
    increaseEvery: base.increaseEvery === "round" ? "round" : "interval",
    repeatRound: Boolean(base.repeatRound),
    rounds: Math.max(1, integer(base.rounds)),
    restBetweenSec: Math.max(0, integer(base.restBetweenSec)),
  }
}

export function cycleGroupFromSimple(session: Session, nextId: () => string): Cycle[] {
  const pattern = clampSimple(session.simple)
  const steps = pattern.stepTempo ? pattern.times : 1
  const cycles: Cycle[] = []
  for (let step = 0; step < steps; step += 1) {
    for (let practice = 0; practice < pattern.practices; practice += 1) {
      cycles.push({
        id: nextId(),
        length: { ...pattern.length },
        restSec: pattern.restAfterSec,
      })
    }
  }
  return cycles
}
```

`createDefaultSession` returns `complex: freshComplex()`. `clampSession` returns `complex: clampComplex(session.complex)`. Add `complex: freshComplex()` to the object `migrateLegacy` passes to `clampSession`, so that object satisfies `Session`.

Leave `cyclesFromSimple` unchanged. Done still uses it for the inactive Simple half.

- [ ] **Step 4: Write the failing playback tests**

Add these tests to `src/expandSession.test.ts`:

```ts
it("restarts a complex interval climb and uses between for the round", () => {
  const session = createDefaultSession(() => "cycle-1")
  session.type = "complex"
  session.bpm = 80
  session.bpmIncrease = 5
  session.complex = {
    increaseEvery: "interval",
    repeatRound: true,
    rounds: 2,
    restBetweenSec: 60,
  }
  session.cycles = [0, 1, 2].map((index) => ({
    id: `cycle-${index}`,
    length: { unit: "time" as const, seconds: 30 },
    restSec: 5,
  }))
  const segments = expandSession(session)
  const plays = segments.filter((segment) => segment.kind === "play")
  expect(plays.map((segment) => segment.bpm)).toEqual([80, 85, 90, 80, 85, 90])
  const rests = segments.filter((segment) => segment.kind === "rest")
  expect(rests.map((segment) => segment.durationSec)).toEqual([5, 5, 60, 5, 5])
  expect(segments.at(-1)?.kind).toBe("play")
})

it("holds one bpm across a complex round", () => {
  const session = createDefaultSession(() => "cycle-1")
  session.type = "complex"
  session.bpm = 80
  session.bpmIncrease = 5
  session.complex.increaseEvery = "round"
  session.complex.repeatRound = true
  session.complex.rounds = 3
  session.cycles = [0, 1, 2].map((index) => ({
    id: `cycle-${index}`,
    length: { unit: "time" as const, seconds: 30 },
    restSec: 0,
  }))
  const plays = expandSession(session).filter((segment) => segment.kind === "play")
  expect(plays.map((segment) => segment.bpm)).toEqual([
    80, 80, 80, 85, 85, 85, 90, 90, 90,
  ])
})

it("keeps one cycle tempo and steps the neighbors", () => {
  const session = createDefaultSession(() => "cycle-1")
  session.type = "complex"
  session.bpm = 80
  session.bpmIncrease = 5
  session.cycles = [
    { id: "a", length: { unit: "time", seconds: 30 }, restSec: 0 },
    { id: "b", length: { unit: "time", seconds: 30 }, restSec: 0, bpm: 100 },
    { id: "c", length: { unit: "time", seconds: 30 }, restSec: 0 },
  ]
  const plays = expandSession(session).filter((segment) => segment.kind === "play")
  expect(plays.map((segment) => segment.bpm)).toEqual([80, 100, 90])
})

it("caps a stepped complex bpm at 300", () => {
  const session = createDefaultSession(() => "cycle-1")
  session.type = "complex"
  session.bpm = 290
  session.bpmIncrease = 20
  session.cycles = [0, 1, 2].map((index) => ({
    id: `cycle-${index}`,
    length: { unit: "time" as const, seconds: 30 },
    restSec: 0,
  }))
  const plays = expandSession(session).filter((segment) => segment.kind === "play")
  expect(plays.map((segment) => segment.bpm)).toEqual([290, 300, 300])
})
```

- [ ] **Step 5: Run the new playback tests to verify they fail**

Run: `npx vitest run src/expandSession.test.ts`

Expected: FAIL. The interval test expects `[80, 85, 90, 80, 85, 90]` and the current ladder does not restart the second round.

- [ ] **Step 6: Repeat the cycle group in expandSession**

Replace the complex branch of `resolved` in `src/expandSession.ts` with:

```ts
if (session.type === "complex") {
  const pattern = session.complex
  const rounds = pattern.repeatRound ? pattern.rounds : 1
  const items: Resolved[] = []
  for (let round = 0; round < rounds; round += 1) {
    session.cycles.forEach((cycle, index) => {
      const lastOfRound = index === session.cycles.length - 1
      const lastOfSession = round === rounds - 1 && lastOfRound
      const bpm = cycle.bpm ?? simplePlayedBpm(session.bpm, session.bpmIncrease, pattern.increaseEvery, round, index)
      items.push({
        id: cycle.id,
        bpm,
        durationSec: lengthSeconds(cycle.length, session.meter, bpm),
        restSec: lastOfSession ? 0 : lastOfRound ? pattern.restBetweenSec : cycle.restSec,
        restRole: lastOfSession ? undefined : lastOfRound ? "between" : "after",
      })
    })
  }
  return items
}
```

`simplePlayedBpm` is already imported in this file. Do not change the Simple branch.

- [ ] **Step 7: Run the model tests**

Run: `npx vitest run src/session.test.ts src/expandSession.test.ts`

Expected: PASS

- [ ] **Step 8: Commit**

```bash
git add src/types.ts src/session.ts src/session.test.ts src/expandSession.ts src/expandSession.test.ts
git commit -m "$(cat <<'EOF'
Play a Complex cycle group by interval or by round.

EOF
)"
```

Do not stage `src/tokens.css`, `src/tokens.test.ts`, `src/Edit.tsx`, `src/app.css`, or `.vite/`.

---

### Task 2: Choose the cycle group

**Files:**
- Modify: `src/Edit.tsx`
- Modify: `src/Edit.test.tsx`
- Modify: `src/Practice.tsx`
- Modify: `src/Practice.test.tsx`
- Modify: `src/app.css`

**Interfaces:**
- Consumes: `freshComplex`, `cycleGroupFromSimple`, `freshSimple`, `cyclesFromSimple`, `Session.complex`.
- Produces: the Increase every control on both types, Repeat the round outside the cycle group, and Complex BPM edits that use the playback step.

- [ ] **Step 1: Write the failing editor tests**

Replace the expectations in "builds complex cycles from the simple pattern". The session in that test has 3 practices and Times 2. After clicking Complex:

```ts
expect(next.type).toBe("complex")
expect(next.cycles).toHaveLength(6)
expect(next.cycles.every((cycle: { bpm?: number; restSec: number }) => cycle.bpm === undefined && cycle.restSec === 30)).toBe(true)
expect(next.complex).toEqual({
  increaseEvery: "interval",
  repeatRound: false,
  rounds: 2,
  restBetweenSec: 30,
})
expect(screen.queryByRole("textbox", { name: "Every" })).not.toBeInTheDocument()
```

Set `session.simple.restAfterSec = 30` before render so the rest expectation does not depend on a later edit. The default is already 30.

Replace "chooses a round increase and hides that choice on complex" with:

```ts
it("chooses a round increase for simple and for complex", async () => {
  const user = userEvent.setup()
  const onChange = vi.fn()
  const { rerender } = render(<Edit session={createDefaultSession(() => "cycle-1")} onChange={onChange} onDone={() => {}} />)
  expect(screen.getByRole("group", { name: "Increase every" })).toBeInTheDocument()
  expect(screen.getByRole("button", { name: "Interval" })).toHaveAttribute("aria-pressed", "true")
  expect(screen.queryByRole("textbox", { name: "Every" })).not.toBeInTheDocument()
  await user.click(screen.getByRole("button", { name: "Round" }))
  const simpleRound = onChange.mock.calls.at(-1)?.[0]
  expect(simpleRound.simple.increaseEvery).toBe("round")
  rerender(<Edit session={simpleRound} onChange={onChange} onDone={() => {}} />)
  await user.click(screen.getByRole("button", { name: "Complex" }))
  const complex = onChange.mock.calls.at(-1)?.[0]
  expect(complex.complex.increaseEvery).toBe("round")
  rerender(<Edit session={complex} onChange={onChange} onDone={() => {}} />)
  expect(screen.getByRole("group", { name: "Increase every" })).toBeInTheDocument()
  expect(screen.getByRole("button", { name: "Round" })).toHaveAttribute("aria-pressed", "true")
  expect(screen.queryByRole("textbox", { name: "Every" })).not.toBeInTheDocument()
  expect(screen.queryByText("Interval", { selector: ".card-title" })).not.toBeInTheDocument()
  expect(screen.queryByRole("textbox", { name: "Rounds" })).not.toBeInTheDocument()
  await user.click(screen.getByRole("button", { name: "Repeat the round" }))
  const repeated = onChange.mock.calls.at(-1)?.[0]
  expect(repeated.complex.repeatRound).toBe(true)
  rerender(<Edit session={repeated} onChange={onChange} onDone={() => {}} />)
  expect(screen.getByRole("textbox", { name: "Rounds" })).toHaveValue("2")
  expect(screen.getByRole("textbox", { name: "Between" })).toHaveValue("0:30")
})
```

In "adds, moves, and refuses to remove the last cycle", delete the line that expects a textbox named Every.

Add:

```ts
it("drops the complex pattern when simple is saved", async () => {
  const user = userEvent.setup()
  const onChange = vi.fn()
  const onDone = vi.fn()
  const session = createDefaultSession(() => "cycle-1")
  session.complex.repeatRound = true
  render(<Edit session={session} onChange={onChange} onDone={onDone} />)
  await user.click(screen.getByRole("button", { name: "Done" }))
  const saved = onChange.mock.calls.at(-1)?.[0]
  expect(saved.type).toBe("simple")
  expect(saved.complex).toEqual(freshComplex())
  expect(onDone).toHaveBeenCalledOnce()
})
```

Import `freshComplex` from `./session`.

- [ ] **Step 2: Run the editor tests to verify they fail**

Run: `npx vitest run src/Edit.test.tsx`

Expected: FAIL. Complex still shows Every, and the cycle group is not built from Times.

- [ ] **Step 3: Share the increase card and add Repeat the round**

In `src/Edit.tsx`, import `cycleGroupFromSimple` and `freshComplex`.

`done()` becomes:

```ts
function done() {
  if (session.type === "complex") {
    commit({ ...session, simple: freshSimple() })
  } else {
    commit({
      ...session,
      cycles: cyclesFromSimple(session, () => crypto.randomUUID()),
      complex: freshComplex(),
    })
  }
  props.onDone()
}
```

In `choose`, the simple-opened Complex branch becomes:

```ts
if (type === "complex") {
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
```

Replace the increase card with one card for both types:

```tsx
<section className="editor-card increase-card">
  <DraftField label="BPM increase" value={String(session.bpmIncrease)} onCommit={(text) => commit({ ...session, bpmIncrease: Number(text) })} />
  <div className="type-switch" role="group" aria-label="Increase every">
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
  </div>
</section>
```

Replace the Complex `cycle-list` section with:

```tsx
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
```

Do not add a title to that sub-card. Leave the Simple sub-card title Interval as it is.

In `src/app.css`, change `.cycle-list` so it no longer adds page margin:

```css
.cycle-list { display: flex; flex-direction: column; gap: 8px; margin: 0; padding: 0; }
```

- [ ] **Step 4: Run the editor tests**

Run: `npx vitest run src/Edit.test.tsx`

Expected: PASS

- [ ] **Step 5: Write the failing practice test and update the old ladder test**

In `src/Practice.test.tsx`, "writes the session tempo so a later practice lands on the typed BPM" types 100 on cycle index 3 with increase 5. The session comes from `createDefaultSession`, so `complex.increaseEvery` is `"interval"`. Change the expectation from `100 - 5 * Math.floor(3 / 2)` to `85`. Delete `session.every = 2`.

Add:

```ts
it("writes a complex between rest onto the round", async () => {
  const session = createDefaultSession(() => "cycle-1")
  session.type = "complex"
  session.complex.repeatRound = true
  session.complex.rounds = 2
  session.complex.restBetweenSec = 30
  session.cycles = [0, 1].map((index) => ({
    id: `cycle-${index}`,
    length: { unit: "time" as const, seconds: 30 },
    restSec: 5,
  }))
  const segments = expandSession(session)
  const restIndex = segments.findIndex((segment) => segment.restRole === "between")
  const elapsed = segments.slice(0, restIndex).reduce((sum, segment) => sum + segment.durationSec, 0)
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
  const next = onChange.mock.calls.at(-1)?.[0]
  expect(next.complex.restBetweenSec).toBe(60)
  expect(next.cycles.map((cycle: { restSec: number }) => cycle.restSec)).toEqual([5, 5])
})
```

- [ ] **Step 6: Run the practice tests to verify the new one fails**

Run: `npx vitest run src/Practice.test.tsx`

Expected: FAIL on the Between test, because a Complex rest edit still writes the cycle rest. The updated BPM test also fails until Step 7, because cycle 3 now steps by 3 instead of `floor(3 / 2)`.

- [ ] **Step 7: Edit the session tempo and Between from the practice page**

In `src/Practice.tsx`, `commitTime`, insert this block immediately after `const session = props.session` and delete both later `session.type === "complex"` branches in that function. A between rest writes `complex.restBetweenSec`. Any other complex rest or length uses `target.cycleIndex % session.cycles.length`:

```ts
if (session.type === "complex") {
  if (target.kind === "rest" && target.restRole === "between") {
    props.onChange(clampSession({
      ...session,
      complex: { ...session.complex, restBetweenSec: Math.max(0, parseDuration(typed)) },
    }))
    return
  }
  const cycleIndex = target.cycleIndex % session.cycles.length
  if (target.kind === "rest") {
    props.onChange(clampSession({
      ...session,
      cycles: session.cycles.map((cycle, index) => index === cycleIndex ? { ...cycle, restSec: Math.max(0, parseDuration(typed)) } : cycle),
    }))
    return
  }
  const length = { unit: "time" as const, seconds }
  props.onChange(clampSession({
    ...session,
    cycles: session.cycles.map((cycle, index) => index === cycleIndex ? { ...cycle, length } : cycle),
  }))
  return
}
```

Remove the old complex branches below that block so a complex session does not fall through into the Simple length write. Keep the Simple rest and length writes as they are.

In `commitBpm`, after the own-tempo branch, handle Complex before the old `every` line:

```ts
const cycleIndex = target.cycleIndex % Math.max(1, session.cycles.length)
const cycle = session.cycles[cycleIndex]
if (session.type === "complex" && cycle?.bpm !== undefined) {
  props.onChange(clampSession({
    ...session,
    cycles: session.cycles.map((item, index) => index === cycleIndex ? { ...item, bpm: Number(typed) } : item),
  }))
  return
}
if (session.type === "complex") {
  const count = Math.max(1, session.cycles.length)
  const round = Math.floor(target.cycleIndex / count)
  const index = target.cycleIndex % count
  const step = session.complex.increaseEvery === "round" ? round : index
  const bpm = Number(typed) - session.bpmIncrease * Math.max(0, step)
  props.onChange(clampSession({ ...session, bpm }))
  return
}
```

Leave the Simple calculation that follows unchanged.

- [ ] **Step 8: Run the suite**

Run: `npm test`

Expected: PASS. The `Unknown env config "devdir"` warning is environment noise.

- [ ] **Step 9: Commit**

```bash
git add src/Edit.tsx src/Edit.test.tsx src/Practice.tsx src/Practice.test.tsx src/app.css
git commit -m "$(cat <<'EOF'
Choose whether Complex raises the BPM each cycle or each round.

EOF
)"
```

Do not stage `src/tokens.css`, `src/tokens.test.ts`, or `.vite/`.
