# Complex uses the same BPM increase

Complex raises the BPM on each cycle or on each round, the same choice Simple already has. The cycles are the group Simple builds by repeating an interval. Repeat the round repeats that group. Every is no longer used.

This replaces the Complex Every behavior in `2026-10-27-simple-increase-design.md`.

## Goals

- Complex shows the same BPM increase card as Simple: the amount, then Interval or Round.
- The cycles are one group. That group is what Repeat interval produces in Simple. Cycles can still be added, removed, and moved up and down.
- Repeat the round repeats the group. Off means the group plays once. On shows Rounds and Between.
- An interval climb steps once per cycle and restarts when the round repeats. A round climb holds one BPM for every cycle in the group, then steps on the next round.
- A cycle that already has its own BPM keeps that BPM.
- Between replaces the rest of the last cycle of a round that is not the last round. The session still does not end on a rest.

## Non-goals

- Repeat interval or Times on Complex. The cycle group is those repeats, written out.
- A second increase amount. There is still one BPM increase.
- Changing Simple's own pattern, count-in, the 300 cap, or the practice page layout.
- Deleting the stored `every` field. Old documents still load it. Playback and the editor do not read it.

## What Complex stores

`Session` gains `complex`:

```ts
{
  increaseEvery: "interval" | "round"
  repeatRound: boolean
  rounds: number
  restBetweenSec: number
}
```

A missing or unknown `increaseEvery` loads as `"interval"`. Fresh Complex uses `"interval"`, `repeatRound: false`, `rounds: 2`, and `restBetweenSec: 30`. Turning a switch off keeps the stored numbers.

Simple keeps its own `increaseEvery` and repeat-the-round fields. The two modes do not share those values, except for the switch described below.

## Playback

One round is one pass through the cycle group. Repeat the round off means one round. Both indexes start at 0.

```
step = cycle index within the round, when increaseEvery is "interval"
step = round index, when increaseEvery is "round"
played BPM = cycle.bpm, when that cycle has its own BPM
played BPM = min(300, session BPM + BPM increase × step), otherwise
```

A cycle keeps its own rest. The last cycle of a round that is not the last round uses Between instead. The last cycle of the session uses rest 0. Count-in stays four beats in 4/4 at the played BPM.

## Examples

Three cycles, session BPM 80, increase 5, and no cycle has its own BPM.

Interval, one round: 80, 85, 90.

Interval, the round repeated twice: 80, 85, 90, then 80, 85, 90.

Round, three rounds: 80, 80, 80, then 85, 85, 85, then 90, 90, 90.

## Editor

The increase card is the same for both types. It shows BPM increase, then the group Increase every, with Interval and Round. Every is not shown.

The Complex bottom card holds the cycle group in a raised sub-card. That sub-card is not titled Interval. It holds the cycles and Add cycle. Up, Down, and Remove stay on each cycle. Repeat the round sits outside that sub-card, with Rounds and Between when it is on. Total stays on the outer card.

## Switching

On a visit that opened as Simple, choosing Complex turns one round of the repeated intervals into the cycle group:

- One cycle for every practice that would play in a single round, in that order. Practices and Times are both included. Two practices repeated three times become six cycles.
- Each of those cycles copies the practice length and rest after. Between stays on Repeat the round and is not baked into a cycle.
- Copies `increaseEvery`, `repeatRound`, `rounds`, and `restBetweenSec` from Simple onto `complex`.
- Does not set a cycle BPM.

Interval mode then steps once per cycle. Simple practices that shared a BPM inside one interval become neighboring cycles, so they climb one by one after the switch.

A visit that opened as Complex is unchanged. Simple shows a fresh pattern and does not delete the cycles or `complex`. Switching back before Done restores them. Done on Complex saves `complex` and sets Simple to a fresh pattern. Done on Simple saves Simple, replaces the cycles through the existing Simple expansion, and sets `complex` back to fresh.

## Practice page

Editing the BPM of a Complex segment that follows the session tempo sets the session BPM so that segment plays the typed number:

```
session BPM = typed − BPM increase × step
```

`step` is the same step playback uses for that segment. A segment whose cycle has its own BPM still edits that cycle BPM. Simple is unchanged. The practice page layout is unchanged.

## Tests

- Interval, 3 cycles, 1 round: 80, 85, 90. Each earlier cycle keeps its rest. The last rest is omitted.
- Interval, 3 cycles, 2 rounds: 80, 85, 90, 80, 85, 90. Between replaces the rest after the third cycle of the first round.
- Round, 3 cycles, 3 rounds: 80, 80, 80, 85, 85, 85, 90, 90, 90.
- A cycle with its own BPM plays that BPM. The others still follow the step.
- A played BPM above 300 is played as 300.
- A document without `complex.increaseEvery` loads as interval.
- Both types show Increase every and hide Every.
- Complex shows Repeat the round outside the cycle group. Turning it on shows Rounds and Between. The cycle group is not titled Interval.
- A Simple visit with 2 practices and Times 3 switches to 6 cycles, copies the round settings, and sets no cycle BPM.
