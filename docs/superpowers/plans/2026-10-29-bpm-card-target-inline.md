# BPM Card Target Inline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When "Increase to target" is active in Simple mode, surface Target BPM and Step as inline-editable fields directly in the BPM card on the Practice page.

**Architecture:** Two files change — `src/Practice.tsx` restructures the `.bpm-top` zone (wraps BPM input + label in a left column, adds a conditional right column with two inline-edit inputs) and adds two commit functions + two ref/state pairs. `src/app.css` adds new layout classes for the two-column top zone and the field inputs.

**Tech Stack:** React 19, TypeScript, plain CSS, Vitest 3 + Testing Library

---

## File Map

- **Modify:** `src/Practice.tsx` — restructure `.bpm-top` JSX; add `targetRef`, `stepRef`, `targetText`, `stepText` state; add `commitTarget`, `commitStep` functions
- **Modify:** `src/app.css` — update `.bpm-top`; add `.bpm-left`, `.bpm-right`, `.bpm-target-group`, `.bpm-field-label`, `.bpm-field-value`
- **Test:** `src/Practice.test.tsx` — add tests for target-on visibility, target-off/routine hiding, and inline edit commits

---

### Task 1: TDD — write failing tests, then implement

Write the tests first, then implement the JSX and CSS together (they are tightly coupled — new class names need new CSS rules to render correctly).

**Files:**
- Modify: `src/Practice.test.tsx`
- Modify: `src/Practice.tsx`
- Modify: `src/app.css`

- [ ] **Step 1: Write failing tests**

Add after the `"does not commit BPM when input is cleared"` test in `src/Practice.test.tsx`:

```ts
it("shows Target and Step inputs when target is on in simple mode", () => {
  render(<Practice {...makeProps({ bpmIncrease: 5, time: { seconds: 120, targetBpm: 120, increaseEvery: "bars", everySec: 30, everyBars: 4 } })} />)
  expect(screen.getByRole("textbox", { name: "Target BPM" })).toBeInTheDocument()
  expect(screen.getByRole("textbox", { name: "BPM step" })).toBeInTheDocument()
})

it("hides Target and Step when target is off", () => {
  render(<Practice {...makeProps()} />)
  expect(screen.queryByRole("textbox", { name: "Target BPM" })).not.toBeInTheDocument()
  expect(screen.queryByRole("textbox", { name: "BPM step" })).not.toBeInTheDocument()
})

it("hides Target and Step in routine mode even when increaseEvery is bars", () => {
  render(<Practice {...makeProps({ routineEnabled: true, time: { seconds: 120, targetBpm: 120, increaseEvery: "bars", everySec: 30, everyBars: 4 } })} />)
  expect(screen.queryByRole("textbox", { name: "Target BPM" })).not.toBeInTheDocument()
  expect(screen.queryByRole("textbox", { name: "BPM step" })).not.toBeInTheDocument()
})

it("commits target BPM on blur", async () => {
  const props = makeProps({ bpmIncrease: 5, time: { seconds: 120, targetBpm: 120, increaseEvery: "bars", everySec: 30, everyBars: 4 } })
  const user = userEvent.setup()
  render(<Practice {...props} />)
  const input = screen.getByRole("textbox", { name: "Target BPM" })
  await user.clear(input)
  await user.type(input, "140")
  await user.tab()
  expect(props.onChange).toHaveBeenCalledWith(expect.objectContaining({
    time: expect.objectContaining({ targetBpm: 140 })
  }))
})

it("commits step on blur", async () => {
  const props = makeProps({ bpmIncrease: 5, time: { seconds: 120, targetBpm: 120, increaseEvery: "bars", everySec: 30, everyBars: 4 } })
  const user = userEvent.setup()
  render(<Practice {...props} />)
  const input = screen.getByRole("textbox", { name: "BPM step" })
  await user.clear(input)
  await user.type(input, "10")
  await user.tab()
  expect(props.onChange).toHaveBeenCalledWith(expect.objectContaining({ bpmIncrease: 10 }))
})

it("does not commit target when cleared", async () => {
  const props = makeProps({ bpmIncrease: 5, time: { seconds: 120, targetBpm: 120, increaseEvery: "bars", everySec: 30, everyBars: 4 } })
  const user = userEvent.setup()
  render(<Practice {...props} />)
  const input = screen.getByRole("textbox", { name: "Target BPM" })
  await user.clear(input)
  await user.tab()
  expect(props.onChange).not.toHaveBeenCalled()
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm run test -- src/Practice.test.tsx
```

Expected: 6 new FAILs — `"Target BPM"` and `"BPM step"` elements do not exist yet.

- [ ] **Step 3: Add refs and state for target and step in `src/Practice.tsx`**

Find the existing ref/state block for inline BPM editing (lines ~29–37). Add two more pairs directly after it:

```tsx
  // Inline BPM editing
  const bpmRef = useRef<string | null>(null)
  const [bpmText, setBpmText] = useState<string | null>(null)

  // Inline target / step editing
  const targetRef = useRef<string | null>(null)
  const stepRef = useRef<string | null>(null)
  const [targetText, setTargetText] = useState<string | null>(null)
  const [stepText, setStepText] = useState<string | null>(null)
```

- [ ] **Step 4: Add `commitTarget` and `commitStep` functions in `src/Practice.tsx`**

Find `commitBpm` (lines ~32–37). Add two functions directly after it:

```tsx
  function commitTarget() {
    const v = targetRef.current; setTargetText(null); targetRef.current = null
    if (v === null || v.trim() === "") return
    const next = clampBpm(Number(v))
    if (next !== props.session.time.targetBpm) props.onChange(clampSession({ ...props.session, time: { ...props.session.time, targetBpm: next } }))
  }

  function commitStep() {
    const v = stepRef.current; setStepText(null); stepRef.current = null
    if (v === null || v.trim() === "") return
    const n = Math.max(0, Math.round(Number(v)))
    if (!Number.isFinite(n) || n === props.session.bpmIncrease) return
    props.onChange(clampSession({ ...props.session, bpmIncrease: n }))
  }
```

- [ ] **Step 5: Restructure the `.bpm-top` JSX in `src/Practice.tsx`**

Find the `{/* BPM + pick */}` section (lines ~143–204). Replace the `<div className="bpm-top">` block:

```tsx
// Before:
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

// After:
            <div className="bpm-top">
              <div className="bpm-left">
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
              {!routineEnabled && props.session.time.increaseEvery !== "off" && (
                <div className="bpm-right">
                  <div className="bpm-target-group">
                    <span className="bpm-field-label">Target</span>
                    <input
                      className="bpm-field-value"
                      inputMode="numeric"
                      aria-label="Target BPM"
                      value={targetText ?? String(props.session.time.targetBpm)}
                      onFocus={() => { targetRef.current = String(props.session.time.targetBpm); setTargetText(String(props.session.time.targetBpm)) }}
                      onChange={(e) => { targetRef.current = e.target.value; setTargetText(e.target.value) }}
                      onBlur={commitTarget}
                      onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur() }}
                    />
                  </div>
                  <div className="bpm-target-group">
                    <span className="bpm-field-label">Step</span>
                    <input
                      className="bpm-field-value"
                      inputMode="numeric"
                      aria-label="BPM step"
                      value={stepText ?? String(props.session.bpmIncrease)}
                      onFocus={() => { stepRef.current = String(props.session.bpmIncrease); setStepText(String(props.session.bpmIncrease)) }}
                      onChange={(e) => { stepRef.current = e.target.value; setStepText(e.target.value) }}
                      onBlur={commitStep}
                      onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur() }}
                    />
                  </div>
                </div>
              )}
            </div>
```

- [ ] **Step 6: Update CSS in `src/app.css`**

**6a. Update `.bpm-top`** — change `align-items: flex-end` to `align-items: stretch` so both columns can fill the full height of the top zone:

Find line ~275:
```css
.bpm-top { display: flex; justify-content: space-between; align-items: flex-end; padding: 14px 16px 12px; }
```
Replace with:
```css
.bpm-top { display: flex; justify-content: space-between; align-items: stretch; padding: 14px 16px 12px; }
```

**6b. Add new classes** after `.bpm-label` (line ~319):

```css
.bpm-left { display: flex; flex-direction: column; justify-content: flex-end; gap: 2px; min-width: 0; }
.bpm-right { display: flex; flex-direction: column; justify-content: space-between; align-items: flex-end; }
.bpm-target-group { display: flex; flex-direction: column; align-items: flex-end; gap: 0; }
.bpm-field-label { font-size: 9px; color: var(--ink-muted); text-transform: uppercase; letter-spacing: 0.5px; line-height: 1; }
.bpm-field-value {
  font-size: 15px;
  font-weight: 600;
  color: var(--ink-muted);
  background: none;
  border: none;
  border-bottom: 1px solid var(--line);
  text-align: right;
  width: 44px;
  padding: 0;
  font-family: inherit;
  line-height: 1.15;
  outline: none;
}
.bpm-field-value:focus { border-bottom-color: var(--blue); color: var(--ink); }
```

- [ ] **Step 7: Run the tests**

```bash
npm run test -- src/Practice.test.tsx
```

Expected: all tests pass including the 6 new ones.

- [ ] **Step 8: Run the full suite**

```bash
npm run test
```

Expected: all tests pass.

- [ ] **Step 9: Commit**

```bash
git add src/Practice.tsx src/Practice.test.tsx src/app.css
git commit -m "feat: show Target BPM and Step inline in BPM card when target is on"
```
