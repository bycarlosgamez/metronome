# BPM Card Redesign

## Goal

Redesign the BPM card on the Practice page for clearer visual hierarchy and better touch targets, while preserving all existing functionality.

## Current State

The BPM card currently uses a left/right split layout (`bpm-endless`): large BPM number on the left, and a cramped right column stacking elapsed time, +/− steppers, and a tiny "More ›" link. The elapsed time lives on the BPM card.

## Design

### BPM Card Layout (Option C)

Three clearly separated zones, top to bottom:

1. **Display zone** — top section with padding
   - Large BPM number (52px, bold) — tappable/editable inline, same as today
   - "BPM" label top-right

2. **Action zone** — full-width −/+ stepper bar, separated by a 1px border
   - `−` on the left, `+` on the right, equal width, easy to tap
   - Separated from the display by a divider line

3. **Overflow zone** — "More ›" link in its own row, separated by a 1px border
   - Opens the BpmSheet (target BPM, step, ramp settings)
   - Clearly secondary — visually separated so it can't be accidentally tapped with the stepper

### Elapsed Time

Moves from the BPM card to the play controls area, **above the Play button**. Only shown during playback (same condition as today: `isPlaying`). Hidden when stopped. This is semantically correct — elapsed time is a playback concept, not a tempo concept.

### What Does Not Change

- BPM number is still an editable input (tap to type, blur/Enter to commit)
- +/− steppers adjust `session.bpm` by 1 each tap
- "More ›" still opens `BpmSheet`
- Time Sig and Subdiv pick buttons remain in the right column (`pick-col`), unchanged
- Routine mode: no elapsed on BPM card (already the case); routine timer block shows its own elapsed

## Files

- **Modify:** `src/Practice.tsx` — restructure BPM block JSX; move elapsed to play controls
- **Modify:** `src/app.css` — replace `.bpm-endless` layout with new three-zone layout (`.bpm-top`, `.bpm-step-bar`, `.bpm-more-bar`); remove now-unused `.bpm-endless*` rules
