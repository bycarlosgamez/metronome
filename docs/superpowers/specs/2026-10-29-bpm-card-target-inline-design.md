# BPM Card Target Inline Design

## Goal

When the "Increase to target" feature is active in Simple mode, surface Target BPM and Step directly in the BPM card on the Practice page so the user can see and edit them without opening the BpmSheet.

## Scope

Simple (non-routine) mode only. Routine mode redesign is deferred.

## Current State

The BPM card top zone shows the large BPM number on the left and a "BPM" label at the top-right. Target BPM and Step are only visible inside the BpmSheet (opened via "More ›"). When target is active, there is no indication of it on the main Practice screen.

## Design

### BPM Card Top Zone

The top zone layout changes in two ways:

**Always (regardless of target state):**
- The "BPM" label moves from top-right to directly below the large BPM number (left side).

**When target is On** (`!routineEnabled && session.time.increaseEvery !== "off"`):
- A right column appears with two stacked field groups:
  1. "Target" label (flush above) + editable input showing `session.time.targetBpm`
  2. "Step" label (flush above) + editable input showing `session.bpmIncrease`
- Labels are small (9px), muted (`var(--ink-muted)`), flush to their value with no gap.
- Generous spacing between the two groups makes it clear which label belongs to which value.
- Values are ~15px, semi-bold, muted color, with a bottom-border underline to indicate editability.

**When target is Off:**
- The right column is absent. The card looks like the current design except "BPM" label is below the number.

### Inline Editing

Both fields use the same ref+state pattern as the existing BPM input in `Practice.tsx`:
- `onFocus`: copy current value into a `ref` and a `useState` text string
- `onChange`: update ref and state
- `onBlur` / `Enter key`: commit — clamp the value and call `props.onChange(clampSession({...}))`
- Empty blur: no-op (guard against empty string, same as `commitBpm`)

**Target** commits to `session.time.targetBpm` via `clampBpm(Number(v))`.
**Step** commits to `session.bpmIncrease` via `Math.max(0, Math.round(Number(v)))`.

### What Does Not Change

- The Off/On toggle remains in BpmSheet only. This feature surfaces values; it does not add a new toggle.
- The −/+ stepper bar and "More ›" row are unchanged.
- Routine mode is unaffected.

## Files

- **Modify:** `src/Practice.tsx` — update `.bpm-top` JSX: move "BPM" label to left column below number; add conditional right column with two inline-edit field groups; add two `useRef` + `useState` pairs for target and step text.
- **Modify:** `src/app.css` — update `.bpm-top` to `align-items: flex-start`; add `.bpm-left`, `.bpm-lbl`, `.bpm-right`, `.bpm-target-group`, `.bpm-field-label`, `.bpm-field-value` classes.
