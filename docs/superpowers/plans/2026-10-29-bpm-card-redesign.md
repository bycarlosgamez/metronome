# BPM Card Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the BPM card on the Practice page to a three-zone layout (display / stepper bar / More link) and move elapsed time to above the Play button.

**Architecture:** Two files change — `src/Practice.tsx` for JSX structure and `src/app.css` for CSS classes. The existing `bpm-endless` layout is replaced with `bpm-top` / `bpm-step-bar` / `bpm-more-bar` zones. Elapsed time moves from the BPM card to the play-controls block, shown only when playing in Simple mode (Routine mode already shows elapsed in the routine timer block).

**Tech Stack:** React 19, TypeScript, plain CSS, Vitest + Testing Library

---

## File Map

- **Modify:** `src/Practice.tsx` — restructure BPM card JSX; add elapsed above Play button
- **Modify:** `src/app.css` — remove `.bpm-endless*` rules; add `.bpm-top`, `.bpm-step-bar`, `.bpm-bar-btn`, `.bpm-more-bar`, `.bpm-more-link`, `.play-elapsed`
- **Test:** `src/Practice.test.tsx` — fix broken `bpm-current` assertion; add three elapsed tests

---

### Task 1: Fix broken bpm-current test

The `bpm-current` element was recently changed from a `<div>` to an `<input>`. The existing test uses `toHaveTextContent` which checks DOM `textContent` — always empty for inputs. It must be `toHaveDisplayValue`.

**Files:**
- Modify: `src/Practice.test.tsx:50-53`

- [ ] **Step 1: Run the test to confirm it currently fails**

```bash
npm run test -- src/Practice.test.tsx
```

Expected: FAIL — `toHaveTextContent` assertion on an `<input>` returns empty string.

- [ ] **Step 2: Fix the assertion**

In `src/Practice.test.tsx`, find the test at line ~50:

```ts
it("shows current BPM", () => {
  render(<Practice {...makeProps()} />)
  expect(screen.getByTestId("bpm-current")).toHaveTextContent("80")
})
```

Replace with:

```ts
it("shows current BPM", () => {
  render(<Practice {...makeProps()} />)
  expect(screen.getByTestId("bpm-current")).toHaveDisplayValue("80")
})
```

- [ ] **Step 3: Run test to verify it passes**

```bash
npm run test -- src/Practice.test.tsx
```

Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/Practice.test.tsx
git commit -m "fix(test): use toHaveDisplayValue for bpm-current input"
```

---

### Task 2: TDD — elapsed in play-controls, then implement full card redesign

Write three tests for the moved elapsed display first, then implement both the JSX and CSS changes together (they are tightly coupled — new class names need new CSS rules).

**Files:**
- Modify: `src/Practice.test.tsx`
- Modify: `src/Practice.tsx:143-211` (BPM block), `src/Practice.tsx:304-322` (play-controls)
- Modify: `src/app.css`

- [ ] **Step 1: Write three failing tests for play-elapsed**

Add after the existing `"shows current BPM"` test in `src/Practice.test.tsx`:

```ts
it("shows elapsed time above play button when playing in simple mode", () => {
  const props = { ...makeProps(), status: "playing" as const }
  render(<Practice {...props} />)
  expect(screen.getByTestId("play-elapsed")).toBeInTheDocument()
})

it("does not show elapsed time when stopped", () => {
  render(<Practice {...makeProps()} />)
  expect(screen.queryByTestId("play-elapsed")).not.toBeInTheDocument()
})

it("does not show elapsed time in routine mode when playing", () => {
  const props = { ...makeProps({ routineEnabled: true }), status: "playing" as const }
  render(<Practice {...props} />)
  expect(screen.queryByTestId("play-elapsed")).not.toBeInTheDocument()
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm run test -- src/Practice.test.tsx
```

Expected: 3 FAILs — `play-elapsed` element does not exist yet.

- [ ] **Step 3: Implement — restructure BPM card JSX**

In `src/Practice.tsx`, replace the entire `{/* BPM + pick */}` block (lines ~143–211) with:

```tsx
        {/* BPM + pick */}
        <div className="bpm-pick-row">
          <div className="bpm-block">
            <div className="bpm-top">
              <input
                className="bpm-current"
                data-testid="bpm-current"
                inputMode="numeric"
                aria-label="BPM"
                value={bpmText ?? String(currentBpm)}
                onFocus={() => { bpmRef.current = String(props.session.bpm); setBpmText(String(props.session.bpm)) }}
                onChange={(e) => { bpmRef.current = e.target.value; setBpmText(e.target.value) }}
                onBlur={commitBpm}
                onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur() }}
              />
              <span className="bpm-label">BPM</span>
            </div>
            <div className="bpm-step-bar">
              <button
                type="button"
                className="bpm-bar-btn"
                aria-label="Decrease BPM"
                onClick={() => props.onChange(clampSession({ ...props.session, bpm: props.session.bpm - 1 }))}
              >−</button>
              <button
                type="button"
                className="bpm-bar-btn"
                aria-label="Increase BPM"
                onClick={() => props.onChange(clampSession({ ...props.session, bpm: props.session.bpm + 1 }))}
              >+</button>
            </div>
            <div className="bpm-more-bar">
              <button
                type="button"
                className="bpm-more-link"
                aria-label="More BPM settings"
                onClick={() => setSheet("bpm")}
              >More ›</button>
            </div>
          </div>

          <div className="pick-col">
            <button
              type="button"
              className="pick-btn"
              aria-label={`Time signature: ${props.session.meter}`}
              onClick={() => setSheet("meter")}
            >
              <strong>{props.session.meter}</strong>
              <span>Time Sig</span>
            </button>
            <button
              type="button"
              className="pick-btn"
              aria-label={`Subdivision: ${props.session.subdivision}`}
              onClick={() => setSheet("subdiv")}
            >
              <SubdivIcon subdivision={props.session.subdivision} size="sm" />
              <span>Subdiv</span>
            </button>
          </div>
        </div>
```

- [ ] **Step 4: Implement — move elapsed to play-controls**

In `src/Practice.tsx`, replace the `{/* Play controls */}` block (lines ~304–322) with:

```tsx
        {/* Play controls */}
        <div className="play-controls">
          {isPlaying && !routineEnabled && (
            <div className="play-elapsed" data-testid="play-elapsed">{formatClock(elapsedSec)}</div>
          )}
          <button
            type="button"
            className={`play-btn${isPlaying ? " playing" : ""}`}
            aria-label={isPlaying ? "Pause" : "Play"}
            onClick={props.onToggle}
          >
            {isPlaying ? "❚❚" : "▶"}
          </button>
          <button
            type="button"
            className="stop-link"
            aria-label="Stop"
            onClick={props.onReset}
          >
            ■ Stop
          </button>
        </div>
```

- [ ] **Step 5: Implement — update CSS**

In `src/app.css`, make the following changes:

**5a. Update `.bpm-block`** — remove `padding`, `cursor`, `text-align`; add `overflow: hidden`:

Find and replace:
```css
.bpm-block {
  flex: 0 0 50%;
  min-width: 0;
  background: var(--surface);
  border: 1.5px solid var(--line);
  border-radius: var(--radius-card);
  padding: 18px 20px;
  text-align: left;
  cursor: pointer;
  box-sizing: border-box;
}
```
Replace with:
```css
.bpm-block {
  flex: 0 0 50%;
  min-width: 0;
  background: var(--surface);
  border: 1.5px solid var(--line);
  border-radius: var(--radius-card);
  overflow: hidden;
  box-sizing: border-box;
}
```

**5b. Replace `.bpm-endless*`, `.bpm-elapsed`, `.bpm-hint*` rules** with the new zone classes.

Find and remove these lines (lines ~277–299 in the current file):
```css
.bpm-endless { display: flex; align-items: flex-start; justify-content: space-between; gap: 8px; }
.bpm-endless__left { display: flex; flex-direction: column; gap: 4px; }
.bpm-endless__right { display: flex; flex-direction: column; align-items: flex-end; gap: 4px; padding-top: 2px; }
```
and:
```css
.bpm-elapsed { font-size: 13px; color: var(--ink-muted); font-variant-numeric: tabular-nums; }
.bpm-hint { font-size: 11px; color: var(--surface-high); }
.bpm-hint--link { background: none; border: none; padding: 0; cursor: pointer; font-family: inherit; }
.bpm-hint--link:hover { color: var(--ink-muted); }
```

Replace with:
```css
.bpm-top { display: flex; justify-content: space-between; align-items: flex-end; padding: 14px 16px 12px; }
.bpm-step-bar { display: flex; border-top: 1px solid var(--line); }
.bpm-bar-btn {
  flex: 1;
  background: none;
  border: none;
  border-right: 1px solid var(--line);
  color: var(--ink);
  font-size: 22px;
  font-weight: 300;
  padding: 12px 0;
  cursor: pointer;
  line-height: 1;
}
.bpm-bar-btn:last-child { border-right: none; }
.bpm-bar-btn:hover { background: var(--surface-raised); }
.bpm-more-bar { border-top: 1px solid var(--line); padding: 8px 16px; display: flex; justify-content: center; }
.bpm-more-link {
  background: none;
  border: none;
  padding: 0;
  font-family: inherit;
  font-size: 11px;
  color: var(--ink-muted);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  cursor: pointer;
}
.bpm-more-link:hover { color: var(--ink); }
```

**5c. Add `.play-elapsed`** in the `/* Play controls */` section, after `.play-controls { ... }`:

```css
.play-elapsed { font-size: 13px; color: var(--ink-muted); font-variant-numeric: tabular-nums; }
```

- [ ] **Step 6: Run all tests**

```bash
npm run test -- src/Practice.test.tsx
```

Expected: All tests PASS including the 3 new elapsed tests.

- [ ] **Step 7: Commit**

```bash
git add src/Practice.tsx src/Practice.test.tsx src/app.css
git commit -m "feat: redesign BPM card with three-zone layout, move elapsed to play controls"
```
