# Practice Stage Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Open a new session on Time, and let the practice stage pick a time signature and a subdivision from two square buttons.

**Architecture:** Quintuplet and sextuplet join the existing subdivision union, and the beat walk already splits a beat by the slot count. The editor keeps its labeled selectors and slot row. The practice stage replaces that block with `StagePicks`: two buttons and a panel under the open one. `createDefaultSession` returns a Time session.

**Tech Stack:** Vite 6, React 19, TypeScript, Vitest 3, Testing Library, user-event. `npm test` is `vitest run`.

## Global Constraints

- A fresh session has `type: "time"`, meter `"4/4"`, and subdivision `"quarter"`.
- A saved session still opens as the type it stored.
- The practice stage, from top to bottom, is the title, the clock, the two buttons, BPM, the beat dots, then Previous, Play, Next, and Reset.
- The two buttons have no visible captions. They are equal squares with rounded corners, in one centered row.
- The left button shows the time signature, `4/4` until it changes.
- The right button shows a note icon, a quarter note until it changes.
- Tapping a button opens a panel under it. The button updates as the choice changes.
- The beat dots stay one per beat. They wrap when the bar is wide.
- The editor is not restyled into these buttons, and its per-slot click row stays.
- Note is still only 1, 2, 4, or 8. The bottom number does not change click speed.
- The count-in stays four beats and does not subdivide.
- The transport stays in the stage. The strip stays where it is. The stored `click` field stays.
- Stay on `feat/restyle` in this checkout. Do not create a git worktree. Do not implement on `main`.
- Do not stage `src/tokens.css`, `src/tokens.test.ts`, or `.vite/`.

## File structure

- `src/types.ts` — add `"quintuplet"` and `"sextuplet"` to `SUBDIVISIONS`.
- `src/session.ts` — slot counts 5 and 6. `createDefaultSession` returns `type: "time"`.
- `src/Signature.tsx` — editor captions and option names for the two new subdivisions.
- `src/NoteIcon.tsx` — one current-color note icon per subdivision.
- `src/StagePicks.tsx` — the two practice buttons and their panels.
- `src/Practice.tsx` — stage order, and `StagePicks` in place of `Signature`.
- `src/app.css` — square buttons and the panel.
- Tests live beside those files.

---

### Task 1: Add quintuplets and sextuplets

**Files:**
- Modify: `src/types.ts`
- Modify: `src/session.ts`
- Modify: `src/Signature.tsx`
- Modify: `src/session.test.ts`
- Modify: `src/Edit.test.tsx`
- Modify: `src/clock.test.ts`

**Interfaces:**
- Consumes: `SUBDIVISIONS`, `SUBDIVISION_SLOTS`, `clicksInSegment`, `Signature`.
- Produces: `Subdivision` includes `"quintuplet"` and `"sextuplet"`. `SUBDIVISION_SLOTS.quintuplet` is `5`. `SUBDIVISION_SLOTS.sextuplet` is `6`. Editor captions are `["1", "ta", "ka", "di", "mi"]` and `["1", "ta", "la", "ta", "li", "ta"]`.

- [ ] **Step 1: Write the failing tests**

In `src/session.test.ts`, inside "keeps a known time signature and rejects an unknown bottom number", after the eighth slots assertion, add:

```ts
session.subdivision = "quintuplet"
session.slots = ["click-1"]
session.click = "click-3"
expect(clampSession(session).slots).toEqual(["click-1", "click-3", "click-3", "click-3", "click-3"])
session.subdivision = "sextuplet"
session.slots = ["off", "click-1", "click-1", "click-1", "click-1", "click-1", "click-4"]
expect(clampSession(session).slots).toEqual(["off", "click-1", "click-1", "click-1", "click-1", "click-1"])
```

In `src/clock.test.ts`, add:

```ts
it("splits one beat into five quintuplet clicks and leaves the count-in plain", () => {
  const session = createDefaultSession(() => "cycle-1")
  session.bpm = 60
  session.subdivision = "quintuplet"
  session.slots = ["click-1", "click-1", "click-1", "click-1", "click-1"]
  const segments = expandSession(session)
  expect(clicksInSegment(segments[0])).toHaveLength(4)
  const play = segments.find((segment) => segment.kind === "play")!
  expect(clicksInSegment(play).slice(0, 5).map((click) => click.offsetSec)).toEqual([0, 0.2, 0.4, 0.6, 0.8])
  expect(clicksInSegment(play)[0].accent).toBe(true)
  expect(clicksInSegment(play)[1].accent).toBe(false)
})
```

In `src/Edit.test.tsx`, add:

```ts
it("shows a caption for each quintuplet and sextuplet slot", async () => {
  const user = userEvent.setup()
  const onChange = vi.fn()
  const { rerender } = render(<Edit session={createDefaultSession(() => "cycle-1")} onChange={onChange} onDone={() => {}} />)
  await user.selectOptions(screen.getByRole("combobox", { name: "Subdivision" }), "quintuplet")
  const quintuplet = onChange.mock.calls.at(-1)?.[0]
  expect(quintuplet.subdivision).toBe("quintuplet")
  expect(quintuplet.slots).toEqual(["click-1", "click-1", "click-1", "click-1", "click-1"])
  rerender(<Edit session={quintuplet} onChange={onChange} onDone={() => {}} />)
  expect(screen.getByRole("combobox", { name: "ta click" })).toBeInTheDocument()
  expect(screen.getByRole("combobox", { name: "ka click" })).toBeInTheDocument()
  expect(screen.getByRole("combobox", { name: "di click" })).toBeInTheDocument()
  expect(screen.getByRole("combobox", { name: "mi click" })).toBeInTheDocument()
  expect(screen.getByText("ta")).toBeInTheDocument()
  await user.selectOptions(screen.getByRole("combobox", { name: "Subdivision" }), "sextuplet")
  const sextuplet = onChange.mock.calls.at(-1)?.[0]
  expect(sextuplet.slots).toHaveLength(6)
  rerender(<Edit session={sextuplet} onChange={onChange} onDone={() => {}} />)
  expect(screen.getByRole("combobox", { name: "li click" })).toBeInTheDocument()
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test -- src/session.test.ts src/clock.test.ts src/Edit.test.tsx`

Expected: FAIL. `"quintuplet"` is not a subdivision, so the assignment or the option is rejected, and the quintuplet clicks are not 0.2 seconds apart.

- [ ] **Step 3: Store five and six slots**

In `src/types.ts`, change `SUBDIVISIONS` to:

```ts
export const SUBDIVISIONS = ["quarter", "eighth", "triplet", "sixteenth", "quintuplet", "sextuplet"] as const
```

In `src/session.ts`, add `quintuplet: 5` and `sextuplet: 6` to `SUBDIVISION_SLOTS`.

In `src/Signature.tsx`, extend `labels`:

```ts
const labels = {
  quarter: ["Beat"],
  eighth: ["1", "&"],
  triplet: ["1", "trip", "let"],
  sixteenth: ["1", "e", "&", "a"],
  quintuplet: ["1", "ta", "ka", "di", "mi"],
  sextuplet: ["1", "ta", "la", "ta", "li", "ta"],
}
```

Extend the option names:

```ts
const names = {
  quarter: "Beat",
  eighth: "Eighth",
  triplet: "Triplet",
  sixteenth: "Sixteenth",
  quintuplet: "Quintuplet",
  sextuplet: "Sextuplet",
}
```

Use `names[subdivision]` as the option text. Slot keys must stay unique, so key each slot by `` `${label}-${index}` ``. The two "ta" captions in a sextuplet would otherwise collide.

Do not change `createDefaultSession`. Do not change the practice page.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test -- src/session.test.ts src/clock.test.ts src/Edit.test.tsx`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/types.ts src/session.ts src/Signature.tsx src/session.test.ts src/clock.test.ts src/Edit.test.tsx
git commit -m "Split a beat into quintuplets and sextuplets."
```

Do not stage `src/tokens.css`, `src/tokens.test.ts`, or `.vite/`.

---

### Task 2: Open a new session on Time

**Files:**
- Modify: `src/session.ts`
- Modify: `src/session.test.ts`
- Modify: `src/store.test.ts`
- Modify: the test files that build a Simple or Complex session from `createDefaultSession` without setting `type`

**Interfaces:**
- Consumes: `createDefaultSession`, `loadSession`, `freshTime`.
- Produces: `createDefaultSession().type` is `"time"`. Meter, subdivision, slots, BPM, and `time` are unchanged.

- [ ] **Step 1: Write the failing tests**

In `src/session.test.ts`, change the first-visit expectation from `type: "simple"` to `type: "time"`.

In `src/store.test.ts`, change "loads the first-visit session when nothing is saved" so `loaded.type` is `"time"`. Leave the BPM and `simple.length` expectations. Add:

```ts
it("keeps a saved simple session", () => {
  const storage = memory()
  const session = createDefaultSession(() => "set-1")
  session.type = "simple"
  saveSession(session, storage)
  expect(loadSession(storage).type).toBe("simple")
})
```

- [ ] **Step 2: Run the session and store tests to verify they fail**

Run: `npm test -- src/session.test.ts src/store.test.ts`

Expected: FAIL. The fresh session is still `"simple"`.

- [ ] **Step 3: Return a Time session**

In `createDefaultSession`, set `type: "time"`. Change nothing else in that object.

Then run `npm test`. A Time session has no Repeat interval button and expands to one count-in plus one timed play, so Simple and Complex tests fail. For each failure, if that test exercises Simple or Complex behavior, add `session.type = "simple"` immediately after its `createDefaultSession` call and leave the rest of the assertion. Do this in `src/Edit.test.tsx`, `src/Practice.test.tsx`, `src/expandSession.test.ts`, `src/clock.test.ts`, `src/audio.test.ts`, and `src/App.test.tsx`.

Tests that already assign `session.type` keep that assignment. Tests that only compare against `createDefaultSession()` follow the new default. The first-visit store test expects `"time"`.

These Edit tests need `session.type = "simple"` because they click Simple or Complex controls: "edits the session card and the tempo card", "hides the repeat fields until the switches are on", "builds complex cycles from the simple pattern", "returns to the same cycles when a complex session peeks at simple", "adds, moves, and refuses to remove the last cycle", "shows the stored value when a commit clamps back to it", "shows the total of every segment, including rests", "chooses a round increase for simple and for complex", and "drops the complex pattern when simple is saved". "fills a subdivision with the current click" and "shows a caption for each quintuplet and sextuplet slot" can stay on the default Time session.

`src/Practice.test.tsx` "edits duration, tempo, and meter on the stage" expects `simple.length`, so it needs `session.type = "simple"`. So does every practice test that commits a simple length, a cycle rest, or a complex BPM. The tests whose names say "time" already set `session.type = "time"`.

- [ ] **Step 4: Run the full suite to verify it passes**

Run: `npm test`

Expected: PASS. `Unknown env config "devdir"` is environment noise, not a failure.

- [ ] **Step 5: Commit**

```bash
git add src/session.ts src/session.test.ts src/store.test.ts src/Edit.test.tsx src/Practice.test.tsx src/expandSession.test.ts src/clock.test.ts src/audio.test.ts src/App.test.tsx
git commit -m "Open a new session on Time."
```

Stage only the files this task actually changed. Do not stage `src/tokens.css`, `src/tokens.test.ts`, or `.vite/`.

---

### Task 3: Pick the signature from two buttons

**Files:**
- Create: `src/NoteIcon.tsx`
- Create: `src/StagePicks.tsx`
- Modify: `src/Practice.tsx`
- Modify: `src/Practice.test.tsx`
- Modify: `src/app.css`

**Interfaces:**
- Consumes: `Session`, `BEATS`, `NOTES`, `SUBDIVISIONS`, `SUBDIVISION_SLOTS`, `Subdivision`.
- Produces: `function NoteIcon(props: { subdivision: Subdivision }): JSX.Element` and `function StagePicks(props: { session: Session; onChange(session: Session): void }): JSX.Element`.

- [ ] **Step 1: Write the failing practice tests**

In "edits duration, tempo, and meter on the stage", change `render(` to `const { rerender } = render(`. Replace the meter portion, from the Meter query through the Beat click expectation, with:

```ts
expect(screen.queryByRole("combobox", { name: "Beat click" })).not.toBeInTheDocument()
expect(screen.queryByText("Time signature")).not.toBeInTheDocument()
expect(screen.queryByText("Subdivision")).not.toBeInTheDocument()
await user.click(screen.getByRole("button", { name: "Time signature" }))
await user.selectOptions(screen.getByRole("combobox", { name: "Beats" }), "7")
await user.selectOptions(screen.getByRole("combobox", { name: "Note" }), "8")
const signed = onChange.mock.calls.at(-1)?.[0]
expect(signed.meter).toBe("7/8")
rerender(
  <Practice
    session={signed}
    segments={expandSession(signed)}
    snapshot={snapshotAt(expandSession(signed), 0)}
    status="stopped"
    onToggle={() => {}}
    onJump={() => {}}
    onReset={() => {}}
    onEdit={() => {}}
    onChange={onChange}
    onSeek={() => {}}
  />,
)
expect(screen.getByRole("button", { name: "Time signature" })).toHaveTextContent("7/8")
expect(screen.getByRole("combobox", { name: "Beats" })).toBeInTheDocument()
await user.keyboard("{Escape}")
expect(screen.queryByRole("combobox", { name: "Beats" })).not.toBeInTheDocument()
```

Add:

```ts
it("orders the clock, the two buttons, BPM, the dots, and Play", () => {
  const session = createDefaultSession(() => "cycle-1")
  const segments = expandSession(session)
  render(
    <Practice
      session={session}
      segments={segments}
      snapshot={snapshotAt(segments, 0)}
      status="stopped"
      onToggle={() => {}}
      onJump={() => {}}
      onReset={() => {}}
      onEdit={() => {}}
      onChange={() => {}}
      onSeek={() => {}}
    />,
  )
  const stage = document.querySelector(".stage")!
  expect(screen.getByRole("button", { name: "Time signature" })).toHaveTextContent("4/4")
  const nodes = [
    screen.getByTestId("stage-time"),
    screen.getByRole("button", { name: "Time signature" }),
    screen.getByRole("button", { name: "Subdivision" }),
    screen.getByRole("textbox", { name: "BPM" }),
    screen.getByTestId("beat-1"),
    screen.getByRole("button", { name: "Play" }),
  ]
  nodes.forEach((node) => expect(stage.contains(node)).toBe(true))
  for (let index = 1; index < nodes.length; index += 1) {
    expect(nodes[index - 1].compareDocumentPosition(nodes[index]) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  }
})

it("chooses a quintuplet from the subdivision panel", async () => {
  const user = userEvent.setup()
  const onChange = vi.fn()
  const session = createDefaultSession(() => "cycle-1")
  session.click = "click-2"
  const segments = expandSession(session)
  const { rerender } = render(
    <Practice
      session={session}
      segments={segments}
      snapshot={snapshotAt(segments, 0)}
      status="stopped"
      onToggle={() => {}}
      onJump={() => {}}
      onReset={() => {}}
      onEdit={() => {}}
      onChange={onChange}
      onSeek={() => {}}
    />,
  )
  const button = screen.getByRole("button", { name: "Subdivision" })
  expect(button).not.toHaveTextContent("5")
  await user.click(button)
  await user.click(screen.getByRole("button", { name: "Quintuplet" }))
  const next = onChange.mock.calls.at(-1)?.[0]
  expect(next.subdivision).toBe("quintuplet")
  expect(next.slots).toEqual(["click-2", "click-2", "click-2", "click-2", "click-2"])
  rerender(
    <Practice
      session={next}
      segments={expandSession(next)}
      snapshot={snapshotAt(expandSession(next), 0)}
      status="stopped"
      onToggle={() => {}}
      onJump={() => {}}
      onReset={() => {}}
      onEdit={() => {}}
      onChange={onChange}
      onSeek={() => {}}
    />,
  )
  expect(screen.getByRole("button", { name: "Subdivision" })).toHaveTextContent("5")
  expect(screen.queryByRole("button", { name: "Quintuplet" })).not.toBeInTheDocument()
})
```

Replace "shows sixteenth syllables on the stage and leaves a beat unlabeled" with this. The captions stay on the editor, which Task 1 already tests.

```ts
it("does not show slot clicks on the practice stage", () => {
  const session = createDefaultSession(() => "cycle-1")
  session.subdivision = "sixteenth"
  session.slots = ["click-1", "click-1", "click-1", "click-1"]
  const segments = expandSession(session)
  render(
    <Practice
      session={session}
      segments={segments}
      snapshot={snapshotAt(segments, 0)}
      status="stopped"
      onToggle={() => {}}
      onJump={() => {}}
      onReset={() => {}}
      onEdit={() => {}}
      onChange={() => {}}
      onSeek={() => {}}
    />,
  )
  expect(screen.queryByRole("combobox", { name: "e click" })).not.toBeInTheDocument()
  expect(screen.getByRole("button", { name: "Subdivision" })).toBeInTheDocument()
})
```

In "shows the following stretch during a rest", add:

```ts
expect(screen.queryByRole("button", { name: "Time signature" })).not.toBeInTheDocument()
expect(screen.getByRole("button", { name: "Play" })).toBeInTheDocument()
```

- [ ] **Step 2: Run the practice tests to verify they fail**

Run: `npm test -- src/Practice.test.tsx`

Expected: FAIL. The stage still has a Time signature group and a Beat click combobox, and there is no Subdivision button.

- [ ] **Step 3: Draw the note and open the panels**

Create `src/NoteIcon.tsx`:

```tsx
import type { Subdivision } from "./types"

const mark: Record<Subdivision, string> = {
  quarter: "",
  eighth: "",
  triplet: "3",
  sixteenth: "",
  quintuplet: "5",
  sextuplet: "6",
}

export function NoteIcon(props: { subdivision: Subdivision }) {
  const flags = props.subdivision === "quarter" ? 0 : props.subdivision === "sixteenth" ? 2 : 1
  return (
    <svg aria-hidden="true" viewBox="0 0 32 32" width="28" height="28">
      <ellipse cx="11" cy="24" rx="6" ry="4.5" fill="currentColor" />
      <rect x="16" y="6" width="2" height="18" fill="currentColor" />
      {flags > 0 && <path d="M18 6c6 2 8 6 8 8-4-1-8-1-8 2V6z" fill="currentColor" />}
      {flags > 1 && <path d="M18 11c6 2 8 6 8 8-4-1-8-1-8 2V11z" fill="currentColor" />}
      {mark[props.subdivision] && (
        <text x="22" y="30" fontSize="11" fontFamily="system-ui, sans-serif" fill="currentColor">
          {mark[props.subdivision]}
        </text>
      )}
    </svg>
  )
}
```

A quarter note has a stem and no flag. An eighth note has one flag. A sixteenth note has two flags. Triplet, quintuplet, and sextuplet have one flag plus 3, 5, or 6.

Create `src/StagePicks.tsx`:

```tsx
import { useEffect, useRef, useState } from "react"
import { SUBDIVISION_SLOTS } from "./session"
import { NoteIcon } from "./NoteIcon"
import { BEATS, NOTES, SUBDIVISIONS, type Session, type Subdivision } from "./types"

const names: Record<Subdivision, string> = {
  quarter: "Quarter",
  eighth: "Eighth",
  triplet: "Triplet",
  sixteenth: "Sixteenth",
  quintuplet: "Quintuplet",
  sextuplet: "Sextuplet",
}

export function StagePicks(props: { session: Session; onChange(session: Session): void }) {
  const [open, setOpen] = useState<"meter" | "subdivision" | null>(null)
  const rootRef = useRef<HTMLDivElement>(null)
  const [beats, note] = props.session.meter.split("/")

  useEffect(() => {
    if (!open) return
    function onPointer(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(null)
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(null)
    }
    document.addEventListener("pointerdown", onPointer)
    document.addEventListener("keydown", onKey)
    return () => {
      document.removeEventListener("pointerdown", onPointer)
      document.removeEventListener("keydown", onKey)
    }
  }, [open])

  function chooseMeter(nextBeats: string, nextNote: string) {
    props.onChange({ ...props.session, meter: `${nextBeats}/${nextNote}` })
  }

  return (
    <div className="stage-picks" ref={rootRef}>
      <div className="stage-pick-row">
        <button
          type="button"
          aria-label="Time signature"
          aria-expanded={open === "meter"}
          onClick={() => setOpen(open === "meter" ? null : "meter")}
        >
          {props.session.meter}
        </button>
        <button
          type="button"
          aria-label="Subdivision"
          aria-expanded={open === "subdivision"}
          onClick={() => setOpen(open === "subdivision" ? null : "subdivision")}
        >
          <NoteIcon subdivision={props.session.subdivision} />
        </button>
      </div>
      {open === "meter" && (
        <div className="stage-panel" role="group" aria-label="Choose time signature">
          <select aria-label="Beats" value={beats} onChange={(event) => chooseMeter(event.target.value, note)}>
            {BEATS.map((value) => <option key={value} value={value}>{value}</option>)}
          </select>
          <span aria-hidden="true">/</span>
          <select aria-label="Note" value={note} onChange={(event) => chooseMeter(beats, event.target.value)}>
            {NOTES.map((value) => <option key={value} value={value}>{value}</option>)}
          </select>
        </div>
      )}
      {open === "subdivision" && (
        <div className="stage-panel" role="group" aria-label="Choose subdivision">
          {SUBDIVISIONS.map((subdivision) => (
            <button
              key={subdivision}
              type="button"
              onClick={() => {
                props.onChange({
                  ...props.session,
                  subdivision,
                  slots: Array.from({ length: SUBDIVISION_SLOTS[subdivision] }, () => props.session.click),
                })
                setOpen(null)
              }}
            >
              <NoteIcon subdivision={subdivision} />
              {names[subdivision]}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
```

In `src/Practice.tsx`, render `<StagePicks session={props.session} onChange={(next) => props.onChange(clampSession(next))} />` after the clock and before the BPM paragraph. Remove the `Signature` render. Leave the BPM paragraph, the beat dots, and the transport in that order. A rest still hides BPM, the dots, and these buttons, and still shows the next-up line.

In `src/app.css`, add:

```css
.stage-picks { display: flex; flex-direction: column; align-items: center; gap: 8px; }
.stage-pick-row { display: flex; justify-content: center; gap: 12px; }
.stage-pick-row > button {
  width: 64px;
  height: 64px;
  border: 0;
  border-radius: 12px;
  background: rgba(0, 0, 0, 0.22);
  color: inherit;
  font: inherit;
  display: grid;
  place-items: center;
  padding: 0;
}
.stage-panel {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  align-items: center;
  gap: 8px;
  background: rgba(0, 0, 0, 0.28);
  border-radius: 12px;
  padding: 8px;
}
.stage-panel button {
  display: flex;
  align-items: center;
  gap: 8px;
  background: transparent;
  border: 0;
  color: inherit;
}
.stage select:focus, .stage-pick-row > button:focus { outline: 2px solid currentColor; outline-offset: 6px; border-radius: 8px; }
```

The editor's `.editor-screen select` rules do not apply on the stage. Do not change `Signature.tsx` in this task.

- [ ] **Step 4: Run the practice tests to verify they pass**

Run: `npm test -- src/Practice.test.tsx src/Edit.test.tsx`

Expected: PASS. The editor still has the labeled Subdivision select and the slot captions.

- [ ] **Step 5: Run the full suite**

Run: `npm test`

Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/NoteIcon.tsx src/StagePicks.tsx src/Practice.tsx src/Practice.test.tsx src/app.css
git commit -m "Pick the time signature and subdivision from two stage buttons."
```

Do not stage `src/tokens.css`, `src/tokens.test.ts`, or `.vite/`.
