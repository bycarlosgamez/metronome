---
target: practice page
total_score: 24
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 2
target_identity: "file:/Users/carlosgamez/workspace/github.com/bycarlosgamez/mentronome/src/Practice.tsx"
target_fingerprint: "sha256:00e738f0a34f47197271cc465240cbed66e6ada83bdf48acf2da9b3307571679"
target_path: /Users/carlosgamez/workspace/github.com/bycarlosgamez/mentronome/src/Practice.tsx
timestamp: 2026-10-31T02-35-36Z
slug: src-practice-tsx
---
Method: dual-agent (A: design review · B: detector + browser evidence)

## Design Health Score
| # | Heuristic | Score | Key Issue |
|---|---|---|---|
| 1 | Visibility of System Status | 3 | Stage reads well; 16px phase/round, 3px progress bar and the beat row sit outside the glance zone |
| 2 | Match System / Real World | 3 | "Duration: Bars | Time" is a unit, not a quantity; sounds unnamed; count-in draws 4 squares in 7/8 |
| 3 | User Control and Freedom | 2 | No undo; unit toggles discard values; Space goes to the last-clicked control |
| 4 | Consistency and Standards | 3 | Set rest always MIN:SEC; Stop shown when idle; red Pause |
| 5 | Error Prevention | 2 | Space trap; destructive unit toggles; silent clamping |
| 6 | Recognition Rather Than Recall | 2 | Shortcuts and tap tempo invisible; tap-to-accent/mute only in title tooltips |
| 7 | Flexibility and Efficiency | 3 | Shortcuts, hold-repeat, typeable fields; no presets |
| 8 | Aesthetic and Minimalist Design | 3 | Clean; dense 11–12px routine labels; empty left column in Steady |
| 9 | Error Recovery | 2 | Silent clamps and resets |
| 10 | Help and Documentation | 1 | Two hints; no shortcut legend, no Climb explanation |
| **Total** | | **24/40** | **Acceptable** |

## Design Specificity Verdict
Layout specific (stage, start→target, routine summary, rest tint); surface still stock dark utility with phone-style bottom sheets on desktop. Detector: 0 findings in source and at 1280, 1600, 390. Contrast: plain beat squares (now buttons) 1.1–1.4:1 edge/fill vs page — fails 1.4.11; rest of pairings pass.

## Priority Issues
- [P1] Space goes to the last mouse-clicked button (Chrome focuses on click): tapping a beat or stepper then Space edits the plan. Fix: defer only when the control has :focus-visible.
- [P1] The beat row (most-watched while playing) sits outside the stage at 72px; phase/round 16px; progress bar 3px; dots wrap shift layout; count-in 7→4. Fix: beat row inside the stage scaled from --time-size, phase/round larger, 8px bar, fixed dot height.
- [P2] Steady's hero is elapsed 0:00 and the idle label is "Stopped" with a Stop link. Fix: BPM hero in Steady, "Ready" before first play, hide idle Stop.
- [P2] Discoverability: no shortcut legend, no Tap button, unnamed sounds, hints only in tooltips. Fix: kbd legend, Tap button, named sounds with preview.
- [P2] Unit toggles discard values; settings type 11–12px. Fix: convert at session BPM or remember per unit; "Measure in"; 14px labels.

## Persona Red Flags
- Alex: one session only; set rest not in bars; unit toggles wipe values; no shortcuts beyond tempo.
- Sam: "pressed" doesn't say accented/sounding; global ↑/↓ blocks page scroll; disabled switch below 3:1; 11px labels; Space trap.
- Student: beat position and 3px bar unreadable at 1.5 m; red Pause; 4-square count-in in 7/8.

## Minor Observations
Summary wraps mid-range; full-height bottom sheets on desktop; Sound chip accent dots duplicate the beat row; Count-in floats ungrouped; stage card ends ~560px with dead space; complete state hero shows 0:00; bare header.

## Questions to Consider
- Why is the beat display outside the stage and smaller than the clock?
- Should the setup column disappear while a session runs?
- In Steady, what does elapsed time earn by being the hero?
