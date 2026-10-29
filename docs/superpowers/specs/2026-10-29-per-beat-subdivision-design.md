# Per-Beat Subdivision — Design

## Intent

Speed practice: the player wants the metronome to click exactly the grid they're playing when the subdivision changes inside a bar. Their example: in 4/4, beats 1 and 2 are triplets and beats 3 and 4 are 16ths, repeated every bar for about two minutes. Hearing that grid shows straight away when the change from triplets to 16ths rushes or drags.

## Decisions (from the conversation)

- **Part of the core subdivision setting, not a separate mode.** Each beat in the bar has its own subdivision. When every beat matches, the app behaves exactly as it does today.
- **The pattern is fixed for the whole session.** The same pattern plays every bar, in both Simple and Routine mode. A pattern that changes over a session, for example per Routine round, is out of scope.
- **Sheet UI** (approved via mockup):
  - The Subdivision sheet shows a row of beat tiles for the current meter (1 2 3 4 in 4/4). Each tile shows the beat number, the subdivision name, and one dot per click. The first dot marks the start of the beat.
  - Tapping a tile selects or deselects it, and several tiles can be selected at once. An "All beats" button selects every beat. When the sheet opens, all beats are selected.
  - The subdivision grid below (Quarter, Eighth, Triplet, 16th, Quintuplet, Sextuplet) applies the chosen subdivision to every selected beat. The grid highlights an option only when all the selected beats share it.
  - Tapping a dot mutes or unmutes that click. Choosing a new subdivision for a beat clears that beat's mutes and gives every click in it the session click sound.
  - The sheet no longer closes when you pick a subdivision, because you build a pattern in several taps. It closes the same way the other sheets do: the overlay, Escape, or the handle.

## Goals

- You can set any subdivision on any beat of the current meter.
- Muting individual clicks works per beat.
- Every saved session loads with every beat set to its old subdivision and its old slot pattern, so it sounds exactly as before.
- The Practice beat display shows each beat's own number of sub-dots, and the lit dot follows the clicks.

## Non-goals

- A pattern that changes during a session.
- Patterns that span more than one bar (polyrhythms).
- Changing the count-in. It stays one click per beat, as it is today.

## Anti-goals

- **Breaking existing sessions or the sound of today's uniform subdivisions.** A session where every beat matches must sound identical to the current app.
- **Hiding the simple case.** Picking one subdivision for the whole bar must still take two taps: open the sheet, pick an option (all beats are selected by default).

## Behaviour details (my calls; the user hasn't been asked about these)

- **Meter changes:** when the meter changes (e.g. 4/4 → 3/4 or 4/4 → 5/4), existing beats keep their subdivision and slots. Beats that drop off are discarded. New beats copy the last existing beat.
- **Defensive lookup:** if a segment ever has more beats than the pattern, beat *i* uses entry *i*, or the last entry if there aren't enough.
- **Click sound:** no screen currently changes `session.click`, so the slots' click sounds stay as they are. A new subdivision fills its clicks with `session.click`.
- **Accent:** unchanged. Every click within beat 1 is accented, as `clicksInSegment` does today.
- **Practice "Subdiv" button:** shows the shared icon when every beat matches, and a "Mixed" label when they differ. Its `aria-label` becomes `Subdivision: mixed` in that case.

## Constraints

- No backend; the session lives in `localStorage` (`store.ts`). Old saved data must load through `clampSession`.
- Click timing stays in `clock.ts` (`clicksInSegment`): each beat's duration divides evenly among that beat's clicks, at the BPM in effect at the start of the beat (the current rule).
- TDD with Vitest and Testing Library, following the repo's existing test style.

## Left to the builder

- **Data shape.** My suggestion is to replace `session.subdivision` and `session.slots` with `session.beats: { subdivision: Subdivision; slots: Slot[] }[]`, one entry per beat of the session meter, and to have `Segment` carry the pattern instead of the flat `slots`. Any shape that meets the goals and loads legacy sessions works.
- Where resizing happens. The meter only changes in `MeterSheet` (Practice), and its result already goes through `clampSession`, so resizing the pattern inside `clampSession` covers it.
- Exact styling of the beat tiles. Reuse the existing `.subdiv-opt` look and the design tokens.
