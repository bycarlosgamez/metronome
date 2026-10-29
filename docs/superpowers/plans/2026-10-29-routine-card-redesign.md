# Routine Card Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the 3-field routine card with a 3-level (Round / Set / Block) hierarchical structure with stepper buttons and progressive disclosure.

**Architecture:** New `RoutinePattern` type with `RepeatLevel` sub-type replaces old flat fields. `expandSession.ts` routine resolver rewrites into three nested loops. `Practice.tsx` routine card replaces inline number inputs with +/− steppers and conditional sections. `BpmSheet.tsx` loses its routine-specific block since routine config now lives entirely in the Practice card.

**Tech Stack:** React 19, TypeScript, plain CSS, Vitest 3 + Testing Library

---

## File Map

- **Modify:** `src/types.ts` — replace `RoutinePattern`; add `RepeatLevel`
- **Modify:** `src/session.ts` — update `freshRoutine`, `clampRoutine`, `createDefaultSession`, `clampSession` (time migration block), `migrateLegacy`
- **Modify:** `src/expandSession.ts` — rewrite routine resolver in `resolved()`
- **Modify:** `src/Practice.tsx` — replace routine-timer block JSX + refs/state; update progress labels
- **Modify:** `src/app.css` — replace `.routine-timer`/`.routine-field` rules with new card rules
- **Modify:** `src/BpmSheet.tsx` — remove `{routineEnabled && ...}` block; remove `derivedTarget` line
- **Test:** `src/session.test.ts` — update routine tests
- **Test:** `src/expandSession.test.ts` — replace routine describe block
- **Test:** `src/Practice.test.tsx` — replace routine card tests

---

### Task 1: Update types and session — new data model

**Files:**
- Modify: `src/types.ts`
- Modify: `src/session.ts`
- Modify: `src/session.test.ts`

- [ ] **Step 1: Write failing tests in `src/session.test.ts`**

Find the existing `describe("routine", ...)` block inside `describe("session", ...)`. Replace the tests that check `routine.numLevels`, `routine.barsPerLevel`, `routine.repeatCount` (lines ~63–76) with the tests below. Also update the "builds the first-visit session" test — it asserts `routine: freshRoutine()` which is still correct but will fail until the new `freshRoutine()` is in place.

Add/replace in `src/session.test.ts` (after the existing freshRoutine/freshSimple assertions, around line 38–41):

```ts
it("freshRoutine returns the new 3-level shape", () => {
  expect(freshRoutine()).toEqual({
    unit: "bars",
    playDuration: 4,
    restDuration: 0,
    round:  { enabled: false, count: 4, restDuration: 0 },
    set:    { enabled: false, count: 3, restDuration: 30 },
    block:  { enabled: false, count: 2, restDuration: 60 },
    bpmIncreaseAt: "off",
  })
})
```

Replace the "migrates a saved time session to simple with routineEnabled" test (lines ~63–76) with:

```ts
it("migrates a saved time session to simple with routineEnabled", () => {
  const session = createDefaultSession(() => "cycle-1")
  session.type = "time" as Session["type"]
  session.bpm = 80
  session.bpmIncrease = 10
  session.time = { seconds: 120, targetBpm: 100, increaseEvery: "bars", everySec: 30, everyBars: 4 }
  const clamped = clampSession(session)
  expect(clamped.type).toBe("simple")
  expect(clamped.routineEnabled).toBe(true)
  // numLevels = ceil((100 - 80) / 10) + 1 = 3 → round.count
  expect(clamped.routine.round.enabled).toBe(true)
  expect(clamped.routine.round.count).toBe(3)
  expect(clamped.routine.playDuration).toBe(4)  // everyBars
  expect(clamped.routine.bpmIncreaseAt).toBe("round")
})
```

Add a test for old-shape routine migration after that test:

```ts
it("clampSession falls back to freshRoutine defaults when routine has old shape", () => {
  const session = createDefaultSession(() => "s1")
  session.routineEnabled = true
  // Old shape — TypeScript cast needed since type changed
  ;(session as any).routine = { barsPerLevel: 8, numLevels: 4, repeatCount: 3, restAfterSec: 10, loop: false }
  const clamped = clampSession(session)
  expect(clamped.routine.unit).toBe("bars")
  expect(clamped.routine.playDuration).toBe(4)  // freshRoutine default
  expect(clamped.routine.round.enabled).toBe(false)
})

it("clampSession enforces minimums on RepeatLevel fields", () => {
  const session = createDefaultSession(() => "s1")
  session.routineEnabled = true
  session.routine = {
    unit: "sec",
    playDuration: 0,
    restDuration: -1,
    round:  { enabled: true,  count: 1,  restDuration: -5 },
    set:    { enabled: true,  count: 0,  restDuration: 0  },
    block:  { enabled: false, count: 2,  restDuration: 60 },
    bpmIncreaseAt: "round",
  }
  const r = clampSession(session).routine
  expect(r.playDuration).toBe(1)
  expect(r.restDuration).toBe(0)
  expect(r.round.count).toBe(2)
  expect(r.round.restDuration).toBe(0)
  expect(r.set.count).toBe(2)
})
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npm run test -- src/session.test.ts
```

Expected: several FAILs referencing missing `round`, `set`, `block`, `unit`, `playDuration` fields.

- [ ] **Step 3: Update `src/types.ts` — replace RoutinePattern**

Replace lines 57–63:

```ts
export type RepeatLevel = {
  enabled: boolean
  count: number        // number of repetitions (min 2)
  restDuration: number // rest before next repetition, always seconds
}

export type RoutinePattern = {
  unit: "bars" | "sec"   // applies to playDuration and restDuration only
  playDuration: number   // one round's play duration (in unit)
  restDuration: number   // one round's rest duration (in unit)
  round: RepeatLevel     // repeat the round (play + rest)
  set: RepeatLevel       // repeat the full round sequence
  block: RepeatLevel     // repeat the full set
  bpmIncreaseAt: "off" | "round" | "set" | "block"
}
```

- [ ] **Step 4: Update `src/session.ts` — new freshRoutine, clampRoutine**

Replace `freshRoutine` and `clampRoutine` (lines ~46–65):

```ts
export function freshRoutine(): RoutinePattern {
  return {
    unit: "bars",
    playDuration: 4,
    restDuration: 0,
    round:  { enabled: false, count: 4, restDuration: 0 },
    set:    { enabled: false, count: 3, restDuration: 30 },
    block:  { enabled: false, count: 2, restDuration: 60 },
    bpmIncreaseAt: "off",
  }
}

function clampRepeatLevel(level: unknown, defaults: RepeatLevel): RepeatLevel {
  const base = (level && typeof level === "object" ? level : {}) as Partial<RepeatLevel>
  return {
    enabled: Boolean(base.enabled),
    count: Math.max(2, integer(base.count ?? defaults.count)),
    restDuration: Math.max(0, integer(base.restDuration ?? defaults.restDuration)),
  }
}

function clampRoutine(pattern: unknown): RoutinePattern {
  const fresh = freshRoutine()
  const base = (pattern && typeof pattern === "object" ? pattern : {}) as Partial<RoutinePattern>
  const BPM_AT = ["off", "round", "set", "block"] as const
  return {
    unit: base.unit === "sec" ? "sec" : "bars",
    playDuration: Math.max(1, integer(base.playDuration ?? fresh.playDuration)),
    restDuration: Math.max(0, integer(base.restDuration ?? fresh.restDuration)),
    round:  clampRepeatLevel(base.round,  fresh.round),
    set:    clampRepeatLevel(base.set,    fresh.set),
    block:  clampRepeatLevel(base.block,  fresh.block),
    bpmIncreaseAt: BPM_AT.includes(base.bpmIncreaseAt as typeof BPM_AT[number])
      ? base.bpmIncreaseAt as RoutinePattern["bpmIncreaseAt"]
      : "off",
  }
}
```

Also update the import at top of `session.ts` — add `RepeatLevel` to the imported types from `"./types"`:

```ts
import { ..., type RepeatLevel, type RoutinePattern, ... } from "./types"
```

- [ ] **Step 5: Update the time-session migration block in `clampSession`**

Find the `if (session.type === "time")` block (lines ~255–272) and replace:

```ts
if (session.type === "time") {
  type = "simple"
  routineEnabled = true
  const everyBars = Math.max(1, integer(session.time?.everyBars ?? 4))
  const startBpm = clampBpm(session.bpm)
  const targetBpm = clampBpm(session.time?.targetBpm ?? 120)
  const step = Math.max(0, integer(session.bpmIncrease))
  const numLevels = step > 0 && targetBpm > startBpm
    ? Math.max(1, Math.ceil((targetBpm - startBpm) / step) + 1)
    : 1
  routine = clampRoutine({
    unit: "bars",
    playDuration: everyBars,
    restDuration: 0,
    round: { enabled: numLevels > 1, count: Math.max(2, numLevels), restDuration: 0 },
    set:   freshRoutine().set,
    block: freshRoutine().block,
    bpmIncreaseAt: numLevels > 1 ? "round" : "off",
  })
}
```

Also change the `routine` assignment above that block (line ~253):

```ts
// Before:
let routine = clampRoutine(session.routine)
// After:
let routine = clampRoutine(session.routine as unknown)
```

- [ ] **Step 6: Run tests to confirm they pass**

```bash
npm run test -- src/session.test.ts
```

Expected: all tests pass.

- [ ] **Step 7: Run full suite**

```bash
npm run test
```

Expected: session.test.ts passes; expandSession/Practice tests may fail due to type errors — those are fixed in later tasks. TypeScript errors in other files are fine for now (handled in next tasks).

- [ ] **Step 8: Commit**

```bash
git add src/types.ts src/session.ts src/session.test.ts
git commit -m "feat: replace RoutinePattern with 3-level Round/Set/Block data model"
```

---

### Task 2: Rewrite the expandSession routine resolver

**Files:**
- Modify: `src/expandSession.ts`
- Modify: `src/expandSession.test.ts`

- [ ] **Step 1: Write failing tests in `src/expandSession.test.ts`**

Find the existing `describe("routine", ...)` block (lines ~323–381). Replace its content entirely:

```ts
describe("routine", () => {
  function makeRoutineSession() {
    const session = createDefaultSession()
    session.routineEnabled = true
    session.bpm = 80
    session.bpmIncrease = 5
    session.meter = "4/4"
    session.routine = {
      unit: "bars",
      playDuration: 4,
      restDuration: 0,
      round:  { enabled: false, count: 4, restDuration: 0 },
      set:    { enabled: false, count: 3, restDuration: 30 },
      block:  { enabled: false, count: 2, restDuration: 60 },
      bpmIncreaseAt: "off",
    }
    return session
  }

  it("produces a single play segment when no repeats are enabled", () => {
    const session = makeRoutineSession()
    const segments = expandSession(session)
    expect(segments.map((s) => s.kind)).toEqual(["play"])
    expect(segments[0].bpm).toBe(80)
    // 4 bars × 4 beats × 60 / 80 = 12s
    expect(segments[0].durationSec).toBe(12)
  })

  it("produces count-in only on first segment", () => {
    const session = makeRoutineSession()
    session.countIn = true
    const segments = expandSession(session)
    expect(segments[0].kind).toBe("count-in")
    expect(segments[1].kind).toBe("play")
    expect(segments.filter((s) => s.kind === "count-in")).toHaveLength(1)
  })

  it("round repeat: repeats play with rest between, no trailing rest", () => {
    const session = makeRoutineSession()
    session.routine = { ...session.routine, restDuration: 2, round: { enabled: true, count: 3, restDuration: 0 } }
    const segments = expandSession(session)
    // play rest play rest play (no trailing rest)
    expect(segments.map((s) => s.kind)).toEqual(["play", "rest", "play", "rest", "play"])
    const plays = segments.filter((s) => s.kind === "play")
    expect(plays).toHaveLength(3)
    // restDuration is in bars: 2 bars × 4 beats × 60 / 80 = 6s
    expect(segments[1].durationSec).toBe(6)
  })

  it("round repeat with sec unit", () => {
    const session = makeRoutineSession()
    session.routine = {
      ...session.routine,
      unit: "sec",
      playDuration: 30,
      restDuration: 10,
      round: { enabled: true, count: 2, restDuration: 0 },
    }
    const segments = expandSession(session)
    expect(segments.map((s) => s.kind)).toEqual(["play", "rest", "play"])
    expect(segments[0].durationSec).toBe(30)
    expect(segments[1].durationSec).toBe(10)
  })

  it("set repeat: rest between sets uses set.restDuration (seconds)", () => {
    const session = makeRoutineSession()
    session.routine = {
      ...session.routine,
      restDuration: 0,
      round: { enabled: true, count: 2, restDuration: 0 },
      set:   { enabled: true, count: 2, restDuration: 30 },
    }
    const segments = expandSession(session)
    const plays = segments.filter((s) => s.kind === "play")
    const rests = segments.filter((s) => s.kind === "rest")
    expect(plays).toHaveLength(4)  // 2 rounds × 2 sets
    // Between the two sets there should be a rest of set.restDuration (30s)
    // The last play of set 1 should be followed by a 30s rest
    expect(rests.some((r) => r.durationSec === 30)).toBe(true)
    // Last segment is play (no trailing rest)
    expect(segments.at(-1)?.kind).toBe("play")
  })

  it("block repeat: rest between blocks uses block.restDuration (seconds)", () => {
    const session = makeRoutineSession()
    session.routine = {
      ...session.routine,
      restDuration: 0,
      round: { enabled: true, count: 2, restDuration: 0 },
      set:   { enabled: true, count: 2, restDuration: 10 },
      block: { enabled: true, count: 2, restDuration: 60 },
    }
    const segments = expandSession(session)
    const plays = segments.filter((s) => s.kind === "play")
    expect(plays).toHaveLength(8)  // 2 rounds × 2 sets × 2 blocks
    // There should be a rest of 60s (block rest)
    expect(segments.some((s) => s.kind === "rest" && s.durationSec === 60)).toBe(true)
    expect(segments.at(-1)?.kind).toBe("play")
  })

  it("BPM increases at round boundary", () => {
    const session = makeRoutineSession()
    session.bpm = 80
    session.bpmIncrease = 5
    session.routine = {
      ...session.routine,
      round: { enabled: true, count: 3, restDuration: 0 },
      bpmIncreaseAt: "round",
    }
    const plays = expandSession(session).filter((s) => s.kind === "play")
    expect(plays.map((s) => s.bpm)).toEqual([80, 85, 90])
  })

  it("BPM increases at set boundary", () => {
    const session = makeRoutineSession()
    session.bpm = 80
    session.bpmIncrease = 10
    session.routine = {
      ...session.routine,
      round: { enabled: true, count: 2, restDuration: 0 },
      set:   { enabled: true, count: 3, restDuration: 0 },
      bpmIncreaseAt: "set",
    }
    const plays = expandSession(session).filter((s) => s.kind === "play")
    // Set 1: [80, 80], Set 2: [90, 90], Set 3: [100, 100]
    expect(plays.map((s) => s.bpm)).toEqual([80, 80, 90, 90, 100, 100])
  })

  it("caps BPM at 300", () => {
    const session = makeRoutineSession()
    session.bpm = 290
    session.bpmIncrease = 20
    session.routine = {
      ...session.routine,
      round: { enabled: true, count: 3, restDuration: 0 },
      bpmIncreaseAt: "round",
    }
    const plays = expandSession(session).filter((s) => s.kind === "play")
    expect(plays.map((s) => s.bpm)).toEqual([290, 300, 300])
  })

  it("setIndex increments across all segments for progress tracking", () => {
    const session = makeRoutineSession()
    session.routine = {
      ...session.routine,
      round: { enabled: true, count: 2, restDuration: 0 },
    }
    const plays = expandSession(session).filter((s) => s.kind === "play")
    expect(plays[0].setIndex).toBe(0)
    expect(plays[1].setIndex).toBe(1)
  })
})
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npm run test -- src/expandSession.test.ts
```

Expected: FAIL — the new routine tests reference fields/behaviors that don't exist yet.

- [ ] **Step 3: Rewrite the routine resolver in `src/expandSession.ts`**

Find the `if (session.routineEnabled)` block in `resolved()` (lines ~33–52). Replace it:

```ts
if (session.routineEnabled) {
  const { unit, playDuration, restDuration, round, set, block, bpmIncreaseAt } = session.routine
  const items: Resolved[] = []
  const blockPasses = block.enabled ? block.count : 1
  const setPasses   = set.enabled   ? set.count   : 1
  const roundPasses = round.enabled ? round.count  : 1
  let crossings = 0

  for (let b = 0; b < blockPasses; b++) {
    const isLastBlock = b === blockPasses - 1
    for (let s = 0; s < setPasses; s++) {
      const isLastSet = s === setPasses - 1
      for (let r = 0; r < roundPasses; r++) {
        const isLastRound = r === roundPasses - 1
        const isLast = isLastRound && isLastSet && isLastBlock
        const bpm = clampBpm(session.bpm + crossings * session.bpmIncrease)
        const durationSec = unit === "bars"
          ? playDuration * beatsInMeter(session.meter) * 60 / bpm
          : playDuration
        const roundRestSec = unit === "bars"
          ? restDuration * beatsInMeter(session.meter) * 60 / bpm
          : restDuration

        let restSec = 0
        let restRole: "after" | "between" | undefined
        if (!isLast) {
          if (!isLastRound) {
            restSec = roundRestSec
            restRole = "after"
          } else if (!isLastSet) {
            restSec = roundRestSec + set.restDuration
            restRole = "between"
          } else {
            restSec = roundRestSec + block.restDuration
            restRole = "between"
          }
        }

        items.push({
          id: `routine-${b}-${s}-${r}`,
          bpm,
          durationSec,
          restSec,
          restRole,
          steps: [{ atSec: 0, bpm }],
        })

        if (bpmIncreaseAt === "round") crossings++
      }
      if (bpmIncreaseAt === "set") crossings++
    }
    if (bpmIncreaseAt === "block") crossings++
  }
  return items
}
```

- [ ] **Step 4: Run tests**

```bash
npm run test -- src/expandSession.test.ts
```

Expected: all tests pass.

- [ ] **Step 5: Run full suite**

```bash
npm run test
```

Expected: expandSession tests pass; Practice tests may fail — addressed in Task 3.

- [ ] **Step 6: Commit**

```bash
git add src/expandSession.ts src/expandSession.test.ts
git commit -m "feat: rewrite routine resolver with Round/Set/Block three-level expansion"
```

---

### Task 3: New routine card in Practice.tsx

**Files:**
- Modify: `src/Practice.tsx`
- Modify: `src/Practice.test.tsx`

- [ ] **Step 1: Write failing tests in `src/Practice.test.tsx`**

Find the routine describe block (starting at the "routine timer block is hidden in Simple mode" test, around line 242). Replace ALL routine tests with:

```ts
it("routine card is hidden in Simple mode", () => {
  render(<Practice {...makeProps()} />)
  expect(document.querySelector(".routine-card")).not.toBeInTheDocument()
})

it("routine card shows when routineEnabled is true", () => {
  render(<Practice {...makeProps({ routineEnabled: true })} />)
  expect(document.querySelector(".routine-card")).toBeInTheDocument()
})

it("routine card shows Play and Rest steppers with default values", () => {
  render(<Practice {...makeProps({ routineEnabled: true })} />)
  expect(screen.getByRole("button", { name: "Increase play duration" })).toBeInTheDocument()
  expect(screen.getByRole("button", { name: "Decrease play duration" })).toBeInTheDocument()
  expect(screen.getByRole("button", { name: "Increase rest duration" })).toBeInTheDocument()
})

it("clicking Increase play duration calls onChange with incremented value", async () => {
  const props = makeProps({ routineEnabled: true })
  const user = userEvent.setup()
  render(<Practice {...props} />)
  await user.click(screen.getByRole("button", { name: "Increase play duration" }))
  expect(props.onChange).toHaveBeenCalledWith(
    expect.objectContaining({ routine: expect.objectContaining({ playDuration: 5 }) })
  )
})

it("Set section is hidden when round.enabled is false", () => {
  render(<Practice {...makeProps({ routineEnabled: true })} />)
  expect(screen.queryByText("Set")).not.toBeInTheDocument()
})

it("Set section appears when round.enabled is true", () => {
  const props = makeProps({
    routineEnabled: true,
    routine: { ...createDefaultSession().routine, round: { enabled: true, count: 4, restDuration: 0 } },
  })
  render(<Practice {...props} />)
  expect(screen.getByText("Set")).toBeInTheDocument()
  expect(screen.getByRole("button", { name: "Increase set rest" })).toBeInTheDocument()
})

it("Block section is hidden when set.enabled is false", () => {
  const props = makeProps({
    routineEnabled: true,
    routine: { ...createDefaultSession().routine, round: { enabled: true, count: 4, restDuration: 0 } },
  })
  render(<Practice {...props} />)
  expect(screen.queryByText("Block")).not.toBeInTheDocument()
})

it("Block section appears when set.enabled is true", () => {
  const props = makeProps({
    routineEnabled: true,
    routine: {
      ...createDefaultSession().routine,
      round: { enabled: true, count: 4, restDuration: 0 },
      set:   { enabled: true, count: 3, restDuration: 30 },
    },
  })
  render(<Practice {...props} />)
  expect(screen.getByText("Block")).toBeInTheDocument()
})

it("toggling Round repeat off clears set and block enabled", async () => {
  const props = makeProps({
    routineEnabled: true,
    routine: {
      ...createDefaultSession().routine,
      round: { enabled: true, count: 4, restDuration: 0 },
      set:   { enabled: true, count: 3, restDuration: 30 },
      block: { enabled: true, count: 2, restDuration: 60 },
    },
  })
  const user = userEvent.setup()
  render(<Practice {...props} />)
  await user.click(screen.getByRole("button", { name: "Toggle round repeat" }))
  expect(props.onChange).toHaveBeenCalledWith(
    expect.objectContaining({
      routine: expect.objectContaining({
        round: expect.objectContaining({ enabled: false }),
        set:   expect.objectContaining({ enabled: false }),
        block: expect.objectContaining({ enabled: false }),
      }),
    })
  )
})

it("BPM row is hidden when bpmIncrease is 0", () => {
  render(<Practice {...makeProps({ routineEnabled: true, bpmIncrease: 0 })} />)
  expect(screen.queryByText(/BPM \+/)).not.toBeInTheDocument()
})

it("BPM row shows when bpmIncrease > 0", () => {
  render(<Practice {...makeProps({ routineEnabled: true, bpmIncrease: 5 })} />)
  expect(screen.getByText(/BPM \+5 every/)).toBeInTheDocument()
})

it("progress shows Round label with count", () => {
  const props = makeProps({ routineEnabled: true })
  render(<Practice {...props} />)
  expect(screen.getByText(/Round 1\//)).toBeInTheDocument()
})
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npm run test -- src/Practice.test.tsx
```

Expected: FAILs — `.routine-card` doesn't exist yet, new aria-labels not present.

- [ ] **Step 3: Remove old routine ref/state from `src/Practice.tsx`**

Find and remove these lines (~60–68):

```ts
// DELETE these lines:
const barsRef = useRef<string | null>(null)
const levelsRef = useRef<string | null>(null)
const repeatRef = useRef<string | null>(null)
const restRef = useRef<string | null>(null)
const [barsText, setBarsText] = useState<string | null>(null)
const [levelsText, setLevelsText] = useState<string | null>(null)
const [repeatText, setRepeatText] = useState<string | null>(null)
const [restText, setRestText] = useState<string | null>(null)
```

- [ ] **Step 4: Update routine state derivations in `src/Practice.tsx`**

Find lines ~88–95:

```ts
// DELETE/REPLACE this block:
const { routineEnabled, routine } = props.session
const { numLevels, repeatCount } = routine
const setIdx = segment.setIndex
const cycleN = Math.floor(setIdx / numLevels) + 1
const levelN = (setIdx % numLevels) + 1
```

Replace with:

```ts
const { routineEnabled, routine } = props.session
const { round, set, block } = routine
const roundPasses = round.enabled ? round.count : 1
const setPasses   = set.enabled   ? set.count   : 1
const blockPasses = block.enabled ? block.count  : 1
const setIdx  = segment.setIndex
const roundN  = (setIdx % roundPasses) + 1
const setN    = (Math.floor(setIdx / roundPasses) % setPasses) + 1
const blockN  = Math.floor(setIdx / (roundPasses * setPasses)) + 1
```

- [ ] **Step 5: Remove `commitRoutine` from `src/Practice.tsx`**

Find and delete the `commitRoutine` function (lines ~105–107):

```ts
// DELETE:
function commitRoutine(partial: Partial<Session["routine"]>) {
  props.onChange(clampSession({ ...props.session, routine: { ...routine, ...partial } }))
}
```

- [ ] **Step 6: Replace the routine-timer block JSX in `src/Practice.tsx`**

Find the `{/* Routine timer block */}` block (lines ~259–348). Replace it entirely:

```tsx
{/* Routine card */}
{routineEnabled && (
  <div className="routine-card">
    {/* Progress */}
    <div className="routine-progress-row">
      <div className="routine-elapsed" data-testid="routine-elapsed">
        {isPlaying ? formatClock(elapsedSec) : "0:00"}
      </div>
      <div className="routine-cycle-info">
        <div>Round {roundN}/{roundPasses}</div>
        {round.enabled && <div>Set {setN}/{setPasses}</div>}
        {set.enabled && <div>Block {blockN}/{blockPasses}</div>}
      </div>
    </div>
    <div className="routine-progress-bar-wrap">
      <div className="routine-progress-bar-fill" style={{ width: `${Math.round(levelProgress * 100)}%` }} />
    </div>

    {/* Unit toggle */}
    <div className="routine-unit-row">
      <span className="routine-unit-label">Duration in</span>
      <div className="routine-seg">
        {(["bars", "sec"] as const).map((u) => (
          <button key={u} type="button" className="routine-seg-btn" aria-pressed={routine.unit === u}
            onClick={() => props.onChange(clampSession({ ...props.session, routine: { ...routine, unit: u } }))}>
            {u}
          </button>
        ))}
      </div>
    </div>

    {/* Round section */}
    <div className="routine-section">
      <div className="routine-section-title">Round</div>
      <div className="routine-row">
        <span className="routine-row-label">Play</span>
        <div className="routine-stepper">
          <button type="button" aria-label="Decrease play duration"
            onClick={() => props.onChange(clampSession({ ...props.session, routine: { ...routine, playDuration: Math.max(1, routine.playDuration - 1) } }))}>−</button>
          <span className="routine-stepper-val">{routine.playDuration}</span>
          <button type="button" aria-label="Increase play duration"
            onClick={() => props.onChange(clampSession({ ...props.session, routine: { ...routine, playDuration: routine.playDuration + 1 } }))}>+</button>
        </div>
      </div>
      <div className="routine-row">
        <span className="routine-row-label">Rest</span>
        <div className="routine-stepper">
          <button type="button" aria-label="Decrease rest duration"
            onClick={() => props.onChange(clampSession({ ...props.session, routine: { ...routine, restDuration: Math.max(0, routine.restDuration - 1) } }))}>−</button>
          <span className="routine-stepper-val">{routine.restDuration}</span>
          <button type="button" aria-label="Increase rest duration"
            onClick={() => props.onChange(clampSession({ ...props.session, routine: { ...routine, restDuration: routine.restDuration + 1 } }))}>+</button>
        </div>
      </div>
      <div className="routine-row">
        <span className="routine-row-label">Repeat</span>
        <div className="routine-row-controls">
          <button type="button" className="routine-toggle-btn" aria-label="Toggle round repeat" aria-pressed={round.enabled}
            onClick={() => {
              const nextRound = { ...round, enabled: !round.enabled }
              const nextSet   = round.enabled ? { ...set,   enabled: false } : set
              const nextBlock = round.enabled ? { ...block, enabled: false } : block
              props.onChange(clampSession({ ...props.session, routine: { ...routine, round: nextRound, set: nextSet, block: nextBlock } }))
            }}>
            {round.enabled ? "On" : "Off"}
          </button>
          {round.enabled && (
            <div className="routine-stepper">
              <button type="button" aria-label="Decrease round count"
                onClick={() => props.onChange(clampSession({ ...props.session, routine: { ...routine, round: { ...round, count: Math.max(2, round.count - 1) } } }))}>−</button>
              <span className="routine-stepper-val">{round.count}</span>
              <button type="button" aria-label="Increase round count"
                onClick={() => props.onChange(clampSession({ ...props.session, routine: { ...routine, round: { ...round, count: round.count + 1 } } }))}>+</button>
            </div>
          )}
        </div>
      </div>
    </div>

    {/* Set section — visible when round.enabled */}
    {round.enabled && (
      <div className="routine-section routine-section--set">
        <div className="routine-section-title">Set</div>
        <div className="routine-row">
          <span className="routine-row-label">Rest between</span>
          <div className="routine-stepper">
            <button type="button" aria-label="Decrease set rest"
              onClick={() => props.onChange(clampSession({ ...props.session, routine: { ...routine, set: { ...set, restDuration: Math.max(0, set.restDuration - 5) } } }))}>−</button>
            <span className="routine-stepper-val">{set.restDuration}s</span>
            <button type="button" aria-label="Increase set rest"
              onClick={() => props.onChange(clampSession({ ...props.session, routine: { ...routine, set: { ...set, restDuration: set.restDuration + 5 } } }))}>+</button>
          </div>
        </div>
        <div className="routine-row">
          <span className="routine-row-label">Repeat</span>
          <div className="routine-row-controls">
            <button type="button" className="routine-toggle-btn" aria-label="Toggle set repeat" aria-pressed={set.enabled}
              onClick={() => {
                const nextSet   = { ...set,   enabled: !set.enabled }
                const nextBlock = set.enabled ? { ...block, enabled: false } : block
                props.onChange(clampSession({ ...props.session, routine: { ...routine, set: nextSet, block: nextBlock } }))
              }}>
              {set.enabled ? "On" : "Off"}
            </button>
            {set.enabled && (
              <div className="routine-stepper">
                <button type="button" aria-label="Decrease set count"
                  onClick={() => props.onChange(clampSession({ ...props.session, routine: { ...routine, set: { ...set, count: Math.max(2, set.count - 1) } } }))}>−</button>
                <span className="routine-stepper-val">{set.count}</span>
                <button type="button" aria-label="Increase set count"
                  onClick={() => props.onChange(clampSession({ ...props.session, routine: { ...routine, set: { ...set, count: set.count + 1 } } }))}>+</button>
              </div>
            )}
          </div>
        </div>
      </div>
    )}

    {/* Block section — visible when set.enabled */}
    {set.enabled && (
      <div className="routine-section routine-section--block">
        <div className="routine-section-title">Block</div>
        <div className="routine-row">
          <span className="routine-row-label">Rest between</span>
          <div className="routine-stepper">
            <button type="button" aria-label="Decrease block rest"
              onClick={() => props.onChange(clampSession({ ...props.session, routine: { ...routine, block: { ...block, restDuration: Math.max(0, block.restDuration - 5) } } }))}>−</button>
            <span className="routine-stepper-val">{block.restDuration}s</span>
            <button type="button" aria-label="Increase block rest"
              onClick={() => props.onChange(clampSession({ ...props.session, routine: { ...routine, block: { ...block, restDuration: block.restDuration + 5 } } }))}>+</button>
          </div>
        </div>
        <div className="routine-row">
          <span className="routine-row-label">Repeat</span>
          <div className="routine-row-controls">
            <button type="button" className="routine-toggle-btn" aria-label="Toggle block repeat" aria-pressed={block.enabled}
              onClick={() => props.onChange(clampSession({ ...props.session, routine: { ...routine, block: { ...block, enabled: !block.enabled } } }))}>
              {block.enabled ? "On" : "Off"}
            </button>
            {block.enabled && (
              <div className="routine-stepper">
                <button type="button" aria-label="Decrease block count"
                  onClick={() => props.onChange(clampSession({ ...props.session, routine: { ...routine, block: { ...block, count: Math.max(2, block.count - 1) } } }))}>−</button>
                <span className="routine-stepper-val">{block.count}</span>
                <button type="button" aria-label="Increase block count"
                  onClick={() => props.onChange(clampSession({ ...props.session, routine: { ...routine, block: { ...block, count: block.count + 1 } } }))}>+</button>
              </div>
            )}
          </div>
        </div>
      </div>
    )}

    {/* BPM increase row — only when bpmIncrease > 0 */}
    {props.session.bpmIncrease > 0 && (
      <div className="routine-bpm-row">
        <span className="routine-bpm-label">BPM +{props.session.bpmIncrease} every</span>
        <div className="routine-seg">
          {(["round", "set", "block", "off"] as const).map((opt) => (
            <button key={opt} type="button" className="routine-seg-btn" aria-pressed={routine.bpmIncreaseAt === opt}
              onClick={() => props.onChange(clampSession({ ...props.session, routine: { ...routine, bpmIncreaseAt: opt } }))}>
              {opt}
            </button>
          ))}
        </div>
      </div>
    )}
  </div>
)}
```

- [ ] **Step 7: Run tests**

```bash
npm run test -- src/Practice.test.tsx
```

Expected: all tests pass.

- [ ] **Step 8: Run full suite**

```bash
npm run test
```

Expected: all tests pass.

- [ ] **Step 9: Commit**

```bash
git add src/Practice.tsx src/Practice.test.tsx
git commit -m "feat: replace routine-timer with Round/Set/Block card in Practice"
```

---

### Task 4: Update CSS for new routine card

**Files:**
- Modify: `src/app.css`

- [ ] **Step 1: Replace routine CSS rules**

Find the block from `.routine-timer` to `.routine-field input` (lines ~393–468). Replace it entirely:

```css
/* Routine card */
.routine-card {
  background: var(--surface-raised);
  border: 1.5px solid var(--line);
  border-radius: var(--radius-card);
  overflow: hidden;
  width: 100%;
  max-width: 520px;
  box-sizing: border-box;
}

/* Progress row (reused) */
.routine-progress-row {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  padding: 14px 16px 0;
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
  margin: 8px 16px 0;
  border-radius: 2px;
  overflow: hidden;
}
.routine-progress-bar-fill {
  height: 100%;
  background: var(--ink);
  border-radius: 2px;
  transition: width 0.3s linear;
}

/* Unit toggle row */
.routine-unit-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 14px 8px;
  border-bottom: 1px solid var(--line);
}
.routine-unit-label {
  font-size: 10px;
  color: var(--ink-muted);
  text-transform: uppercase;
  letter-spacing: 0.6px;
}

/* Sections */
.routine-section {
  padding: 10px 14px;
  border-bottom: 1px solid var(--line);
}
.routine-section:last-child { border-bottom: none; }
.routine-section--set  { background: var(--surface); }
.routine-section--block { background: color-mix(in srgb, var(--surface) 50%, transparent); }
.routine-section-title {
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.8px;
  color: var(--ink-muted);
  margin-bottom: 8px;
}

/* Field rows */
.routine-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
  gap: 8px;
}
.routine-row:last-child { margin-bottom: 0; }
.routine-row-label { font-size: 12px; color: var(--ink-muted); flex: 1; }
.routine-row-controls { display: flex; align-items: center; gap: 8px; }

/* Stepper */
.routine-stepper {
  display: flex;
  align-items: center;
  border: 1px solid var(--line);
  border-radius: 8px;
  overflow: hidden;
}
.routine-stepper button {
  width: 28px;
  height: 28px;
  background: var(--surface-high);
  border: none;
  color: var(--ink-muted);
  font-size: 16px;
  font-weight: 300;
  cursor: pointer;
  font-family: inherit;
  line-height: 1;
  display: flex;
  align-items: center;
  justify-content: center;
}
.routine-stepper button:hover { color: var(--ink); }
.routine-stepper-val {
  min-width: 36px;
  text-align: center;
  font-size: 14px;
  font-weight: 600;
  color: var(--ink);
  padding: 0 4px;
}

/* Toggle button */
.routine-toggle-btn {
  background: var(--surface-high);
  border: 1px solid var(--line);
  border-radius: 6px;
  color: var(--ink-muted);
  font-size: 11px;
  font-family: inherit;
  padding: 4px 10px;
  cursor: pointer;
}
.routine-toggle-btn[aria-pressed="true"] {
  background: color-mix(in srgb, var(--blue) 15%, transparent);
  border-color: var(--blue);
  color: var(--blue);
}

/* Segment control (bars/sec and BPM row) */
.routine-seg {
  display: flex;
  border: 1px solid var(--line);
  border-radius: 6px;
  overflow: hidden;
}
.routine-seg-btn {
  padding: 4px 8px;
  font-size: 10px;
  color: var(--ink-muted);
  background: none;
  border: none;
  border-right: 1px solid var(--line);
  font-family: inherit;
  cursor: pointer;
  text-transform: none;
}
.routine-seg-btn:last-child { border-right: none; }
.routine-seg-btn[aria-pressed="true"] { background: var(--surface-high); color: var(--ink); }

/* BPM row */
.routine-bpm-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 14px;
  border-top: 1px solid var(--line);
}
.routine-bpm-label { font-size: 11px; color: var(--ink-muted); }
```

- [ ] **Step 2: Run full suite**

```bash
npm run test
```

Expected: all tests pass.

- [ ] **Step 3: Commit**

```bash
git add src/app.css
git commit -m "style: new routine card CSS — sections, steppers, segment control"
```

---

### Task 5: Remove routine block from BpmSheet.tsx

**Files:**
- Modify: `src/BpmSheet.tsx`
- Modify: `src/Practice.test.tsx`

- [ ] **Step 1: Write a failing test in `src/Practice.test.tsx`**

Add at the end of the routine describe block:

```ts
it("BpmSheet does not show BPM step card in routine mode", () => {
  const props = makeProps({ routineEnabled: true, bpmIncrease: 5 })
  render(<Practice {...props} />)
  // open BpmSheet
  const moreBtn = screen.getByRole("button", { name: /More/i })
  // BpmSheet always starts closed; just check the step input doesn't exist in DOM
  expect(screen.queryByLabelText("Step")).not.toBeInTheDocument()
})
```

- [ ] **Step 2: Run tests to confirm**

```bash
npm run test -- src/Practice.test.tsx
```

Expected: the new test passes (Step input is already absent since BpmSheet starts closed), or verify that `aria-hidden` prevents it from surfacing. Adjust test if needed.

- [ ] **Step 3: Remove the `{routineEnabled && ...}` block from `src/BpmSheet.tsx`**

Find the block `{/* Routine mode: Step + derived target */}` (lines ~158–182):

```tsx
// DELETE this entire block:
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
```

- [ ] **Step 4: Remove dead code from `src/BpmSheet.tsx`**

Remove `derivedTarget` (line ~64):
```ts
// DELETE:
const derivedTarget = Math.min(300, bpm + (routine.numLevels - 1) * bpmIncrease)
```

Remove `routine` from the destructure (line ~62) — `routineEnabled` must stay because `!routineEnabled` guards the "Increase to target" card:
```ts
// Before:
const { routineEnabled, routine, bpm, bpmIncrease } = props.session
// After:
const { routineEnabled, bpm, bpmIncrease } = props.session
```

Remove unused `stepRef`, `stepText`, `setStepText`, and `commitStep` (lines ~14–17 and ~48–56):
```ts
// DELETE these lines:
const [stepText, setStepText] = useState<string | null>(null)
const stepRef = useRef<string | null>(null)

// DELETE this function:
function commitStep() {
  const typed = stepRef.current
  setStepText(null)
  stepRef.current = null
  if (typed === null) return
  const n = Math.max(0, Math.round(Number(typed)))
  if (!Number.isFinite(n) || n === props.session.bpmIncrease) return
  props.onChange(clampSession({ ...props.session, bpmIncrease: n }))
}
```

- [ ] **Step 5: Run full suite**

```bash
npm run test
```

Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/BpmSheet.tsx src/Practice.test.tsx
git commit -m "feat: remove BpmSheet routine block — BPM step config now lives in Practice card"
```
