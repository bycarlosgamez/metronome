---
target: practice page
total_score: 21
max_score: 40
na_heuristics: 
p0_count: 1
p1_count: 2
target_identity: "file:/Users/carlosgamez/workspace/github.com/bycarlosgamez/mentronome/src/Practice.tsx"
target_fingerprint: "sha256:65eb3acf30b20d5aa89ffd4d95647154183750e4b0e8178b3ff50e59e7a247d4"
target_path: /Users/carlosgamez/workspace/github.com/bycarlosgamez/mentronome/src/Practice.tsx
timestamp: 2026-10-31T00-38-35Z
slug: src-practice-tsx
---
Method: dual-agent (A: design review · B: detector + browser evidence)

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 2 | Live tempo is 15px (`.player-bpm`); the 52px number is Start BPM; Routine reads "PLAY" while stopped |
| 2 | Match System / Real World | 3 | Musician terms are right; Round/Set/Times unexplained; sounds unnamed |
| 3 | User Control and Freedom | 2 | Mode switch while playing silently resets; Meter sheet closes after first change; sheets have no close button |
| 4 | Consistency and Standards | 2 | Three number-entry styles; "Bars/Min" vs "Bars/Time"; red means both Pause and Rest |
| 5 | Error Prevention | 2 | Silent clamps; Target ≤ Start quietly becomes Steady; destructive mode switch unconfirmed |
| 6 | Recognition Rather Than Recall | 3 | Chips show values; tappable dots and "🔊 1" are cryptic |
| 7 | Flexibility and Efficiency | 1 | Only Space; no BPM arrows, tap tempo, hold-repeat, or saved routines |
| 8 | Aesthetic and Minimalist Design | 3 | Clean, but Routine nests four container levels (detector: nested-cards) |
| 9 | Error Recovery | 2 | Corrections are silent reverts |
| 10 | Help and Documentation | 1 | Nothing explains Round vs Set, Increase, or tap-to-mute dots |
| **Total** | | **21/40** | **Acceptable** |

## Design Specificity Verdict
Mostly category-interchangeable dark utility UI; product-specific moments are the beat row with editable subdivision dots and the accent dots on the Sound chip. The plan (Climb/Routine) reads as settings under Play rather than as the product. Detector: source scan clean (0); URL scan 1 warning, nested-cards on `div.player-panel` (src/PlayerCard.tsx:140) at 1280 and 390 widths. Contrast: muted text passes everywhere (≥6:1); non-text fails — `--line` borders 1.06:1 on raised surfaces, accent beat border ~1.2:1, inactive dots and switch off-state < 3:1.

## Priority Issues
- [P0] Live tempo is the least readable number: 52px Start BPM vs 15px playing BPM, 11px phase, 12px Round/Set. Fix: show the playing BPM large during play (in the panel beside the timer or swap the BPM card value), phase/Round/Set ≥16px.
- [P1] One misclick costs the session: Steady/Climb/Routine switch resets playback; Meter sheet closes on first select. Fix: lock the switch while playing; keep sheets open with a Done/close control.
- [P1] State changes not legible at a distance; colour semantics muddled: Rest is red text only, Pause also red; accent beats ~1.2:1; dots/switch off < 3:1. Fix: tint the panel for Rest with its own colour; stronger accent marking; ≥3:1 non-text contrast.
- [P2] Keyboard efficiency near zero: no BPM arrows/shift-step, no tap tempo, no hold-repeat; Tab walks every dot. Fix: shortcuts, hold-repeat, roving tabindex for dots.
- [P2] Routine reads as a form: four nested containers, inconsistent unit labels, borderless Climb inputs, Count-in between switch and settings (and flush to card edge in Steady). Fix: one-line plan summary, flatten, consistent controls, move Count-in.

## Persona Red Flags
- Alex: no BPM keys/tap tempo; ±1 only; Tab through every dot; sheets don't take focus; no saved routines.
- Sam: sheets lack focus move/trap/close/return; no aria-live for phase/round/step; h1 text vs label mismatch; low non-text contrast; 9–10px labels; no designed focus-visible.
- Instrument student at a desk: playing BPM, phase, Round/Set and "Next +5" unreadable at ~1.5m; reads the misleading Start BPM; Rest only red text; mode buttons under Play reset the run; no end-of-session moment; count-in shows 4 squares regardless of meter.

## Minor Observations
🔊 emoji vs SVG icons; left-floating "Practice" title; Stop link full-strength when stopped; "❚❚" text glyph; Climb progress bar at 0% looks like a divider; weak ♩ subdivision icon; "+5" lacks "BPM"; dead legacy CSS (.stage*, .bpm-progress-*, .routine-toggle-btn).

## Questions to Consider
- Should playing turn the page into a stage (tempo, phase, time left at 3×, settings collapsed)?
- If the product is a metronome that runs a plan, should the plan be a timeline that lights up as it runs?
- What does finishing feel like?
