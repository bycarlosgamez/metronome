# Unified Practice Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Simple | Routine page switch and the BPM popup with one page whose player card holds a Steady | Climb | Routine switch and the chosen option's settings.

**Architecture:** A new `session.practice` field (`"steady" | "climb" | "routine"`) replaces `routineEnabled` and Simple's `time.increaseEvery`. Climb reuses `session.bpmIncrease` (step) and `session.time` (target, interval) with a new `time.everyUnit` (`"bars" | "sec"`). Routine's Increase to target is removed. The player UI moves out of `Practice.tsx` into a new `PlayerCard.tsx`; `BpmSheet.tsx` is deleted.

**Tech Stack:** React 19, TypeScript, plain CSS (`tokens.css`, `app.css`), Vitest 3 + Testing Library (jsdom).

**Spec:** `docs/superpowers/specs/2026-10-30-unified-practice-page-design.md`

## Global Constraints

- Before Task 1, commit the work-in-progress darker play panel already in the working tree (`src/Practice.tsx`, `src/Practice.test.tsx`, `src/app.css`, `src/tokens.css`) as `style: darker routine play panel with Count-in beside the countdown`. It is part of this design.
- No new dependencies. Plain CSS with tokens from `tokens.css`.
- UI copy, exactly: switch buttons `Steady`, `Climb`, `Routine`; BPM card label `BPM` (Steady) / `Start BPM` (Climb, Routine; rendered uppercase by CSS); phase labels `Playing`, `Ready` (count-in), `Play`, `Rest`; Climb fields `Target BPM`, `Step`, `Every`, unit choice `Bars` | `Min`; Climb sub-line `Next +{step} in {m:ss}` (Min) or `Next +{step} in {n} bars` (Bars), `At target` when holding.
- Climb defaults: target 120, step 5, every 4 bars; switching to Min sets every to 120 sec (2:00); switching to Bars sets 4 bars.
- BPM is always clamped with `clampBpm` (40–300).
- Changing the Steady | Climb | Routine switch while playing stops playback (`onReset`).
- Commit messages end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Verify every task with `npm run test`; Tasks 4 and 5 also with `npm run build`.

## Review Focus

1. **Lowering Target mid-climb below the current step** must move playback to the new target hold, not crash or play past the end. *(Task 3 test.)*
2. **Climb with Start ≥ Target or Step 0** (including after a mid-play edit) plays one step at Start, like Steady. *(Task 2 and Task 3 tests.)*
3. **Old saves** (Simple with `increaseEvery: "bars"`, `routineEnabled: true`, routine `increase.mode: "target"`, `type: "time"`) load into the right practice without throwing. *(Task 2 tests.)*
4. **Switching Bars ↔ Min while playing** keeps your place in the current step. *(Task 3 test.)*
5. **Clearing a Climb number field** (empty string) must not commit 0 or NaN. *(Task 5 test.)*

---

### Task 1: Remove Increase to target from routines

**Files:**
- Modify: `src/types.ts`, `src/session.ts`, `src/expandSession.ts`, `src/BpmSheet.tsx`, `src/Practice.tsx`
- Test: `src/session.test.ts`, `src/expandSession.test.ts`, `src/BpmSheet.test.tsx`, `src/Practice.test.tsx`

**Interfaces:**
- Produces: `RoutineIncrease = { mode: "off" | "round"; roundStep: number }`. `freshRoutine().increase` is `{ mode: "off", roundStep: 5 }`. `routineClimb` no longer exists.

- [ ] **Step 1: Update tests.** In `src/session.test.ts` change `defaults` to `{ mode: "off", roundStep: 5 }` and the fresh-routine expectation (line ~71) to match. Replace the clamp test's input/expectation with `{ mode: "bogus", roundStep: 0 }` → `{ mode: "off", roundStep: 1 }`. Add:
  ```ts
  it("loads a routine saved with Increase to target as no increase", () => {
    const session = withRoutine({ ...freshRoutine(), increase: { mode: "target", step: 4, targetBpm: 125, every: 30 } })
    expect(clampSession(session).routine.increase).toEqual({ mode: "off", roundStep: 5 })
  })
  ```
  Keep "loads an older Per round save…" but expect `{ mode: "round", roundStep: 7 }`. In `src/expandSession.test.ts` delete the "to target …" routine tests. In `src/BpmSheet.test.tsx` delete the whole `describe("BpmSheet routine increase")` except the "Simple keeps its own card…" test. In `src/Practice.test.tsx` delete the "To target shows the computed play length…", "To target in Bars…" and "switching Bars and Time resets Every…" tests, and change the `routine Start and Now BPM` tests that use `mode: "target"` to `increase({ mode: "round", roundStep: 5 })` with `round: { enabled: true, count: 2, restDuration: 0 }`; at 13s (4 bars at 80 = 12s) Now shows `85`; during the first rest (`unit: "sec", playDuration: 10, restDuration: 5`, elapsed 12) Now shows `85`.
- [ ] **Step 2: Run** `npm run test`. Expected: the new/changed tests FAIL (type has `step`, `targetBpm`, `every`).
- [ ] **Step 3: Implement.** Narrow `RoutineIncrease` in `types.ts`. In `session.ts`: `clampIncrease` keeps only `mode` (`"round"` stays, anything else `"off"`) and `roundStep` (old-save fallback to `step` when mode was `"round"`); delete `routineClimb`; in `clampSession`'s `type === "time"` branch drop the `increase` override (Task 2 replaces this branch). In `expandSession.ts` remove `climb`: every routine play is one step at its per-round BPM, duration from `playDuration`. In `BpmSheet.tsx` delete the routine branch (render nothing for routine). In `Practice.tsx` remove `climb`, the computed play length, and the `every` resets in the Bars/Time switch.
- [ ] **Step 4: Run** `npm run test`. Expected: all PASS.
- [ ] **Step 5: Commit** `refactor: routines raise BPM per round only`.

---

### Task 2: `practice` field, Climb data, migrations and playback

**Files:**
- Modify: `src/types.ts`, `src/session.ts`, `src/expandSession.ts`, `src/Practice.tsx`, `src/BpmSheet.tsx`, `src/App.tsx`
- Test: `src/session.test.ts`, `src/expandSession.test.ts`, `src/store.test.ts`; replace `routineEnabled` in fixtures of `src/clock.test.ts`, `src/audio.test.ts`, `src/App.test.tsx`, `src/Practice.test.tsx`, `src/BpmSheet.test.tsx`

**Interfaces:**
- Consumes: Task 1's `RoutineIncrease`.
- Produces:
  ```ts
  export type Practice = "steady" | "climb" | "routine"   // types.ts
  // Session: routineEnabled removed; practice: Practice added
  // TimePattern: increaseEvery removed; everyUnit: "bars" | "sec" added
  export function choosePractice(session: Session, practice: Practice): Session   // session.ts
  ```
  `freshTime()` → `{ seconds: 120, targetBpm: 120, everyUnit: "bars", everySec: 120, everyBars: 4 }`. `createDefaultSession().practice === "steady"`.
  `choosePractice` returns a clamped session with `practice` set; when entering `"climb"` with `bpmIncrease === 0` it also sets `bpmIncrease: 5` and `time: { ...time, targetBpm: 120, everyUnit: "bars", everyBars: 4 }`. Other Climb values are left as they are.

- [ ] **Step 1: Write failing tests.**
  `src/session.test.ts`, new `describe("practice")`:
  - `createDefaultSession().practice` is `"steady"`; `.time.everyUnit` is `"bars"`; `.time.everySec` is `120`.
  - Loading (via `clampSession` on an object cast to `Session`): `{ ...base, practice: undefined, time: { ...base.time, increaseEvery: "bars" } }` → `"climb"`; same with `"off"` → `"steady"`; `{ ...base, practice: undefined, routineEnabled: true }` → `"routine"`; `{ ...base, practice: "bogus" }` → `"steady"`.
  - `type: "time"` with `bpm: 80, bpmIncrease: 5, time: { …, targetBpm: 120, everyBars: 8 }` → `practice: "climb"`, `time.everyUnit: "bars"`, `time.everyBars: 8`, `time.targetBpm: 120`, `bpmIncrease: 5`.
  - `choosePractice(steadySession with bpmIncrease 0, "climb")` → `bpmIncrease 5`, `time.targetBpm 120`, `time.everyBars 4`, `time.everyUnit "bars"`.
  - `choosePractice(session with bpmIncrease 3, targetBpm 140, "climb")` keeps 3 and 140.
  - `choosePractice(climbSession, "routine").practice` is `"routine"` and `bpmIncrease` is unchanged.
  `src/expandSession.test.ts`:
  - Steady (`practice: "steady"`, `bpmIncrease: 5`): one play, `steps` `[{ atSec: 0, bpm: 80 }]`, infinite duration.
  - Climb Min (`bpm 110, bpmIncrease 5, time: { …, targetBpm 125, everyUnit "sec", everySec 120 }`): steps `[{0,110},{120,115},{240,120},{360,125}]`.
  - Climb Bars keeps the existing `timeSteps` expectations.
  - Climb with `bpm 130, targetBpm 120` → one step at 130.
  `src/store.test.ts`: the "loads a time session…" test expects `{ type: "simple", practice: "climb" }`.
- [ ] **Step 2: Run** `npm run test`. Expected: the new tests FAIL.
- [ ] **Step 3: Implement.**
  - `types.ts`: add `Practice`; swap `routineEnabled` for `practice`; swap `increaseEvery` for `everyUnit` in `TimePattern`.
  - `session.ts`: `clampTime` clamps `everyUnit` (`"sec"` else `"bars"`), `everySec ≥ 1`, `everyBars ≥ 1`. `clampSession` derives `practice` in this order: valid `session.practice`; `type === "time"` → `"climb"` (keep target, `everyBars`, `bpmIncrease`, unit bars); legacy `routineEnabled` truthy → `"routine"`; legacy `time.increaseEvery` `"bars"` or `"time"` → `"climb"`; else `"steady"`. Read the legacy fields through a widened type, not `any`. `timeSteps` uses `everySec` as the window when `everyUnit === "sec"`, otherwise the bars window it uses today. Add `choosePractice`.
  - `expandSession.ts`: branch on `practice`: `"routine"` as today; `"climb"` → `timeSteps(session)`; `"steady"` → one step at `session.bpm`.
  - Mechanically replace `routineEnabled` with `practice === "routine"` in `Practice.tsx` and `App.tsx`. The top Simple | Routine switch calls `choosePractice(session, isRoutine ? "routine" : "steady")`. `BpmSheet`'s Off/On sets `practice` to `"steady"`/`"climb"` via `choosePractice`, and its On is pressed when `practice === "climb"`. `Practice.tsx`'s inline Target/Step shows when `practice === "climb"`. These are temporary; Tasks 4–5 replace them.
  - Fixtures: `session.routineEnabled = true` → `session.practice = "routine"`; `routineEnabled: true` in props → `practice: "routine"`; Simple fixtures that set `time.increaseEvery: "bars"` → `practice: "climb"` and drop `increaseEvery`.
- [ ] **Step 4: Run** `npm run test` and `npm run build`. Expected: all PASS, no type errors.
- [ ] **Step 5: Commit** `feat: practice field with Steady, Climb and Routine`.

---

### Task 3: Keep your place when Climb settings change mid-play

**Files:**
- Create: `src/climb.ts`, `src/climb.test.ts`
- Modify: `src/App.tsx` (`onChange`, lines ~168–200)
- Test: `src/App.test.tsx`

**Interfaces:**
- Consumes: `timeSteps`, `Session.practice` from Task 2; `Segment.steps`.
- Produces (`src/climb.ts`):
  ```ts
  export type Step = { atSec: number; bpm: number }
  // Where you are in a climb: step index, seconds until the next step (Infinity on the last), fraction through the current step (0 on the last)
  export function climbProgress(steps: Step[], intoSec: number): { index: number; nextInSec: number; fraction: number }
  // New seconds-into-play after the steps change, keeping the current step and the fraction through it
  export function carryClimbPosition(oldSteps: Step[], intoSec: number, newSteps: Step[]): number
  ```
  `carryClimbPosition` rules: find the old step index `i` and fraction `f`. If `i` is past the new last index, return the new last step's `atSec`. If the new step `i` is the last (hold) step, return `newSteps[i].atSec + (intoSec - oldSteps[i].atSec)` when the old step was also the last, else `newSteps[i].atSec`. Otherwise return `newSteps[i].atSec + f * (newSteps[i+1].atSec - newSteps[i].atSec)`.

- [ ] **Step 1: Write failing tests** in `src/climb.test.ts`:
  - `climbProgress([{0,110},{120,115},{240,120}], 150)` → `{ index: 1, nextInSec: 90, fraction: 0.25 }`.
  - On the last step: `climbProgress(…, 300)` → `{ index: 2, nextInSec: Infinity, fraction: 0 }`.
  - Carry, same index: old `[{0,110},{120,115},{240,120}]`, into 150 → new `[{0,110},{60,115},{120,120}]` returns `75`.
  - Carry, target lowered below the current step: old 4 steps, into in step 2 → new 2 steps returns new step 1's `atSec`.
  - Carry, holding at target: old last step at 240, into 300 → new last step at 120 returns `180`.
  - Carry with a single new step (Start ≥ Target) returns `0` when it wasn't already on the last step.
  In `src/App.test.tsx` add "keeps the current Climb step when Start BPM changes while playing": save a Climb session (`bpm 110, bpmIncrease 5, targetBpm 130, everyUnit "sec", everySec 120`), play, advance to 150s, type `100` in the BPM input and blur, then assert the next scheduled clicks are at 105 BPM (second step of the new climb), not 100 or 110. Reuse the audio-clock mocks the file already uses for "keeps playing an Off session…". (Task 5 adds the same check for changing Every.)
- [ ] **Step 2: Run** `npm run test -- src/climb.test.ts src/App.test.tsx`. Expected: FAIL (module missing; App test plays the wrong step).
- [ ] **Step 3: Implement** `src/climb.ts`. In `App.onChange`, replace the `session.type === "time"` condition with `session.practice === "climb" && next.practice === "climb"` and any of `bpm`, `bpmIncrease`, `time` changed; for the infinite play segment use `carryClimbPosition(currentSegment.steps, played, nextPlay.steps)` plus the next count-in length. Keep the existing count-in branch. Delete the finite-play step branch (no other practice reaches it).
- [ ] **Step 4: Run** `npm run test`. Expected: all PASS.
- [ ] **Step 5: Commit** `feat: Climb edits keep your place in the current step`.

---

### Task 4: Player card with the Steady | Climb | Routine switch

**Files:**
- Create: `src/PlayerCard.tsx`
- Modify: `src/Practice.tsx`, `src/app.css`
- Test: `src/Practice.test.tsx`

**Interfaces:**
- Consumes: `choosePractice`, `climbProgress`.
- Produces: `export function PlayerCard(props: { session: Session; segments: Segment[]; snapshot: Snapshot; status: PlayStatus; onToggle(): void; onReset(): void; onChange(session: Session): void })` rendering the play panel, the switch and the active option's settings. Use the snapshot/status types `Practice.tsx` already imports.

- [ ] **Step 1: Write failing tests** in `src/Practice.test.tsx` (new `describe("player card")`):
  - No `Simple`/`Routine` buttons at the top; a group named `How to practice` has `Steady`, `Climb`, `Routine` with `Steady` pressed by default.
  - Clicking `Climb` calls `onChange` with `practice: "climb"` (and `bpmIncrease: 5` from a default session); while playing it also calls `onReset`.
  - Steady: phase label `Playing` when playing, big number is elapsed time (`snapshotAt(segments, 65)` → `1:05`), no progress bar (`.routine-progress-bar-wrap` absent), no settings rows.
  - Climb (`bpm 110, bpmIncrease 5, targetBpm 130, everyUnit "sec", everySec 120`), stopped: big number `0:00`, sub-line `Next +5 in 2:00`, right info `110 → 130`. Playing at elapsed 150: sub-line `Next +5 in 1:30`, right info `115 → 130`. At elapsed 600: sub-line `At target`, right info `130`. In bars mode (`everyBars 4`, 4/4, `bpm 120`, elapsed 2): sub-line `Next +5 in 3 bars` (round the remaining bars up).
  - Routine: the existing routine card tests pass against the player card (same labels and test ids), and Count-in sits on the phase row in all three practices.
  Update the existing Simple/Routine-switch tests to use the new switch.
- [ ] **Step 2: Run** `npm run test -- src/Practice.test.tsx`. Expected: new tests FAIL.
- [ ] **Step 3: Implement.** Move the routine card markup (play panel, transport, routine settings) from `Practice.tsx` into `PlayerCard.tsx`; the play panel renders for every practice with the per-practice content in the spec's table. Put the segmented switch (`role="group"`, `aria-label="How to practice"`, reuse the `routine-seg` / `routine-seg-btn` classes) between the panel and the settings. Remove the top Simple | Routine switch and the Simple-mode transport/elapsed outside the card. Climb settings are Task 5; render nothing under the switch for Climb in this task.
- [ ] **Step 4: Run** `npm run test` and `npm run build`. Expected: all PASS.
- [ ] **Step 5: Commit** `feat: player card with Steady, Climb and Routine`.

---

### Task 5: Climb settings in the card; remove More and the BPM popup

**Files:**
- Modify: `src/PlayerCard.tsx`, `src/Practice.tsx`, `src/app.css`, `CLAUDE.md`
- Delete: `src/BpmSheet.tsx`, `src/BpmSheet.test.tsx`
- Test: `src/Practice.test.tsx`, `src/App.test.tsx`

**Interfaces:**
- Consumes: `PlayerCard`, `choosePractice`.

- [ ] **Step 1: Write failing tests** in `src/Practice.test.tsx` (`describe("climb settings")`, Climb session from Task 4):
  - Fields `Target BPM` (`130`), `Step` (`5`), `Every` with a `Bars | Min` group; Min shows the MIN:SEC input at `2:00`, Bars shows `4 bars`.
  - Typing `140` in Target BPM and blurring commits `time.targetBpm: 140`; clearing Step and blurring does not call `onChange`.
  - Clicking `Min` commits `everyUnit: "sec", everySec: 120`; clicking `Bars` commits `everyUnit: "bars", everyBars: 4`.
  - No `More BPM settings` button; no `BPM settings` dialog; no Target/Step inputs in the BPM card.
  - BPM card label is `BPM` in Steady, `Start BPM` in Climb and Routine; `bpm-now` shows in Climb (current step BPM while playing, Start when stopped) and in Routine when the per-round increase is on.
  In `src/App.test.tsx` add "keeps the current Climb step when Every changes while playing": same Climb session as Task 3, play to 150s, set Every to 1:00 in the Climb settings, assert the next clicks stay at 115 BPM.
- [ ] **Step 2: Run** `npm run test`. Expected: new tests FAIL.
- [ ] **Step 3: Implement** the Climb settings in `PlayerCard.tsx` (reuse the commit-on-blur `NumberField` pattern from `BpmSheet.tsx`, moved into `PlayerCard.tsx`, and `TimeInput` for Min). Delete `BpmSheet.tsx`, its test, the `More` bar and the inline Target/Step block in `Practice.tsx`, and their CSS (`.bpm-more-*`, `.bpm-target-*`, `.increase-*` if unused). Update `CLAUDE.md`: Practice Modes describes Steady / Climb / Routine via `session.practice`; UI Components lists `PlayerCard.tsx`.
- [ ] **Step 4: Run** `npm run test` and `npm run build`. Expected: all PASS, no type errors.
- [ ] **Step 5: Manual check.** `npm run dev`: Climb from 110 to 130, +5 every 0:10 (Min) climbs and holds; changing Every mid-play keeps the step; your 110 routine plays 110/115/120/125 per set; old routine save with Increase to target opens as Routine with Increase off.
- [ ] **Step 6: Commit** `feat: Climb settings in the player card, remove BPM popup`.
