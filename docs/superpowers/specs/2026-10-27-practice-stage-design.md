# Practice stage

A new session opens as Time. On the practice stage the clock comes first, then two square buttons, then BPM, then the beat dots, then the transport.

This updates `2026-10-27-time-signature-design.md`. A new session is Time, not Simple. The practice page no longer shows labeled selectors. Quintuplets and sextuplets are subdivisions. The editor keeps its labeled Time signature, Subdivision, and slot row, and gains the two new subdivisions.

## Goals

- A fresh session has `type: "time"`, meter `"4/4"`, and subdivision `"quarter"`.
- A saved session still opens as the type it stored.
- The practice stage, from top to bottom, is the title, the clock, the two buttons, BPM, the beat dots, then Previous, Play, Next, and Reset.
- The two buttons have no visible captions. They are equal squares with rounded corners, in one centered row.
- The left button shows the time signature, `4/4` until it changes.
- The right button shows a note icon, a quarter note until it changes.
- Tapping a button opens a panel under it. The button updates as the choice changes.
- The beat dots stay one per beat. They wrap when the bar is wide.

## Non-goals

- Restyling the editor into these buttons.
- Removing the editor's per-slot click row.
- A bottom number other than 1, 2, 4, or 8.
- A subdivision other than quarter, eighth, triplet, sixteenth, quintuplet, or sextuplet.
- Letting the bottom number change the click speed.
- Subdividing the count-in.
- Moving the transport out of the stage, or moving the strip.
- Deleting the stored `click` field.

## Default session

`createDefaultSession` sets `type` to `"time"`. Meter, subdivision, slots, BPM, and `time` stay as they are: `"4/4"`, `"quarter"`, `["click-1"]`, 80, and a 2:00 Time pattern. Opening Edit on that new session follows the existing Time-opened visit rules.

A document that already stores `"simple"` or `"complex"` still loads as that type.

## Practice stage

During a play or a count-in, the order inside the stage is:

1. The segment title.
2. The clock.
3. A row of two buttons.
4. BPM.
5. One dot per beat.
6. Previous, Play, Next, and Reset.

During a rest, the two buttons, BPM, and the dots stay hidden, as the signature controls do now. The next-up line and the transport stay.

The buttons share one size. The corners are rounded, not a circle and not a pill. They use the stage color: a translucent dark fill, light text and icon, like the beat dots. The left button's accessible name is Time signature. The right button's accessible name is Subdivision. No visible word "Time signature" or "Subdivision" appears on the practice stage, and the practice stage does not show the slot row.

### Time signature panel

The left button's text is the stored meter, such as `4/4` or `7/8`.

The panel offers Beats, 1 through 16, and Note, 1, 2, 4, or 8. Those selectors keep the accessible names Beats and Note. Choosing either number writes the meter immediately, and the button shows the new text while the panel is open. The panel closes on a click outside it or on Escape.

### Subdivision panel

The right button shows one icon, in the current text color:

- Quarter: a quarter note.
- Eighth: an eighth note.
- Triplet: an eighth note with a 3.
- Sixteenth: a sixteenth note.
- Quintuplet: an eighth note with a 5.
- Sextuplet: an eighth note with a 6.

The panel lists those six choices, each with its icon and its name: Quarter, Eighth, Triplet, Sixteenth, Quintuplet, Sextuplet. Choosing one writes that subdivision, fills every slot with the stored `click`, closes the panel, and the button shows the new icon.

## Subdivisions

```ts
subdivision: "quarter" | "eighth" | "triplet" | "sixteenth" | "quintuplet" | "sextuplet"
```

The slot counts are 1, 2, 3, 4, 5, and 6. Playback already splits a beat into equal slots, so five and six use that same walk. The count-in stays four beats of the stored click, with no inner slots.

An unknown subdivision still loads as quarter. A short or long `slots` list is still resized to the subdivision.

The editor's Subdivision selector adds Quintuplet and Sextuplet. Its slot captions are:

- Quintuplet: 1, ta, ka, di, mi
- Sextuplet: 1, ta, la, ta, li, ta

The accessible names stay the caption plus "click", such as "ta click". Beat still has no caption.

## Tests

- A fresh session is type Time, meter 4/4, subdivision quarter.
- A saved Simple session still loads as Simple.
- The practice stage order is the clock, then a button named Time signature whose text is `4/4`, then a button named Subdivision, then BPM, then the beat dots, then Play.
- The practice stage does not show the words Time signature or Subdivision as captions, and it does not show a Beat click selector.
- Choosing beats 7 and note 8 in the time-signature panel stores `"7/8"` and the button reads `7/8`.
- Choosing Quintuplet stores `"quintuplet"`, fills five slots with the current click, and the button shows the quintuplet icon.
- The count-in is still four clicks with no inner slots.
- A 16/8 play still shows 16 beat dots.
