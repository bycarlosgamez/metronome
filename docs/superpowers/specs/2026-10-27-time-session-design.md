# Time session

Time is a third session type beside Simple and Complex. It plays one continuous stretch of a duration you set, and the BPM climbs by clock time or by bars.

## Goals

- The type control offers Simple, Complex, and Time.
- A Time session stores a duration, such as 2:00.
- Increase every offers Time or Bars, with a step size for each.
- Playback is one count-in and one play. The tempo changes inside that play. There is no rest.
- Done saves the type on screen. The other types go back to fresh patterns.

## Non-goals

- Practices, rests, rounds, or a cycle list on a Time session.
- A second BPM increase amount. The session still has one BPM and one BPM increase.
- Changing how Simple or Complex climbs, repeats, or expands.
- Changing the practice page layout. The stage, transport, and strip stay where they are.
- Deleting the stored `every` field. Old documents still load it. Playback and the editor do not read it.
- Look-ahead scheduling.

## What Time stores

`Session.type` is `"simple"`, `"complex"`, or `"time"`. `Session` gains `time`:

```ts
{
  seconds: number
  increaseEvery: "time" | "bars"
  everySec: number
  everyBars: number
}
```

A fresh Time pattern is 120 seconds, `increaseEvery: "time"`, `everySec: 30`, and `everyBars: 4`.

Loading clamps the pattern. `seconds` and `everySec` are integers of at least 1. `everyBars` is an integer of at least 1. A missing pattern loads as the fresh pattern. An unknown `increaseEvery` loads as `"time"` and the other fields still clamp. An unknown session type still loads as Simple. A saved Simple or Complex session with no `time` field keeps its type and gains the fresh Time pattern.

BPM stays an integer from 40 to 300. BPM increase stays an integer of 0 or more. The played tempo is never above 300. A bar still uses the session meter and the existing beat count. A bar's clock length is `beats × 60 / played BPM` at the tempo of the step it belongs to.

## Playback

A Time session expands to two segments: one count-in, then one play of `seconds`. The count-in is four beats in 4/4 at the first step's BPM. Its length is outside the duration. The play has no rest after it.

Inside the play, steps start at index 0.

```
played BPM = min(300, session BPM + BPM increase × step)
```

**Time.** Each step lasts `everySec` seconds, or the time still left when that is shorter. The next step starts as soon as the previous one ends.

**Bars.** Each step lasts `everyBars` bars at that step's BPM, or the time still left when that is shorter. A higher BPM makes each bar shorter, so more steps fit in the same duration. The play stops at `seconds` even when that cuts through a bar.

An increase of 0 holds the session BPM for the whole play. When the first step is already longer than the duration, the whole play stays at the session BPM.

The click does not pause between steps and does not play another count-in. Each step occupies its clock window, and a click uses the BPM of the window that contains it. The gap after a click is `60 / that BPM`. Beats keep counting across steps, and beat 1 of the meter stays the accent. A click that would fall after the play is not played.

## Examples

Session BPM 80, increase 5, duration 2:00, every 0:30. The play is 80, 85, 90, then 95, for 30 seconds each. The count-in is 3 seconds at 80 and is not part of the 2:00.

The same session with 2:10 left over plays 10 more seconds at 100.

Session BPM 80, increase 5, 4/4, every 4 bars, duration 18 seconds. The first four bars take 12 seconds at 80. The remaining 6 seconds play at 85 and stop inside that bar group.

Session BPM 290, increase 20, every 0:30, duration 2:00. The steps play 290, then 300, 300, and 300.

## Editor

Time is a third pill in the type group, in the same style as Simple and Complex.

The BPM increase card stays above the builder. While Time is selected, its pills are Time and Bars. Simple and Complex still show Interval and Round.

Time shows an Every clock under the pills. It starts at 0:30. Bars shows an Every count under the pills. It starts at 4. Choosing the other pill keeps the number that is hidden.

The Time builder is a Duration field, default 2:00, and the calculated Total. It has no interval sub-card, cycle list, or Repeat the round. Total is the count-in plus the duration. A 2:00 session at 80 BPM shows 2:03.

## Switching

The editor remembers the type it opened with. Switching before Done does not replace that type's pattern. Choosing the opened type again shows it. The first visit to another type installs the preview described below. A later visit in the same edit keeps the edits made on that preview, except for the Simple-to-Complex rebuild.

A few switches keep the rules they already have:

- A visit that opened as Simple still rebuilds the cycle group from Simple every time Complex is chosen.
- A visit that opened as Complex still shows a fresh Simple on the first visit to Simple, and it does not delete the cycles or `complex`.
- The first visit to Time, from either of those, installs the fresh Time pattern. Time is not derived from the practices or the cycles.

A visit that opened as Time follows the same preview rule. The first visit to Simple installs a fresh Simple pattern. The first visit to Complex installs a fresh Complex pattern and one cycle of 2:00 with a rest of 0:30 and no cycle BPM.

Done on Time saves `time`, sets Simple and Complex to fresh patterns, and replaces the cycle list with that one fresh cycle. It does not write the tempo steps into cycles. Done on Simple still saves Simple, replaces the cycles through the Simple expansion, and sets Complex to fresh. It also sets `time` to fresh. Done on Complex still saves Complex and the cycles, and sets Simple to fresh. It also sets `time` to fresh.

Opening Edit still stops playback and resets the elapsed time.

## Practice page

The strip shows the count-in and the one play. Previous and Next move between those two segments. Set shows the segment index over that count, so a Time session reads 1 / 2 and then 2 / 2.

During the play, the stage clock counts down the whole duration. The BPM on screen is the step that is sounding, and it changes when the next step starts. The count-in shows the first step's BPM.

Focusing the duration shows the stored duration, including during the count-in. Committing it writes `time.seconds`. Committing a BPM writes the session BPM so the step on screen keeps the typed number:

```
session BPM = typed − BPM increase × step
```

`step` is the step sounding now. The count-in uses step 0. The meter control still edits the session meter.

## Tests

- 2:00 at 80, increase 5, every 0:30 plays 80, 85, 90, 95 for 30 seconds each. There is one count-in of 3 seconds and no rest. The count-in is outside the 2:00.
- 2:10 with those same settings plays 10 more seconds at 100.
- 4/4, 80, increase 5, every 4 bars, duration 18 seconds plays 12 seconds at 80 and 6 seconds at 85.
- A step that would pass 300 plays at 300.
- Increase 0, and an Every longer than the duration, each hold the session BPM for the whole play.
- A document without `time` loads the fresh pattern and keeps its Simple or Complex type.
- Time shows Duration, Every, and the Time and Bars pills. It hides the cycle list and Repeat the round. Total for 2:00 at 80 is 2:03. Choosing Bars keeps 0:30 stored, and choosing Time again shows it.
- A Simple visit that switches to Time and back keeps the Simple pattern. Done on Time saves Time and replaces Simple, Complex, and the cycles with fresh patterns.
- The practice page shows one play. Typing the BPM of a later step keeps that number on screen and moves the session BPM by the step.
