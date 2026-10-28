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

### Session Types

Three session types (`types.ts`) with different expansion logic in `expandSession.ts`:
- **Simple** — fixed length, repeating with BPM increases
- **Complex** — custom cycles with flexible repeat logic
- **Time** — freeform duration with optional auto-ramping tempo

### Key Modules

- **`types.ts`** — All domain types (`Session`, `Meter`, `Length`, `Subdivision`, `Segment`, etc.)
- **`session.ts`** — Session creation, validation (`clampSession`), BPM math, legacy migration
- **`expandSession.ts`** — Transforms a `Session` into an ordered array of `Segment` objects (count-in → play → rest)
- **`clock.ts`** — Given elapsed time, computes current segment/beat/BPM; generates the 2-second click window for scheduling
- **`audio.ts`** — Web Audio API: creates sine-wave click buffers for 4 click styles; schedules audio nodes
- **`store.ts`** — `loadSession()` / `saveSession()` via `localStorage` key `"mentronome.session"`

### UI Components

- **`App.tsx`** — Root: owns session state, view switching (practice ↔ edit), audio context, playback loop via `requestAnimationFrame`
- **`Practice.tsx`** — Playback view: beat display, play/pause/reset/seek, BPM display
- **`Edit.tsx`** — Configuration view: session type switcher, pattern fields, cycle management

### Styling

Plain CSS — `tokens.css` defines design tokens (colors, spacing); `app.css` contains all component styles. No CSS framework.

### Testing

Vitest 3 + Testing Library. Tests run sequentially (file parallelism disabled in `vite.config.ts`). Each test file covers its corresponding module; `App.test.tsx`, `Practice.test.tsx`, and `Edit.test.tsx` are integration-level tests using a mocked Web Audio API.
