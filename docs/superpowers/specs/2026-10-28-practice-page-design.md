# Practice Page Redesign — Design Spec

**Date:** 2026-10-28  
**Status:** Approved

---

## Overview

Redesign the Practice page to make the metronome's core controls clearer and more musical. The beat grid is the hero. BPM is a dedicated, prominent block. Popups become bottom sheets. The timer steps back and only appears when relevant.

Primary use is desktop web, but the layout must be responsive for mobile.

---

## Layout

Three vertical zones inside a centered frame (max-width ~720px):

1. **Beat grid** — hero, top of body
2. **BPM block** — full-width card, tappable to open BPM sheet
3. **Two buttons** (Meter / Subdivision) + **Play controls** below

Header: session name left, "Edit" link right.  
No footer. No strip navigation (time sessions don't have segments).

---

## Beat Grid

- One column per beat in the current meter numerator (e.g. 4 columns for 4/4).
- Each beat is a large square (~72px), numbered, rounded corners.
- Beat 1 is the accent beat — slightly brighter border when idle, white flash when struck.
- Non-accent beats flash green when struck.
- Below each beat square: a row of small circles, one per subdivision. Active subdivision dot lights up in indigo on its tick.
- Dots are always visible (idle state shows them dimmed).

---

## BPM Block

Full-width tappable card that opens the BPM bottom sheet. Two states:

**Endless mode** (no BPM increase):
- Large current BPM number (left, ~52px font)
- Label: "BPM · endless"
- Elapsed time (right, quiet, counts up while playing)
- "Tap to edit ›" hint

**Ramping mode** (BPM increase active):
- Large current BPM (left)
- Label: "BPM · +N every Xs" (or "every N bars")
- Target BPM in muted green (right, smaller)
- Progress bar from start BPM → target BPM, with gradient fill
- Below bar: start label left, "next ↑ in X:XX · elapsed X:XX" center, target label right

No dedicated timer section. Elapsed time lives inside the BPM block.

---

## BPM Increase — Data Model Change

**Current model:** user sets duration (`time.seconds`); the session ends when time runs out.

**New model:** user sets Target BPM; duration is derived.

Fields in the BPM sheet:
- **Start BPM** — existing `session.bpm`
- **Target BPM** — new field `session.time.targetBpm: number`
- **Step** — existing `session.bpmIncrease`
- **Every** — time or bars (existing `everySec` / `everyBars`)
- **Mode** — Off / Time / Bars (existing `increaseEvery`)

When mode is Off: session runs forever (`durationSec: POSITIVE_INFINITY`).  
When mode is Time or Bars: `durationSec` is derived as `Math.ceil((targetBpm - bpm) / bpmIncrease) * everySec` (or bar equivalent). The UI shows "Estimated duration ~X:XX" as a read-only derived value.

`time.seconds` becomes an internal derived field, not user-set. `targetBpm` replaces it as the user-facing goal.

### TypeScript changes needed:
- `TimePattern`: add `targetBpm: number` (default: `bpm + 40` or similar)
- `expandSession.ts`: compute `durationSec` from `(targetBpm - bpm) / bpmIncrease * everySec`
- `session.ts`: update `freshTime()`, `clampSession()`, `timeSteps()`

---

## Two Buttons (Meter & Subdivision)

Full-width row, two equal buttons. Each shows current value and a label.

**Meter button:** shows `4/4` (numerator / denominator). Opens Meter sheet.

**Subdivision button:** shows the current subdivision symbol. Opens Subdivision sheet.

Subdivision symbols:
- Quarter → `♩`
- Eighth → `♪`
- Triplet → `3`
- Sixteenth → `16`
- Quintuplet → `5`
- Sextuplet → `6`

---

## Subdivision Icons

Unicode music characters as the base icon, with a small number badge for subdivisions that don't have a Unicode equivalent:

| Subdivision | Icon | Badge |
|---|---|---|
| Quarter | ♩ | — |
| Eighth | ♪ | — |
| Triplet | ♪ | 3 |
| 16th | ♪ | 16 |
| Quintuplet | ♪ | 5 |
| Sextuplet | ♪ | 6 |

The badge sits top-right on the icon — same approach used by Pro Metronome and Soundbrenner. It communicates both note type (eighth) and grouping (3), which plain text alone does not. `NoteIcon.tsx` is not used for this — replaced by a simple CSS+Unicode implementation.

---

## Subdivision Sheet

Bottom sheet with six options. Each shows the icon (with badge if applicable) above a text label. Selected option gets the purple highlight.

The subdivision button on the main screen shows the same icon at a smaller size.

---

## Meter Sheet

Bottom sheet with two number pickers (numerator / denominator) separated by `/`. Simple spinners or tap-to-edit inputs.

---

## BPM Sheet

Bottom sheet in two sections:

1. **Start BPM** — large input with +/− steppers
2. **Increase to target** — toggle: Off / Time / Bars  
   When On: Target BPM input (highlighted green), Step input, Every input (time or bars depending on mode)  
   Derived: "Estimated duration ~X:XX" read-only line at bottom

---

## Play Controls

Centered below the two buttons:

- **Play/Pause button** — large circle (~72px). Green with ▶ when stopped/paused; red with ❚❚ when playing.
- **Stop** — small text link below the circle: "■ Stop". Resets position to beginning.

No forward/backward buttons.

---

## NoteIcon Component

`NoteIcon.tsx` is unchanged and continues to be used wherever it already appears (edit page, etc.). The subdivision sheet and button use the new Unicode+badge approach instead.

---

## Files to Change

| File | Change |
|---|---|
| `src/Practice.tsx` | Full redesign of the practice view |
| `src/types.ts` | Add `targetBpm` to `TimePattern` |
| `src/session.ts` | Update `freshTime()`, `clampSession()`, `timeSteps()` |
| `src/expandSession.ts` | Derive `durationSec` from `targetBpm` |
| `src/StagePicks.tsx` | Replace with bottom-sheet-based controls (or remove) |
| `src/app.css` | New styles for beat grid, BPM block, sheets, controls |

---

## What Does Not Change

- Audio scheduling (`audio.ts`, `clock.ts`) — untouched
- Store / localStorage (`store.ts`) — untouched
- Edit page — untouched
- Session type switching — untouched
- Simple and Complex session logic — untouched. The visual redesign (beat grid, bottom sheets, play controls) applies to all session types, but the BPM increase data model change is Time-session-only.
