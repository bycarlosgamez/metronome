# Routine BPM Increase Design

## Why

Two real practice routines don't fit the current Routine mode:

1. **Per round, reset each set.** Start at 110 BPM, play 2:00, rest 0:15, go up 5 BPM every round. Repeat that set 4 times, and **every set starts back at 110**.
2. **Climb to a target, reset each repeat.** Start at 80 BPM, go up 4 BPM every 30 seconds until 125, play 125 for one more 30-second step, then stop. Repeat that twice, and **every repeat starts back at 80**.

Today's Routine can't do either. The BPM increase never resets: it keeps counting across sets. Routine mode also has **no place to set the step**. The "BPM +N every…" row only shows when `bpmIncrease > 0`, and the only step input lives in Simple mode. On top of that, the three levels (Round / Set / Block) are confusing, and nobody needs Block.

## Goals

- Routine mode gets its own BPM increase, with three choices: **Off / Per round / To target**.
- **Per round** adds a step after each round. When a new set starts, the BPM follows a choice: **Reset** (back to Start, the default), **Keep** (continue from where the last set ended) or **+N** (each set starts N above the previous set's start).
- **To target** climbs inside each play, from Start to Target, one step every N bars or N seconds. It holds Target for one step and then the play ends. Every repeat starts back at Start.
- The BPM card shows **Start** (editable) and, while an increase is on in Routine, the **current BPM** (read-only).
- Remove the **Block** level.

## Non-goals

- No redesign of the BPM card or the routine card. Change only what's listed here.
- No changes to how Simple mode behaves or looks.
- Round and Set keep their names. ("Rep" was considered and dropped to keep the change small.)

## Anti-goals

- Changing a Routine increase setting must not change Simple's Target/Step, and vice versa.
- Don't make the current BPM editable or let it look like an input.

---

## Behavior

### Per round

Let `start` be the session BPM, `step` the per-round step, `r` the round index within a set (0-based) and `s` the set index (0-based).

- Round BPM = `setStart(s) + r × step`, clamped to the BPM range.
- `setStart(s)` depends on **Next set BPM**:
  - **Reset** (default): `start`
  - **Keep**: the BPM the next round would have had if the sets were one continuous run, i.e. `start + s × roundsPerSet × step`. This matches today's `bpmIncreaseAt: "round"`.
  - **+N**: `start + s × N`
- Each round's play lasts the round's Play duration, as it does today.

Example 1 (start 110, step 5, 4 rounds, 4 sets, Reset): every set plays 110, 115, 120, 125.

### To target

- Each play is a climb: `start`, `start + step`, … capped at `target`. Each BPM lasts one **Every** window. Every is in bars when the routine's Duration is Bars and in seconds when it's Time. A bars window is `every × beatsPerBar × 60 / bpm` at that step's BPM.
- The target BPM gets one full window too, and then the play ends. The play length is computed from this, so the routine's **Play** setting doesn't apply in this mode.
- Every round, and every set, starts back at `start`. The Next set BPM setting doesn't apply.
- Example 2 (start 80, step 4, every 30 s, target 125): 80, 84, …, 124, 125. That's 13 windows × 30 s = **6:30** per play.
- If `step` is 0 or `start ≥ target`, the play is a single window at `start`.

### Rests

Rests work as they do today: the round rest after each round, plus the set rest between sets. Rest segments carry the BPM of the play they follow. Remove Block's rest.

### Count-in

Unchanged. It counts in at the first play's starting BPM.

---

## UI

The mockups are in `.superpowers/brainstorm/` (routine-layout-v4/v5). These are the changes:

### BPM card (Practice.tsx)

- The big number on the left is **Start BPM**. It stays editable as it is today (typing, −/+). Change its label from "BPM" to "Start BPM" **in Routine mode only**.
- **Simple:** the right side is unchanged (Target + Step, editable, shown when increase is on).
- **Routine, increase on (Per round or To target):** the right side shows the current BPM as a number with the label **NOW** under it. It's read-only, has no border, and is styled like the Target value but isn't an input.
- **Routine, increase off:** the right side is empty.

### BPM popup ("More", BpmSheet.tsx), Routine mode

Add an **Increase** card (Routine's counterpart to Simple's "Increase to target" card):

- A segmented control: **Off / Per round / To target**.
- **Per round:** a **Step** field and **Next set BPM: Reset / Keep / +N**. When +N is picked, a number field for N appears.
- **To target:** **Target BPM**, **Step**, and **Every** (shows "bars" or "sec" to match the routine's Duration unit).

### Routine card

- Remove the **Block** section and the **"BPM +N every round/set/block/off"** row.
- In **To target** mode, the Round **Play** row shows the computed play length and can't be edited.
- The progress line drops Block: "Round 3/4 · Set 2/4".

---

## Data

Routine's increase settings are stored separately from Simple's (`session.time.*`, `session.bpmIncrease`). This is how the anti-goal above is enforced. Start BPM (`session.bpm`) is shared by both modes, as it is today.

The shape is up to the builder. Something like:

```ts
routine.increase: {
  mode: "off" | "round" | "target"
  step: number
  nextSet: "reset" | "keep" | "raise"
  raiseBy: number
  targetBpm: number
  every: number   // bars or seconds per routine.unit
}
```

Remove `block` and `bpmIncreaseAt` from `RoutinePattern`. `clampSession` must still load old saved sessions:

- `bpmIncreaseAt: "round"` → mode `round`, step = old `bpmIncrease`, nextSet `keep` (this keeps the old behavior)
- `bpmIncreaseAt: "set"` → mode `round`, step 0, nextSet `raise`, raiseBy = old `bpmIncrease` (this keeps the old behavior)
- `bpmIncreaseAt: "block"` or `"off"` → mode `off`
- Saved `block` settings are dropped. Those routines play without the block repeat.
- The legacy `type: "time"` migration should map to mode `target` (start, target, step, every N bars), with round repeat off. It no longer needs the "one round per level" workaround.

---

## Calls made during design (not stated by the user)

- **NOW during a rest** shows the BPM of the **next** play, so you can get ready for it.
- **NOW when stopped** shows the BPM the routine will start at.
- In To target, Next set BPM doesn't apply. It always resets.
- To target's Every follows the routine's Bars/Time switch instead of having its own unit.
- Routine increase settings are stored separately from Simple's.
- Old routines that used Block play without it.
- Next set BPM is hidden in the popup when Set repeat is off.
- In To target with Duration = Bars, the round rest's length in bars is converted using the BPM the play ended at (Target).
- Editing Start or an increase setting during playback keeps today's behavior: the segments are rebuilt at the same elapsed time, with no re-anchoring.
- The spec's Off / Per round / To target replaces mockup v5's Off/On toggle.
- Defaults for the new fields: mode Off, step 5, nextSet Reset, raiseBy 2, target 120, every 4 bars / 30 s.

## Left to the builder

- The exact data shape and field names.
- How the computed Play length is shown in To target with Duration = Bars (total bars or MM:SS).
- How the playback steps inside a To target play are expressed (the existing `Segment.steps` already supports BPM steps inside one play).

## Tests to update / add

- `expandSession.test.ts`: Per round with Reset / Keep / +N. To target with seconds and with bars, including the final hold window and the reset each repeat. Block is gone.
- `session.test.ts`: legacy migration for every old `bpmIncreaseAt` value and for `type: "time"`.
- `Practice.test.tsx` / BpmSheet: the Routine Increase card, NOW on the BPM card (shown and hidden), the Play row locked in To target, and Block removed.
