# Backlog

- **Project skill for checking the UI in a browser.** Capture the headless-Chrome screenshot recipe as a project skill with `/run-skill-generator`. The recipe: start `npm run dev -- --port 5199 --strictPort`, then load a temporary `__probe.html` page that writes a session to `localStorage["mentronome.session"]` and redirects to `/`. Then run Chrome with `--headless=new --screenshot --virtual-time-budget=5000 --window-size=480,1300`. Finally, remove the probe page and stop the port. This lets future sessions check the UI without rebuilding the script.

## Practice page: critique run 3 (24/40), all five issues in scope

Full report: `.impeccable/critique/2026-10-31T02-35-36Z__src-practice-tsx.md`. Decided: keep both columns while playing. The setup stays visible; only the beat row moves into the stage, so nothing moves under the student's hands.

1. **[P1] Space presses the last mouse-clicked control.**
   - In Chrome, clicking a button gives it focus. After tapping a beat square or a stepper, Space toggles that control instead of play/pause.
   - Fix in `App.tsx`'s keydown handler: defer to the focused control only when it is `:focus-visible`, i.e. reached by keyboard. Otherwise Space always plays or pauses.
   - Command: `/impeccable harden`.
2. **[P1] The beat row sits outside the stage.**
   - Move the beat row into `.player-panel`, scaled from `--time-size`.
   - Phase and Round/Set at `clamp(20px, 2vw, 28px)`; progress bar 8px.
   - Give the dots a fixed two-row height so the stage never shifts.
   - Count-in should show the meter's beats, not always 4.
   - Commands: `/impeccable layout`, then `/impeccable typeset`.
3. **[P2] Steady's hero is a meaningless "0:00".**
   - In Steady, make the BPM the hero and elapsed time the sub-line.
   - Label it "Ready" before the first play instead of "Stopped", and hide Stop while idle.
   - The routine-complete screen should show the total practised as its hero number, not "0:00".
   - Command: `/impeccable distill`.
4. **[P2] Features can only be found by experimenting.**
   - A one-line key legend under the transport: "Space play · ↑↓ ±1 · ⇧ ±5 · T tap".
   - A Tap button beside the BPM.
   - Named sounds instead of "Sound 1–4", previewed when picked in the Sound sheet.
   - Screen readers should hear "accented" and "sounding" instead of "pressed".
   - ↑/↓ shouldn't block page scrolling when focus is in the settings column.
   - Commands: `/impeccable onboard`, then `/impeccable clarify`.
5. **[P2] Unit toggles wipe values, and the settings type is small.**
   - Routine "Duration" and Climb "Every" Bars/Time switches should convert at the current BPM, or remember the last value per unit, instead of resetting.
   - Relabel "Duration" as "Measure in". Allow Set rest in bars.
   - Labels at least 14px, segment buttons 13px.
   - Commands: `/impeccable harden`, then `/impeccable typeset`.

**Smaller items from the same run:**
- Plain beat squares are buttons but only 1.1–1.4:1 against the page; they need a 3:1 edge.
- The routine summary wraps mid-range ("110 → / 125 BPM").
- On desktop, use small popovers by the chips instead of full-height bottom sheets.
- The Sound chip's accent dots duplicate the beat row.
- Group Count-in with the settings below it.
- At 1600px the stage ends about 560px down; make it truly full height.
- The header is a bare word.
- The disabled mode switch is under 3:1.
