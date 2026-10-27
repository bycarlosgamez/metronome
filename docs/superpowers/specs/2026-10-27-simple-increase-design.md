# Simple BPM increase

Simple can raise the BPM on each interval or on each round. Repeating the other level plays that pattern again from the session BPM. Complex now uses that same choice; see `2026-10-27-complex-increase-design.md`.

## Goals

- Beside BPM increase, Simple offers Interval or Round.
- Practices inside one interval share one BPM.
- An interval climb restarts when the round repeats.
- A round climb holds one BPM for every interval in that round, then steps on the next round.
- Switching from Simple to Complex keeps the tempos that would have played.

## Non-goals

- A second increase amount. There is still one BPM increase.
- Changing how Complex climbs. That choice is specified in `2026-10-27-complex-increase-design.md`.
- Changing rests, count-in, the 300 cap, or the practice page.

## What Simple stores

`SimplePattern` gains `increaseEvery: "interval" | "round"`. A missing or unknown value loads as `"interval"`. Fresh Simple uses `"interval"`. A saved Simple session that used to keep climbing through later rounds now restarts each round when the choice is Interval.

Interval means one pass through the practices. Repeat interval off means one interval. Repeat the round off means one round. The stored Times and Rounds stay when a switch is off.

The played BPM for an interval is:

```
step = interval index within the round, when increaseEvery is "interval"
step = round index, when increaseEvery is "round"
played BPM = min(300, session BPM + BPM increase × step)
```

Both indexes start at 0. An increase of 0 makes both choices sound the same.

Expansion order stays rounds, then intervals, then the practices in the interval. Rest after, Between, and the final rest of 0 stay as they are.

## Examples

Session BPM 80, increase 5, one practice per interval.

Interval, three interval repeats, one round: 80, 85, 90.

The same pattern with the round repeated twice: 80, 85, 90, then 80, 85, 90.

Round, three interval repeats, three rounds: 80, 80, 80, then 85, 85, 85, then 90, 90, 90.

Three practices in the interval share the interval BPM. Interval, two interval repeats, one round: 80, 80, 80, then 85, 85, 85.

## Editor

The choice sits in the BPM increase row, only while Simple is selected. The group name is Increase every. The buttons are Interval and Round. The pressed button uses the same selected style as Simple and Complex.

Complex no longer keeps Every in that row. The later Complex spec gives it the same Interval and Round choice.

## Switching to Complex

The later Complex spec replaces this switch. It turns one round of the repeated intervals into the cycle group, including Times, and copies the round settings.

## Tests

The Complex lines below describe the behavior this spec originally required. `2026-10-27-complex-increase-design.md` replaces them.

- Interval, Times 3, one round, one practice: 80, 85, 90.
- That pattern with Rounds 2: 80, 85, 90, 80, 85, 90.
- Round, Times 3, Rounds 3, one practice: 80, 80, 80, 85, 85, 85, 90, 90, 90.
- Interval, Practices 3, Times 2, one round: 80, 80, 80, 85, 85, 85.
- A played BPM above 300 is stored and played as 300.
- A document without `increaseEvery` loads as interval.
- Simple shows Increase every and hides Every. Complex shows Every and hides Increase every.
- Simple to Complex on the restarted round writes the restarted BPMs onto the cycles that differ from the ladder, and leaves the others without their own BPM.
