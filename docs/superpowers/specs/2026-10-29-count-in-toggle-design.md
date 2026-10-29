# Count-In Toggle Design

## Goal

Make the count-in bar optional per session, defaulting to off (no count-in). Currently a 4-beat count-in bar always plays before the session starts (except Time sessions). Users who prefer to start immediately should not have to hear it.

## Data Model

Add `countIn: boolean` to the `Session` type in `src/types.ts`.

- Default: `false` (no count-in)
- `createDefaultSession` in `src/session.ts` returns `countIn: false`
- `clampSession` passes the field through unchanged
- `migrateLegacy` adds `countIn: false` to any session object missing the field

## Expansion Logic

In `src/expandSession.ts`, gate the existing count-in logic on `session.countIn`:

```ts
const addCountIn = session.countIn && (session.routineEnabled ? index === 0 : session.type !== "time")
```

Time sessions continue to have no count-in regardless of the toggle (existing behavior, unchanged).

## Edit UI

Add a `switch` button for "Count-in" in the Session card of `src/Edit.tsx`, using the existing `aria-pressed` button pattern already present in the file. One row added to the Session card — no new UI patterns needed.

## Tests

Tests in `src/expandSession.test.ts` and `src/clock.test.ts` that assert on count-in segments must add `countIn: true` to their session fixtures (since the default is now `false`, those tests would otherwise produce no count-in and fail). Tests in `src/App.test.tsx` that calculate `countInSec` and advance time past the count-in must also add `countIn: true` to their session fixtures.

## Files

- **Modify:** `src/types.ts` — add `countIn: boolean` to `Session`
- **Modify:** `src/session.ts` — update `createDefaultSession`, `migrateLegacy`
- **Modify:** `src/expandSession.ts` — gate count-in on `session.countIn`
- **Modify:** `src/Edit.tsx` — add count-in toggle to Session card
- **Modify:** `src/expandSession.test.ts` — add `countIn: true` to fixtures that need it
- **Modify:** `src/clock.test.ts` — add `countIn: true` to fixtures that need it
- **Modify:** `src/App.test.tsx` — add `countIn: true` to fixtures that need it
