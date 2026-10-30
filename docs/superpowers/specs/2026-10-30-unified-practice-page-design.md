# Unified Practice Page Design

## Intent

Today the page has two modes (a Simple | Routine switch at the top) and BPM increase settings hidden behind the BPM card's **More** popup. The goal is one simpler page: set a tempo, pick how to practice inside the player card, press Play.

The user practices in three ways:

1. **Steady**: set a tempo and play until stopped.
2. **Climb**: set a start tempo and a target; the tempo steps up every N bars or N minutes (e.g. +5 every 2:00) until it reaches the target, then holds there until stopped.
3. **Routine**: the existing Round/Set routine. Example: start 110, play 2:00, rest 0:15, +5 per round, 4 rounds, 3 sets; every set starts back at 110.

Time sig, Subdiv and Click are fine as they are.

## Goals

- One page with no mode switch at the top.
- A single player card holds playback (display, progress, Play/Stop, Count-in) **and** the choice of how to practice: a three-way **Steady | Climb | Routine** switch below the player, with only the chosen option's settings shown below the switch (mockup option B, chosen by the user).
- The BPM card's **More** button and the BPM popup (`BpmSheet`) are removed. Their controls move into the player card.
- Climb's interval can be bars **or** minutes (user decision: both).

## Non-goals

- No changes to Time sig, Subdiv or Click (meter, subdivision and click sheets stay).
- No changes to how the routine's Round/Set structure or per-round increase play.
- No new practice types beyond the three.

## Anti-goals

- Routine must not regain **Increase to target** (climbing inside each play). The user said the per-round increase is enough for routines.
- Old saved sessions must load and play without crashing.

## Layout (top to bottom)

1. Beat squares (unchanged).
2. BPM card + pick column (Time sig, Subdiv, Click). The BPM card keeps the big BPM input and the − / + bar. **More is removed**, and the inline Target/Step fields that appear in the BPM card for Simple today also move to the Climb settings. Label: **BPM** in Steady, **START BPM** in Climb and Routine. The read-only **Now** value shows in Climb and in Routine when its per-round increase is on.
3. The player card (built on the darker play panel already in the working tree):
   - **Play panel** (darker, `--surface-sunk`): label row (phase label + Count-in toggle, Count-in's right edge aligned with the big number), big number, a sub-line, right-side info, progress bar, then Play and Stop with 28px of space above.
   - **Steady | Climb | Routine** segmented switch.
   - Settings for the chosen option.

### What the play panel shows

| | Label | Big number | Sub-line | Right info | Progress bar |
|---|---|---|---|---|---|
| Steady | PLAYING (READY during count-in) | elapsed time, counting up | none | none | hidden |
| Climb, climbing | PLAYING | elapsed time | `Next +5 in 0:48` (bars mode: `Next +5 in 3 bars`) | `115 → 130` (current → target) | progress through the current step |
| Climb, at target | PLAYING | elapsed time | `At target` | `130` | hidden |
| Routine | PLAY / REST / READY | countdown of the current stretch | `28:45 left` | `Round 1/4`, `Set 1/3` | progress through the stretch (as today) |

When stopped, Steady and Climb show 0:00 and the Climb sub-line shows the first step. The progress bar and the "Next +N in" wording are the builder's call as long as the meaning above holds.

### Settings below the switch

- **Steady**: none.
- **Climb**: Target BPM, Step (+N BPM), Every N with a **Bars | Min** choice. Bars shows a stepper ("4 bars"); Min shows the existing MIN:SEC `TimeInput`. Defaults: target 120, step 5, every 4 bars; switching to Min sets every to 2:00, and switching back to Bars sets 4 bars.
- **Routine**: unchanged from today's routine card: Duration (Bars | Time), Round (Play, Rest, Repeat, Increase +N), Set (Rest between, Repeat).

## Behavior

- **Steady** plays one endless stretch at BPM until Stop.
- **Climb** steps BPM from Start by Step every interval until it reaches the target, then holds at the target until Stop. If Start ≥ Target or Step is 0, it plays like Steady at Start. BPM is always clamped to 40–300. In bars mode the window length is measured at each step's own BPM (as `timeSteps` does today); in minutes mode every window is the same length in seconds.
- **Routine** plays as today with the per-round increase only.
- Changing the switch while playing stops playback, as switching Simple/Routine does today.
- **Editing Climb while playing or paused** (Start BPM, Target, Step, Every, Bars | Min) applies straight away and keeps your place in the current step: the step you're on carries on from where it was, at its new BPM, instead of the elapsed time landing on a different step (user decision). `App.onChange` already has code for this, but it only runs for `session.type === "time"`, which `clampSession` no longer produces; it needs rewiring for Climb, with tests.
- Count-in works the same in all three: one 4-beat bar before the first play.

## Data and old saves

The builder chooses the exact field names. The intent:

- A session-level practice choice: `"steady" | "climb" | "routine"`, replacing the role of `routineEnabled` and Simple's `time.increaseEvery` `"off" | "bars"`.
- Climb settings: target BPM, step, interval unit (`"bars" | "min"`), interval length in bars and in seconds. Reuse `session.time` and `session.bpmIncrease` where that keeps migration simple.
- Routine's `increase` keeps only Off / per round. The `"target"` mode, its `step`/`targetBpm`/`every` fields, `routineClimb`, and the computed-play-length display are removed.

Loading old saves (my calls, confirmed in chat):

- Simple with no increase (`time.increaseEvery: "off"`) → **Steady**.
- Simple with an increase (`"bars"`) → **Climb**, bars mode, keeping target, step and every-bars.
- `routineEnabled: true` → **Routine**.
- Routine saved with Increase to target (`increase.mode: "target"`) → Routine with **no increase**.
- Old `type: "time"` saves → **Climb**, bars mode, keeping target, step (`bpmIncrease`) and every-bars. They were climbs to a target, which is what Climb is now. Today `clampSession` turns them into a target-mode Routine; that path changes. (My call.)
- Other legacy formats keep going through the existing `clampSession` / `migrateLegacy` path.

Climb settings are remembered across switches between Steady, Climb and Routine. If the step is 0 when switching into Climb (true for every new session and every "Simple, no increase" save, since `bpmIncrease` starts at 0), Climb fills in its defaults (target 120, +5, every 4 bars) so it never plays like Steady by surprise. (My call.)

## Constraints

- React 19 + TypeScript, plain CSS with tokens in `tokens.css`, Vitest 3 + Testing Library. No new dependencies.
- Work-in-progress already in the working tree and part of this design: the darker play panel (`.routine-play-panel`, `--surface-sunk`), Count-in on the label row with right edge aligned to the countdown, 28px above Play, and **READY** as the count-in label. It is currently routine-only and becomes the player card's panel for all three options.
- `CLAUDE.md` describes Practice Modes and Practice.tsx; update it.

## Left to the builder

- Component structure (e.g. splitting the player card out of `Practice.tsx`).
- Exact styling of the segmented switch (reuse existing segmented-control classes where possible).
- Wording and formatting details of the Climb sub-line within the meaning above.
- Whether `BpmSheet.tsx` and its test are deleted outright (expected: yes, since nothing opens it any more).
