# Routine Timer Design

## Goal

Add a structured practice timer to the Practice page — without changing anything about the current page. A segmented control at the top switches between **Simple** (unchanged) and **Routine** (structured BPM progression with cycles and repeats).

## What changes and what doesn't

**Unchanged:** Beat display, BPM block, transport (Play/Pause/Stop), meter button, subdivision button, Edit page (Simple session only).

**Added:** Segmented control at top of Practice page. When Routine is selected, the timer area gains structured progress display and inline configuration fields.

**Removed:** Time session type (migrated automatically to Routine mode).

---

## Data Model

Two changes to `Session` in `types.ts`:

```ts
// Remove TimePattern and session.time entirely.
// Add to Session:
routineEnabled: boolean

routine: {
  barsPerLevel: number    // bars at each BPM step before advancing
  numLevels: number       // how many BPM steps (1 = no ramp, just a countdown)
  repeatCount: number     // how many times to run the full level sequence
  restAfterSec: number    // rest between levels AND between repeats
  loop: boolean           // loop the whole routine when done
}
```

**BPM ramp** uses existing fields: `session.bpm` (start BPM) + `session.bpmIncrease` (step per level). Target BPM is derived: `bpm + numLevels * bpmIncrease`. The BPM sheet no longer shows Target BPM as an editable field — just Start BPM and Step; target is shown as read-only derived info.

**Defaults:**
```ts
routineEnabled: false,
routine: {
  barsPerLevel: 8,
  numLevels: 4,
  repeatCount: 1,
  restAfterSec: 10,
  loop: false,
}
```

**Migration:** Old `type: "time"` sessions become `type: "simple"` with `routineEnabled: true` and routine fields mapped from `session.time`:
- `barsPerLevel` ← `session.time.everyBars`
- `numLevels` ← derived: `Math.ceil((session.time.targetBpm - session.bpm) / session.bpmIncrease)` (min 1)
- `repeatCount` ← 1
- `restAfterSec` ← `session.simple.restAfterSec` (or 10 if not set)
- `loop` ← false

---

## expandSession

When `routineEnabled` is false: expand exactly as today (no change).

When `routineEnabled` is true, generate segments in this order:

```
count-in (1 bar at session.bpm)

for each repeat (1..repeatCount):
  for each level (0..numLevels-1):
    play segment: bpm = session.bpm + level * session.bpmIncrease
                  durationSec = barsPerLevel * beatsInMeter(session.meter) * 60 / bpm
    if not last level in this repeat:
      rest segment: durationSec = routine.restAfterSec
  if not last repeat:
    rest segment: durationSec = routine.restAfterSec

if not loop: end (session stops, user presses Play to restart)
```

Each play segment gets a `steps` array for BPM (constant within a level — no intra-segment ramp).

---

## Practice Page UI

### Segmented control (top of page, always visible)

```
[ Simple ]  [ Routine ]
```

Switching modes while playing stops playback and resets. In Simple mode everything below is identical to today. In Routine mode the timer area changes.

### Timer area — Simple mode (unchanged)

Plain elapsed clock, same as today.

### Timer area — Routine mode

Replaces the plain clock with:

```
┌─────────────────────────────────┐
│  1:24            Cycle 2/3      │
│                  Level 2/4      │
│  ████░░░░░░░░░░  Rep 1/2        │
│                                 │
│  Bars/level  Levels  Repeat ×   │
│  [ 8 ]       [ 4 ]   [ 3 ]      │
│  Rest (sec)  Loop               │
│  [ 10 ]      ○                  │
└─────────────────────────────────┘
```

- Elapsed time shown large (left); structured progress shown small (right): Cycle N/M, Level N/M, Rep N/M
- Thin progress bar spanning the full width beneath the time/progress row — tracks progress through the current level
- Inline fields always editable (same pattern as BPM sheet inputs); changes take effect on next play/reset
- Fields commit on blur/Enter

### BPM sheet changes

- Remove "Target BPM" editable field
- Add derived summary line: e.g. `80 → 100 BPM (5 levels)` — read-only, updates as Step changes
- "Every (bars)" label and field removed — bars/level lives in the routine timer section now
- Mode toggle ("Off" | "Bars") removed — ramp is configured in the Routine timer section, not here
- Step field only shown in BPM sheet when `routineEnabled` is true; hidden in Simple mode

---

## Session type switcher (Edit page)

Edit page currently has Simple / Complex / Time. After this change:

- Remove Complex (already planned)
- Remove Time
- Show only Simple
- Edit page is unchanged for Simple sessions

The Routine toggle lives on the Practice page only — it's not on the Edit page.

---

## Files Affected

| File | Change |
|------|--------|
| `src/types.ts` | Remove `TimePattern`, add `routineEnabled` + `routine` to `Session` |
| `src/session.ts` | Update `createDefaultSession`, `clampSession`, migration from Time, remove `timeSteps`/`timeDurationSec` |
| `src/expandSession.ts` | Add routine expansion logic; remove Time path |
| `src/expandSession.test.ts` | Add routine expansion tests |
| `src/Practice.tsx` | Add segmented control; routine timer display + inline fields |
| `src/Practice.test.tsx` | Add routine UI tests |
| `src/BpmSheet.tsx` | Remove Target BPM field; add derived summary line |
| `src/Edit.tsx` | Remove Time + Complex type options |
| `src/Edit.test.tsx` | Update for removed types |
| `src/app.css` | Styles for segmented control, routine timer block |
| `src/tokens.css` | Any new tokens needed |

---

## Out of Scope (for now)

- Named exercises / exercise labels
- Per-exercise meter or subdivision overrides
- Set-within-set hierarchy
- Saving multiple routines
- Loop (auto-restart when done) — data model field reserved, implementation deferred
