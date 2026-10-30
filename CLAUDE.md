# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev       # Start Vite dev server with HMR
npm run test      # Run all Vitest tests (jsdom environment)
npm run build     # TypeScript type-check + production build
```

Run a single test file:
```bash
npm run test -- src/clock.test.ts
```

Run tests in watch mode:
```bash
npm run test -- --watch
```

## Architecture

**Mentronome** is a React 19 + TypeScript metronome app for musicians. There is no backend — all state lives in `localStorage` and audio runs in the browser via Web Audio API.

### Data Flow

```
Session (localStorage) → expandSession() → Segment[] → clock.ts → audio.ts → Web Audio nodes
                                                              ↓
                                                        App.tsx (schedules clicks via requestAnimationFrame)
```

### Practice Modes

Practice has three ways to play, chosen with the Steady | Climb | Routine switch in the player card (`session.practice`):
- **Steady** — one endless stretch at the session BPM until stopped
- **Climb** — one endless stretch that steps from Start BPM by `bpmIncrease` every N bars or N seconds (`time.everyUnit`, `everyBars`, `everySec`) up to `time.targetBpm`, then holds there until stopped. Editing Climb while playing keeps your place in the current step (`climb.ts`, `App.onChange`)
- **Routine** — Round/Set structure with play/rest durations (bars or MIN:SEC) and an optional per-round increase (`routine.increase`: each round +N BPM, every set restarts at Start)

Older saves load through `clampSession`: `routineEnabled` → Routine, Simple with an increase or `type: "time"` → Climb, otherwise Steady. Legacy fields (`type`, `simple`, `complex`, `cycles`, `name`, `color`) are still loaded and clamped for old saved sessions but no longer drive playback or UI.

### Key Modules

- **`types.ts`** — All domain types (`Session`, `Meter`, `Length`, `Subdivision`, `Segment`, etc.)
- **`session.ts`** — Session creation, validation (`clampSession`), BPM math, legacy migration
- **`expandSession.ts`** — Transforms a `Session` into an ordered array of `Segment` objects (count-in → play → rest)
- **`climb.ts`** — Where you are in a Climb's steps, and how to keep that place when its settings change
- **`clock.ts`** — Given elapsed time, computes current segment/beat/BPM; generates the 2-second click window for scheduling
- **`audio.ts`** — Web Audio API: creates sine-wave click buffers for 4 click styles; schedules audio nodes
- **`store.ts`** — `loadSession()` / `saveSession()` via `localStorage` key `"mentronome.session"`

### UI Components

- **`App.tsx`** — Root: owns session state, audio context, playback loop via `requestAnimationFrame`
- **`Practice.tsx`** — The only screen: beat display, BPM card (BPM / Start BPM and Now), Time sig / Subdiv / Click sheets
- **`PlayerCard.tsx`** — Player for all three practices: darker panel (label + Count-in, big number, progress, Play/Stop), the Steady | Climb | Routine switch, and Climb or Routine settings

### Styling

Plain CSS — `tokens.css` defines design tokens (colors, spacing); `app.css` contains all component styles. No CSS framework.

### Testing

Vitest 3 + Testing Library. Tests run sequentially (file parallelism disabled in `vite.config.ts`). Each test file covers its corresponding module; `App.test.tsx` and `Practice.test.tsx` are integration-level tests using a mocked Web Audio API.
