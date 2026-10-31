---
target: practice page
total_score: 23
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 3
target_identity: "file:/Users/carlosgamez/workspace/github.com/bycarlosgamez/mentronome/src/Practice.tsx"
target_fingerprint: "sha256:b5f9d385b46de8008a4e7106d287ea0bb750962788e31d00cafc7e1f57995c70"
target_path: /Users/carlosgamez/workspace/github.com/bycarlosgamez/mentronome/src/Practice.tsx
timestamp: 2026-10-31T01-21-05Z
slug: src-practice-tsx
---
Method: dual-agent (A: design review · B: detector + browser evidence)

## Design Health Score
| # | Heuristic | Score | Key Issue |
|---|---|---|---|
| 1 | Visibility of System Status | 3 | Strong panel + live region; 15px muted sub-lines unreadable at 1.5 m; no end-of-routine state |
| 2 | Match System / Real World | 3 | "Times 4" means total, reads as extra; red Pause reads as stop |
| 3 | User Control and Freedom | 2 | No undo; no skip round/rest though onJump/onSeek exist; Space hijacks focused controls |
| 4 | Consistency and Standards | 2 | Four number-entry styles; Climb box untitled; Routine progress bar shows while stopped (Climb hides it); readout baselines misalign in Steady |
| 5 | Error Prevention | 3 | Mode switch locked while playing; Space on a focused control starts playback |
| 6 | Recognition Rather Than Recall | 2 | Shortcuts (Space, arrows, Shift, T) invisible; accents only in Sound sheet |
| 7 | Flexibility and Efficiency | 2 | Shortcuts exist but undiscoverable; one saved session; ±1-only steppers |
| 8 | Aesthetic and Minimalist Design | 3 | Restrained; tempo shown twice (52px card, 56px panel); permanent dot hint |
| 9 | Error Recovery | 2 | Invalid numbers dropped silently; no undo |
| 10 | Help and Documentation | 1 | Inline hints only; no shortcut legend |
| **Total** | | **23/40** | **Acceptable** |

## Design Specificity Verdict
Half authored: the player panel, rest tint, routine summary, tappable dots and Climb readout are product-specific; the shell is a generic dark utility app in a 520px phone column on a desktop screen. Detector: source and URL scans clean (0 findings, 1280 and 390 viewports); nested-cards resolved. Contrast: plain beat-square border 1.28:1 and Subdivision-sheet .beat-dot off-edge 1.53:1 fail 3:1; control-edge, rest ink, idle Stop, focus ring pass in context.

## Priority Issues
- [P1] Space bar hijacks focused buttons/switches and plays behind open sheets (App.tsx keydown). Fix: only treat Space as Play when focus is not on a control or inside a dialog.
- [P1] Readout too small for desktop practice: 72/56px in a 520px column, 15px muted sub-lines; --time-size unused. Fix: desktop stage (two columns or play-state stage), bigger time/BPM, sub-lines ~22px in --ink.
- [P1] Two competing tempo numbers (Start BPM card vs live panel BPM). Fix: one tempo display, or compact "Start 110" outside Steady.
- [P2] Tap targets backwards: 12px dots are tappable, 72px squares are not; accents only in Sound sheet; muted dots faint. Fix: tap square to accent, 24px dot hit area, clear hollow muted ring.
- [P2] Four number-entry styles and small inconsistencies (Climb untitled, Routine bar while stopped, readout baseline). Fix: one stepper component, title Climb, hide Routine bar when stopped, shared baseline.
- [P3] No ending and no skip controls. Fix: "Routine complete" end state; skip round/rest beside Stop.

## Persona Red Flags
- Alex: no presets; tap tempo/±5 undiscoverable; ±1-only Times/Increase; no skip.
- Sam: Space hijack; 12px dots; disabled switch explained only by title; 11–12px labels; dashed faint mutes.
- Student at a desk: readout small at 1.5 m; 13px Stop; red Pause; count-in grid 7→4→7.

## Minor Observations
Lonely 16px header; unused tokens and duplicate .visually-hidden; summary omits set rest; dot wrap splits 16ths 3+1 at 500px; "Mixed" chip 12px; permanent dot hint; low-contrast repeat inset.

## Questions to Consider
- Should Play turn the page into a full-width stage?
- Is the 520px phone column a decision or a leftover?
- What would one tempo object (start → current → target) look like?
