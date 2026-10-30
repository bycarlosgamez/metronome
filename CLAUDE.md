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

Practice has two modes, chosen with the Simple | Routine control (`session.routineEnabled`):
- **Simple** — one endless stretch at the session BPM; an optional increase (every N bars by a step) ramps up to the target BPM and holds there until stopped
- **Routine** — Round/Set structure with play/rest durations (bars or MIN:SEC) and its own BPM increase (`routine.increase`, separate from Simple's): one of Off, per round (set on the routine card: each round +N BPM, every set restarts at Start) or Increase to target (set in the BPM sheet: climbs inside each play)

Legacy fields (`type`, `simple`, `complex`, `cycles`, `name`, `color`) are still loaded and clamped for old saved sessions but no longer drive playback or UI.

### Key Modules

- **`types.ts`** — All domain types (`Session`, `Meter`, `Length`, `Subdivision`, `Segment`, etc.)
- **`session.ts`** — Session creation, validation (`clampSession`), BPM math, legacy migration
- **`expandSession.ts`** — Transforms a `Session` into an ordered array of `Segment` objects (count-in → play → rest)
- **`clock.ts`** — Given elapsed time, computes current segment/beat/BPM; generates the 2-second click window for scheduling
- **`audio.ts`** — Web Audio API: creates sine-wave click buffers for 4 click styles; schedules audio nodes
- **`store.ts`** — `loadSession()` / `saveSession()` via `localStorage` key `"mentronome.session"`

### UI Components

- **`App.tsx`** — Root: owns session state, audio context, playback loop via `requestAnimationFrame`
- **`Practice.tsx`** — The only screen: beat display, BPM card, meter/subdivision sheets, routine card, play controls and count-in toggle

### Styling

Plain CSS — `tokens.css` defines design tokens (colors, spacing); `app.css` contains all component styles. No CSS framework.

### Testing

Vitest 3 + Testing Library. Tests run sequentially (file parallelism disabled in `vite.config.ts`). Each test file covers its corresponding module; `App.test.tsx` and `Practice.test.tsx` are integration-level tests using a mocked Web Audio API.
