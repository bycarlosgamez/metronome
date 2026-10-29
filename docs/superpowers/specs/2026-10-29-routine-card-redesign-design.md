# Routine Card Redesign Design

## Goal

Replace the current routine card (above the play button in Routine mode) with a 3-level hierarchical structure — Round, Set, Block — that lets musicians configure nested repetitions with rests and optional BPM progression. Remove the routine section from the Edit page once this is complete.

## Scope

- Routine mode only (Practice screen)
- Replaces the current `routine-timer` block and its inline fields
- The Edit page routine configuration is removed as part of this work

---

## Data Model

Replace the current `RoutinePattern` in `src/types.ts` with:

```ts
type RepeatLevel = {
  enabled: boolean
  count: number        // number of repetitions
  restDuration: number // rest before the next repetition (always seconds)
}

type RoutinePattern = {
  unit: "bars" | "sec"   // global unit for playDuration and restDuration
  playDuration: number   // one round's play (bars or seconds per unit)
  restDuration: number   // one round's rest (bars or seconds per unit)
  round: RepeatLevel     // repeat the round (play + rest)
  set: RepeatLevel       // repeat the full round sequence
  block: RepeatLevel     // repeat the full set
  bpmIncreaseAt: "off" | "round" | "set" | "block"
}
```

The `unit` toggle applies to `playDuration` and `restDuration` only. `round.restDuration`, `set.restDuration`, and `block.restDuration` are always in seconds because between-level rests are real-time breaks.

The existing fields `barsPerLevel`, `numLevels`, `repeatCount`, `restAfterSec`, and `loop` are removed from `RoutinePattern`. The existing top-level `bpmIncrease` field on `Session` is reused as the BPM step amount.

Default values:
```ts
{
  unit: "bars",
  playDuration: 4,
  restDuration: 0,
  round:  { enabled: false, count: 4, restDuration: 0 },
  set:    { enabled: false, count: 3, restDuration: 30 },
  block:  { enabled: false, count: 2, restDuration: 60 },
  bpmIncreaseAt: "off"
}
```

---

## UI — Routine Card

The card lives above the play button in Practice.tsx, visible when `routineEnabled` is true. It replaces the current `routine-timer` block.

### Layout (top to bottom)

**Header row**
- Left: global unit toggle — `[bars | sec]` — applies to playDuration and restDuration
- This row is always visible

**Round section** (always visible)
- "Play" label + stepper (value in `unit`)
- "Rest" label + stepper (value in `unit`)
- "Repeat" toggle. When on: count stepper appears inline

**Set section** (visible only when `round.enabled` is true)
- Subtle visual differentiation (slightly different background shade)
- "Rest between" label + stepper (always seconds)
- "Repeat" toggle. When on: count stepper appears inline

**Block section** (visible only when `set.enabled` is true)
- Same subtle shade as Set or one step deeper
- "Rest between" label + stepper (always seconds)
- "Repeat" toggle. When on: count stepper appears inline

**BPM row** (always visible at bottom)
- "BPM +{bpmIncrease} every" label + segment control: `[round | set | block | off]`
- Hidden when `bpmIncrease` is 0

### Interaction

- Toggling Round repeat off also hides Set and Block sections (and sets `set.enabled` and `block.enabled` to false on commit)
- Toggling Set repeat off also hides Block section (and sets `block.enabled` to false on commit)
- All steppers use the existing ref+state inline-edit pattern (onFocus/onChange/onBlur commit)
- Minimum values: playDuration ≥ 1, restDuration ≥ 0, all counts ≥ 2, all restDurations ≥ 0

### Progress Display

Shown above the card fields during playback (same as today):
- Elapsed time
- Progress bar for current segment
- Labels: only show levels that are active
  - Always: "Round N / total"
  - If `round.enabled`: "Set N / total"
  - If `set.enabled`: "Block N / total"

---

## expandSession Change

The routine resolver in `expandSession.ts` is rewritten using three nested loops:

```
crossings = 0
effectiveBpm() = clampBpm(session.bpm + crossings * session.bpmIncrease)

blockPasses  = block.enabled ? block.count : 1
setPasses    = set.enabled   ? set.count   : 1
roundPasses  = round.enabled ? round.count : 1

for b = 0..blockPasses-1:
  for s = 0..setPasses-1:
    for r = 0..roundPasses-1:
      emit play segment at effectiveBpm()
      isLastRound = r === roundPasses-1
      if !isLastRound: emit rest segment (restDuration)
      else if !isLastSet or !isLastBlock: emit rest segment (restDuration)
      if bpmIncreaseAt === "round": crossings++
    isLastSet = s === setPasses-1
    if set.enabled and !isLastSet: emit set.restDuration rest
    if bpmIncreaseAt === "set": crossings++
  isLastBlock = b === blockPasses-1
  if block.enabled and !isLastBlock: emit block.restDuration rest
  if bpmIncreaseAt === "block": crossings++
```

BPM starts at `session.bpm` for the first segment and increases by `session.bpmIncrease` each time the chosen boundary is crossed. Round 1 / Set 1 / Block 1 always plays at the base BPM.

Play duration in bars is converted to seconds using `barsToSec(bars, meter, bpm)`. Play duration in seconds is used directly.

---

## Migration

`migrateLegacy` and `clampSession` must handle the old `RoutinePattern` shape gracefully. If a stored session has the old fields (`barsPerLevel`, `numLevels`, etc.), migrate to the new shape with sensible defaults rather than crashing.

---

## Edit Page

The routine-related fields in the Edit page are removed. The Edit page is not the primary configuration surface for the routine — the Practice card is.

---

## Files

- **Modify:** `src/types.ts` — replace `RoutinePattern`
- **Modify:** `src/session.ts` — update `createDefaultSession`, `clampSession`, `migrateLegacy`
- **Modify:** `src/expandSession.ts` — rewrite routine resolver
- **Modify:** `src/Practice.tsx` — replace `routine-timer` block with new card JSX; add new ref/state pairs
- **Modify:** `src/app.css` — update routine card styles
- **Test:** `src/expandSession.test.ts` — update/add routine expansion tests
- **Modify:** `src/BpmSheet.tsx` — remove the routine-specific step/derived-target block (lines ~158–180); routine config now lives entirely in the Practice card
- **Test:** `src/Practice.test.tsx` — update routine card rendering and interaction tests
