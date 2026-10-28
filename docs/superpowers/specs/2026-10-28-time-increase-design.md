# Time increase

A Time session starts with no climb and no end. The click continues until you stop it. Choosing a climb by time or by bars gives the session an end, and the tempo steps until that end.

This updates `2026-10-27-practice-stage-design.md` and the Time pattern in `2026-10-27-time-session-design.md`. On a Time session the practice stage has three square buttons, and the cards under the footer are absent. A fresh Time pattern is `"off"`.

## Goals

- A fresh Time pattern has `increaseEvery: "off"`. The amount, Every, and End stay stored.
- While Off, one tempo plays until you stop it. The stage clock counts up during that play.
- Choosing Time or Bars writes that mode, and the session ends at the stored End. The tempo climbs by the stored amount after each interval.
- The third practice button is BPM increase. Its panel sets the mode, and, for Time or Bars, the amount, Every, and End.
- The cards under the footer are absent only when the session type is Time. Simple and Complex keep them.
- A saved `"time"` or `"bars"` pattern still loads as that mode and still ends.

## Non-goals

- Hiding the cards for Simple or Complex.
- Showing the BPM increase button on Simple or Complex.
- A finite Time session with no climb, other than an amount of 0, which still ends and holds the tempo.
- Changing the count-in. It stays four beats in 4/4 and is not subdivided.
- Changing click spacing. One beat still lasts `60 / BPM` from the beat start, and a tempo window does not split a beat.
- Moving the transport, or deleting the stored `click` field.
- Restyling the editor's time signature, subdivision, or slot row.

## Stored pattern

```ts
increaseEvery: "off" | "time" | "bars"
```

`freshTime()` returns `seconds: 120`, `increaseEvery: "off"`, `everySec: 30`, and `everyBars: 4`. `bpmIncrease` stays `0`.

`"time"` and `"bars"` load unchanged. `"off"`, a missing value, and any unknown value load as `"off"`. That replaces the old rule that an unknown Time increase loaded as `"time"`.

Choosing Off keeps `bpmIncrease`, `everySec`, `everyBars`, and `seconds`. Choosing Time or Bars uses those stored values. Switching between Time and Bars keeps the end and both Every numbers. The unused Every number stays stored.

End is at least 1 second. Every is at least 1 second or 1 bar. The amount is a whole number of 0 or more. The played tempo is still `min(300, session BPM + amount × step)`.

## Practice stage

On a Time session the cards under the footer are absent, including during the count-in. Simple and Complex still render the strip, and a click on a card still seeks to that segment.

The footer keeps Elapsed and Set. Set is still the count-in, then the play. Left is shown only while the increase is Time or Bars. While Off, the footer has Elapsed and Set.

During a play or a count-in, the Time stage order is:

1. The segment title.
2. The clock.
3. A row of three buttons.
4. BPM.
5. One dot per beat.
6. Previous, Play, Next, and Reset.

The third button sits after Subdivision. It is the same square as the other two: rounded corners, translucent dark fill, light mark. It has no visible caption. Its accessible name is BPM increase. Its accessible description is Off, Time, or Bars.

The marks use the current text color:

- Off shows ∞.
- Time shows a clock, a circle with two hands.
- Bars shows two vertical barlines.

No visible word "BPM increase", "Off", "Time", or "Bars" appears on the button. The panel uses those words.

The panel opens under the row, in the document flow, in the same place as the time-signature and subdivision panels. One panel is open at a time. A click outside the panel, or Escape, closes it and leaves the stored mode as it is.

The panel lists Off, Time, and Bars. The current choice is pressed. Choosing Off writes `"off"` and closes the panel. Choosing Time or Bars writes that mode and leaves the panel open, with the three choices still visible. The open Time or Bars panel also has three fields:

- Amount, the stored `bpmIncrease`.
- Every, a clock when the mode is Time and a count when the mode is Bars.
- End, the stored `time.seconds`, shown as a clock.

Those fields write through immediately. Amount 0 still ends at End and holds the session BPM.

### Clock

The count-in clock counts down its four beats, whether the increase is Off or not.

During an Off play the clock counts up from 0:00. That clock is a display. Focusing it does not set an end. Its accessible name is Played, so it stays distinct from the footer Elapsed. The Off count-in clock counts down and is also a display. Focusing it does not set an end. Its accessible name stays Duration.

During a Time or Bars play the clock counts down the time left in the end, as the Time duration clock does today. It stays editable. Focusing it shows the stored end and writes `time.seconds`. Its accessible name stays Duration. The same seconds are what the panel calls End.

## Editor

On a Time session the increase choices are Off, Time, and Bars. Every and Duration are shown for Time and Bars, and hidden for Off. The amount field stays. Duration still writes `time.seconds`. The editor does not gain the practice-stage icons.

Simple and Complex keep Interval and Round.

## Playback

An Off session expands to one count-in and one play. The play has no end. Previous and Next move between those two segments. Next does nothing once the play has started. Reset returns to the count-in and stops.

The Off play places the next whole beats at their exact times, enough beats to cover at least the next 2 seconds. When less than 1 second of placed clicks remains, the following stretch is placed the same way. Each beat uses the BPM at its start. Editing BPM during an Off play keeps the elapsed time into the play, and the next beat uses the new BPM.

A Time or Bars session uses the existing step walk. The play stops at End. The count-in does not consume the end.

## Tests

- A fresh Time pattern is `"off"`, with end 2:00, Every 0:30 and 4, and amount 0.
- A saved `"time"` or `"bars"` pattern still loads as that mode. An unknown increase loads as `"off"`.
- A Time practice stage has no strip and has a BPM increase button. A Simple practice stage still has a strip and has no BPM increase button.
- While Off, the footer has Elapsed and Set, and Left is absent. After Time is chosen, Left is present.
- The third button is named BPM increase, describes Off, and shows ∞. Choosing Time writes `"time"`, leaves the panel open, and shows Amount, Every, and End. Choosing Off again closes the panel and keeps the stored end.
- The Off play clock is named Played, counts up, and does not write an end when focused. A Time play clock is named Duration, counts down, and writes the end.
- An Off session is a count-in plus one endless play. A later beat is placed after the first stretch, and the play does not stop on its own. The count-in is still four clicks.
- Amount 0 with Time selected holds the tempo and stops at the end.
