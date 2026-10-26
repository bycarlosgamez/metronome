# Mentronome Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a mobile-first website that plays a timed practice session with a metronome click, rests, and a BPM increase per repetition.

**Architecture:** A pure `expandSession` function turns the saved session into count-in, play, and rest segments. A clock reports where playback is in that list, and Web Audio schedules the clicks. Practice and Edit are React views over one session stored in `localStorage`.

**Tech Stack:** Vite, React, TypeScript, Vitest, Testing Library, Web Audio.

## Global Constraints

- Vite, React, and TypeScript. No server.
- `localStorage` key is `mentronome.session`. Playback position is not stored.
- Meters are `3/4`, `4/4`, `5/4`, `6/8`, `7/8`. Default `4/4`.
- BPM is an integer from 40 to 300. Duration is at least 1 second. Rest is 0 or more seconds. Repeats is an integer of at least 1. `bpmIncrease` is a whole number of at least 0.
- The BPM is the click rate. Eighty BPM is eighty clicks per minute in every meter. Accent beat 1 only.
- A count-in is four clicks, always `4/4`, length `4 * 60 / bpm` seconds, added after a rest and before the playing stretch. Click 1 is accented.
- A rest of 0 seconds is omitted. The session never ends on a rest. The last set’s rest is unused.
- A repetition whose BPM would pass 300 stays at 300, as do later repetitions of that same set.
- Colors are red, orange, yellow, green, blue, pink. Rests use slate.
- Four click timbres. Default is the first. Each has a normal click and a brighter accent.
- First visit: session name Practice, one set named Set 1, 2:00, 80 BPM, 30-second rest, one repeat, red, meter `4/4`, per-set meter off, BPM increase 0, first click.
- An empty session name is shown as Practice. An empty set name is shown as Set.
- The last remaining set cannot be deleted.
- Opening Edit stops playback.
- Layout is mobile-first. At 800px and wider, the editor shows the list and the selected set side by side. The practice page stays one column.
- Leaving a field snaps it to the nearest allowed value.

---

## File structure

- `package.json`, `tsconfig.json`, `vite.config.ts`, `index.html` — app shell and test runner.
- `src/main.tsx` — mounts React.
- `src/types.ts` — session, set, and segment types.
- `src/session.ts` — defaults, titles, clamping, creating a set.
- `src/session.test.ts` — tests for defaults, titles, clamp, and new sets.
- `src/expandSession.ts` — session to segment list.
- `src/expandSession.test.ts` — the playback examples from the spec.
- `src/format.ts` — `m:ss` and `h:mm:ss` clocks.
- `src/format.test.ts` — clock formatting.
- `src/store.ts` — `localStorage` read and write.
- `src/store.test.ts` — round trip and unreadable save.
- `src/clock.ts` — position in the segment list, and click times.
- `src/clock.test.ts` — fake-time position and click schedule.
- `src/audio.ts` — click buffers and scheduling them on an `AudioContext`.
- `src/audio.test.ts` — scheduled click times against a fake context.
- `src/Practice.tsx` — the countdown page.
- `src/Practice.test.tsx` — stopped practice screen.
- `src/Edit.tsx` — list and set form.
- `src/Edit.test.tsx` — add, delete, reorder, and clamp.
- `src/App.tsx` — which view is showing, and playback controls.
- `src/App.test.tsx` — Edit stops playback; reload does not resume.
- `src/app.css` — mobile-first layout.

Each file owns one job. Views never expand the session themselves. They call `expandSession`.

---

### Task 1: Scaffold the Vite app

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `vite.config.ts`
- Create: `index.html`
- Create: `src/main.tsx`
- Create: `src/App.tsx`
- Create: `src/App.test.tsx`
- Create: `src/vite-env.d.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: a React app whose root text includes `Mentronome`. Test command is `npm test`.

- [ ] **Step 1: Add the project files the test runner needs**

`package.json`:

```json
{
  "name": "mentronome",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "test": "vitest run",
    "build": "tsc --noEmit && vite build"
  },
  "dependencies": {
    "react": "^19.0.0",
    "react-dom": "^19.0.0"
  },
  "devDependencies": {
    "@testing-library/jest-dom": "^6.6.0",
    "@testing-library/react": "^16.1.0",
    "@testing-library/user-event": "^14.5.2",
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "@vitejs/plugin-react": "^4.3.4",
    "jsdom": "^26.0.0",
    "typescript": "^5.7.0",
    "vite": "^6.0.0",
    "vitest": "^3.0.0"
  }
}
```

`tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "useDefineForClassFields": true,
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "types": ["vite/client"]
  },
  "include": ["src"]
}
```

`vite.config.ts`:

```ts
/// <reference types="vitest/config" />
import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: "./src/test-setup.ts",
  },
})
```

`src/test-setup.ts`:

```ts
import "@testing-library/jest-dom/vitest"
```

`src/vite-env.d.ts`:

```ts
/// <reference types="vite/client" />
```

`index.html`:

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Mentronome</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

`src/main.tsx`:

```tsx
import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { App } from "./App"
import "./app.css"

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
```

Create an empty `src/app.css` so the import resolves.

- [ ] **Step 2: Install and write the failing test**

Run: `npm install`

`src/App.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { App } from "./App"

describe("App", () => {
  it("shows the Mentronome wordmark", () => {
    render(<App />)
    expect(screen.getByRole("heading", { name: "Mentronome" })).toBeInTheDocument()
  })
})
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npx vitest run src/App.test.tsx`

Expected: FAIL because `./App` cannot be resolved.

- [ ] **Step 4: Write the smallest App that passes**

`src/App.tsx`:

```tsx
export function App() {
  return (
    <header>
      <h1>
        MENTRO<span>NOME</span>
      </h1>
    </header>
  )
}
```

The accessible name of that heading is `Mentronome` because the spans concatenate.

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run src/App.test.tsx`

Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json tsconfig.json vite.config.ts index.html src
git commit -m "Add the Vite app shell for Mentronome."
```

---

### Task 2: Session model

**Files:**
- Create: `src/types.ts`
- Create: `src/session.ts`
- Create: `src/session.test.ts`
- Test: `src/session.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:

```ts
export const METERS = ["3/4", "4/4", "5/4", "6/8", "7/8"] as const
export type Meter = (typeof METERS)[number]
export const COLORS = ["red", "orange", "yellow", "green", "blue", "pink"] as const
export type SetColor = (typeof COLORS)[number]
export const CLICKS = ["click-1", "click-2", "click-3", "click-4"] as const
export type ClickId = (typeof CLICKS)[number]

export type PracticeSet = {
  id: string
  name: string
  durationSec: number
  bpm: number
  restSec: number
  repeats: number
  color: SetColor
  meter: Meter
}

export type Session = {
  name: string
  meter: Meter
  perSetMeter: boolean
  bpmIncrease: number
  click: ClickId
  sets: PracticeSet[]
}

export function sessionTitle(session: Session): string
export function setTitle(set: PracticeSet): string
export function clampSession(session: Session): Session
export function createDefaultSession(nextId?: () => string): Session
export function createSetAfter(previous: PracticeSet, position: number, id: string): PracticeSet
export function beatsInMeter(meter: Meter): number
```

- [ ] **Step 1: Write the failing test**

`src/session.test.ts`:

```ts
import { describe, expect, it } from "vitest"
import {
  clampSession,
  createDefaultSession,
  createSetAfter,
  sessionTitle,
  setTitle,
} from "./session"

describe("session", () => {
  it("builds the first-visit session", () => {
    const session = createDefaultSession(() => "set-1")
    expect(session).toEqual({
      name: "Practice",
      meter: "4/4",
      perSetMeter: false,
      bpmIncrease: 0,
      click: "click-1",
      sets: [
        {
          id: "set-1",
          name: "Set 1",
          durationSec: 120,
          bpm: 80,
          restSec: 30,
          repeats: 1,
          color: "red",
          meter: "4/4",
        },
      ],
    })
  })

  it("shows Practice and Set for blank names", () => {
    const session = createDefaultSession(() => "set-1")
    session.name = "  "
    session.sets[0].name = ""
    expect(sessionTitle(session)).toBe("Practice")
    expect(setTitle(session.sets[0])).toBe("Set")
  })

  it("snaps fields to the allowed range", () => {
    const session = createDefaultSession(() => "set-1")
    session.bpmIncrease = -4
    session.sets[0].bpm = 12
    session.sets[0].durationSec = 0
    session.sets[0].restSec = -2
    session.sets[0].repeats = 0
    const clamped = clampSession(session)
    expect(clamped.bpmIncrease).toBe(0)
    expect(clamped.sets[0].bpm).toBe(40)
    expect(clamped.sets[0].durationSec).toBe(1)
    expect(clamped.sets[0].restSec).toBe(0)
    expect(clamped.sets[0].repeats).toBe(1)
  })

  it("caps bpm at 300", () => {
    const session = createDefaultSession(() => "set-1")
    session.sets[0].bpm = 900
    expect(clampSession(session).sets[0].bpm).toBe(300)
  })

  it("creates the next set from the previous one", () => {
    const session = createDefaultSession(() => "set-1")
    const next = createSetAfter(session.sets[0], 2, "set-2")
    expect(next).toMatchObject({
      id: "set-2",
      name: "Set 2",
      durationSec: 60,
      bpm: 80,
      restSec: 30,
      repeats: 1,
      color: "orange",
    })
  })

  it("cycles the palette after pink", () => {
    const session = createDefaultSession(() => "set-1")
    session.sets[0].color = "pink"
    expect(createSetAfter(session.sets[0], 2, "set-2").color).toBe("red")
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/session.test.ts`

Expected: FAIL with cannot find module `./session`

- [ ] **Step 3: Write the session module**

`src/types.ts`:

```ts
export const METERS = ["3/4", "4/4", "5/4", "6/8", "7/8"] as const
export type Meter = (typeof METERS)[number]

export const COLORS = ["red", "orange", "yellow", "green", "blue", "pink"] as const
export type SetColor = (typeof COLORS)[number]

export const CLICKS = ["click-1", "click-2", "click-3", "click-4"] as const
export type ClickId = (typeof CLICKS)[number]

export type PracticeSet = {
  id: string
  name: string
  durationSec: number
  bpm: number
  restSec: number
  repeats: number
  color: SetColor
  meter: Meter
}

export type Session = {
  name: string
  meter: Meter
  perSetMeter: boolean
  bpmIncrease: number
  click: ClickId
  sets: PracticeSet[]
}
```

`src/session.ts`:

```ts
import {
  CLICKS,
  COLORS,
  METERS,
  type ClickId,
  type Meter,
  type PracticeSet,
  type Session,
  type SetColor,
} from "./types"

const integer = (value: number) => Math.round(Number.isFinite(value) ? value : 0)

export function sessionTitle(session: Session): string {
  return session.name.trim() || "Practice"
}

export function setTitle(set: PracticeSet): string {
  return set.name.trim() || "Set"
}

export function clampBpm(bpm: number): number {
  return Math.min(300, Math.max(40, integer(bpm)))
}

export function clampSession(session: Session): Session {
  const sets = (session.sets.length > 0 ? session.sets : createDefaultSession().sets).map(clampSet)
  return {
    name: session.name ?? "",
    meter: METERS.includes(session.meter) ? session.meter : "4/4",
    perSetMeter: Boolean(session.perSetMeter),
    bpmIncrease: Math.max(0, integer(session.bpmIncrease)),
    click: CLICKS.includes(session.click) ? session.click : "click-1",
    sets,
  }
}

function clampSet(set: PracticeSet): PracticeSet {
  return {
    id: set.id || crypto.randomUUID(),
    name: set.name ?? "",
    durationSec: Math.max(1, integer(set.durationSec)),
    bpm: clampBpm(set.bpm),
    restSec: Math.max(0, integer(set.restSec)),
    repeats: Math.max(1, integer(set.repeats)),
    color: COLORS.includes(set.color) ? set.color : "red",
    meter: METERS.includes(set.meter) ? set.meter : "4/4",
  }
}

export function createDefaultSession(nextId: () => string = () => crypto.randomUUID()): Session {
  return {
    name: "Practice",
    meter: "4/4",
    perSetMeter: false,
    bpmIncrease: 0,
    click: "click-1",
    sets: [
      {
        id: nextId(),
        name: "Set 1",
        durationSec: 120,
        bpm: 80,
        restSec: 30,
        repeats: 1,
        color: "red",
        meter: "4/4",
      },
    ],
  }
}

export function createSetAfter(previous: PracticeSet, position: number, id: string): PracticeSet {
  const colorIndex = (COLORS.indexOf(previous.color) + 1) % COLORS.length
  return {
    id,
    name: `Set ${position}`,
    durationSec: 60,
    bpm: previous.bpm,
    restSec: previous.restSec,
    repeats: 1,
    color: COLORS[colorIndex] as SetColor,
    meter: previous.meter,
  }
}

export function beatsInMeter(meter: Meter): number {
  return Number(meter.split("/")[0])
}

export function isClickId(value: string): value is ClickId {
  return (CLICKS as readonly string[]).includes(value)
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/session.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/types.ts src/session.ts src/session.test.ts
git commit -m "Add the practice session model and its limits."
```

---

### Task 3: Expand a session into segments

**Files:**
- Create: `src/expandSession.ts`
- Create: `src/expandSession.test.ts`
- Test: `src/expandSession.test.ts`

**Interfaces:**
- Consumes: `Session`, `PracticeSet`, `Meter`, `SetColor` from `src/types.ts`. `setTitle` from `src/session.ts`.
- Produces:

```ts
export type SegmentKind = "count-in" | "play" | "rest"

export type Segment = {
  kind: SegmentKind
  setId: string
  label: string
  repetition: number
  bpm: number
  meter: Meter
  durationSec: number
  color: SetColor | "slate"
  setIndex: number
}

export function expandSession(session: Session): Segment[]
```

`setIndex` is 0-based. `repetition` is 1-based. A count-in’s `meter` is always `"4/4"`.

- [ ] **Step 1: Write the failing test**

`src/expandSession.test.ts`:

```ts
import { describe, expect, it } from "vitest"
import { expandSession } from "./expandSession"
import { createDefaultSession } from "./session"
import type { Session } from "./types"

function example(): Session {
  const session = createDefaultSession(() => "scales")
  session.bpmIncrease = 5
  session.sets[0] = {
    id: "scales",
    name: "Scales",
    durationSec: 120,
    bpm: 80,
    restSec: 30,
    repeats: 3,
    color: "red",
    meter: "6/8",
  }
  session.sets.push({
    id: "piece",
    name: "Piece",
    durationSec: 60,
    bpm: 100,
    restSec: 20,
    repeats: 1,
    color: "green",
    meter: "3/4",
  })
  return session
}

describe("expandSession", () => {
  it("builds the 80 BPM example and does not end on a rest", () => {
    const segments = expandSession(example())
    expect(segments.map((segment) => segment.kind)).toEqual([
      "count-in", "play", "rest",
      "count-in", "play", "rest",
      "count-in", "play", "rest",
      "count-in", "play",
    ])
    expect(segments.map((segment) => segment.bpm)).toEqual([
      80, 80, 80,
      85, 85, 85,
      90, 90, 90,
      100, 100,
    ])
    expect(segments[0].durationSec).toBeCloseTo(3)
    expect(segments[3].durationSec).toBeCloseTo((4 * 60) / 85)
    expect(segments[9].durationSec).toBeCloseTo(2.4)
    expect(segments.at(-1)?.kind).toBe("play")
    expect(segments.at(-1)?.durationSec).toBe(60)
  })

  it("uses the session meter unless per-set meter is on", () => {
    const session = example()
    session.perSetMeter = false
    session.meter = "4/4"
    const off = expandSession(session)
    expect(off[0].meter).toBe("4/4")
    expect(off[1].meter).toBe("4/4")

    session.perSetMeter = true
    const on = expandSession(session)
    expect(on[0].meter).toBe("4/4")
    expect(on[1].meter).toBe("6/8")
    expect(on.at(-1)?.meter).toBe("3/4")
  })

  it("keeps every repetition at the typed BPM when increase is 0", () => {
    const session = example()
    session.bpmIncrease = 0
    const bpms = expandSession(session).filter((segment) => segment.kind === "play").map((segment) => segment.bpm)
    expect(bpms).toEqual([80, 80, 80, 100])
  })

  it("caps a repetition at 300 and holds later repetitions of that set", () => {
    const session = createDefaultSession(() => "fast")
    session.bpmIncrease = 20
    session.sets[0].bpm = 290
    session.sets[0].repeats = 3
    session.sets[0].restSec = 0
    const plays = expandSession(session).filter((segment) => segment.kind === "play")
    expect(plays.map((segment) => segment.bpm)).toEqual([290, 300, 300])
  })

  it("omits a 0 second rest and still counts in", () => {
    const session = example()
    session.sets[0].restSec = 0
    session.sets[0].repeats = 2
    session.sets.pop()
    const kinds = expandSession(session).map((segment) => segment.kind)
    expect(kinds).toEqual(["count-in", "play", "count-in", "play"])
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/expandSession.test.ts`

Expected: FAIL with cannot find module `./expandSession`

- [ ] **Step 3: Write expandSession**

`src/expandSession.ts`:

```ts
import { setTitle } from "./session"
import type { Meter, Session, SetColor } from "./types"

export type SegmentKind = "count-in" | "play" | "rest"

export type Segment = {
  kind: SegmentKind
  setId: string
  label: string
  repetition: number
  bpm: number
  meter: Meter
  durationSec: number
  color: SetColor | "slate"
  setIndex: number
}

export function expandSession(session: Session): Segment[] {
  const plays = session.sets.flatMap((set, setIndex) => {
    const meter = session.perSetMeter ? set.meter : session.meter
    return Array.from({ length: set.repeats }, (_, index) => {
      const repetition = index + 1
      const bpm = Math.min(300, set.bpm + index * session.bpmIncrease)
      return { set, setIndex, repetition, bpm, meter }
    })
  })

  return plays.flatMap((play, index) => {
    const label = setTitle(play.set)
    const segments: Segment[] = [
      {
        kind: "count-in",
        setId: play.set.id,
        label,
        repetition: play.repetition,
        bpm: play.bpm,
        meter: "4/4",
        durationSec: (4 * 60) / play.bpm,
        color: play.set.color,
        setIndex: play.setIndex,
      },
      {
        kind: "play",
        setId: play.set.id,
        label,
        repetition: play.repetition,
        bpm: play.bpm,
        meter: play.meter,
        durationSec: play.set.durationSec,
        color: play.set.color,
        setIndex: play.setIndex,
      },
    ]
    const anotherPlayFollows = index < plays.length - 1
    if (anotherPlayFollows && play.set.restSec > 0) {
      segments.push({
        kind: "rest",
        setId: play.set.id,
        label: "Rest",
        repetition: play.repetition,
        bpm: play.bpm,
        meter: play.meter,
        durationSec: play.set.restSec,
        color: "slate",
        setIndex: play.setIndex,
      })
    }
    return segments
  })
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/expandSession.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/expandSession.ts src/expandSession.test.ts
git commit -m "Expand a practice session into count-in, play, and rest segments."
```

---

### Task 4: Save and load the session

**Files:**
- Create: `src/store.ts`
- Create: `src/store.test.ts`
- Test: `src/store.test.ts`

**Interfaces:**
- Consumes: `Session` from `src/types.ts`. `clampSession` and `createDefaultSession` from `src/session.ts`.
- Produces:

```ts
export const SESSION_KEY = "mentronome.session"
export function loadSession(storage: Storage): Session
export function saveSession(session: Session, storage: Storage): void
```

- [ ] **Step 1: Write the failing test**

`src/store.test.ts`:

```ts
import { describe, expect, it } from "vitest"
import { createDefaultSession } from "./session"
import { SESSION_KEY, loadSession, saveSession } from "./store"

function memory(): Storage {
  const values = new Map<string, string>()
  return {
    get length() {
      return values.size
    },
    clear: () => values.clear(),
    getItem: (key) => values.get(key) ?? null,
    key: (index) => [...values.keys()][index] ?? null,
    removeItem: (key) => values.delete(key),
    setItem: (key, value) => values.set(key, value),
  }
}

describe("store", () => {
  it("round-trips a session", () => {
    const storage = memory()
    const session = createDefaultSession(() => "set-1")
    session.name = "Evening practice"
    saveSession(session, storage)
    expect(storage.getItem(SESSION_KEY)).toContain("Evening practice")
    expect(loadSession(storage)).toEqual(session)
  })

  it("loads the first-visit session when the save cannot be read", () => {
    const storage = memory()
    storage.setItem(SESSION_KEY, "{")
    const loaded = loadSession(storage)
    expect(loaded.name).toBe("Practice")
    expect(loaded.sets).toHaveLength(1)
    expect(loaded.sets[0].name).toBe("Set 1")
  })

  it("loads the first-visit session when nothing is saved", () => {
    expect(loadSession(memory()).sets[0].bpm).toBe(80)
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/store.test.ts`

Expected: FAIL with cannot find module `./store`

- [ ] **Step 3: Write the store**

`src/store.ts`:

```ts
import { clampSession, createDefaultSession } from "./session"
import type { Session } from "./types"

export const SESSION_KEY = "mentronome.session"

export function loadSession(storage: Storage): Session {
  const raw = storage.getItem(SESSION_KEY)
  if (!raw) return createDefaultSession()
  try {
    const parsed = JSON.parse(raw) as Session
    if (!parsed || typeof parsed !== "object" || !Array.isArray(parsed.sets)) {
      return createDefaultSession()
    }
    return clampSession(parsed)
  } catch {
    return createDefaultSession()
  }
}

export function saveSession(session: Session, storage: Storage): void {
  storage.setItem(SESSION_KEY, JSON.stringify(clampSession(session)))
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/store.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/store.ts src/store.test.ts
git commit -m "Remember the last practice session in localStorage."
```

---

### Task 5: Clock position and click times

**Files:**
- Create: `src/format.ts`
- Create: `src/format.test.ts`
- Create: `src/clock.ts`
- Create: `src/clock.test.ts`
- Test: `src/format.test.ts`, `src/clock.test.ts`

**Interfaces:**
- Consumes: `Segment` from `src/expandSession.ts`. `beatsInMeter` from `src/session.ts`.
- Produces:

```ts
export function formatClock(seconds: number): string

export type ClockSnapshot = {
  segmentIndex: number
  beat: number
  segmentRemainingSec: number
  elapsedSec: number
  remainingSec: number
}

export function snapshotAt(segments: Segment[], elapsedSec: number): ClockSnapshot

export type ClickMark = { offsetSec: number; beat: number; accent: boolean }

export function clicksInSegment(segment: Segment): ClickMark[]
```

`beat` is 0 during a rest. Otherwise it is 1-based. `formatClock` floors the seconds. Under an hour it returns `m:ss`. At an hour or more it returns `h:mm:ss`.

- [ ] **Step 1: Write the failing tests**

`src/format.test.ts`:

```ts
import { describe, expect, it } from "vitest"
import { formatClock } from "./format"

describe("formatClock", () => {
  it("formats minutes and hours", () => {
    expect(formatClock(0)).toBe("0:00")
    expect(formatClock(65)).toBe("1:05")
    expect(formatClock(3600)).toBe("1:00:00")
    expect(formatClock(65.9)).toBe("1:05")
  })
})
```

`src/clock.test.ts`:

```ts
import { describe, expect, it } from "vitest"
import { clicksInSegment, snapshotAt } from "./clock"
import { expandSession } from "./expandSession"
import { createDefaultSession } from "./session"

describe("clock", () => {
  it("starts on the first count-in beat and enters the playing stretch after that bar", () => {
    const session = createDefaultSession(() => "set-1")
    const segments = expandSession(session)
    const countIn = (4 * 60) / 80
    const start = snapshotAt(segments, 0)
    expect(start.segmentIndex).toBe(0)
    expect(start.beat).toBe(1)
    expect(segments[start.segmentIndex].kind).toBe("count-in")

    const playing = snapshotAt(segments, countIn)
    expect(playing.segmentIndex).toBe(1)
    expect(playing.beat).toBe(1)
    expect(segments[playing.segmentIndex].kind).toBe("play")
  })

  it("reports no beat during a rest", () => {
    const session = createDefaultSession(() => "set-1")
    session.sets[0].repeats = 2
    const segments = expandSession(session)
    const restIndex = segments.findIndex((segment) => segment.kind === "rest")
    const restStart = segments.slice(0, restIndex).reduce((sum, segment) => sum + segment.durationSec, 0)
    expect(snapshotAt(segments, restStart).beat).toBe(0)
  })

  it("places four accented-on-one count-in clicks and no rest clicks", () => {
    const session = createDefaultSession(() => "set-1")
    session.sets[0].repeats = 2
    const segments = expandSession(session)
    const countIn = clicksInSegment(segments[0])
    expect(countIn).toHaveLength(4)
    expect(countIn.map((click) => click.beat)).toEqual([1, 2, 3, 4])
    expect(countIn[0].accent).toBe(true)
    expect(countIn[1].accent).toBe(false)
    expect(countIn[0].offsetSec).toBe(0)
    expect(countIn[1].offsetSec).toBeCloseTo(60 / 80)

    const rest = segments.find((segment) => segment.kind === "rest")!
    expect(clicksInSegment(rest)).toEqual([])
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/format.test.ts src/clock.test.ts`

Expected: FAIL with cannot find module `./format` or `./clock`

- [ ] **Step 3: Write format and clock**

`src/format.ts`:

```ts
export function formatClock(seconds: number): string {
  const whole = Math.max(0, Math.floor(seconds))
  const hours = Math.floor(whole / 3600)
  const minutes = Math.floor((whole % 3600) / 60)
  const secs = whole % 60
  const ss = String(secs).padStart(2, "0")
  if (hours > 0) return `${hours}:${String(minutes).padStart(2, "0")}:${ss}`
  return `${minutes}:${ss}`
}
```

`src/clock.ts`:

```ts
import type { Segment } from "./expandSession"
import { beatsInMeter } from "./session"

export type ClockSnapshot = {
  segmentIndex: number
  beat: number
  segmentRemainingSec: number
  elapsedSec: number
  remainingSec: number
}

export type ClickMark = { offsetSec: number; beat: number; accent: boolean }

export function snapshotAt(segments: Segment[], elapsedSec: number): ClockSnapshot {
  const total = segments.reduce((sum, segment) => sum + segment.durationSec, 0)
  const elapsed = Math.min(Math.max(0, elapsedSec), total)
  let cursor = 0
  for (let index = 0; index < segments.length; index++) {
    const segment = segments[index]
    const end = cursor + segment.durationSec
    const isLast = index === segments.length - 1
    if (elapsed < end || isLast) {
      const into = elapsed - cursor
      return {
        segmentIndex: index,
        beat: segment.kind === "rest" ? 0 : beatAt(segment, into),
        segmentRemainingSec: Math.max(0, segment.durationSec - into),
        elapsedSec: elapsed,
        remainingSec: Math.max(0, total - elapsed),
      }
    }
    cursor = end
  }
  throw new Error("expandSession always returns at least one segment")
}

export function clicksInSegment(segment: Segment): ClickMark[] {
  if (segment.kind === "rest") return []
  const secondsPerBeat = 60 / segment.bpm
  const beats = segment.kind === "count-in" ? 4 : beatsInMeter(segment.meter)
  const marks: ClickMark[] = []
  for (let index = 0; ; index++) {
    const offsetSec = index * secondsPerBeat
    if (offsetSec >= segment.durationSec - 1e-9) break
    const beat = (index % beats) + 1
    marks.push({ offsetSec, beat, accent: beat === 1 })
  }
  return marks
}

function beatAt(segment: Segment, intoSec: number): number {
  const secondsPerBeat = 60 / segment.bpm
  const beats = segment.kind === "count-in" ? 4 : beatsInMeter(segment.meter)
  const index = Math.floor(intoSec / secondsPerBeat)
  return (index % beats) + 1
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/format.test.ts src/clock.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/format.ts src/format.test.ts src/clock.ts src/clock.test.ts
git commit -m "Report the current beat and the clicks inside a segment."
```

---

### Task 6: Schedule clicks on an audio context

**Files:**
- Create: `src/audio.ts`
- Create: `src/audio.test.ts`
- Test: `src/audio.test.ts`

**Interfaces:**
- Consumes: `Segment` from `src/expandSession.ts`. `clicksInSegment` from `src/clock.ts`. `ClickId` from `src/types.ts`.
- Produces:

```ts
export type ClickBuffers = {
  normal: AudioBuffer
  accent: AudioBuffer
  restCue: AudioBuffer
}

export function createClickBuffers(ctx: AudioContext, click: ClickId): ClickBuffers

export function scheduleSegment(
  ctx: AudioContext,
  buffers: ClickBuffers,
  segment: Segment,
  when: number,
): AudioBufferSourceNode[]
```

`when` is the `AudioContext` time of the segment start. Rest segments schedule only the rest cue at `when`. Count-in and play schedule a click at `when + offsetSec`. Accented beats use `buffers.accent`.

- [ ] **Step 1: Write the failing test**

`src/audio.test.ts`:

```ts
import { describe, expect, it } from "vitest"
import { scheduleSegment } from "./audio"
import { expandSession } from "./expandSession"
import { createDefaultSession } from "./session"

function fakeContext() {
  const started: { when: number; name: string }[] = []
  const buffers = {
    normal: { name: "normal" },
    accent: { name: "accent" },
    restCue: { name: "cue" },
  }
  return {
    started,
    buffers,
    ctx: {
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
    session.sets[0].bpm = 60
    session.sets[0].repeats = 2
    const segments = expandSession(session)
    const { ctx, buffers, started } = fakeContext()
    scheduleSegment(ctx, buffers as never, segments[0], 10)
    expect(started.map((click) => click.when)).toEqual([10, 11, 12, 13])
    expect(started[0].name).toBe("accent")
    expect(started[1].name).toBe("normal")

    started.length = 0
    const rest = segments.find((segment) => segment.kind === "rest")!
    scheduleSegment(ctx, buffers as never, rest, 20)
    expect(started).toEqual([{ when: 20, name: "cue" }])
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/audio.test.ts`

Expected: FAIL with cannot find module `./audio`

- [ ] **Step 3: Write the scheduler and buffer builder**

`src/audio.ts`:

```ts
import { clicksInSegment } from "./clock"
import type { Segment } from "./expandSession"
import type { ClickId } from "./types"

export type ClickBuffers = {
  normal: AudioBuffer
  accent: AudioBuffer
  restCue: AudioBuffer
}

const TONES: Record<ClickId, { normal: number; accent: number }> = {
  "click-1": { normal: 880, accent: 1760 },
  "click-2": { normal: 660, accent: 1320 },
  "click-3": { normal: 440, accent: 990 },
  "click-4": { normal: 330, accent: 660 },
}

export function createClickBuffers(ctx: AudioContext, click: ClickId): ClickBuffers {
  const tone = TONES[click]
  return {
    normal: toneBuffer(ctx, tone.normal, 0.4),
    accent: toneBuffer(ctx, tone.accent, 0.7),
    restCue: toneBuffer(ctx, 520, 0.5),
  }
}

export function scheduleSegment(
  ctx: AudioContext,
  buffers: ClickBuffers,
  segment: Segment,
  when: number,
): AudioBufferSourceNode[] {
  if (segment.kind === "rest") {
    return [startBuffer(ctx, buffers.restCue, when)]
  }
  return clicksInSegment(segment).map((click) =>
    startBuffer(ctx, click.accent ? buffers.accent : buffers.normal, when + click.offsetSec),
  )
}

function startBuffer(ctx: AudioContext, buffer: AudioBuffer, when: number): AudioBufferSourceNode {
  const source = ctx.createBufferSource()
  source.buffer = buffer
  source.connect(ctx.destination)
  source.start(when)
  return source
}

function toneBuffer(ctx: AudioContext, frequency: number, gain: number): AudioBuffer {
  const sampleRate = ctx.sampleRate
  const length = Math.floor(sampleRate * 0.05)
  const buffer = ctx.createBuffer(1, length, sampleRate)
  const data = buffer.getChannelData(0)
  for (let i = 0; i < length; i++) {
    const envelope = Math.exp(-i / (sampleRate * 0.01))
    data[i] = Math.sin((2 * Math.PI * frequency * i) / sampleRate) * envelope * gain
  }
  return buffer
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/audio.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/audio.ts src/audio.test.ts
git commit -m "Schedule metronome clicks and the rest cue on the audio clock."
```

---

### Task 7: Practice screen

**Files:**
- Create: `src/app.css`
- Create: `src/Practice.tsx`
- Create: `src/Practice.test.tsx`
- Modify: `src/App.tsx`
- Test: `src/Practice.test.tsx`

**Interfaces:**
- Consumes: `Session` from `src/types.ts`. `expandSession` and `Segment` from `src/expandSession.ts`. `snapshotAt` and `ClockSnapshot` from `src/clock.ts`. `formatClock` from `src/format.ts`. `sessionTitle` from `src/session.ts`.
- Produces:

```tsx
export type PlaybackStatus = "stopped" | "playing" | "paused" | "no-audio"

export function Practice(props: {
  session: Session
  segments: Segment[]
  snapshot: ClockSnapshot
  status: PlaybackStatus
  onToggle(): void
  onJump(direction: -1 | 1): void
  onReset(): void
  onEdit(): void
}): JSX.Element
```

While `status` is `"stopped"`, the parent passes `snapshotAt(segments, 0)`. The stage shows the current segment label, `formatClock` of `Math.ceil(snapshot.segmentRemainingSec)`, and the beat numbers when `snapshot.beat > 0`. A rest shows `Next · {next play label} at {next play bpm}`. The footer shows elapsed, `setIndex + 1 / sets.length`, and remaining. The wordmark heading stays `Mentronome`.

- [ ] **Step 1: Write the failing test**

`src/Practice.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"
import { snapshotAt } from "./clock"
import { expandSession } from "./expandSession"
import { Practice } from "./Practice"
import { createDefaultSession } from "./session"

describe("Practice", () => {
  it("shows the first count-in while stopped", async () => {
    const session = createDefaultSession(() => "set-1")
    const segments = expandSession(session)
    const onEdit = vi.fn()
    const user = userEvent.setup()
    render(
      <Practice
        session={session}
        segments={segments}
        snapshot={snapshotAt(segments, 0)}
        status="stopped"
        onToggle={() => {}}
        onJump={() => {}}
        onReset={() => {}}
        onEdit={onEdit}
      />,
    )
    expect(screen.getByRole("heading", { name: "Mentronome" })).toBeInTheDocument()
    expect(screen.getByTestId("stage-label")).toHaveTextContent("Set 1")
    expect(screen.getByTestId("stage-time")).toHaveTextContent("0:03")
    expect(screen.getByTestId("beat-1")).toHaveAttribute("data-current", "true")
    expect(screen.getByTestId("footer-set")).toHaveTextContent("1 / 1")
    await user.click(screen.getByRole("button", { name: "Edit" }))
    expect(onEdit).toHaveBeenCalledOnce()
  })

  it("shows the following stretch during a rest", () => {
    const session = createDefaultSession(() => "set-1")
    session.sets[0].repeats = 2
    session.bpmIncrease = 5
    const segments = expandSession(session)
    const restIndex = segments.findIndex((segment) => segment.kind === "rest")
    const elapsed = segments.slice(0, restIndex).reduce((sum, segment) => sum + segment.durationSec, 0)
    render(
      <Practice
        session={session}
        segments={segments}
        snapshot={snapshotAt(segments, elapsed)}
        status="playing"
        onToggle={() => {}}
        onJump={() => {}}
        onReset={() => {}}
        onEdit={() => {}}
      />,
    )
    expect(screen.getByTestId("stage-label")).toHaveTextContent("Rest")
    expect(screen.getByTestId("next-up")).toHaveTextContent("Next · Set 1 at 85")
    expect(screen.queryByTestId("beat-1")).not.toBeInTheDocument()
  })
})
```

Add `@testing-library/user-event` if `npm install` did not already bring it in. It is listed in Task 1.

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/Practice.test.tsx`

Expected: FAIL with cannot find module `./Practice`

- [ ] **Step 3: Write the practice view and its styles**

`src/Practice.tsx`:

```tsx
import type { ClockSnapshot } from "./clock"
import type { Segment } from "./expandSession"
import { formatClock } from "./format"
import { sessionTitle } from "./session"
import type { Session } from "./types"

export type PlaybackStatus = "stopped" | "playing" | "paused" | "no-audio"

export function Practice(props: {
  session: Session
  segments: Segment[]
  snapshot: ClockSnapshot
  status: PlaybackStatus
  onToggle(): void
  onJump(direction: -1 | 1): void
  onReset(): void
  onEdit(): void
}) {
  const segment = props.segments[props.snapshot.segmentIndex]
  const nextPlay = props.segments.slice(props.snapshot.segmentIndex + 1).find((item) => item.kind === "play")
  const beatCount = segment.kind === "count-in" ? 4 : Number(segment.meter.split("/")[0])
  return (
    <main className="practice">
      <header className="topbar">
        <h1>
          MENTRO<span>NOME</span>
        </h1>
        <p className="session-name">{sessionTitle(props.session)}</p>
        <button type="button" onClick={props.onEdit}>
          Edit
        </button>
      </header>
      <section className={`stage color-${segment.color}`} data-kind={segment.kind}>
        <p data-testid="stage-label">{segment.label}</p>
        <p className="stage-time" data-testid="stage-time">
          {formatClock(Math.ceil(props.snapshot.segmentRemainingSec - 1e-9))}
        </p>
        {segment.kind !== "rest" && (
          <>
            <p>{segment.bpm} BPM</p>
            <div className="beats">
              {Array.from({ length: beatCount }, (_, index) => {
                const beat = index + 1
                return (
                  <span
                    key={beat}
                    data-testid={`beat-${beat}`}
                    data-current={beat === props.snapshot.beat ? "true" : "false"}
                    data-accent={beat === 1 ? "true" : "false"}
                  >
                    {beat}
                  </span>
                )
              })}
            </div>
            <p>{segment.kind === "count-in" ? "4/4" : segment.meter}</p>
          </>
        )}
        {segment.kind === "rest" && nextPlay && (
          <p data-testid="next-up">
            Next · {nextPlay.label} at {nextPlay.bpm}
          </p>
        )}
        {props.status === "no-audio" && <p role="status">Sound is unavailable. The countdown is still running.</p>}
      </section>
      <div className="strip">
        {props.segments.map((item, index) => (
          <article key={`${item.setId}-${item.kind}-${index}`} data-current={index === props.snapshot.segmentIndex}>
            <strong>{item.label}</strong>
            <span>
              {formatClock(Math.round(item.durationSec))}
              {item.kind === "play" ? ` · ${item.bpm}` : ""}
            </span>
          </article>
        ))}
      </div>
      <footer className="transport">
        <div>
          <span>Elapsed</span>
          <strong>{formatClock(props.snapshot.elapsedSec)}</strong>
        </div>
        <div>
          <span>Set</span>
          <strong data-testid="footer-set">
            {segment.setIndex + 1} / {props.session.sets.length}
          </strong>
        </div>
        <div>
          <span>Left</span>
          <strong>{formatClock(Math.ceil(props.snapshot.remainingSec - 1e-9))}</strong>
        </div>
        <div className="controls">
          <button type="button" aria-label="Previous" onClick={() => props.onJump(-1)}>‹</button>
          <button type="button" aria-label={props.status === "playing" ? "Pause" : "Play"} onClick={props.onToggle}>
            {props.status === "playing" ? "Pause" : "Play"}
          </button>
          <button type="button" aria-label="Next" onClick={() => props.onJump(1)}>›</button>
          <button type="button" aria-label="Reset" onClick={props.onReset}>Reset</button>
        </div>
      </footer>
    </main>
  )
}
```

`src/app.css`:

```css
* { box-sizing: border-box; }
body { margin: 0; background: #0e0e0e; color: #fff; font-family: system-ui, sans-serif; }
h1 { font-size: 1rem; letter-spacing: -0.04em; }
h1 span { color: #ff5a1f; }
.topbar, .transport { display: flex; justify-content: space-between; align-items: center; gap: 12px; padding: 12px 16px; }
.session-name { display: none; }
.stage { margin: 12px; border-radius: 20px; min-height: 46vh; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; }
.stage-time { font-size: clamp(4rem, 18vw, 8rem); line-height: 0.9; margin: 0; }
.beats { display: flex; gap: 8px; }
.beats span { width: 32px; height: 32px; border-radius: 50%; display: grid; place-items: center; background: rgba(0,0,0,0.18); }
.beats span[data-current="true"] { background: #fff; color: #111; }
.strip { display: flex; gap: 8px; overflow-x: auto; padding: 0 12px 12px; }
.strip article { min-width: 120px; background: #1b1b1b; border-radius: 12px; padding: 10px; }
.strip article[data-current="true"] { outline: 2px solid #ff5a1f; }
.color-red { background: #d23b2f; }
.color-orange { background: #e06a1a; }
.color-yellow { background: #c6a10e; color: #111; }
.color-green { background: #1f8f45; }
.color-blue { background: #1d6fbf; }
.color-pink { background: #b43b78; }
.color-slate { background: #3e4c5e; }
button[aria-label="Play"], button[aria-label="Pause"] { background: #ff5a1f; color: #fff; border: 0; border-radius: 999px; padding: 10px 16px; }
@media (min-width: 800px) {
  .session-name { display: block; }
}
```

`src/App.tsx` renders `Practice` for the default session at elapsed 0 and status `"stopped"`. `onEdit` can be a no-op until Task 8. This keeps `src/App.test.tsx` passing because the wordmark heading remains.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/Practice.test.tsx src/App.test.tsx`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/Practice.tsx src/Practice.test.tsx src/App.tsx src/app.css
git commit -m "Show the practice countdown, segment row, and transport."
```

---

### Task 8: Edit screen

**Files:**
- Create: `src/Edit.tsx`
- Create: `src/Edit.test.tsx`
- Modify: `src/app.css`
- Modify: `src/format.ts`
- Modify: `src/format.test.ts`
- Test: `src/Edit.test.tsx`
- Test: `src/format.test.ts`

**Interfaces:**
- Consumes: `Session`, `PracticeSet`, `METERS`, `COLORS`, `CLICKS` from `src/types.ts`. `clampSession`, `createSetAfter`, `sessionTitle` from `src/session.ts`.
- Produces:

```tsx
export function Edit(props: {
  session: Session
  selectedId: string
  onChange(session: Session): void
  onSelect(id: string): void
  onDone(): void
}): JSX.Element
```

`onChange` receives an already clamped session. Add appends `createSetAfter(last, sets.length + 1, crypto.randomUUID())`. Delete removes the selected set unless it is the only one, then selects a neighbor. Up and down swap with the neighbor. The form’s meter field renders only when `session.perSetMeter` is true. Number and duration fields call `clampSession` on blur.

- [ ] **Step 1: Write the failing test**

`src/Edit.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"
import { Edit } from "./Edit"
import { createDefaultSession } from "./session"

describe("Edit", () => {
  it("adds a set, blocks deleting the last set, and snaps BPM", async () => {
    const user = userEvent.setup()
    const session = createDefaultSession(() => "set-1")
    const onChange = vi.fn()
    render(<Edit session={session} selectedId="set-1" onChange={onChange} onSelect={() => {}} onDone={() => {}} />)

    await user.click(screen.getByRole("button", { name: "Add set" }))
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({
      sets: expect.arrayContaining([expect.objectContaining({ name: "Set 2", durationSec: 60, repeats: 1, color: "orange" })]),
    }))

    expect(screen.getByRole("button", { name: "Delete set" })).toBeDisabled()

    await user.clear(screen.getByLabelText("BPM"))
    await user.type(screen.getByLabelText("BPM"), "12")
    await user.tab()
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({
      sets: [expect.objectContaining({ bpm: 40 })],
    }))
  })

  it("hides the set meter until the session switch is on", () => {
    const session = createDefaultSession(() => "set-1")
    const { rerender } = render(
      <Edit session={session} selectedId="set-1" onChange={() => {}} onSelect={() => {}} onDone={() => {}} />,
    )
    expect(screen.queryByLabelText("Set meter")).not.toBeInTheDocument()
    rerender(
      <Edit
        session={{ ...session, perSetMeter: true }}
        selectedId="set-1"
        onChange={() => {}}
        onSelect={() => {}}
        onDone={() => {}}
      />,
    )
    expect(screen.getByLabelText("Set meter")).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/Edit.test.tsx`

Expected: FAIL with cannot find module `./Edit`

- [ ] **Step 3: Write the editor**

`src/Edit.tsx` renders:

- The same wordmark heading, so the app test still passes when this view is shown.
- A text field labeled `Session name`.
- A list of buttons, one per set, showing name, BPM, rest, repeats, and duration. The selected button has `aria-current="true"`.
- Buttons `Add set`, `Move up`, `Move down`, and `Delete set`.
- Session controls labeled `Meter`, `Different meter per set`, `BPM increase`, and `Click`.
- A form for the selected set labeled `Name`, `Duration`, `BPM`, `Rest`, `Repeats`, `Color`, and `Set meter` when the switch is on.
- A `Done` button that calls `onDone`.

Duration is edited as `m:ss`. Use these helpers, and on blur pass the next session through `clampSession` before `onChange`:

```ts
export function formatDuration(seconds: number): string {
  const whole = Math.max(0, Math.round(seconds))
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, "0")}`
}

export function parseDuration(value: string): number {
  const [minutes, seconds] = value.split(":")
  const parsed = Number(minutes) * 60 + Number(seconds ?? 0)
  return Number.isFinite(parsed) ? parsed : 0
}
```

Put both helpers in `src/format.ts` and cover `formatDuration(90) === "1:30"` and `parseDuration("1:30") === 90` in `src/format.test.ts` before using them. Run `npx vitest run src/format.test.ts` and expect PASS.

Add this to `src/app.css`:

```css
.editor { display: block; }
@media (min-width: 800px) {
  .editor { display: grid; grid-template-columns: 1fr 1fr; }
}
```

On a narrow window the form sits on its own screen: the list view and the form view are two sections, and the component shows the form when `selectedId` was chosen from a set button. Track that with local state `pane: "list" | "form"`, default `"list"`. Choosing a set sets `pane` to `"form"` and calls `onSelect`. A `Back` button returns to `"list"`. Move a set with:

```ts
function moveSets(sets: PracticeSet[], id: string, direction: -1 | 1): PracticeSet[] {
  const index = sets.findIndex((set) => set.id === id)
  const target = index + direction
  if (index < 0 || target < 0 || target >= sets.length) return sets
  const copy = sets.slice()
  const [item] = copy.splice(index, 1)
  copy.splice(target, 0, item)
  return copy
}
```

At `min-width: 800px`, CSS shows both sections and hides `Back`:

```css
.editor-form { display: none; }
.editor[data-pane="form"] .editor-list { display: none; }
.editor[data-pane="form"] .editor-form { display: block; }
@media (min-width: 800px) {
  .editor-list, .editor-form { display: block; }
  .back-to-sets { display: none; }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/Edit.test.tsx`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/Edit.tsx src/Edit.test.tsx src/app.css
git commit -m "Edit sets on a narrow screen and a two-column wide screen."
```

---

### Task 9: Wire playback

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/App.test.tsx`
- Test: `src/App.test.tsx`

**Interfaces:**
- Consumes: `loadSession`, `saveSession` from `src/store.ts`. `expandSession` from `src/expandSession.ts`. `snapshotAt` from `src/clock.ts`. `createClickBuffers`, `scheduleSegment` from `src/audio.ts`. `Practice` and `Edit`.
- Produces: the running app. `App` loads the session, saves on every edit, and owns playback.

Playback rules to implement in `App.tsx`:

- View state is `"practice" | "edit"`. Edit starts on the first set.
- `onEdit` stops playback, clears scheduled audio nodes, and shows Edit.
- Play creates one `AudioContext` on the first gesture and calls `resume()`. If `resume` does not leave `state === "running"`, status is `"no-audio"` and the countdown still runs.
- While playing, `requestAnimationFrame` advances elapsed time and publishes `snapshotAt`.
- When a segment starts, call `scheduleSegment` for that segment only, using `audio.currentTime` plus any already-elapsed part of the segment. Skip clicks whose start time is already past. Stop those nodes on pause, jump, reset, and when the segment changes.
- Pause freezes elapsed. Play again resumes from that elapsed time.
- Previous and next move elapsed to the start of the neighboring segment. They keep the previous playing or paused status. Reset sets elapsed to 0 and status to `"stopped"`.
- When elapsed reaches the end of the list, status becomes `"stopped"` and elapsed stays at the end.
- Changing the session from Edit saves it and rebuilds segments. Playback is already stopped.

- [ ] **Step 1: Write the failing test**

Extend `src/App.test.tsx`:

```tsx
it("stops playback when Edit opens", async () => {
  const user = userEvent.setup()
  render(<App />)
  await user.click(screen.getByRole("button", { name: "Play" }))
  await user.click(screen.getByRole("button", { name: "Edit" }))
  expect(screen.getByRole("button", { name: "Add set" })).toBeInTheDocument()
  await user.click(screen.getByRole("button", { name: "Done" }))
  expect(screen.getByRole("button", { name: "Play" })).toBeInTheDocument()
})
```

Mock `AudioContext` in the test file with a class whose `resume` resolves and whose `state` is `"running"`, plus `createBuffer`, `createBufferSource`, and `destination`. If the real `AudioContext` exists under jsdom, stub `globalThis.AudioContext` before render.

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/App.test.tsx`

Expected: FAIL because Edit does not open, or Play is missing.

- [ ] **Step 3: Implement App playback**

Replace `src/App.tsx` with the state described above. Keep the wordmark inside `Practice` and `Edit`, not a second heading in `App`, so exactly one `Mentronome` heading is rendered.

Use this elapsed loop:

```ts
function usePlayback(segments: Segment[]) {
  const [elapsed, setElapsed] = useState(0)
  const [status, setStatus] = useState<PlaybackStatus>("stopped")
  const elapsedRef = useRef(0)
  const statusRef = useRef(status)
  statusRef.current = status

  useEffect(() => {
    let frame = 0
    let last = performance.now()
    const tick = (now: number) => {
      if (statusRef.current === "playing" || statusRef.current === "no-audio") {
        const next = elapsedRef.current + (now - last) / 1000
        elapsedRef.current = next
        setElapsed(next)
      }
      last = now
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [])

  return { elapsed, status, setStatus, elapsedRef }
}
```

Schedule audio in an effect that depends on `snapshot.segmentIndex` and `status`. Read `audio.currentTime` inside that effect.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test`

Expected: PASS for every test file.

- [ ] **Step 5: Commit**

```bash
git add src/App.tsx src/App.test.tsx
git commit -m "Play, pause, and edit one saved practice session."
```

---

### Task 10: Check the running app

**Files:**
- Modify: none, unless a check fails. A failure goes back to the task that owns it.

**Interfaces:**
- Consumes: the app from Task 9.
- Produces: a checked narrow layout and a checked wide layout.

- [ ] **Step 1: Run the full test suite**

Run: `npm test`

Expected: PASS

- [ ] **Step 2: Run the dev server**

Run: `npm run dev`

Open the printed local URL.

- [ ] **Step 3: Check the spec by hand**

Narrow window, under 800px:

- The first screen is the countdown for Set 1’s count-in, about 0:03 at 80 BPM.
- Play starts the clicks. Beat 1 sounds brighter.
- After the count-in, the stage counts down a 2:00 playing stretch.
- Pause freezes the time. Play continues from that time.
- Previous and next jump a segment. Reset returns to the start and stops.
- The rest between two repeats is silent after one short cue, and it names the next stretch.
- Edit opens the list. A set’s fields open on their own screen. Done returns to Practice.
- Add a set, set it to 100 BPM, and reload. Both sets are still there. Playback is stopped.

Wide window, 800px or more:

- The countdown is larger and the session name is in the header.
- Edit shows the list and the selected set side by side.

Sound check: in a browser that blocks audio, the page says sound is unavailable and the countdown still moves.

- [ ] **Step 4: Commit only if a check required a fix**

```bash
git add src
git commit -m "Fix the practice session behavior found in the manual check."
```

If nothing failed, do not create an empty commit.
