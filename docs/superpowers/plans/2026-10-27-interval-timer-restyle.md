# Interval Timer Restyle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restyle the practice page and the editor toward Interval Timer without changing playback or saving.

**Architecture:** `src/tokens.css` holds the shared custom properties. `src/app.css` imports it and is the only place that paints the two screens. `Practice` and `Edit` keep their props. The header shows the session title, Play becomes a circle, and the set color control becomes six dots.

**Tech Stack:** Vite, React 19, TypeScript, Vitest, Testing Library, CSS custom properties.

## Global Constraints

- The session, the segment list, playback, and saving stay as they are.
- `src/tokens.css` defines the custom properties. `src/app.css` imports it. Practice and Edit do not hard-code these colors, sizes, or radii.
- Page `#0c0c0c`, surface `#1a1a1a`, ink `#ffffff`, muted ink `#bdbdbd`, yellow text `#1a1a1a`, Play fill `#ffffff`, Play ink `#111111`, line `#2e2e2e`.
- Set colors: red `#e23b32`, orange `#f07820`, yellow `#f0c429`, green `#2ea85a`, blue `#2f7fe0`, pink `#e24b8a`. Rest `#4a5968`.
- Radii: stage `28px`, card `16px`, field `12px`, pill `999px`. Countdown `clamp(4.5rem, 18vw, 9rem)`, weight 700, tight letter-spacing.
- A current card or chip uses a 2px solid white outline. Yellow text uses the dark yellow-ink token on the stage, on cards, and on editor chips.
- The heading’s visible text is the session title. Its accessible name stays `Mentronome`.
- Play and Pause stay a white circle. Their accessible names stay `Play` and `Pause`.
- On a narrow window the transport is two rows. At 800px and wider the stats and controls share one row. The practice page stays one column.
- A narrow editor still opens one set on its own screen. At 800px and wider the list and the fields stay side by side and Back is hidden.
- Color is six dot buttons in a group labeled Color. The stored values stay `red`, `orange`, `yellow`, `green`, `blue`, and `pink`.
- Existing test names stay: Mentronome heading, Edit, Done, Add set, Delete set, Play, Pause, Duration, BPM, Set meter, and the sound-unavailable status.

## File structure

- `src/tokens.css` — custom properties only.
- `src/tokens.test.ts` — the token values are present in that file.
- `src/app.css` — both screens, reading the tokens.
- `src/Practice.tsx` — session-title header and circular Play control.
- `src/Practice.test.tsx` — heading text and Play class.
- `src/Edit.tsx` — session-title header and color dots.
- `src/Edit.test.tsx` — choosing a color dot.

---

### Task 1: Shared tokens

**Files:**
- Create: `src/tokens.css`
- Create: `src/tokens.test.ts`
- Modify: `src/app.css`

**Interfaces:**
- Consumes: nothing.
- Produces: custom properties `--page`, `--surface`, `--ink`, `--ink-muted`, `--ink-on-yellow`, `--play`, `--play-ink`, `--line`, `--red`, `--orange`, `--yellow`, `--green`, `--blue`, `--pink`, `--rest`, `--radius-stage`, `--radius-card`, `--radius-field`, `--radius-pill`, `--time-size`.

- [ ] **Step 1: Write the failing test**

`src/tokens.test.ts`:

```ts
import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

const css = readFileSync(new URL("./tokens.css", import.meta.url), "utf8")

describe("tokens", () => {
  it("defines the restyle values", () => {
    expect(css).toContain("--page: #0c0c0c;")
    expect(css).toContain("--surface: #1a1a1a;")
    expect(css).toContain("--ink: #ffffff;")
    expect(css).toContain("--ink-muted: #bdbdbd;")
    expect(css).toContain("--ink-on-yellow: #1a1a1a;")
    expect(css).toContain("--play: #ffffff;")
    expect(css).toContain("--play-ink: #111111;")
    expect(css).toContain("--line: #2e2e2e;")
    expect(css).toContain("--red: #e23b32;")
    expect(css).toContain("--orange: #f07820;")
    expect(css).toContain("--yellow: #f0c429;")
    expect(css).toContain("--green: #2ea85a;")
    expect(css).toContain("--blue: #2f7fe0;")
    expect(css).toContain("--pink: #e24b8a;")
    expect(css).toContain("--rest: #4a5968;")
    expect(css).toContain("--radius-stage: 28px;")
    expect(css).toContain("--radius-card: 16px;")
    expect(css).toContain("--radius-field: 12px;")
    expect(css).toContain("--radius-pill: 999px;")
    expect(css).toContain("--time-size: clamp(4.5rem, 18vw, 9rem);")
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/tokens.test.ts`

Expected: FAIL because `src/tokens.css` does not exist.

- [ ] **Step 3: Add the tokens and import them**

`src/tokens.css`:

```css
:root {
  --page: #0c0c0c;
  --surface: #1a1a1a;
  --ink: #ffffff;
  --ink-muted: #bdbdbd;
  --ink-on-yellow: #1a1a1a;
  --play: #ffffff;
  --play-ink: #111111;
  --line: #2e2e2e;
  --red: #e23b32;
  --orange: #f07820;
  --yellow: #f0c429;
  --green: #2ea85a;
  --blue: #2f7fe0;
  --pink: #e24b8a;
  --rest: #4a5968;
  --radius-stage: 28px;
  --radius-card: 16px;
  --radius-field: 12px;
  --radius-pill: 999px;
  --time-size: clamp(4.5rem, 18vw, 9rem);
}
```

Add this line at the top of `src/app.css`:

```css
@import "./tokens.css";
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/tokens.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/tokens.css src/tokens.test.ts src/app.css
git commit -m "Add the shared restyle tokens."
```

---

### Task 2: Practice page

**Files:**
- Modify: `src/Practice.tsx`
- Modify: `src/Practice.test.tsx`
- Modify: `src/app.css`

**Interfaces:**
- Consumes: `sessionTitle` from `src/session.ts`. The token properties from Task 1.
- Produces: the practice header shows the session title. The Play control has class `play-toggle`.

- [ ] **Step 1: Write the failing test**

In the first test of `src/Practice.test.tsx`, after the Mentronome heading assertion, add:

```tsx
    expect(screen.getByRole("heading", { name: "Mentronome" })).toHaveTextContent("Practice")
    expect(screen.getByRole("button", { name: "Play" })).toHaveClass("play-toggle")
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/Practice.test.tsx`

Expected: FAIL because the heading text is `MENTRONOME` and the Play button has no `play-toggle` class.

- [ ] **Step 3: Update the practice screen and its paint**

In `src/Practice.tsx`, replace the header with:

```tsx
      <header className="topbar">
        <h1 aria-label="Mentronome">{sessionTitle(props.session)}</h1>
        <button type="button" className="quiet" onClick={props.onEdit}>
          Edit
        </button>
      </header>
```

Replace the Play button’s visible contents and add the class. Keep the accessible name:

```tsx
          <button
            type="button"
            className="play-toggle"
            aria-label={props.status === "playing" || props.status === "no-audio" ? "Pause" : "Play"}
            onClick={props.onToggle}
          >
            {props.status === "playing" || props.status === "no-audio" ? "❚❚" : "▶"}
          </button>
```

Replace `src/app.css` with:

```css
@import "./tokens.css";

* { box-sizing: border-box; }
body { margin: 0; background: var(--page); color: var(--ink); font-family: system-ui, sans-serif; }
button, input, select { font: inherit; color: inherit; }
h1 { font-size: 1rem; font-weight: 600; margin: 0; }
.practice { min-height: 100vh; display: flex; flex-direction: column; }
.topbar { display: flex; justify-content: space-between; align-items: center; gap: 12px; padding: 12px 16px; }
.quiet { background: transparent; border: 1px solid var(--line); border-radius: var(--radius-pill); padding: 6px 12px; }
.stage { margin: 12px 16px; border-radius: var(--radius-stage); min-height: 46vh; flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; padding: 24px 16px; }
.stage-time { font-size: var(--time-size); font-weight: 700; letter-spacing: -0.04em; line-height: 0.9; margin: 0; }
.beats { display: flex; gap: 8px; }
.beats span { width: 32px; height: 32px; border-radius: 50%; display: grid; place-items: center; background: rgba(0, 0, 0, 0.22); }
.beats span[data-current="true"] { background: var(--ink); color: var(--play-ink); }
.strip { display: flex; gap: 8px; overflow-x: auto; padding: 0 16px 12px; }
.strip article { min-width: 120px; border-radius: var(--radius-card); padding: 10px 12px; display: flex; flex-direction: column; gap: 4px; }
.strip article[data-current="true"] { outline: 2px solid var(--ink); }
.color-red { background: var(--red); }
.color-orange { background: var(--orange); }
.color-yellow { background: var(--yellow); color: var(--ink-on-yellow); }
.color-green { background: var(--green); }
.color-blue { background: var(--blue); }
.color-pink { background: var(--pink); }
.color-slate { background: var(--rest); }
.transport { display: flex; flex-wrap: wrap; justify-content: space-between; align-items: flex-end; gap: 12px; padding: 8px 16px 16px; }
.transport > div:not(.controls) { display: flex; flex-direction: column; min-width: 4.5rem; }
.transport > div:not(.controls) span { color: var(--ink-muted); font-size: 0.75rem; }
.controls { display: flex; align-items: center; gap: 8px; }
.play-toggle { width: 48px; height: 48px; border: 0; border-radius: 50%; background: var(--play); color: var(--play-ink); }
.controls button:not(.play-toggle) { background: transparent; border: 0; }
.editor { display: block; }
.editor-list button[aria-current="true"] { outline: 2px solid var(--ink); outline-offset: 2px; }
@media (max-width: 799px) {
  .controls { flex-basis: 100%; justify-content: flex-end; }
  .editor-form { display: none; }
  .editor[data-pane="form"] .editor-list { display: none; }
  .editor[data-pane="form"] .editor-form { display: block; }
}
@media (min-width: 800px) {
  .editor { display: grid; grid-template-columns: 1fr 1fr; align-items: start; }
  .editor .editor-list, .editor .editor-form { display: flex; }
  .back-to-sets { display: none; }
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test`

Expected: PASS for every test file, including the new heading text and `play-toggle` assertions.

- [ ] **Step 5: Commit**

```bash
git add src/Practice.tsx src/Practice.test.tsx src/app.css
git commit -m "Restyle the practice countdown."
```

---

### Task 3: Editor

**Files:**
- Modify: `src/Edit.tsx`
- Modify: `src/Edit.test.tsx`
- Modify: `src/app.css`

**Interfaces:**
- Consumes: `COLORS` and `SetColor` from `src/types.ts`. `sessionTitle` from `src/session.ts`. `patchSet` already in `Edit`.
- Produces: a radiogroup labeled Color with one radio per color name. Choosing it calls `onChange` with that set color.

- [ ] **Step 1: Write the failing test**

Add this test to `src/Edit.test.tsx`:

```tsx
  it("sets the set color from a dot and shows the session title", async () => {
    const user = userEvent.setup()
    const session = createDefaultSession(() => "set-1")
    const onChange = vi.fn()
    render(<Edit session={session} selectedId="set-1" onChange={onChange} onSelect={() => {}} onDone={() => {}} />)

    expect(screen.getByRole("heading", { name: "Mentronome" })).toHaveTextContent("Practice")
    expect(screen.getByRole("radio", { name: "red" })).toHaveAttribute("aria-checked", "true")
    await user.click(screen.getByRole("radio", { name: "blue" }))
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({
      sets: [expect.objectContaining({ color: "blue" })],
    }))
  })
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/Edit.test.tsx`

Expected: FAIL because the heading text is `MENTRONOME` and there is no color radio.

- [ ] **Step 3: Update the editor**

In `src/Edit.tsx`, replace the header with:

```tsx
      <header className="topbar">
        <h1 aria-label="Mentronome">{sessionTitle(props.session)}</h1>
        <button type="button" className="quiet" onClick={props.onDone}>
          Done
        </button>
      </header>
```

Replace the Color field with a group that is not wrapped in a label:

```tsx
          <div className="color-field">
            <span id="set-color">Color</span>
            <div className="color-dots" role="radiogroup" aria-labelledby="set-color">
              {COLORS.map((color) => (
                <button
                  key={color}
                  type="button"
                  role="radio"
                  aria-label={color}
                  aria-checked={selected.color === color}
                  className={`color-${color}`}
                  onClick={() => patchSet({ color })}
                />
              ))}
            </div>
          </div>
```

`patchSet({ color })` is valid because `color` is a `SetColor`.

Replace `src/app.css` with:

```css
@import "./tokens.css";

* { box-sizing: border-box; }
body { margin: 0; background: var(--page); color: var(--ink); font-family: system-ui, sans-serif; }
button, input, select { font: inherit; color: inherit; }
h1 { font-size: 1rem; font-weight: 600; margin: 0; }
.practice { min-height: 100vh; display: flex; flex-direction: column; }
.topbar { display: flex; justify-content: space-between; align-items: center; gap: 12px; padding: 12px 16px; }
.quiet { background: transparent; border: 1px solid var(--line); border-radius: var(--radius-pill); padding: 6px 12px; }
.stage { margin: 12px 16px; border-radius: var(--radius-stage); min-height: 46vh; flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; padding: 24px 16px; }
.stage-time { font-size: var(--time-size); font-weight: 700; letter-spacing: -0.04em; line-height: 0.9; margin: 0; }
.beats { display: flex; gap: 8px; }
.beats span { width: 32px; height: 32px; border-radius: 50%; display: grid; place-items: center; background: rgba(0, 0, 0, 0.22); }
.beats span[data-current="true"] { background: var(--ink); color: var(--play-ink); }
.strip { display: flex; gap: 8px; overflow-x: auto; padding: 0 16px 12px; }
.strip article { min-width: 120px; border-radius: var(--radius-card); padding: 10px 12px; display: flex; flex-direction: column; gap: 4px; }
.strip article[data-current="true"] { outline: 2px solid var(--ink); }
.color-red { background: var(--red); }
.color-orange { background: var(--orange); }
.color-yellow { background: var(--yellow); color: var(--ink-on-yellow); }
.color-green { background: var(--green); }
.color-blue { background: var(--blue); }
.color-pink { background: var(--pink); }
.color-slate { background: var(--rest); }
.transport { display: flex; flex-wrap: wrap; justify-content: space-between; align-items: flex-end; gap: 12px; padding: 8px 16px 16px; }
.transport > div:not(.controls) { display: flex; flex-direction: column; min-width: 4.5rem; }
.transport > div:not(.controls) span { color: var(--ink-muted); font-size: 0.75rem; }
.controls { display: flex; align-items: center; gap: 8px; }
.play-toggle { width: 48px; height: 48px; border: 0; border-radius: 50%; background: var(--play); color: var(--play-ink); }
.controls button:not(.play-toggle) { background: transparent; border: 0; }
.editor { display: block; }
.editor-list, .editor-form { display: flex; flex-direction: column; gap: 12px; padding: 0 16px 24px; }
.editor-list > button { border: 0; border-radius: var(--radius-card); padding: 12px; text-align: left; }
.editor-list > button:not([class*="color-"]) { align-self: flex-start; border-radius: var(--radius-pill); background: var(--surface); padding: 8px 12px; }
.editor-list button[aria-current="true"] { outline: 2px solid var(--ink); outline-offset: 2px; }
.editor label, .color-field { display: flex; flex-direction: column; gap: 6px; color: var(--ink-muted); font-size: 0.8rem; }
.editor input, .editor select { background: var(--surface); border: 0; border-radius: var(--radius-field); padding: 12px; color: var(--ink); }
.color-dots { display: flex; gap: 8px; }
.color-dots button { width: 28px; height: 28px; border: 0; border-radius: 50%; padding: 0; }
.color-dots button[aria-checked="true"] { outline: 2px solid var(--ink); outline-offset: 2px; }
.back-to-sets { align-self: flex-start; background: transparent; border: 0; color: var(--ink-muted); padding: 0; }
@media (max-width: 799px) {
  .controls { flex-basis: 100%; justify-content: flex-end; }
  .editor-form { display: none; }
  .editor[data-pane="form"] .editor-list { display: none; }
  .editor[data-pane="form"] .editor-form { display: block; }
}
@media (min-width: 800px) {
  .editor { display: grid; grid-template-columns: 1fr 1fr; align-items: start; }
  .editor .editor-list, .editor .editor-form { display: flex; }
  .back-to-sets { display: none; }
}
```

`.editor .editor-list` is as specific as the narrow `.editor[data-pane="form"] .editor-list` rule, and the wide query applies at 800px, so both columns stay visible after a set is selected.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test`

Expected: PASS for every test file. The new test shows the session title and sets the color to blue.

- [ ] **Step 5: Commit**

```bash
git add src/Edit.tsx src/Edit.test.tsx src/app.css
git commit -m "Restyle the editor and its color dots."
```

---

### Task 4: Check the running app

**Files:**
- Modify: none, unless a check fails. A failure goes back to the task that owns it.

**Interfaces:**
- Consumes: the app from Task 3.
- Produces: a checked narrow practice page, a checked narrow editor, and a checked wide editor.

- [ ] **Step 1: Run the full test suite**

Run: `npm test`

Expected: PASS

- [ ] **Step 2: Run the dev server**

Run: `npm run dev`

Open the printed local URL.

- [ ] **Step 3: Check the spec by hand**

Narrow window, under 800px:

- The header shows Practice, not the old wordmark. Edit is an outlined pill.
- The stage is the set color, the countdown is large, and the beat dots, BPM, and meter are still there.
- The cards are colored. The current card has a white outline.
- Elapsed, Set, and Left are on one row. The controls are on the next row and do not cover the numbers. Play is a white circle.
- Edit opens the colored set list. Tapping a set opens its fields, including six color dots. Back returns to the list. Done returns to Practice.

Wide window, 800px or more:

- The practice page stays one column and the countdown is large.
- Edit shows the list and the selected set side by side after a set is chosen. Back is hidden.

If a set is changed to yellow, its stage, card, and chip use dark text.

- [ ] **Step 4: Commit only if a check required a fix**

```bash
git add src
git commit -m "Fix the restyle found in the manual check."
```

If nothing failed, do not create an empty commit.
