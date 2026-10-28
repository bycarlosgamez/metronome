# Time signature and subdivision

The type pills lead with Time. The meter becomes a time signature made of two numbers, and each slot of a subdivision has its own click.

This updates the type-pill order in `2026-10-27-time-session-design.md`. A new session still opens as Simple.

## Goals

- The type pills read Time, Simple, Complex.
- The label is Time signature, on the tempo card and on the practice page.
- The top number and the bottom number are chosen separately.
- A subdivision can split each beat, and each slot has its own click.
- The stage still shows one dot per beat in the bar.

## Non-goals

- A bottom number of 16, or any bottom number other than 1, 2, 4, and 8.
- Quintuplets, sextuplets, or any subdivision other than the beat, eighths, triplets, and sixteenths.
- Letting the bottom number change the click speed. The BPM is already one beat.
- Subdividing the count-in.
- Moving the stage, the transport, or the strip.
- Deleting the stored `click` field. Old documents still load it.

## Time signature

The control is two selectors with a slash between them. The group is named Time signature. The first selector is Beats. The second is Note.

Beats is an integer from 1 to 16. Note is 1, 2, 4, or 8. The stored value stays a string such as `"4/4"` or `"7/8"`.

A fresh session is 4/4. A saved 3/4, 5/4, 6/8, or 7/8 still loads. A top number outside 1–16, or a bottom number other than 1, 2, 4, or 8, loads as 4/4.

The top number is how many beats are in a bar. Beat 1 of the bar is the accent. The click spacing stays `60 / played BPM`. A bar's clock length stays `beats × 60 / played BPM`. 6/8 still clicks 6 times a bar. The count-in stays four beats in 4/4.

## Subdivision

A session stores a subdivision and one slot for each part of the beat:

```ts
subdivision: "quarter" | "eighth" | "triplet" | "sixteenth"
slots: ("click-1" | "click-2" | "click-3" | "click-4" | "off")[]
```

Quarter has 1 slot, eighth has 2, triplet has 3, and sixteenth has 4. A missing subdivision loads as quarter. Its one slot is the stored `click`. An unknown subdivision loads as quarter. A short or long `slots` list is resized to the subdivision: extra slots are dropped, and a missing slot is filled with `click`.

The selector is named Subdivision. Its choices are Beat, Eighth, Triplet, and Sixteenth. Beat is quarter. Choosing a subdivision replaces the row and fills every slot with `click`, so the new division is heard immediately.

Each slot is its own selector: Click 1, Click 2, Click 3, Click 4, or Off. The labels on the slots are:

- Eighth: 1, &
- Triplet: 1, trip, let
- Sixteenth: 1, e, &, a

Beat has one slot and no syllable label. The accessible name is Beat click. The other accessible names are the syllable, such as "& click".

Setting the Beat slot, the Eighth "1" slot, the Triplet "1" slot, or the Sixteenth "1" slot to a click also stores that click in `click`. Off does not change `click`.

## Where it appears

The tempo card shows Time signature, then Subdivision, then the slot row. The single Click selector is removed. The practice page shows the same three controls where the meter selector is now. The beat dots stay one per beat.

## Playback

One beat lasts `60 / played BPM`. The slots divide that beat into equal parts. A slot set to Off schedules no click. Any other slot schedules that click's normal pitch.

When the first slot of beat 1 has a click, that click plays its higher accent pitch. Every other sounding slot plays the normal pitch, including the first slot of later beats and every inner slot of beat 1. Off still plays nothing.

The count-in does not subdivide. Its four beats use the click stored in `click`, with the accent on the first of those four, as they do now.

The beat shown on the stage is the beat in the bar, from 1 to the top number. It changes when the next beat starts, not when an inner slot plays.

## Tests

- The type pills are Time, Simple, then Complex.
- Beats offers 1 through 16. Note offers 1, 2, 4, and 8. Choosing 16 and 8 stores `"16/8"`. A saved `"5/4"` stays `"5/4"`. A saved `"7/16"` loads as `"4/4"`.
- The tempo card and the practice page name the control Time signature and do not name it Meter.
- Beat at 80 BPM in 4/4 with Eighth, both slots Click 1, plays a click every 0.375 seconds. The click on beat 1 is the accent. The "&" is the normal pitch.
- Off on the "&" plays only the beat clicks.
- Choosing Triplet fills three slots with the stored click.
- The count-in is four clicks with no inner slots.
- The stage shows four dots in 4/4 while an eighth subdivision is playing.
