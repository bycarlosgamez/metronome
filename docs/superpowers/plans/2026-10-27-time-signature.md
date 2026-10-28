# Time Signature Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Lead with the Time pill, choose a time signature as two numbers, and give each subdivision slot its own click.

**Architecture:** A time signature stays a string such as `"4/4"`. The top number is the beats in a bar. The bottom number is only the written note. `Session.subdivision` and `Session.slots` split each beat, and `clicksInSegment` emits one mark per sounding slot. The scheduler plays that slot's click. The stage beat still advances once per beat.

**Tech Stack:** Vite 6, React 19, TypeScript, Vitest 3, Testing Library, user-event. `npm test` is `vitest run`.

## Global Constraints

- The type pills read Time, Simple, Complex.
- A new session still opens as Simple.
- The label is Time signature, on the tempo card and on the practice page.
- Beats is an integer from 1 to 16. Note is 1, 2, 4, or 8. The stored value stays a string such as `"4/4"`.
- A fresh session is 4/4. A saved 3/4, 5/4, 6/8, or 7/8 still loads. Anything else loads as 4/4.
- The top number is the beats in a bar. Click spacing stays `60 / played BPM`. A bar's length stays `beats × 60 / played BPM`. 6/8 still clicks 6 times a bar.
- The count-in stays four beats in 4/4 and does not subdivide.
- Subdivision is quarter, eighth, triplet, or sixteenth. Quarter is the beat and the default.
- Each slot is `click-1`, `click-2`, `click-3`, `click-4`, or `off`.
- Choosing a subdivision fills every slot with the stored `click`.
- The first slot of the beat, when set to a click, also stores that click. Off does not.
- The first slot of beat 1 plays the higher accent of its click. Every other sounding slot plays the normal pitch. Off plays nothing.
- The stage shows one dot per beat. The dot changes when the next beat starts.
- The stage, the transport, and the strip stay where they are.
- The stored `click` field stays. Old documents still load it.
- Stay on `feat/restyle` in this checkout. Do not create a git worktree. Do not implement on `main`.
- Do not stage `src/tokens.css`, `src/tokens.test.ts`, or `.vite/`.

## File structure

- `src/types.ts` — `Meter` is a string. `Subdivision`, `Slot`, `BEATS`, and `NOTES`.
- `src/session.ts` — `clampMeter`, `clampSubdivision`, and `clampSlots`. `beatsInMeter` still reads the top number.
- `src/Signature.tsx` — the shared Time signature control, then the subdivision control.
- `src/Edit.tsx` — Time is the first pill. The tempo card uses `Signature`.
- `src/Practice.tsx` — the stage uses the same control where the meter select is.
- `src/expandSession.ts` — a play segment carries `slots`. A count-in carries `click` and no slots.
- `src/clock.ts` — `ClickMark.click`. Slots divide the beat. `beatAt` still steps once per beat.
- `src/audio.ts` — a scheduled click uses the buffers for `mark.click`.
- `src/App.tsx` — build all four click buffers.
- `src/app.css` — the two signature selects sit on one row.
- Tests live beside those files.

---

### Task 1: Choose the two numbers

**Files:**
- Modify: `src/types.ts`
- Modify: `src/session.ts`
- Modify: `src/session.test.ts`
- Create: `src/Signature.tsx`
- Modify: `src/Edit.tsx`
- Modify: `src/Edit.test.tsx`
- Modify: `src/Practice.tsx`
- Modify: `src/Practice.test.tsx`
- Modify: `src/app.css`

**Interfaces:**
- Consumes: `Session.meter`, `Session.click`, `clampSession`.
- Produces:
  - `type Meter = string`
  - `type Subdivision = "quarter" | "eighth" | "triplet" | "sixteenth"`
  - `type Slot = ClickId | "off"`
  - `BEATS` is `1` through `16`. `NOTES` is `[1, 2, 4, 8]`.
  - `Session.subdivision: Subdivision` and `Session.slots: Slot[]`
  - `function Signature(props: { session: Session; onChange(session: Session): void }): JSX.Element`

- [ ] **Step 1: Write the failing session tests**

In `src/session.test.ts`, add `subdivision: "quarter"` and `slots: ["click-1"]` to the expected `createDefaultSession` object.

Add:

```ts
it("keeps a known time signature and rejects an unknown bottom number", () => {
  const session = createDefaultSession(() => "cycle-1")
  session.meter = "5/4"
  expect(clampSession(session).meter).toBe("5/4")
  session.meter = "16/8"
  expect(clampSession(session).meter).toBe("16/8")
  session.meter = "7/16"
  expect(clampSession(session).meter).toBe("4/4")
  session.meter = "0/4"
  expect(clampSession(session).meter).toBe("4/4")
  delete (session as { subdivision?: unknown }).subdivision
  delete (session as { slots?: unknown }).slots
  session.click = "click-2"
  const loaded = clampSession(session)
  expect(loaded.subdivision).toBe("quarter")
  expect(loaded.slots).toEqual(["click-2"])
  session.subdivision = "nope" as "quarter"
  session.slots = ["click-3", "off", "click-4", "click-1"]
  const unknown = clampSession(session)
  expect(unknown.subdivision).toBe("quarter")
  expect(unknown.slots).toEqual(["click-3"])
  session.subdivision = "eighth"
  session.click = "click-2"
  session.slots = ["click-3"]
  expect(clampSession(session).slots).toEqual(["click-3", "click-2"])
})
```

- [ ] **Step 2: Run the session test to verify it fails**

Run: `npm test -- src/session.test.ts`

Expected: FAIL. `subdivision` is missing from the default session.

- [ ] **Step 3: Store and clamp the signature**

In `src/types.ts`, replace the `METERS` union with:

```ts
export type Meter = string

export const BEATS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16] as const
export const NOTES = [1, 2, 4, 8] as const

export const SUBDIVISIONS = ["quarter", "eighth", "triplet", "sixteenth"] as const
export type Subdivision = (typeof SUBDIVISIONS)[number]

export type Slot = ClickId | "off"
```

Add `subdivision: Subdivision` and `slots: Slot[]` to `Session` after `click`.

In `src/types.ts`, delete `METERS`. Nothing else imports it once the two screens stop.

In `src/session.ts`, replace both `METERS.includes(...)` checks with `clampMeter`. Add `subdivision: "quarter"` and `slots: [click]` to the object `migrateLegacy` passes to `clampSession`, using the same `click` already chosen there. `clampSession` still repairs a document that omits them. Add:

```ts
export const SUBDIVISION_SLOTS: Record<Subdivision, number> = {
  quarter: 1,
  eighth: 2,
  triplet: 3,
  sixteenth: 4,
}

export function clampMeter(meter: string | undefined): Meter {
  const [beats, note] = (meter ?? "").split("/")
  const top = Number(beats)
  const bottom = Number(note)
  if (!BEATS.includes(top as (typeof BEATS)[number])) return "4/4"
  if (!NOTES.includes(bottom as (typeof NOTES)[number])) return "4/4"
  return `${top}/${bottom}`
}

function clampSlot(value: unknown, fallback: ClickId): Slot {
  if (value === "off") return "off"
  return CLICKS.includes(value as ClickId) ? value as ClickId : fallback
}

export function clampSlots(subdivision: Subdivision, slots: unknown, click: ClickId): Slot[] {
  const list = Array.isArray(slots) ? slots : []
  return Array.from({ length: SUBDIVISION_SLOTS[subdivision] }, (_, index) => clampSlot(list[index], click))
}
```

`beatsInMeter` stays `Number(meter.split("/")[0])`. `createDefaultSession` sets `subdivision: "quarter"` and `slots: ["click-1"]`.

In `clampSession`, replace the `click` line and the `meter` line with:

```ts
const click = CLICKS.includes(session.click) ? session.click : "click-1"
const subdivision = SUBDIVISIONS.includes(session.subdivision) ? session.subdivision : "quarter"
```

and in the returned object:

```ts
meter: clampMeter(session.meter),
click,
subdivision,
slots: clampSlots(subdivision, session.slots, click),
```

Keep every other field in that return. `migrateLegacy` passes `subdivision: "quarter"` and `slots: [click]` so the object matches `Session`. `clampSession` still repairs a saved document that omits them.

- [ ] **Step 4: Run the session test to verify it passes**

Run: `npm test -- src/session.test.ts`

Expected: PASS

- [ ] **Step 5: Write the failing editor and practice tests**

In `src/Edit.test.tsx`, add:

```ts
it("puts Time first and stores the two time-signature numbers", async () => {
  const user = userEvent.setup()
  const onChange = vi.fn()
  render(<Edit session={createDefaultSession(() => "cycle-1")} onChange={onChange} onDone={() => {}} />)
  const types = within(screen.getByRole("group", { name: "Type" })).getAllByRole("button")
  expect(types.map((button) => button.textContent)).toEqual(["Time", "Simple", "Complex"])
  const signature = screen.getByRole("group", { name: "Time signature" })
  expect(within(signature).getByRole("combobox", { name: "Beats" })).toHaveValue("4")
  expect(within(signature).getByRole("combobox", { name: "Note" })).toHaveValue("4")
  expect(screen.queryByRole("combobox", { name: "Meter" })).not.toBeInTheDocument()
  const beatOptions = [...within(signature).getByRole("combobox", { name: "Beats" }).querySelectorAll("option")].map((option) => option.value)
  const noteOptions = [...within(signature).getByRole("combobox", { name: "Note" }).querySelectorAll("option")].map((option) => option.value)
  expect(beatOptions).toEqual(["1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12", "13", "14", "15", "16"])
  expect(noteOptions).toEqual(["1", "2", "4", "8"])
  await user.selectOptions(within(signature).getByRole("combobox", { name: "Beats" }), "16")
  await user.selectOptions(within(signature).getByRole("combobox", { name: "Note" }), "8")
  expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ meter: "16/8" }))
})
```

`within` is already imported in `src/Edit.test.tsx`.

In `src/Practice.test.tsx`, replace the Meter selection in "edits duration, tempo, and meter on the stage" with:

```ts
expect(screen.queryByRole("combobox", { name: "Meter" })).not.toBeInTheDocument()
const signature = screen.getByRole("group", { name: "Time signature" })
await user.selectOptions(within(signature).getByRole("combobox", { name: "Beats" }), "3")
expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ meter: "3/4" }))
```

Import `within` from `@testing-library/react`.

- [ ] **Step 6: Run the UI tests to verify they fail**

Run: `npm test -- src/Edit.test.tsx src/Practice.test.tsx`

Expected: FAIL. The type group still starts with Simple, and there is no Time signature group.

- [ ] **Step 7: Show the two selectors**

Create `src/Signature.tsx`:

```tsx
import { BEATS, NOTES, type Session } from "./types"

export function Signature(props: { session: Session; onChange(session: Session): void }) {
  const [beats, note] = props.session.meter.split("/")
  function choose(nextBeats: string, nextNote: string) {
    props.onChange({ ...props.session, meter: `${nextBeats}/${nextNote}` })
  }
  return (
    <div className="signature" role="group" aria-label="Time signature">
      <span>Time signature</span>
      <select aria-label="Beats" value={beats} onChange={(event) => choose(event.target.value, note)}>
        {BEATS.map((value) => <option key={value} value={value}>{value}</option>)}
      </select>
      <span aria-hidden="true">/</span>
      <select aria-label="Note" value={note} onChange={(event) => choose(beats, event.target.value)}>
        {NOTES.map((value) => <option key={value} value={value}>{value}</option>)}
      </select>
    </div>
  )
}
```

In `src/Edit.tsx`, render the Time pill first. Replace the Meter label with `<Signature session={session} onChange={commit} />`. Remove the unused `METERS` and `Meter` imports. Leave the Click selector in place until Task 3.

In `src/Practice.tsx`, replace the meter `<select>` with:

```tsx
<Signature
  session={props.session}
  onChange={(next) => props.onChange(clampSession(next))}
/>
```

Remove the unused `METERS` and `Meter` imports. `clampSession` is already imported.

In `src/app.css`, add:

```css
.signature { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.signature select { width: auto; }
.editor-screen .signature select {
  appearance: none;
  padding-right: 40px;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 12 12'%3E%3Cpath d='M2.5 4.5 6 8l3.5-3.5' fill='none' stroke='%23bdbdbd' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 12px center;
  background-size: 12px 12px;
}
.stage .signature { justify-content: center; }
.stage .signature select { background: transparent; color: inherit; border: 0; text-align: center; }
```

Do not move the stage, the transport, or the strip.

- [ ] **Step 8: Run the UI tests to verify they pass**

Run: `npm test -- src/session.test.ts src/Edit.test.tsx src/Practice.test.tsx`

Expected: PASS

- [ ] **Step 9: Commit**

```bash
git add src/types.ts src/session.ts src/session.test.ts src/Signature.tsx src/Edit.tsx src/Edit.test.tsx src/Practice.tsx src/Practice.test.tsx src/app.css
git commit -m "Choose a time signature from its two numbers."
```

Do not stage `src/tokens.css`, `src/tokens.test.ts`, or `.vite/`.

---

### Task 2: Play each slot

**Files:**
- Modify: `src/expandSession.ts`
- Modify: `src/clock.ts`
- Modify: `src/clock.test.ts`
- Modify: `src/audio.ts`
- Modify: `src/audio.test.ts`
- Modify: `src/App.tsx`
- Modify: `src/Practice.test.tsx`

**Interfaces:**
- Consumes: `Session.slots`, `Session.click`, `Session.subdivision`, `beatsInMeter`, `bpmAt`.
- Produces:
  - `ClickMark = { offsetSec: number; beat: number; accent: boolean; click: ClickId }`
  - `Segment.slots?: Slot[]` on play segments
  - `Segment.click: ClickId` on every segment
  - `scheduleSegment(ctx, sounds, segment, when)` where `sounds.clicks[mark.click]` supplies the normal and accent buffers, and `sounds.restCue` supplies the rest.

- [ ] **Step 1: Write the failing playback tests**

In `src/clock.test.ts`, add:

```ts
it("divides a beat into eighths and skips an off slot", () => {
  const session = createDefaultSession(() => "cycle-1")
  session.bpm = 80
  session.meter = "4/4"
  session.subdivision = "eighth"
  session.slots = ["click-1", "click-1"]
  const segments = expandSession(session)
  const countIn = clicksInSegment(segments[0])
  expect(countIn).toHaveLength(4)
  expect(countIn.map((click) => click.offsetSec)).toEqual([0, 0.75, 1.5, 2.25])

  const play = segments.find((segment) => segment.kind === "play")!
  const clicks = clicksInSegment(play)
  expect(clicks[0]).toMatchObject({ offsetSec: 0, beat: 1, accent: true, click: "click-1" })
  expect(clicks[1].offsetSec).toBeCloseTo(0.375)
  expect(clicks[1]).toMatchObject({ beat: 1, accent: false, click: "click-1" })
  expect(clicks[2].offsetSec).toBeCloseTo(0.75)
  expect(clicks[2]).toMatchObject({ beat: 2, accent: false })
  expect(snapshotAt(segments, segments[0].durationSec + 0.4).beat).toBe(1)

  session.slots = ["click-1", "off"]
  const beatsOnly = clicksInSegment(expandSession(session).find((segment) => segment.kind === "play")!)
  expect(beatsOnly.slice(0, 4).map((click) => click.offsetSec)).toEqual([0, 0.75, 1.5, 2.25])

  session.meter = "6/8"
  session.subdivision = "quarter"
  session.slots = ["click-1"]
  const six = clicksInSegment(expandSession(session).find((segment) => segment.kind === "play")!)
  expect(six.slice(0, 6).map((click) => click.beat)).toEqual([1, 2, 3, 4, 5, 6])
  expect(six[1].offsetSec - six[0].offsetSec).toBeCloseTo(60 / 80)

  session.meter = "4/8"
  const fourEight = clicksInSegment(expandSession(session).find((segment) => segment.kind === "play")!)
  expect(fourEight[1].offsetSec - fourEight[0].offsetSec).toBeCloseTo(60 / 80)
})
```

In `src/Practice.test.tsx`, add:

```ts
it("shows one dot per beat while the eighths play", () => {
  const session = createDefaultSession(() => "cycle-1")
  session.subdivision = "eighth"
  session.slots = ["click-1", "click-2"]
  const segments = expandSession(session)
  const playIndex = segments.findIndex((segment) => segment.kind === "play")
  const elapsed = segments.slice(0, playIndex).reduce((sum, segment) => sum + segment.durationSec, 0)
  render(
    <Practice
      session={session}
      segments={segments}
      snapshot={snapshotAt(segments, elapsed + 0.4)}
      status="stopped"
      onToggle={() => {}}
      onJump={() => {}}
      onReset={() => {}}
      onEdit={() => {}}
      onChange={() => {}}
      onSeek={() => {}}
    />,
  )
  expect(screen.getAllByTestId(/beat-/)).toHaveLength(4)
  expect(screen.getByTestId("beat-1")).toHaveAttribute("data-current", "true")
})
```

Replace `src/audio.test.ts` with this. The count-in still starts at 10, 11, 12, and 13. The new case plays beat 1 from the click-1 accent buffer and the "&" from the click-2 normal buffer.

```ts
import { describe, expect, it } from "vitest"
import { scheduleSegment, type ClickSounds } from "./audio"
import { expandSession } from "./expandSession"
import { createDefaultSession } from "./session"

function fakeContext() {
  const started: { when: number; name: string }[] = []
  const sounds: ClickSounds = {
    restCue: { name: "cue" } as unknown as AudioBuffer,
    clicks: {
      "click-1": {
        normal: { name: "normal" } as unknown as AudioBuffer,
        accent: { name: "accent" } as unknown as AudioBuffer,
      },
      "click-2": {
        normal: { name: "click-2-normal" } as unknown as AudioBuffer,
        accent: { name: "click-2-accent" } as unknown as AudioBuffer,
      },
      "click-3": {
        normal: { name: "click-3-normal" } as unknown as AudioBuffer,
        accent: { name: "click-3-accent" } as unknown as AudioBuffer,
      },
      "click-4": {
        normal: { name: "click-4-normal" } as unknown as AudioBuffer,
        accent: { name: "click-4-accent" } as unknown as AudioBuffer,
      },
    },
  }
  return {
    started,
    sounds,
    ctx: {
      currentTime: 0,
      createBufferSource() {
        let chosen = ""
        return {
          set buffer(value: { name: string }) {
            chosen = value.name
          },
          connect() {},
          start(when: number) {
            started.push({ when, name: chosen })
          },
        }
      },
    } as unknown as AudioContext,
  }
}

describe("scheduleSegment", () => {
  it("schedules four count-in clicks and one rest cue", () => {
    const session = createDefaultSession(() => "set-1")
    session.bpm = 60
    session.simple.practices = 2
    session.simple.restAfterSec = 30
    const segments = expandSession(session)
    const { ctx, sounds, started } = fakeContext()
    scheduleSegment(ctx, sounds, segments[0], 10)
    expect(started.map((click) => click.when)).toEqual([10, 11, 12, 13])
    expect(started[0].name).toBe("accent")
    expect(started[1].name).toBe("normal")

    started.length = 0
    const rest = segments.find((segment) => segment.kind === "rest")!
    scheduleSegment(ctx, sounds, rest, 20)
    expect(started).toEqual([{ when: 20, name: "cue" }])
  })

  it("plays an eighth slot from that slot's normal buffer", () => {
    const session = createDefaultSession(() => "set-1")
    session.bpm = 80
    session.subdivision = "eighth"
    session.slots = ["click-1", "click-2"]
    const play = expandSession(session).find((segment) => segment.kind === "play")!
    const { ctx, sounds, started } = fakeContext()
    scheduleSegment(ctx, sounds, play, 0)
    expect(started[0]).toEqual({ when: 0, name: "accent" })
    expect(started[1].when).toBeCloseTo(0.375)
    expect(started[1].name).toBe("click-2-normal")
  })
})
```

- [ ] **Step 2: Run the playback tests to verify they fail**

Run: `npm test -- src/clock.test.ts src/Practice.test.tsx src/audio.test.ts`

Expected: FAIL. Eighth clicks are still 0.75 seconds apart, and `scheduleSegment` does not accept a per-click buffer map.

- [ ] **Step 3: Emit one mark per sounding slot**

Add `click: ClickId` to `Segment`. Add `slots?: Slot[]`. Set `click: session.click` on the count-in, the play, and the rest. Set `slots: session.slots` on the play only. Add `click: "click-1"` to the hand-built segment in `src/clock.test.ts`. It has no `slots`, so it still plays one click per beat.

In `src/clock.ts`, add `click: ClickId` to `ClickMark`. Replace the body of `clicksInSegment` with a beat walk. A count-in, and a play with no slots, uses one slot: `[segment.click]`. Otherwise it uses `segment.slots`.

```ts
export function clicksInSegment(segment: Segment): ClickMark[] {
  if (segment.kind === "rest") return []
  const slots = segment.kind === "count-in" || !segment.slots?.length ? [segment.click] : segment.slots
  const beats = segment.kind === "count-in" ? 4 : beatsInMeter(segment.meter)
  const marks: ClickMark[] = []
  let offsetSec = 0
  let beatIndex = 0
  while (offsetSec < segment.durationSec - 1e-9) {
    const beatDur = 60 / bpmAt(segment, offsetSec)
    if (!(beatDur > 0)) break
    const beat = (beatIndex % beats) + 1
    const slotDur = beatDur / slots.length
    slots.forEach((slot, index) => {
      const at = offsetSec + index * slotDur
      if (at >= segment.durationSec - 1e-9 || slot === "off") return
      marks.push({ offsetSec: at, beat, accent: beat === 1 && index === 0, click: slot })
    })
    offsetSec += beatDur
    beatIndex += 1
  }
  return marks
}
```

Leave `beatAt` stepping by `60 / bpmAt`. It must not step by slot.

In `src/audio.ts`:

```ts
export type ClickSounds = {
  clicks: Record<ClickId, { normal: AudioBuffer; accent: AudioBuffer }>
  restCue: AudioBuffer
}

export function createClickSounds(ctx: AudioContext): ClickSounds {
  const clicks = Object.fromEntries(CLICKS.map((click) => {
    const buffers = createClickBuffers(ctx, click)
    return [click, { normal: buffers.normal, accent: buffers.accent }]
  })) as ClickSounds["clicks"]
  return { clicks, restCue: createClickBuffers(ctx, "click-1").restCue }
}

export function scheduleSegment(ctx: AudioContext, sounds: ClickSounds, segment: Segment, when: number) {
  if (segment.kind === "rest") return [startBuffer(ctx, sounds.restCue, when)]
  return clicksInSegment(segment).map((mark) => {
    const buffers = sounds.clicks[mark.click]
    return startBuffer(ctx, mark.accent ? buffers.accent : buffers.normal, when + mark.offsetSec)
  })
}
```

In `src/App.tsx`, replace the `ClickBuffers` import and ref with `ClickSounds` and `createClickSounds`. Delete `clickRef`, `clickIdRef`, and the line that copies `session.click` into a ref. A slot can name a different click from `session.click`, so one shared buffer set is not enough. Build all four once:

```tsx
const buffersRef = useRef<ClickSounds | null>(null)

// inside the playing effect, after `if (!audio) return`:
if (!buffersRef.current) buffersRef.current = createClickSounds(audio)
const scheduled = scheduleSegment(audio, buffersRef.current, segment, idealWhen)
```

Leave the rest of the effect. It pairs `scheduled` with `clicksInSegment` by index, and both skip Off, so the indexes still match. The effect already reruns when `segments` changes, and a slot edit changes the play segment.

Update the hand-built segment in `src/clock.test.ts` with `click: "click-1"`. A segment with no slots still plays one `click-1` per beat, so the tempo-window test keeps its offsets.

- [ ] **Step 4: Run the playback tests to verify they pass**

Run: `npm test -- src/clock.test.ts src/Practice.test.tsx src/audio.test.ts src/expandSession.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/expandSession.ts src/clock.ts src/clock.test.ts src/audio.ts src/audio.test.ts src/App.tsx src/Practice.test.tsx
git commit -m "Play a click on each subdivision of the beat."
```

Do not stage `src/tokens.css`, `src/tokens.test.ts`, or `.vite/`.

---

### Task 3: Choose the click for each slot

**Files:**
- Modify: `src/Signature.tsx`
- Modify: `src/Edit.tsx`
- Modify: `src/Edit.test.tsx`
- Modify: `src/Practice.tsx`
- Modify: `src/app.css`

**Interfaces:**
- Consumes: `Session.subdivision`, `Session.slots`, `Session.click`, `SUBDIVISIONS`, `Slot`.
- Produces: no new export. `Signature` also renders Subdivision and the slot row. Choosing a subdivision writes `slots` filled with `session.click`, using `SUBDIVISION_SLOTS` from `src/session.ts`. Changing slot 0 to a click writes `click` as well. Off does not.

- [ ] **Step 1: Write the failing editor test**

In `src/Edit.test.tsx`, add:

```ts
it("fills a subdivision with the current click and keeps that click when the first slot changes", async () => {
  const user = userEvent.setup()
  const onChange = vi.fn()
  const session = createDefaultSession(() => "cycle-1")
  session.click = "click-2"
  const { rerender } = render(<Edit session={session} onChange={onChange} onDone={() => {}} />)
  expect(screen.queryByRole("combobox", { name: "Click" })).not.toBeInTheDocument()
  expect(screen.getByRole("combobox", { name: "Beat click" })).toHaveValue("click-2")
  await user.selectOptions(screen.getByRole("combobox", { name: "Subdivision" }), "triplet")
  const triplet = onChange.mock.calls.at(-1)?.[0]
  expect(triplet.subdivision).toBe("triplet")
  expect(triplet.slots).toEqual(["click-2", "click-2", "click-2"])
  rerender(<Edit session={triplet} onChange={onChange} onDone={() => {}} />)
  expect(screen.getByRole("combobox", { name: "1 click" })).toBeInTheDocument()
  expect(screen.getByRole("combobox", { name: "trip click" })).toBeInTheDocument()
  expect(screen.getByRole("combobox", { name: "let click" })).toBeInTheDocument()
  await user.selectOptions(screen.getByRole("combobox", { name: "trip click" }), "off")
  const muted = onChange.mock.calls.at(-1)?.[0]
  expect(muted.slots).toEqual(["click-2", "off", "click-2"])
  expect(muted.click).toBe("click-2")
  rerender(<Edit session={muted} onChange={onChange} onDone={() => {}} />)
  await user.selectOptions(screen.getByRole("combobox", { name: "1 click" }), "click-4")
  const next = onChange.mock.calls.at(-1)?.[0]
  expect(next.click).toBe("click-4")
  expect(next.slots[0]).toBe("click-4")
})
```

In the existing test "edits the session card and the tempo card", replace the Click assertion with:

```ts
expect(screen.queryByRole("combobox", { name: "Click" })).not.toBeInTheDocument()
expect(screen.getByRole("combobox", { name: "Beat click" })).toBeInTheDocument()
```

In `src/Practice.test.tsx`, inside "edits duration, tempo, and meter on the stage", after the Time signature assertion from Task 1, add:

```ts
expect(screen.getByRole("combobox", { name: "Subdivision" })).toBeInTheDocument()
expect(screen.getByRole("combobox", { name: "Beat click" })).toBeInTheDocument()
```

- [ ] **Step 2: Run the editor test to verify it fails**

Run: `npm test -- src/Edit.test.tsx`

Expected: FAIL. The Click combobox is still present, and Subdivision is missing.

- [ ] **Step 3: Add the subdivision row**

In `src/Signature.tsx`, import `SUBDIVISION_SLOTS` from `./session` and `CLICKS`, `SUBDIVISIONS`, and `type Slot` from `./types`. Under the time signature, render:

```tsx
<label>
  Subdivision
  <select
    aria-label="Subdivision"
    value={props.session.subdivision}
    onChange={(event) => {
      const subdivision = event.target.value as Session["subdivision"]
      props.onChange({
        ...props.session,
        subdivision,
        slots: Array.from({ length: SUBDIVISION_SLOTS[subdivision] }, () => props.session.click),
      })
    }}
  >
    {SUBDIVISIONS.map((subdivision) => (
      <option key={subdivision} value={subdivision}>
        {{ quarter: "Beat", eighth: "Eighth", triplet: "Triplet", sixteenth: "Sixteenth" }[subdivision]}
      </option>
    ))}
  </select>
</label>
```

Under that, render one select per slot. Quarter's accessible name is `Beat click`. The others use `1 click`, `& click`, `trip click`, `let click`, `e click`, and `a click` in this order:

```ts
const labels = {
  quarter: ["Beat"],
  eighth: ["1", "&"],
  triplet: ["1", "trip", "let"],
  sixteenth: ["1", "e", "&", "a"],
}
```

The accessible name is `${label} click`. Each select offers Click 1, Click 2, Click 3, Click 4, and Off:

```tsx
<div className="slot-row">
  {labels[props.session.subdivision].map((label, index) => (
    <select
      key={label}
      aria-label={`${label} click`}
      value={props.session.slots[index]}
      onChange={(event) => {
        const slot = event.target.value as Slot
        const slots = props.session.slots.map((current, slotIndex) => slotIndex === index ? slot : current)
        const click = index === 0 && slot !== "off" ? slot : props.session.click
        props.onChange({ ...props.session, slots, click })
      }}
    >
      {CLICKS.map((click) => (
        <option key={click} value={click}>{`Click ${click.slice(-1)}`}</option>
      ))}
      <option value="off">Off</option>
    </select>
  ))}
</div>
```

Changing index 0 to a click also sets `session.click`. Off, and any later slot, leaves `session.click` as it was.

Remove the Click selector from `src/Edit.tsx`. Remove `CLICKS`, `ClickId`, and `CLICK_LABELS` from that file when nothing else uses them.

Leave the slot row outside the Time signature group. That group stays Beats, the slash, and Note. Subdivision stays a full-width `label > select`.

In `src/app.css`, add:

```css
.slot-row { display: flex; flex-wrap: wrap; gap: 8px; }
.editor-screen .slot-row select {
  width: auto;
  appearance: none;
  padding-right: 40px;
  background-color: var(--surface);
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 12 12'%3E%3Cpath d='M2.5 4.5 6 8l3.5-3.5' fill='none' stroke='%23bdbdbd' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 12px center;
  background-size: 12px 12px;
}
.stage .slot-row { justify-content: center; }
.stage .slot-row select { width: auto; background-color: transparent; color: inherit; border: 0; }
```

- [ ] **Step 4: Run the editor tests to verify they pass**

Run: `npm test -- src/Edit.test.tsx src/Practice.test.tsx`

Expected: PASS

- [ ] **Step 5: Run the full suite**

Run: `npm test`

Expected: PASS. `Unknown env config "devdir"` is environment noise, not a failure.

- [ ] **Step 6: Commit**

```bash
git add src/Signature.tsx src/Edit.tsx src/Edit.test.tsx src/Practice.tsx src/app.css
git commit -m "Choose the click for each subdivision slot."
```

Do not stage `src/tokens.css`, `src/tokens.test.ts`, or `.vite/`.
