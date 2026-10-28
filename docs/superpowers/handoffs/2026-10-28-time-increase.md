# Handoff: Time increase

Date: 2026-10-28. Branch `feat/restyle`. HEAD `0420db9`. Base `main` at `7656f53`. The branch is 49 commits ahead of `origin/feat/restyle`. Nothing from this feature has been pushed. The integration choice is still open: merge to `main` locally, push and open a pull request, keep the branch, or discard. Do not do any of those until asked.

Spec: `docs/superpowers/specs/2026-10-28-time-increase-design.md` (`897e76d`).
Plan: `docs/superpowers/plans/2026-10-28-time-increase.md` (`6aa99f3`).
Progress notes: `.superpowers/sdd/progress.md` (gitignored).

## What shipped

A Time session starts Off: one tempo, no end, clock counts up during the play. Time and Bars add a climb and an end. The practice stage hides the footer cards only for Time, and adds a third square button, BPM increase, with an in-flow panel. Simple and Complex are unchanged.

Commits on top of the plan:

| Commit | What |
| --- | --- |
| `4f6ec69` | Store Off. Unknown and missing climbs load as Off. Saved `time` and `bars` stay. |
| `5938fdb` | Play Off until it is stopped. |
| `2e69478` | Sound the downbeat when an endless play begins. |
| `21dbfe9` | Third stage button. |
| `7e8c13b`, `28c64ac` | Amount, Every, and End draft until blur. |
| `fb1cf60` | Editor choices Off, Time, and Bars. |
| `b4d0bcf` | Try to save a typed climb when the panel closes. |
| `0420db9` | Save that climb in Chrome. |

`npm test` after `0420db9`: 10 files, 103 tests passed. `npm warn Unknown env config "devdir"` is environment noise.

## Working tree

Leave these unstaged. They are a color-token experiment, not this feature:

- `src/tokens.css`
- `src/tokens.test.ts`
- `.vite/` (untracked)

HEAD already has `--surface`, `--surface-raised`, and `--surface-high`. Do not stage `.vite/`.

## Product rules that are easy to undo

- `increaseEvery` is `"off" | "time" | "bars"`. `freshTime()` is seconds 120, Off, every 30 seconds, every 4 bars. `bpmIncrease` stays 0.
- `"time"` and `"bars"` load unchanged. Off, missing, and unknown load as Off. This replaces the older Time-session rule that an unknown climb loaded as `"time"`.
- Off expands to one count-in plus one play with `durationSec: Infinity` and one step at the session BPM. Do not compute time-into-play as `durationSec - remainingSec` when both are Infinity.
- Changing BPM during an Off play keeps the time already played and prepends the new count-in. Ten seconds into a play at 80, typed to 100, leaves Elapsed at `0:12` (2.4s count-in plus 10s played, floored). The plan's `0:13` was wrong.
- Endless clicks are scheduled in two-second windows of whole beats and refilled when less than one second remains. The first window starts at `scheduleOrigin(into) = max(0, into - 0.05)`. Later windows start at the previous `untilSec`. `clicksInSegment` with no finite end returns `[]`.
- The strip is absent for the whole Time session, including the count-in. Left is absent only while Off.
- The third button has no visible caption. Its name is exactly `BPM increase`. A visually hidden span outside the button describes Off, Time, or Bars. The marks are ∞, a clock, and two barlines.
- Amount, Every, and End draft while focused and commit on blur, Enter, or an outside click. Escape closes the panel and discards the draft.
- One panel is open at a time. Choosing Off writes `"off"` and closes the panel. Choosing Time or Bars leaves the panel open.
- The spec line "Those fields write through immediately" is stale. Blur commit is the behavior, because committing on each keystroke made a duration impossible to type.

## Chrome close path

`src/StagePicks.tsx` listens for `pointerdown`. Chrome does not emit `blur` when `blur()` runs during that event, so the draft was still discarded in the browser after `b4d0bcf`. `0420db9` dispatches a bubbling `focusout` on the focused control before `setOpen(null)`. React's `onBlur` runs from that event and commits. The practice test stubs `HTMLElement.prototype.blur` to a no-op and dispatches `pointerdown`, so the test fails if the code goes back to calling `blur()` only. `PointerEvent` is not defined in this jsdom, so the test uses `new Event("pointerdown", { bubbles: true })`.

## Saved browser session

The dev server is already on `http://127.0.0.1:5173/`. Do not start another. After the stage check, localStorage `mentronome.session` was restored to the live practice: type `time`, meter `7/4`, subdivision `quarter`, click `click-1`, BPM 80, `increaseEvery: "time"`, seconds 120, everySec 30, everyBars 4. Count-in is still four beats in 4/4, so the stopped clock shows `0:03` and four dots. The 7/4 dots appear once the play starts.

## Left alone on purpose

Do not fix these unless a later review upgrades them:

- Scheduled audio nodes are kept after they start.
- Editing BPM during an Off play rebuilds the grid from the start, so the gap to the next click can stutter.
- Each refill walks the grid from offset 0.
- No test proves the 250ms interval schedules a click after the first two seconds.
- `durationSec - remainingSec` is `NaN` during an Off play in the old formula. The Off play has one step, so playback still uses step 0.
- Choosing Time or Bars after an Off play has already passed the new End clamps elapsed and stops.
- The Off count-in clock has no test. It is named Duration, read-only, and focusing it does not write an end.
- Escape closes the climb panel without committing the draft.

Older specs still describe two stage buttons, a strip on every session, and unknown Time climbs loading as `"time"`. The Time-increase spec overrides those lines. Do not edit the older specs unless a new plan says so.

## Verify

```bash
npm test
```

On the practice page: no strip, third button, panel Off / Time / Bars, a typed End survives a click outside the panel, Off play counts up as Played with no Left, and the editor hides Duration, Every, and Total while Off.
