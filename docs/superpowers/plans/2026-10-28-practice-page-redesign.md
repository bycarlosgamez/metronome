# Practice Page Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the Practice page with a beat-grid hero, a dedicated BPM block, bottom sheets for Meter/Subdivision/BPM, and a Target BPM data model replacing the duration-based increase model.

**Architecture:** Data model changes first (types → session → expandSession), then new UI components (SubdivIcon, three bottom sheets), then the Practice.tsx redesign that wires them together, then cleanup. Each task leaves tests green before moving on.

**Tech Stack:** React 19, TypeScript, Vitest 3 + Testing Library, plain CSS (no framework)

---

## File Map

| Action | File | Purpose |
|--------|------|---------|
| Modify | `src/types.ts` | Add `targetBpm` to `TimePattern` |
| Modify | `src/session.ts` | Update `freshTime`, `clampTime`, `timeSteps`, add `timeDurationSec` |
| Modify | `src/session.test.ts` | Update `freshTime` snapshot; add `timeSteps` + `timeDurationSec` tests |
| Modify | `src/expandSession.ts` | Derive `durationSec` from `targetBpm` via `timeDurationSec` |
| Modify | `src/expandSession.test.ts` | Add time-ramp duration test |
| Create | `src/SubdivIcon.tsx` | Unicode ♩ ♪ + number badge icon |
| Modify | `src/app.css` | Bottom sheet CSS + new practice layout styles |
| Create | `src/MeterSheet.tsx` | Bottom sheet: beats / note selectors |
| Create | `src/SubdivisionSheet.tsx` | Bottom sheet: 6 subdivision options with SubdivIcon |
| Create | `src/BpmSheet.tsx` | Bottom sheet: BPM input + increase target fields |
| Modify | `src/Practice.tsx` | Full redesign: beat grid, BPM block, 2 buttons, play controls, 3 sheets |
| Modify | `src/Practice.test.tsx` | Rewrite for new UI |
| Delete | `src/StagePicks.tsx` | Replaced by the three sheet components |

---

## Task 1 — Add `targetBpm` to `TimePattern` and update session functions

**Files:**
- Modify: `src/types.ts`
- Modify: `src/session.ts`
- Modify: `src/session.test.ts`

- [ ] **Step 1.1 — Add `targetBpm` to `TimePattern` in `src/types.ts`**

Replace the `TimePattern` type (lines 49–54):

```ts
export type TimePattern = {
  seconds: number
  targetBpm: number
  increaseEvery: "off" | "time" | "bars"
  everySec: number
  everyBars: number
}
```

- [ ] **Step 1.2 — Update `freshTime()` in `src/session.ts`**

Replace the `freshTime` function (lines 36–43):

```ts
export function freshTime(): TimePattern {
  return {
    seconds: 120,
    targetBpm: 120,
    increaseEvery: "off",
    everySec: 30,
    everyBars: 4,
  }
}
```

- [ ] **Step 1.3 — Update private `clampTime()` in `src/session.ts`**

Replace `clampTime` (lines 45–53):

```ts
function clampTime(pattern: TimePattern | undefined): TimePattern {
  const base = pattern ?? freshTime()
  return {
    seconds: Math.max(1, integer(base.seconds)),
    targetBpm: clampBpm(base.targetBpm ?? 120),
    increaseEvery: base.increaseEvery === "bars" || base.increaseEvery === "time" ? base.increaseEvery : "off",
    everySec: Math.max(1, integer(base.everySec)),
    everyBars: Math.max(1, integer(base.everyBars)),
  }
}
```

- [ ] **Step 1.4 — Rewrite `timeSteps()` in `src/session.ts`**

Replace `timeSteps` (lines 55–72):

```ts
export function timeSteps(session: Session): { atSec: number; bpm: number }[] {
  const pattern = clampTime(session.time)
  const startBpm = clampBpm(session.bpm)
  const targetBpm = pattern.targetBpm
  const increase = Math.max(0, integer(session.bpmIncrease))
  if (increase === 0 || startBpm >= targetBpm) {
    return [{ atSec: 0, bpm: startBpm }]
  }
  const steps: { atSec: number; bpm: number }[] = []
  let at = 0
  let index = 0
  while (true) {
    const bpm = Math.min(targetBpm, startBpm + increase * index)
    steps.push({ atSec: at, bpm })
    if (bpm >= targetBpm) break
    const window =
      pattern.increaseEvery === "bars"
        ? pattern.everyBars * beatsInMeter(session.meter) * 60 / bpm
        : pattern.everySec
    if (!(window > 0)) break
    at += window
    index += 1
  }
  return steps
}
```

- [ ] **Step 1.5 — Add `timeDurationSec()` export to `src/session.ts`** (after `timeSteps`)

```ts
export function timeDurationSec(session: Session): number {
  if (session.time.increaseEvery === "off") return Number.POSITIVE_INFINITY
  const steps = timeSteps(session)
  const pattern = clampTime(session.time)
  const lastStep = steps[steps.length - 1]
  const window =
    pattern.increaseEvery === "bars"
      ? pattern.everyBars * beatsInMeter(session.meter) * 60 / lastStep.bpm
      : pattern.everySec
  return Math.max(1, Math.round(lastStep.atSec + window))
}
```

- [ ] **Step 1.6 — Run TypeScript check**

```bash
npm run build 2>&1 | head -40
```

Expected: no type errors (a few session.test.ts failures are fine — those get fixed next).

- [ ] **Step 1.7 — Update `freshTime` snapshot in `src/session.test.ts`**

Find the `expect(freshTime()).toEqual({` block and add `targetBpm: 120`:

```ts
expect(freshTime()).toEqual({
  seconds: 120,
  targetBpm: 120,
  increaseEvery: "off",
  everySec: 30,
  everyBars: 4,
})
```

Also find the `createDefaultSession` snapshot and update the `time` field:

```ts
time: {
  seconds: 120,
  targetBpm: 120,
  increaseEvery: "off",
  everySec: 30,
  everyBars: 4,
},
```

- [ ] **Step 1.8 — Add `timeSteps` and `timeDurationSec` tests to `src/session.test.ts`**

Add these tests inside the existing `describe("session", ...)` block, after the existing tests:

```ts
describe("timeSteps", () => {
  it("returns single step when increase is off", () => {
    const session = createDefaultSession()
    session.bpm = 80
    session.bpmIncrease = 0
    session.time = { seconds: 120, targetBpm: 120, increaseEvery: "off", everySec: 30, everyBars: 4 }
    const steps = timeSteps(session)
    expect(steps).toEqual([{ atSec: 0, bpm: 80 }])
  })

  it("returns single step when bpmIncrease is 0", () => {
    const session = createDefaultSession()
    session.bpm = 80
    session.bpmIncrease = 0
    session.time = { seconds: 120, targetBpm: 120, increaseEvery: "time", everySec: 30, everyBars: 4 }
    const steps = timeSteps(session)
    expect(steps).toEqual([{ atSec: 0, bpm: 80 }])
  })

  it("returns single step when startBpm already meets targetBpm", () => {
    const session = createDefaultSession()
    session.bpm = 120
    session.bpmIncrease = 5
    session.time = { seconds: 120, targetBpm: 100, increaseEvery: "time", everySec: 30, everyBars: 4 }
    const steps = timeSteps(session)
    expect(steps).toEqual([{ atSec: 0, bpm: 120 }])
  })

  it("ramps up to targetBpm every N seconds", () => {
    const session = createDefaultSession()
    session.bpm = 80
    session.bpmIncrease = 10
    session.time = { seconds: 120, targetBpm: 100, increaseEvery: "time", everySec: 30, everyBars: 4 }
    const steps = timeSteps(session)
    expect(steps).toEqual([
      { atSec: 0, bpm: 80 },
      { atSec: 30, bpm: 90 },
      { atSec: 60, bpm: 100 },
    ])
  })

  it("caps final bpm at targetBpm not above", () => {
    const session = createDefaultSession()
    session.bpm = 80
    session.bpmIncrease = 15
    session.time = { seconds: 120, targetBpm: 100, increaseEvery: "time", everySec: 30, everyBars: 4 }
    const steps = timeSteps(session)
    expect(steps[steps.length - 1].bpm).toBe(100)
  })
})

describe("timeDurationSec", () => {
  it("returns POSITIVE_INFINITY when increaseEvery is off", () => {
    const session = createDefaultSession()
    session.time = { seconds: 120, targetBpm: 120, increaseEvery: "off", everySec: 30, everyBars: 4 }
    expect(timeDurationSec(session)).toBe(Number.POSITIVE_INFINITY)
  })

  it("returns last step atSec plus one window", () => {
    const session = createDefaultSession()
    session.bpm = 80
    session.bpmIncrease = 10
    session.time = { seconds: 120, targetBpm: 100, increaseEvery: "time", everySec: 30, everyBars: 4 }
    // steps: [{atSec:0,bpm:80},{atSec:30,bpm:90},{atSec:60,bpm:100}]
    // duration = 60 + 30 = 90
    expect(timeDurationSec(session)).toBe(90)
  })
})
```

- [ ] **Step 1.9 — Add `timeSteps` and `timeDurationSec` to imports in `src/session.test.ts`**

```ts
import {
  clampSession,
  createDefaultSession,
  cycleGroupFromSimple,
  cyclesFromSimple,
  freshComplex,
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
```

- [ ] **Step 1.10 — Run tests**

```bash
npm run test -- src/session.test.ts
```

Expected: all pass.

- [ ] **Step 1.11 — Commit**

```bash
git add src/types.ts src/session.ts src/session.test.ts
git commit -m "feat: add targetBpm to TimePattern; rewrite timeSteps to ramp to target"
```

---

## Task 2 — Update `expandSession.ts` to derive duration from `targetBpm`

**Files:**
- Modify: `src/expandSession.ts`
- Modify: `src/expandSession.test.ts`

- [ ] **Step 2.1 — Import `timeDurationSec` in `src/expandSession.ts`**

Change the import line (line 1):

```ts
import { lengthSeconds, sessionTitle, simplePlayedBpm, timeDurationSec, timeSteps } from "./session"
```

- [ ] **Step 2.2 — Replace the time-session branch in `resolved()` in `src/expandSession.ts`**

Replace lines 42–51 (the `if (session.type === "time")` branch, not the `"off"` branch):

```ts
  if (session.type === "time") {
    const steps = timeSteps(session)
    return [{
      id: "time",
      bpm: steps[0]?.bpm ?? session.bpm,
      durationSec: timeDurationSec(session),
      restSec: 0,
      steps,
    }]
  }
```

- [ ] **Step 2.3 — Run existing tests**

```bash
npm run test -- src/expandSession.test.ts
```

Expected: all pass (no time-ramp tests existed yet).

- [ ] **Step 2.4 — Add a time-ramp duration test to `src/expandSession.test.ts`**

Add inside the `describe("expandSession", ...)` block:

```ts
it("derives durationSec from targetBpm for a time session with increase", () => {
  const session = createDefaultSession(() => "cycle-1")
  session.type = "time"
  session.bpm = 80
  session.bpmIncrease = 10
  session.time = { seconds: 999, targetBpm: 100, increaseEvery: "time", everySec: 30, everyBars: 4 }
  // steps: 80@0s, 90@30s, 100@60s → duration = 60 + 30 = 90s
  const segments = expandSession(session)
  const play = segments.find((s) => s.kind === "play")!
  expect(play.durationSec).toBe(90)
  expect(play.steps).toEqual([
    { atSec: 0, bpm: 80 },
    { atSec: 30, bpm: 90 },
    { atSec: 60, bpm: 100 },
  ])
})

it("uses POSITIVE_INFINITY for a time session with increase off", () => {
  const session = createDefaultSession(() => "cycle-1")
  session.type = "time"
  session.time = { seconds: 120, targetBpm: 120, increaseEvery: "off", everySec: 30, everyBars: 4 }
  const segments = expandSession(session)
  const play = segments.find((s) => s.kind === "play")!
  expect(play.durationSec).toBe(Number.POSITIVE_INFINITY)
})
```

- [ ] **Step 2.5 — Run tests**

```bash
npm run test -- src/expandSession.test.ts
```

Expected: all pass.

- [ ] **Step 2.6 — Run full test suite**

```bash
npm run test
```

Expected: all pass.

- [ ] **Step 2.7 — Commit**

```bash
git add src/expandSession.ts src/expandSession.test.ts
git commit -m "feat: derive expandSession durationSec from targetBpm"
```

---

## Task 3 — Create `SubdivIcon` component

**Files:**
- Create: `src/SubdivIcon.tsx`

- [ ] **Step 3.1 — Create `src/SubdivIcon.tsx`**

```tsx
import type { Subdivision } from "./types"

const glyph: Record<Subdivision, string> = {
  quarter: "♩",
  eighth: "♪",
  triplet: "♪",
  sixteenth: "♪",
  quintuplet: "♪",
  sextuplet: "♪",
}

const badge: Record<Subdivision, string> = {
  quarter: "",
  eighth: "",
  triplet: "3",
  sixteenth: "16",
  quintuplet: "5",
  sextuplet: "6",
}

export function SubdivIcon(props: { subdivision: Subdivision; size?: "sm" | "md" }) {
  const size = props.size ?? "md"
  return (
    <span className={`subdiv-icon subdiv-icon--${size}`} aria-hidden="true">
      <span className="subdiv-icon__glyph">{glyph[props.subdivision]}</span>
      {badge[props.subdivision] && (
        <span className="subdiv-icon__badge">{badge[props.subdivision]}</span>
      )}
    </span>
  )
}
```

- [ ] **Step 3.2 — Run TypeScript check**

```bash
npm run build 2>&1 | head -20
```

Expected: no errors.

- [ ] **Step 3.3 — Commit**

```bash
git add src/SubdivIcon.tsx
git commit -m "feat: add SubdivIcon component with Unicode note + badge"
```

---

## Task 4 — Add CSS for bottom sheets and new practice layout

**Files:**
- Modify: `src/app.css`

- [ ] **Step 4.1 — Append new styles to `src/app.css`**

Add at the end of `src/app.css`:

```css
/* ─── Practice redesign ───────────────────────────── */
.practice-body {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 20px 16px 40px;
  gap: 14px;
  width: 100%;
  box-sizing: border-box;
}

/* Beat grid */
.beat-grid {
  display: flex;
  justify-content: center;
  gap: 12px;
  flex-wrap: wrap;
}
.beat-col {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}
.beat-sq {
  width: 72px;
  height: 72px;
  border-radius: 14px;
  background: var(--surface);
  border: 2px solid var(--line);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 26px;
  font-weight: 700;
  color: var(--ink-muted);
  transition: background 0.08s, border-color 0.08s, color 0.08s;
}
.beat-sq.accent { border-color: var(--surface-high); }
.beat-sq.lit { background: var(--stage-play); border-color: var(--stage-play); color: #000; }
.beat-sq.accent.lit { background: var(--ink); border-color: var(--ink); color: var(--play-ink); }
.beat-subs {
  display: flex;
  gap: 5px;
}
.beat-sub {
  width: 9px;
  height: 9px;
  border-radius: 50%;
  background: var(--surface);
  border: 1.5px solid var(--line);
  transition: background 0.08s, border-color 0.08s;
}
.beat-sub.lit { background: var(--blue); border-color: var(--blue); }

/* BPM block */
.bpm-block {
  width: 100%;
  max-width: 520px;
  background: var(--surface);
  border: 1.5px solid var(--line);
  border-radius: var(--radius-card);
  padding: 18px 20px;
  text-align: left;
  cursor: pointer;
  box-sizing: border-box;
}
.bpm-block:hover { border-color: var(--surface-high); }
.bpm-endless {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}
.bpm-endless__left { display: flex; flex-direction: column; gap: 4px; }
.bpm-endless__right {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 4px;
  padding-top: 4px;
}
.bpm-current { font-size: 52px; font-weight: 700; line-height: 1; letter-spacing: -1px; }
.bpm-label { font-size: 11px; color: var(--ink-muted); text-transform: uppercase; letter-spacing: 1px; }
.bpm-elapsed { font-size: 13px; color: var(--ink-muted); font-variant-numeric: tabular-nums; }
.bpm-hint { font-size: 11px; color: var(--surface-high); }
.bpm-ramp { display: flex; flex-direction: column; gap: 10px; }
.bpm-ramp__top {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 12px;
}
.bpm-ramp__right { display: flex; flex-direction: column; align-items: flex-end; gap: 2px; }
.bpm-target { font-size: 20px; font-weight: 700; color: var(--stage-play); opacity: 0.7; }
.bpm-target-label { font-size: 10px; color: var(--stage-play); opacity: 0.6; text-transform: uppercase; letter-spacing: 1px; }
.bpm-progress-wrap { display: flex; flex-direction: column; gap: 4px; }
.bpm-progress-bar { height: 5px; background: var(--line); border-radius: 3px; overflow: hidden; }
.bpm-progress-fill { height: 100%; border-radius: 3px; background: linear-gradient(90deg, var(--blue), var(--stage-play)); transition: width 0.3s; }
.bpm-progress-labels {
  display: flex;
  justify-content: space-between;
  font-size: 10px;
  color: var(--ink-muted);
  font-variant-numeric: tabular-nums;
}
.bpm-step-info { font-size: 11px; color: var(--ink-muted); }

/* Pick row (Meter + Subdivision buttons) */
.pick-row {
  display: flex;
  gap: 12px;
  width: 100%;
  max-width: 520px;
}
.pick-btn {
  flex: 1;
  background: var(--surface);
  border: 1.5px solid var(--line);
  border-radius: var(--radius-card);
  padding: 12px 16px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  cursor: pointer;
}
.pick-btn:hover { border-color: var(--surface-high); }
.pick-btn strong { font-size: 20px; color: var(--ink); }
.pick-btn span { font-size: 11px; color: var(--ink-muted); text-transform: uppercase; letter-spacing: 1px; }

/* Play controls */
.play-controls {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  margin-top: 8px;
}
.play-btn {
  width: 72px;
  height: 72px;
  border-radius: 50%;
  border: 0;
  background: var(--play);
  color: var(--play-ink);
  font-size: 1.75rem;
  display: grid;
  place-items: center;
  cursor: pointer;
}
.play-btn.playing { background: var(--stage-stop); color: var(--ink); }
.stop-link {
  background: transparent;
  border: 0;
  color: var(--ink-muted);
  font-size: 12px;
  cursor: pointer;
  padding: 4px 8px;
}
.stop-link:hover { color: var(--ink); }

/* SubdivIcon */
.subdiv-icon {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
.subdiv-icon--md { width: 32px; height: 32px; }
.subdiv-icon--sm { width: 22px; height: 22px; }
.subdiv-icon__glyph { line-height: 1; }
.subdiv-icon--md .subdiv-icon__glyph { font-size: 26px; }
.subdiv-icon--sm .subdiv-icon__glyph { font-size: 18px; }
.subdiv-icon__badge {
  position: absolute;
  top: 0;
  right: 0;
  font-size: 9px;
  font-weight: 800;
  background: var(--surface-raised);
  border-radius: 3px;
  padding: 0 3px;
  line-height: 13px;
}

/* Bottom sheet */
.sheet-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: flex-end;
  justify-content: center;
  z-index: 200;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.2s;
}
.sheet-overlay.open {
  opacity: 1;
  pointer-events: all;
}
.sheet {
  background: var(--surface);
  border-radius: 20px 20px 0 0;
  padding: 16px 24px 40px;
  width: 100%;
  max-width: 720px;
  transform: translateY(100%);
  transition: transform 0.25s ease;
  box-sizing: border-box;
}
.sheet-overlay.open .sheet { transform: translateY(0); }
.sheet-handle {
  width: 36px;
  height: 4px;
  background: var(--line);
  border-radius: 2px;
  margin: 0 auto 20px;
}
.sheet-title {
  font-size: 11px;
  color: var(--ink-muted);
  text-transform: uppercase;
  letter-spacing: 1px;
  margin: 0 0 16px;
}
.sheet-divider { border: none; border-top: 1px solid var(--line); margin: 16px 0; }

/* Meter sheet */
.meter-selects {
  display: flex;
  align-items: center;
  gap: 16px;
}
.meter-select {
  background: var(--surface-raised);
  border: 1.5px solid var(--line);
  border-radius: var(--radius-field);
  padding: 12px 16px;
  font-size: 28px;
  font-weight: 700;
  color: var(--ink);
  width: 80px;
  text-align: center;
  appearance: none;
}
.meter-slash { color: var(--ink-muted); font-size: 24px; font-weight: 300; }

/* Subdivision sheet */
.subdiv-grid {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}
.subdiv-opt {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 14px 12px;
  background: var(--surface-raised);
  border: 1.5px solid var(--line);
  border-radius: 12px;
  cursor: pointer;
  min-width: 72px;
}
.subdiv-opt:hover { border-color: var(--surface-high); }
.subdiv-opt[aria-pressed="true"] {
  background: color-mix(in srgb, var(--blue) 15%, transparent);
  border-color: var(--blue);
}
.subdiv-opt__name { font-size: 10px; color: var(--ink-muted); text-align: center; }
.subdiv-opt[aria-pressed="true"] .subdiv-opt__name { color: var(--ink); }

/* BPM sheet */
.bpm-input-row {
  display: flex;
  align-items: center;
  gap: 14px;
  margin-bottom: 8px;
}
.bpm-sheet-input {
  font-size: 52px;
  font-weight: 700;
  color: var(--ink);
  background: var(--surface-raised);
  border: 1.5px solid var(--line);
  border-radius: var(--radius-field);
  padding: 8px 16px;
  text-align: center;
  width: 140px;
  -moz-appearance: textfield;
}
.bpm-sheet-input::-webkit-outer-spin-button,
.bpm-sheet-input::-webkit-inner-spin-button { appearance: none; }
.bpm-steppers { display: flex; flex-direction: column; gap: 6px; }
.bpm-stepper {
  width: 36px;
  height: 36px;
  background: var(--surface-raised);
  border: 1.5px solid var(--line);
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  color: var(--ink-muted);
  cursor: pointer;
}
.bpm-stepper:hover { color: var(--ink); border-color: var(--surface-high); }
.increase-mode-row { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 16px; }
.increase-mode-btn {
  padding: 8px 20px;
  background: var(--surface-raised);
  border: 1.5px solid var(--line);
  border-radius: var(--radius-pill);
  font-size: 13px;
  color: var(--ink-muted);
  cursor: pointer;
}
.increase-mode-btn[aria-pressed="true"] {
  background: color-mix(in srgb, var(--blue) 15%, transparent);
  border-color: var(--blue);
  color: var(--ink);
}
.increase-fields { display: flex; gap: 12px; flex-wrap: wrap; align-items: flex-end; }
.increase-field { display: flex; flex-direction: column; gap: 5px; }
.increase-field label { font-size: 10px; color: var(--ink-muted); text-transform: uppercase; letter-spacing: 0.5px; }
.increase-field input {
  background: var(--surface-raised);
  border: 1.5px solid var(--line);
  border-radius: var(--radius-field);
  padding: 8px 12px;
  font-size: 16px;
  color: var(--ink);
  width: 90px;
  text-align: center;
}
.increase-field.target input { border-color: color-mix(in srgb, var(--stage-play) 60%, transparent); }
.increase-field.target label { color: color-mix(in srgb, var(--stage-play) 70%, transparent); }
.increase-derived {
  margin-top: 14px;
  padding: 10px 14px;
  background: var(--surface-raised);
  border-radius: var(--radius-field);
  display: flex;
  justify-content: space-between;
  font-size: 12px;
  color: var(--ink-muted);
}
.increase-derived span { color: var(--ink); font-weight: 600; }

/* Visually hidden (for aria labels) */
.visually-hidden {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}
```

- [ ] **Step 4.2 — Commit**

```bash
git add src/app.css
git commit -m "feat: add CSS for bottom sheets and practice redesign layout"
```

---

## Task 5 — Create `MeterSheet` component

**Files:**
- Create: `src/MeterSheet.tsx`

- [ ] **Step 5.1 — Create `src/MeterSheet.tsx`**

```tsx
import { useEffect, useRef } from "react"
import { BEATS, NOTES } from "./types"

export function MeterSheet(props: {
  meter: string
  open: boolean
  onClose(): void
  onChange(meter: string): void
}) {
  const [beats, note] = props.meter.split("/")
  const overlayRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!props.open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") props.onClose()
    }
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [props.open, props.onClose])

  return (
    <div
      ref={overlayRef}
      className={`sheet-overlay${props.open ? " open" : ""}`}
      aria-modal={props.open}
      role="dialog"
      aria-label="Time Signature"
      onClick={(e) => { if (e.target === overlayRef.current) props.onClose() }}
    >
      <div className="sheet">
        <div className="sheet-handle" />
        <p className="sheet-title">Time Signature</p>
        <div className="meter-selects">
          <select
            className="meter-select"
            aria-label="Beats"
            value={beats}
            onChange={(e) => props.onChange(`${e.target.value}/${note}`)}
          >
            {BEATS.map((b) => <option key={b} value={b}>{b}</option>)}
          </select>
          <span className="meter-slash" aria-hidden="true">/</span>
          <select
            className="meter-select"
            aria-label="Note value"
            value={note}
            onChange={(e) => props.onChange(`${beats}/${e.target.value}`)}
          >
            {NOTES.map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 5.2 — Run TypeScript check**

```bash
npm run build 2>&1 | head -20
```

Expected: no errors.

- [ ] **Step 5.3 — Commit**

```bash
git add src/MeterSheet.tsx
git commit -m "feat: add MeterSheet bottom sheet component"
```

---

## Task 6 — Create `SubdivisionSheet` component

**Files:**
- Create: `src/SubdivisionSheet.tsx`

- [ ] **Step 6.1 — Create `src/SubdivisionSheet.tsx`**

```tsx
import { useEffect, useRef } from "react"
import { SubdivIcon } from "./SubdivIcon"
import { SUBDIVISION_SLOTS } from "./session"
import { SUBDIVISIONS, type Session, type Subdivision } from "./types"

const names: Record<Subdivision, string> = {
  quarter: "Quarter",
  eighth: "Eighth",
  triplet: "Triplet",
  sixteenth: "16th",
  quintuplet: "Quintuplet",
  sextuplet: "Sextuplet",
}

export function SubdivisionSheet(props: {
  session: Session
  open: boolean
  onClose(): void
  onChange(session: Session): void
}) {
  const overlayRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!props.open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") props.onClose()
    }
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [props.open, props.onClose])

  function choose(subdivision: Subdivision) {
    props.onChange({
      ...props.session,
      subdivision,
      slots: Array.from({ length: SUBDIVISION_SLOTS[subdivision] }, () => props.session.click),
    })
    props.onClose()
  }

  return (
    <div
      ref={overlayRef}
      className={`sheet-overlay${props.open ? " open" : ""}`}
      aria-modal={props.open}
      role="dialog"
      aria-label="Subdivision"
      onClick={(e) => { if (e.target === overlayRef.current) props.onClose() }}
    >
      <div className="sheet">
        <div className="sheet-handle" />
        <p className="sheet-title">Subdivision</p>
        <div className="subdiv-grid">
          {SUBDIVISIONS.map((sub) => (
            <button
              key={sub}
              type="button"
              className="subdiv-opt"
              aria-pressed={sub === props.session.subdivision}
              onClick={() => choose(sub)}
            >
              <SubdivIcon subdivision={sub} />
              <span className="subdiv-opt__name">{names[sub]}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 6.2 — Run TypeScript check**

```bash
npm run build 2>&1 | head -20
```

Expected: no errors.

- [ ] **Step 6.3 — Commit**

```bash
git add src/SubdivisionSheet.tsx
git commit -m "feat: add SubdivisionSheet bottom sheet component"
```

---

## Task 7 — Create `BpmSheet` component

**Files:**
- Create: `src/BpmSheet.tsx`

- [ ] **Step 7.1 — Create `src/BpmSheet.tsx`**

```tsx
import { useEffect, useRef, useState } from "react"
import { formatClock } from "./format"
import { clampBpm, clampSession, timeDurationSec } from "./session"
import type { Session } from "./types"

function DerivedDuration(props: { session: Session }) {
  if (props.session.time.increaseEvery === "off") return null
  const sec = timeDurationSec(props.session)
  if (!Number.isFinite(sec)) return null
  return (
    <div className="increase-derived">
      Estimated duration <span>~{formatClock(sec)}</span>
    </div>
  )
}

export function BpmSheet(props: {
  session: Session
  open: boolean
  onClose(): void
  onChange(session: Session): void
}) {
  const overlayRef = useRef<HTMLDivElement>(null)
  const [bpmText, setBpmText] = useState<string | null>(null)
  const [targetText, setTargetText] = useState<string | null>(null)
  const bpmRef = useRef<string | null>(null)
  const targetRef = useRef<string | null>(null)

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

  function commitTarget() {
    const typed = targetRef.current
    setTargetText(null)
    targetRef.current = null
    if (typed === null) return
    const next = clampBpm(Number(typed))
    if (next === props.session.time.targetBpm) return
    props.onChange(clampSession({
      ...props.session,
      time: { ...props.session.time, targetBpm: next },
    }))
  }

  function chooseMode(mode: "off" | "time" | "bars") {
    props.onChange(clampSession({
      ...props.session,
      time: { ...props.session.time, increaseEvery: mode },
    }))
  }

  const { increaseEvery, targetBpm, everySec, everyBars } = props.session.time

  return (
    <div
      ref={overlayRef}
      className={`sheet-overlay${props.open ? " open" : ""}`}
      aria-modal={props.open}
      role="dialog"
      aria-label="BPM settings"
      onClick={(e) => { if (e.target === overlayRef.current) props.onClose() }}
    >
      <div className="sheet">
        <div className="sheet-handle" />
        <p className="sheet-title">BPM</p>

        <div className="bpm-input-row">
          <input
            className="bpm-sheet-input"
            aria-label="BPM"
            inputMode="numeric"
            value={bpmText ?? String(props.session.bpm)}
            onFocus={() => {
              bpmRef.current = String(props.session.bpm)
              setBpmText(String(props.session.bpm))
            }}
            onChange={(e) => {
              bpmRef.current = e.target.value
              setBpmText(e.target.value)
            }}
            onBlur={commitBpm}
            onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur() }}
          />
          <div className="bpm-steppers">
            <button
              type="button"
              className="bpm-stepper"
              aria-label="Increase BPM"
              onClick={() => props.onChange(clampSession({ ...props.session, bpm: props.session.bpm + 1 }))}
            >+</button>
            <button
              type="button"
              className="bpm-stepper"
              aria-label="Decrease BPM"
              onClick={() => props.onChange(clampSession({ ...props.session, bpm: props.session.bpm - 1 }))}
            >−</button>
          </div>
        </div>

        <hr className="sheet-divider" />
        <p className="sheet-title">Increase to target</p>

        <div className="increase-mode-row">
          {(["off", "time", "bars"] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              className="increase-mode-btn"
              aria-pressed={increaseEvery === mode}
              onClick={() => chooseMode(mode)}
            >
              {mode === "off" ? "Off" : mode === "time" ? "Time" : "Bars"}
            </button>
          ))}
        </div>

        {increaseEvery !== "off" && (
          <>
            <div className="increase-fields">
              <div className="increase-field target">
                <label htmlFor="bpm-sheet-target">Target BPM</label>
                <input
                  id="bpm-sheet-target"
                  inputMode="numeric"
                  value={targetText ?? String(targetBpm)}
                  onFocus={() => {
                    targetRef.current = String(targetBpm)
                    setTargetText(String(targetBpm))
                  }}
                  onChange={(e) => {
                    targetRef.current = e.target.value
                    setTargetText(e.target.value)
                  }}
                  onBlur={commitTarget}
                  onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur() }}
                />
              </div>
              <div className="increase-field">
                <label htmlFor="bpm-sheet-step">Step</label>
                <input
                  id="bpm-sheet-step"
                  inputMode="numeric"
                  value={String(props.session.bpmIncrease)}
                  onChange={(e) => {
                    const n = Math.max(0, Math.round(Number(e.target.value)))
                    if (Number.isFinite(n)) {
                      props.onChange(clampSession({ ...props.session, bpmIncrease: n }))
                    }
                  }}
                />
              </div>
              <div className="increase-field">
                <label htmlFor="bpm-sheet-every">
                  Every ({increaseEvery === "bars" ? "bars" : "sec"})
                </label>
                <input
                  id="bpm-sheet-every"
                  inputMode="numeric"
                  value={String(increaseEvery === "bars" ? everyBars : everySec)}
                  onChange={(e) => {
                    const n = Math.max(1, Math.round(Number(e.target.value)))
                    if (Number.isFinite(n)) {
                      props.onChange(clampSession({
                        ...props.session,
                        time: increaseEvery === "bars"
                          ? { ...props.session.time, everyBars: n }
                          : { ...props.session.time, everySec: n },
                      }))
                    }
                  }}
                />
              </div>
            </div>
            <DerivedDuration session={props.session} />
          </>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 7.2 — Run TypeScript check**

```bash
npm run build 2>&1 | head -20
```

Expected: no errors.

- [ ] **Step 7.3 — Commit**

```bash
git add src/BpmSheet.tsx
git commit -m "feat: add BpmSheet bottom sheet component"
```

---

## Task 8 — Redesign `Practice.tsx`

**Files:**
- Modify: `src/Practice.tsx`
- Modify: `src/Practice.test.tsx`

- [ ] **Step 8.1 — Rewrite `src/Practice.tsx`**

Replace the entire file:

```tsx
import { useState } from "react"
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

  const segment = props.segments[props.snapshot.segmentIndex]
  const isPlaying = props.status === "playing" || props.status === "no-audio"
  const isRamping = props.session.type === "time" && props.session.time.increaseEvery !== "off"
  const beatCount = segment.kind === "count-in" ? 4 : Number(props.session.meter.split("/")[0])
  const subCount = SUBDIVISION_SLOTS[props.session.subdivision]
  const intoSec = Math.max(0, segment.durationSec - props.snapshot.segmentRemainingSec)
  const currentBpm = bpmAt(segment, intoSec)

  // Current beat subdivision dot index (0-based within beat)
  const beatDur = currentBpm > 0 ? 60 / currentBpm : 1
  const subDur = beatDur / subCount
  const posInBeat = intoSec % beatDur
  const activeSubSlot = isPlaying ? Math.floor(posInBeat / subDur) : -1

  // Elapsed time (always counting up)
  const elapsedSec = props.snapshot.elapsedSec

  // BPM ramp info
  const startBpm = props.session.bpm
  const targetBpm = props.session.time.targetBpm ?? startBpm
  const progressPct = isRamping && targetBpm > startBpm
    ? Math.min(100, ((currentBpm - startBpm) / (targetBpm - startBpm)) * 100)
    : 0
  const stepIndex = stepIndexAt(segment, intoSec)
  const nextStepAtSec = segment.steps?.[stepIndex + 1]?.atSec
  const timeUntilNext = nextStepAtSec !== undefined ? nextStepAtSec - intoSec : null

  function closeSheet() { setSheet(null) }

  return (
    <main className="practice">
      <header className="topbar">
        <h1 aria-label="Mentronome">{sessionTitle(props.session)}</h1>
        <button type="button" className="quiet" onClick={props.onEdit}>Edit</button>
      </header>

      <div className="practice-body">
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
          {isRamping ? (
            <div className="bpm-ramp">
              <div className="bpm-ramp__top">
                <div>
                  <div className="bpm-current" data-testid="bpm-current">{currentBpm}</div>
                  <div className="bpm-label">
                    BPM · +{props.session.bpmIncrease} every{" "}
                    {props.session.time.increaseEvery === "bars"
                      ? `${props.session.time.everyBars} bars`
                      : `${props.session.time.everySec}s`}
                  </div>
                </div>
                <div className="bpm-ramp__right">
                  <div className="bpm-target" data-testid="bpm-target">{targetBpm}</div>
                  <div className="bpm-target-label">Target</div>
                </div>
              </div>
              <div className="bpm-progress-wrap">
                <div className="bpm-progress-bar">
                  <div className="bpm-progress-fill" style={{ width: `${progressPct}%` }} />
                </div>
                <div className="bpm-progress-labels">
                  <span>{startBpm} BPM</span>
                  <span className="bpm-step-info" data-testid="bpm-step-info">
                    {isPlaying && timeUntilNext !== null
                      ? `next ↑ in ${formatClock(Math.max(0, timeUntilNext))}`
                      : formatClock(elapsedSec)}
                  </span>
                  <span>→ {targetBpm}</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="bpm-endless">
              <div className="bpm-endless__left">
                <div className="bpm-current" data-testid="bpm-current">{currentBpm}</div>
                <div className="bpm-label">BPM · endless</div>
              </div>
              <div className="bpm-endless__right">
                <div className="bpm-elapsed" data-testid="bpm-elapsed">
                  {isPlaying ? formatClock(elapsedSec) : "0:00"}
                </div>
                <div className="bpm-hint">Tap to edit ›</div>
              </div>
            </div>
          )}
        </button>

        {/* Pick row */}
        <div className="pick-row">
          <button
            type="button"
            className="pick-btn"
            aria-label={`Time signature: ${props.session.meter}`}
            onClick={() => setSheet("meter")}
          >
            <strong>{props.session.meter}</strong>
            <span>Meter</span>
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

- [ ] **Step 8.2 — Run TypeScript check**

```bash
npm run build 2>&1 | head -40
```

Expected: no type errors.

- [ ] **Step 8.3 — Rewrite `src/Practice.test.tsx`**

Replace the entire file:

```tsx
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"
import { snapshotAt } from "./clock"
import { expandSession } from "./expandSession"
import { Practice } from "./Practice"
import { createDefaultSession } from "./session"
import type { Session } from "./types"

function makeProps(overrides: Partial<Session> = {}) {
  const session: Session = { ...createDefaultSession(() => "s1"), ...overrides }
  const segments = expandSession(session)
  return {
    session,
    segments,
    snapshot: snapshotAt(segments, 0),
    status: "stopped" as const,
    onToggle: vi.fn(),
    onJump: vi.fn(),
    onReset: vi.fn(),
    onEdit: vi.fn(),
    onChange: vi.fn(),
    onSeek: vi.fn(),
  }
}

describe("Practice", () => {
  it("renders the session name and Edit button", async () => {
    const props = makeProps()
    const user = userEvent.setup()
    render(<Practice {...props} />)
    expect(screen.getByRole("heading", { name: "Mentronome" })).toHaveTextContent("Practice")
    await user.click(screen.getByRole("button", { name: "Edit" }))
    expect(props.onEdit).toHaveBeenCalledOnce()
  })

  it("shows beat squares for the current meter", () => {
    render(<Practice {...makeProps()} />)
    expect(screen.getByTestId("beat-1")).toBeInTheDocument()
    expect(screen.getByTestId("beat-4")).toBeInTheDocument()
    expect(screen.queryByTestId("beat-5")).not.toBeInTheDocument()
  })

  it("shows beat-1 as accent", () => {
    render(<Practice {...makeProps()} />)
    expect(screen.getByTestId("beat-1")).toHaveAttribute("data-accent", "true")
    expect(screen.getByTestId("beat-2")).toHaveAttribute("data-accent", "false")
  })

  it("shows current BPM", () => {
    render(<Practice {...makeProps()} />)
    expect(screen.getByTestId("bpm-current")).toHaveTextContent("80")
  })

  it("shows Play button when stopped", () => {
    render(<Practice {...makeProps()} />)
    expect(screen.getByRole("button", { name: "Play" })).toBeInTheDocument()
  })

  it("shows Pause button when playing", () => {
    const props = makeProps()
    props.status = "playing"
    render(<Practice {...props} />)
    expect(screen.getByRole("button", { name: "Pause" })).toBeInTheDocument()
  })

  it("calls onToggle when Play is clicked", async () => {
    const props = makeProps()
    const user = userEvent.setup()
    render(<Practice {...props} />)
    await user.click(screen.getByRole("button", { name: "Play" }))
    expect(props.onToggle).toHaveBeenCalledOnce()
  })

  it("calls onReset when Stop is clicked", async () => {
    const props = makeProps()
    const user = userEvent.setup()
    render(<Practice {...props} />)
    await user.click(screen.getByRole("button", { name: "Stop" }))
    expect(props.onReset).toHaveBeenCalledOnce()
  })

  it("shows Meter button with current meter", () => {
    render(<Practice {...makeProps()} />)
    expect(screen.getByRole("button", { name: /Time signature: 4\/4/ })).toBeInTheDocument()
  })

  it("shows Subdivision button", () => {
    render(<Practice {...makeProps()} />)
    expect(screen.getByRole("button", { name: /Subdivision: quarter/ })).toBeInTheDocument()
  })

  it("opens meter sheet when Meter button is clicked", async () => {
    const props = makeProps()
    const user = userEvent.setup()
    render(<Practice {...props} />)
    expect(screen.getByRole("dialog", { name: "Time Signature" })).not.toHaveClass("open")
    await user.click(screen.getByRole("button", { name: /Time signature/ }))
    expect(screen.getByRole("dialog", { name: "Time Signature" })).toHaveClass("open")
  })

  it("opens subdivision sheet when Subdivision button is clicked", async () => {
    const props = makeProps()
    const user = userEvent.setup()
    render(<Practice {...props} />)
    await user.click(screen.getByRole("button", { name: /Subdivision/ }))
    expect(screen.getByRole("dialog", { name: "Subdivision" })).toHaveClass("open")
  })

  it("opens BPM sheet when BPM block is clicked", async () => {
    const props = makeProps()
    const user = userEvent.setup()
    render(<Practice {...props} />)
    await user.click(screen.getByRole("button", { name: "Edit BPM settings" }))
    expect(screen.getByRole("dialog", { name: "BPM settings" })).toHaveClass("open")
  })

  it("shows target BPM and progress bar in ramp mode", () => {
    const props = makeProps({
      bpm: 80,
      bpmIncrease: 10,
      time: { seconds: 120, targetBpm: 100, increaseEvery: "time", everySec: 30, everyBars: 4 },
    })
    render(<Practice {...props} />)
    expect(screen.getByTestId("bpm-target")).toHaveTextContent("100")
  })

  it("does not show strip for time sessions", () => {
    render(<Practice {...makeProps()} />)
    expect(document.querySelector(".strip")).not.toBeInTheDocument()
  })
})
```

- [ ] **Step 8.4 — Run Practice tests**

```bash
npm run test -- src/Practice.test.tsx
```

Expected: all pass.

- [ ] **Step 8.5 — Run full test suite**

```bash
npm run test
```

Expected: all pass.

- [ ] **Step 8.6 — Commit**

```bash
git add src/Practice.tsx src/Practice.test.tsx
git commit -m "feat: redesign Practice page with beat grid, BPM block, and bottom sheets"
```

---

## Task 9 — Remove `StagePicks.tsx`

**Files:**
- Delete: `src/StagePicks.tsx`
- Verify: no other file imports it

- [ ] **Step 9.1 — Check nothing else imports StagePicks**

```bash
grep -r "StagePicks" src/
```

Expected: no results (Practice.tsx no longer imports it).

- [ ] **Step 9.2 — Delete `src/StagePicks.tsx`**

```bash
rm src/StagePicks.tsx
```

- [ ] **Step 9.3 — Run full test suite**

```bash
npm run test
```

Expected: all pass.

- [ ] **Step 9.4 — Run build**

```bash
npm run build
```

Expected: clean build, no errors.

- [ ] **Step 9.5 — Commit**

```bash
git add -A
git commit -m "chore: remove StagePicks — replaced by MeterSheet, SubdivisionSheet, BpmSheet"
```

---

## Self-Review

**Spec coverage check:**

| Spec section | Covered by |
|---|---|
| Beat grid — squares, accent, lit, sub dots | Task 8 (Practice.tsx) + Task 4 (CSS) |
| BPM block — endless mode | Task 8 |
| BPM block — ramping mode with progress bar | Task 8 |
| BPM block — "next ↑ in X" | Task 8 |
| Target BPM model — `targetBpm` field | Task 1 |
| Duration derived from targetBpm | Task 1 + Task 2 |
| Two buttons (Meter / Subdivision) | Task 8 |
| Meter sheet | Task 5 |
| Subdivision sheet | Task 6 |
| BPM sheet | Task 7 |
| SubdivIcon (♩ ♪ + badge) | Task 3 |
| Play/Pause large button | Task 8 |
| Stop as text link | Task 8 |
| No forward/backward buttons | Task 8 |
| Bottom sheet CSS (overlay, slide-up) | Task 4 |
| Desktop-first layout (max-width 520px) | Task 4 |
| Backward compat — `clampTime` handles missing targetBpm | Task 1 (defaults to 120) |

**No gaps found.**
