# Mentronome

A mobile-first website for a timed practice session with a musical metronome. The page works like [Interval Timer](https://www.intervaltimer.com/): a full-window countdown, a row of segments, and an editor for the blocks. During a playing stretch it clicks like a metronome, with a time signature, an accent on beat 1, and a beat counter.

## Goals

- Build one practice session as an ordered list of sets.
- Each set has its own duration, BPM, rest, repeat count, and color.
- An optional BPM increase applies to each repetition of a set. The next set starts at the BPM typed for it.
- The metronome uses one meter for the session, with an optional per-set meter.
- The browser remembers the last session.
- The layout is a website, designed for a narrow window first and a wide window second.

## Non-goals

- A library of named sessions, accounts, or sharing links.
- A native app, vibration, or screen flash.
- Drums, a reverse ramp, or a max-tempo wrap back to the start.
- Set length measured in bars. Duration is wall-clock time.
- A count-in that consumes the rest. The count-in is extra time after the rest.

## Session

A session stores:

- `name`. An empty name is shown as Practice.
- `meter`: `3/4`, `4/4`, `5/4`, `6/8`, or `7/8`. Default `4/4`.
- `perSetMeter`: off by default. When off, every playing stretch uses the session meter. When on, each set uses its own meter.
- `bpmIncrease`: a whole number of at least 0. Zero means every repetition stays at the set’s BPM.
- `click`: one of four click timbres, default the first. Each timbre has a normal click and a brighter accent click.
- `sets`: the ordered list. A session always has at least one set.

Each set stores:

- `id`
- `name`. An empty name is shown as Set.
- `duration`: at least 1 second.
- `bpm`: an integer from 40 to 300.
- `rest`: zero or more seconds.
- `repeats`: an integer of at least 1.
- `color`: one of red, orange, yellow, green, blue, pink.
- `meter`: used only while `perSetMeter` is on. Otherwise the session meter wins.

The BPM is the click rate. Eighty BPM is eighty clicks per minute in every meter. The meter groups those clicks into bars and accents beat 1. It does not change how long a click is.

The first visit creates a session named Practice with one set named Set 1: 2:00, 80 BPM, a 30-second rest, one repeat, red. Meter is 4/4, per-set meter is off, the BPM increase is 0, and the click is the first timbre.

Every edit is written to `localStorage` under `mentronome.session`. A reload restores that session. Playback position is not stored. If the saved value cannot be read, the page loads the first-visit session.

Leaving a field snaps it to the nearest allowed value, so a saved session can always be played. A repetition whose BPM would pass 300 stays at 300, as do later repetitions of that same set.

## Playback

Before Start, the session expands into an ordered list of segments. The player walks that list. Clicks are placed on the Web Audio clock.

For each set, for each repetition `n` starting at 1:

1. The playing BPM is the set’s BPM plus `(n - 1) * bpmIncrease`, capped at 300.
2. A count-in of four clicks at that BPM, accented on click 1. This bar is always 4/4, even when the set uses another meter. Its length is `4 * 60 / bpm` seconds, added after any rest and before the playing stretch. Start begins with this bar.
3. A playing stretch that lasts exactly the set’s duration. Beat 1 of each bar is accented. The beat counter follows the meter (the set’s meter when per-set meter is on, otherwise the session meter). Clicks stop when the duration ends, including in the middle of a bar.
4. If another playing stretch follows, a rest of this set’s rest length. The rest is silent except for one short cue at its first moment, and it shows a countdown. A rest of 0 seconds is omitted. The count-in before the next stretch still plays.

The session ends when the last playing stretch ends. The last set’s rest is unused, and nothing follows that stretch.

A set at 80 BPM, repeated 3 times, increase +5, rest 30 seconds, then a second set at 100 BPM for 1 minute once, expands to:

1. Four count-in clicks at 80
2. Play 2:00 at 80
3. Rest 0:30
4. Four count-in clicks at 85
5. Play 2:00 at 85
6. Rest 0:30
7. Four count-in clicks at 90
8. Play 2:00 at 90
9. Rest 0:30
10. Four count-in clicks at 100
11. Play 1:00 at 100

The stage color for a count-in and a playing stretch is that set’s color. A rest uses a fixed slate.

## Screens

One React app with three views. Styles are written for a narrow window. At 800px and wider, the editor places the list and the selected set side by side. The practice page stays one column and uses a larger countdown.

### Practice

- Narrow header: the Mentronome wordmark and Edit. A wide header also shows the session name.
- A stage in the current segment’s color fills the window. It shows the segment label, the time left in that segment, and, during a count-in or a playing stretch, the BPM, the beat counter, and the meter. A count-in is labeled with the upcoming set’s name and shows four beats. A rest is labeled Rest, shows the name and BPM of the playing stretch that follows, and has no beat counter.
- Under the stage, the expanded segments scroll sideways. The current segment is outlined. Each card shows its label and its length. A playing card also shows its BPM.
- A footer shows elapsed session time, the current set number out of the number of sets, and time left in the session, plus previous, play/pause, next, and reset. Elapsed and remaining follow the segment list and stay still while paused. A rest belongs to the set that just finished. A count-in and a playing stretch belong to the set that is about to play or is playing.

### Edit

- The list shows each set’s name, BPM, rest, repeat count, and duration on its color chip. The user can add a set, move a set up or down, and delete a set. The last remaining set cannot be deleted.
- Session settings sit on the list: meter, the per-set meter switch, BPM increase, and click timbre.
- On a narrow window, tapping a set opens its fields on their own screen, with a way back to the list. Fields are name, duration, BPM, rest, repeats, color, and meter when per-set meter is on.
- On a wide window, the list stays on the left and the selected set’s fields stay on the right.
- Done returns to Practice. Opening Edit stops playback. A new set copies the previous set’s BPM and rest, lasts 1:00, repeats once, takes the next palette color after the previous set, cycling to red after pink, and is named Set plus its position in the list.

## Behavior while playing

Start is the gesture that unlocks audio. If the click buffers are still loading, the control waits. If the browser will not play audio, the countdown continues and the page says sound is unavailable.

Pause holds the current segment and schedules no further clicks. Resume continues that segment with the time that was left. Previous and next jump to the neighboring segment boundary. They keep playing if playback was running, and stay paused if it was paused. Reset returns to the first segment and stops. A reload restores the session and leaves playback stopped.

## Architecture

Vite, React, and TypeScript. No server.

- `expandSession(session)` returns the segment list. It is a pure function.
- A clock reads that list, schedules clicks on `AudioContext.currentTime`, and reports the current segment, the current beat, and the time left.
- A store reads and writes `mentronome.session`.
- Practice owns the clock. Edit only changes the session and saves it. The next Start builds a new segment list.

A segment is `count-in`, `play`, or `rest`, and carries the set id, the label, the 1-based repetition, the BPM, the meter, the duration, and the color. A count-in’s meter is always 4/4.

## Testing

`expandSession` is tested with the 80 BPM example above, a 0-second rest, the 300 BPM cap, increase turned off, and both meter modes. The count-in stays four clicks in every case, and the list never ends on a rest.

The store is tested for a round trip and for an unreadable save, which loads the first-visit session.

The clock is tested with a fake timer and no audio output. At time 0 the session is on the first count-in beat. After `4 * 60 / bpm` seconds it is on the first playing stretch.

After the tests pass, run the app and check Start, a silent rest after its opening cue, a reload that keeps the sets, the narrow layout, and the wide editor.

## Out of scope for this version

Presets, accounts, sharing, drums, reverse, vibration, flash, and measuring a set in bars.
