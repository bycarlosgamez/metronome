# Routine BPM Increase Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Routine mode gets its own BPM increase (Off / Per round / To target, with Reset / Keep / +N between sets), the BPM card shows Start + read-only Now, and the Block level is removed.

**Architecture:** A new `routine.increase` object on `RoutinePattern` holds Routine's increase settings, separate from Simple's `session.time` / `session.bpmIncrease`. `expandSession` reads it to give each round its BPM (Per round) or a stepped climb inside each play (To target, via a new `routineClimb` helper in `session.ts`). `BpmSheet` gets a Routine Increase card, and `Practice` shows Start/Now and drops Block.

**Tech Stack:** React 19, TypeScript, Vitest 3 + Testing Library (jsdom).

**Spec:** `docs/superpowers/specs/2026-10-30-routine-bpm-increase-design.md`

## Global Constraints

- Simple mode behavior and UI are unchanged. All existing Simple tests keep passing unmodified.
- Routine increase settings live only in `routine.increase`. Editing them never touches `session.time` or `session.bpmIncrease`, and vice versa. Start BPM (`session.bpm`) is shared.
- Defaults for `routine.increase`: `mode "off"`, `step 5`, `nextSet "reset"`, `raiseBy 2`, `targetBpm 120`, `every 4`.
- BPM values are always clamped with `clampBpm` (range 40–300 as defined in `session.ts`).
- UI copy: "Start BPM" (routine BPM card label), "Now" (rendered uppercase by CSS), "Off" / "Per round" / "To target", "Next set BPM", "Reset" / "Keep" / "+N".
- `src/Practice.tsx` and `src/app.css` hold uncommitted work-in-progress (the More › chevron) that is not part of this plan. Commit it or stash it before starting, and only `git add` the files each task names.
- Commit messages end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Verify each task with `npm run test`. Task 4 also needs `npm run build`.

## Review Focus

1. **Old saved sessions** in localStorage with `block` enabled and `bpmIncreaseAt: "block"` must load and play without crashing: Block is dropped and the increase mode is Off. *(Task 1 test.)*
2. **Switching Bars ↔ Time while To target is on**: `every` must reset to 4 (Bars) or 30 (Time), so "4 bars" doesn't silently become "4 seconds". *(Task 4 test.)*
3. **To target with `start >= target` or `step 0`**: the play is a single window at Start. It must not loop forever or end up with zero length. *(Task 2 test.)*
4. **Per round climbing past 300 with Keep or +N** must cap at 300, not overflow. *(Task 2 test.)*
5. **Clearing a number field** in the Routine Increase card (empty string) must not commit 0 or NaN, matching the existing Target/Step fields. *(Task 3 test.)*

---

### Task 1: Routine increase data model, clamping and legacy migration

**Files:**
- Modify: `src/types.ts` (add `RoutineIncrease`, add `increase` to `RoutinePattern`)
- Modify: `src/session.ts` (`freshRoutine`, `clampRoutine`, `clampSession`'s `type: "time"` migration)
- Test: `src/session.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export type RoutineIncrease = {
    mode: "off" | "round" | "target"
    step: number                          // BPM added per round (round) or per window (target)
    nextSet: "reset" | "keep" | "raise"
    raiseBy: number                       // +N per set when nextSet is "raise"
    targetBpm: number
    every: number                         // window length: bars when routine.unit is "bars", seconds when "sec"
  }
  // RoutinePattern gains: increase: RoutineIncrease
  // freshRoutine().increase === { mode: "off", step: 5, nextSet: "reset", raiseBy: 2, targetBpm: 120, every: 4 }
  ```
- `block` and `bpmIncreaseAt` stay on the type for now. Task 4 removes them.

- [ ] **Step 1: Write failing tests in `src/session.test.ts`** (new `describe("routine increase")`)

  - `freshRoutine().increase` equals the defaults above.
  - Clamping: given `increase: { mode: "bogus", step: -3, nextSet: "x", raiseBy: -1, targetBpm: 999, every: 0 }`, the result is `{ mode: "off", step: 0, nextSet: "reset", raiseBy: 0, targetBpm: 300, every: 1 }`.
  - Legacy, when the raw routine has no `increase`:
    - `bpmIncreaseAt: "round"`, `session.bpmIncrease = 5` → `{ mode: "round", step: 5, nextSet: "keep" }` (other fields default)
    - `bpmIncreaseAt: "set"`, `bpmIncrease = 10` → `{ mode: "round", step: 0, nextSet: "raise", raiseBy: 10 }`
    - `bpmIncreaseAt: "block"` with `block: { enabled: true, count: 3, restDuration: 60 }` → `mode: "off"`, and `clampSession` doesn't throw
    - `bpmIncreaseAt: "off"` → `mode: "off"`
  - An existing `increase` takes priority over `bpmIncreaseAt`. With `increase.mode: "target"` and `bpmIncreaseAt: "round"`, the result has `mode: "target"`.
  - Replace the existing test "migrates a saved time session to simple with routineEnabled" (`session.test.ts:76`). Given `type: "time"`, bpm 80, `time.targetBpm` 100, `bpmIncrease` 10, `everyBars` 4, the result is `routineEnabled true`, `routine.unit "bars"`, `routine.round.enabled false`, and `routine.increase` matches `{ mode: "target", step: 10, targetBpm: 100, every: 4 }`. With `bpmIncrease 0`, the result is `mode: "off"`.

- [ ] **Step 2: Run** `npm run test -- src/session.test.ts`. Expected: the new tests FAIL (`increase` is undefined).

- [ ] **Step 3: Implement.** Add `RoutineIncrease` to `types.ts`. In `session.ts`:
  - Add `increase` defaults to `freshRoutine()`.
  - Change `clampRoutine(pattern: unknown, legacyStep: number): RoutinePattern`. If `base.increase` is an object, clamp it field by field (integers, `step`/`raiseBy` ≥ 0, `every` ≥ 1, `targetBpm` via `clampBpm`, enums fall back to their defaults). Otherwise derive it from the legacy `bpmIncreaseAt` + `legacyStep` as tested.
  - `clampSession` passes `integer(session.bpmIncrease)` as `legacyStep`.
  - Rewrite the `type: "time"` branch to build `increase: { mode: step > 0 && target > start ? "target" : "off", step, targetBpm, every: everyBars, … }` with `round: fresh.round`, and drop the `numLevels` workaround.

- [ ] **Step 4: Run** `npm run test`. Expected: all PASS.

- [ ] **Step 5: Commit**
  ```bash
  git add src/types.ts src/session.ts src/session.test.ts
  git commit -m "feat: routine increase settings with legacy migration"
  ```

---

### Task 2: Playback (Per round with Reset/Keep/+N, To target climb, no Block)

**Files:**
- Modify: `src/session.ts` (add `routineClimb`)
- Modify: `src/expandSession.ts` (`resolved()` routine branch, roughly lines 33–90)
- Test: `src/expandSession.test.ts` (the `describe("routine")` block)

**Interfaces:**
- Consumes: `RoutineIncrease`, `routine.increase` (Task 1).
- Produces:
  ```ts
  // session.ts — the To target climb for one play, starting at session.bpm
  export function routineClimb(session: Session): { steps: { atSec: number; bpm: number }[]; durationSec: number }
  ```
  `steps` are Start, Start+step, … capped at `targetBpm`. Each step lasts one window: `every` seconds when `routine.unit === "sec"`, otherwise `every × beatsInMeter(meter) × 60 / bpm`. `durationSec` is the sum of all windows, including the final Target window. If `step === 0` or `start >= targetBpm`, the result is a single window at Start.

- [ ] **Step 1: Write failing tests in `src/expandSession.test.ts`.** Update `makeRoutineSession()` to set `routine.increase` (spread `freshRoutine().increase`), and delete the tests that set `bpmIncreaseAt` or `block` (lines ~143, 162, 175, 190, 212). Add:
  - **Per round, Reset**: bpm 110, `unit "sec"`, play 120, rest 15, `round {enabled, count 4}`, `set {enabled, count 2, restDuration 60}`, `increase { mode: "round", step: 5, nextSet: "reset" }`. Play BPMs are `[110,115,120,125,110,115,120,125]`.
  - **Keep**: same setup, the result is `[110,115,120,125,130,135,140,145]`.
  - **+N**: `nextSet "raise"`, `raiseBy 2`, the result is `[110,115,120,125,112,117,122,127]`.
  - **Cap (Review Focus 4)**: bpm 290, step 5, Keep, 2 rounds × 2 sets. The result is `[290,295,300,300]`.
  - **Off**: mode `"off"` with step 5. Every play is at Start.
  - **To target, seconds**: bpm 80, `unit "sec"`, `increase { mode: "target", step: 4, targetBpm: 125, every: 30 }`, round count 2. Each play has `steps.map(s => s.bpm)` = `[80,84,…,124,125]` (13 entries), `steps[12].atSec` = 360 and `durationSec` = 390. Both plays start at 80.
  - **To target, bars**: bpm 80, 4/4, step 10, target 90, every 4, `restDuration 2` bars, round count 2. Steps are `[{atSec:0,bpm:80},{atSec:12,bpm:90}]` and `durationSec` ≈ `12 + 640/60` (use `toBeCloseTo`). The rest is ≈ `2*4*60/90` (it uses the BPM the play ended at).
  - **To target edge (Review Focus 3)**: bpm 130, target 120 → one step `[{atSec:0,bpm:130}]` with `durationSec` 30 (sec unit, every 30). Also step 0 → a single step.
  - **Set rest stacking without Block**: keep the existing "set-boundary rest stacks round rest on top of set rest" test (35 s). With 2 rounds × 2 sets the segments are `play rest play rest(35) play rest play`, and nothing comes after the last play.

- [ ] **Step 2: Run** `npm run test -- src/expandSession.test.ts`. Expected: the new tests FAIL.

- [ ] **Step 3: Implement `routineClimb` in `session.ts`, then rewrite the routine branch of `resolved()`.** Loop sets → rounds (no block loop, ignore `bpmIncreaseAt`). BPM per mode:
  - `off`: `start`
  - `round`: `clampBpm(setStart(s) + r × step)`, where `setStart` is `start` (reset), `start + s × roundPasses × step` (keep) or `start + s × raiseBy` (raise)
  - `target`: `steps` and `durationSec` come from `routineClimb(session)`, and the bars-unit rest is converted at the last step's BPM.

  The rest rules stay the same as today, minus Block: round rest after non-last rounds, round rest + `set.restDuration` after the last round of a non-last set, nothing after the final play. `id` becomes `routine-${s}-${r}`.

- [ ] **Step 4: Run** `npm run test`. Expected: all PASS. Practice tests still pass because `block` still exists on the type.

- [ ] **Step 5: Commit**
  ```bash
  git add src/session.ts src/expandSession.ts src/expandSession.test.ts
  git commit -m "feat: routine per-round and to-target BPM increase playback"
  ```

---

### Task 3: Routine Increase card in the BPM popup

**Files:**
- Modify: `src/BpmSheet.tsx`
- Create: `src/BpmSheet.test.tsx`
- Modify: `src/Practice.test.tsx:365-370` (the "BpmSheet does not show BPM step card in routine mode" test: delete it, its replacement lives in `BpmSheet.test.tsx`)

**Interfaces:**
- Consumes: `routine.increase` (Task 1).
- Produces: a private `NumberField({ id, label, value, onCommit(n: number) })` inside `BpmSheet.tsx`. It commits on blur/Enter, ignores empty or non-numeric input, and the parent clamps via `clampSession`. Optionally refactor the existing Target/Step inputs to use it.

- [ ] **Step 1: Write failing tests in `src/BpmSheet.test.tsx`.** Render `<BpmSheet open session={…} onClose={vi.fn()} onChange={onChange} />` with `routineEnabled: true`:
  - The group `getByRole("group", { name: "Routine BPM increase" })` has buttons "Off", "Per round" and "To target". "Off" is `aria-pressed="true"` by default, and no Step field is shown.
  - Clicking "Per round" calls `onChange` with `routine.increase.mode === "round"`, and `session.bpmIncrease` and `session.time` stay unchanged.
  - With mode `"round"` and `routine.set.enabled: true`: there's a `getByLabelText("Step")` field and a group "Next set BPM" with "Reset" / "Keep" / "+N". Clicking "+N" sets `nextSet "raise"`. With `nextSet "raise"`, a `getByLabelText("Raise each set by")` field is shown.
  - With mode `"round"` and `set.enabled: false`, the "Next set BPM" group is absent.
  - With mode `"target"` and `unit "bars"`: the fields are labeled "Target BPM", "Step" and "Every (bars)". With `unit "sec"`, the last one is "Every (sec)". Typing 130 into Target BPM and blurring calls `onChange` with `routine.increase.targetBpm === 130`.
  - **Review Focus 5**: clearing Step and blurring does not call `onChange`.
  - The Simple "Increase to target" card isn't rendered in Routine mode. In Simple mode the Routine card isn't rendered.

- [ ] **Step 2: Run** `npm run test -- src/BpmSheet.test.tsx`. Expected: FAIL.

- [ ] **Step 3: Implement** the card in the `routineEnabled` branch of `BpmSheet`, reusing the `bpm-sheet-card`, `sheet-title` ("Increase"), `increase-toggle` / `increase-toggle-btn` and `increase-fields` / `increase-field` classes. Field ids are `routine-step`, `routine-raise`, `routine-target` and `routine-every`. Every update goes through `props.onChange(clampSession({ ...session, routine: { ...routine, increase: { ...increase, <field> } } }))`.

- [ ] **Step 4: Run** `npm run test`. Expected: all PASS.

- [ ] **Step 5: Commit**
  ```bash
  git add src/BpmSheet.tsx src/BpmSheet.test.tsx src/Practice.test.tsx
  git commit -m "feat: routine increase card in BPM sheet"
  ```

---

### Task 4: Practice cards (Start/Now, computed Play, Block removed)

**Files:**
- Modify: `src/Practice.tsx` (BPM card ~190–262; routine state ~80–92; progress ~309–313; unit toggle ~320–336; Block section ~423–450; BPM row ~452–465)
- Modify: `src/types.ts`, `src/session.ts` (remove `block` and `bpmIncreaseAt` from `RoutinePattern`, `freshRoutine` and `clampRoutine`. The legacy read in `clampRoutine` keeps working because it reads the raw object as `unknown`.)
- Modify: `src/app.css` (delete `.routine-section--block` and `.routine-bpm-row` / `.routine-bpm-label`)
- Modify: `CLAUDE.md` (the "Routine — Round/Set/Block…" line becomes "Round/Set structure … with a BPM increase per round or up to a target")
- Test: `src/Practice.test.tsx`, plus fix `block`/`bpmIncreaseAt` literals in `src/session.test.ts` and `src/expandSession.test.ts`

**Interfaces:**
- Consumes: `routineClimb(session)` (Task 2), `routine.increase` (Task 1), the existing `bpmAt`, `formatClock`.

- [ ] **Step 1: Write failing tests in `src/Practice.test.tsx`.** Use `makeProps` and override `snapshot`/`status` when a test needs a time mid-play.
  - Routine, mode `"off"`: the BPM input shows the Start value, the label "Start BPM" is visible, and `queryByTestId("bpm-now")` is null.
  - Routine, mode `"round"`, bpm 80, step 5, 4/4, 4 bars, round count 2, snapshot at `elapsed 13`, status `"playing"`: the BPM input shows `80` and `getByTestId("bpm-now")` shows `85` with the label "Now".
  - NOW during a rest: `unit "sec"`, play 10, rest 5, round count 2, step 5, snapshot at 12. `bpm-now` shows `85`, the next play's BPM.
  - NOW when stopped (snapshot 0): `bpm-now` shows the Start BPM.
  - Simple mode: the label stays "BPM" and `bpm-now` is absent. The existing Simple tests pass unchanged.
  - Routine, mode `"target"`, `unit "sec"`, bpm 80, step 4, target 125, every 30: the Play row shows `getByTestId("routine-play-computed")` with text `6:30`, and there's no "Increase play duration" button. With `unit "bars"`, bpm 80, target 90, step 10, every 4, it shows `8 bars` (steps × every).
  - **Review Focus 2**: with mode `"target"` and `unit "bars"`, clicking "Time" calls `onChange` with `routine.increase.every === 30`. From `"sec"`, clicking "Bars" sets `every === 4`.
  - The progress line shows "Round 1/2" and "Set 1/2", and nothing matching /Block/ appears anywhere in the routine card.
  - Delete or replace the old tests at lines ~280–358: "Block section …", "toggling … clears block enabled" (keep the round → set clearing part), and "BPM row …".

- [ ] **Step 2: Run** `npm run test -- src/Practice.test.tsx`. Expected: the new tests FAIL.

- [ ] **Step 3: Implement in `Practice.tsx`:**
  - BPM card: when `routineEnabled`, the input's display value is `session.bpm` (Simple still shows `currentBpm`) and the label is "Start BPM". When `routineEnabled && increase.mode !== "off"`, render a `bpm-right` column with the number (`data-testid="bpm-now"`, not an input, styled like `.bpm-field-value` without the underline) and `bpm-field-label` "Now" under it.
  - `nowBpm`: during a rest segment, it's the first `steps[0].bpm` of the next `play` segment after `snapshot.segmentIndex`. Otherwise it's `currentBpm`.
  - Routine card: drop `block`, `blockPasses`, `blockN`, the Block section, the Block line in the progress line, and the BPM increase row. The round → set toggle no longer touches block.
  - Play row: when `increase.mode === "target"`, replace the stepper/TimeInput with `routine-play-computed`. Use `formatClock(Math.round(routineClimb(session).durationSec))` for sec, or `` `${steps.length × every} bars` `` for bars.
  - Unit toggle: the reset object also sets `increase.every` to 4 (bars) or 30 (sec).
  - Then remove `block` / `bpmIncreaseAt` from `types.ts` and `session.ts`, and fix any remaining test literals.

- [ ] **Step 4: Run** `npm run test` and then `npm run build`. Expected: all tests PASS and the build has no type errors.

- [ ] **Step 5: Manual check.** Run `npm run dev` and load Example 1 (110, 2:00 / 0:15, +5 per round, 4 × 4, Reset). Confirm Now climbs and resets each set, and the card shows no Block.

- [ ] **Step 6: Commit**
  ```bash
  git add src/Practice.tsx src/Practice.test.tsx src/types.ts src/session.ts src/session.test.ts src/expandSession.test.ts src/app.css CLAUDE.md
  git commit -m "feat: start/now BPM card and routine card without block"
  ```
