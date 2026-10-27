# Edit page

The editor is two equal cards, then either a simple pattern or a list of cycles. Both types produce the same playback list: a count-in, a practice, and sometimes a rest, repeated for the whole session. One session BPM climbs by a fixed step. Done saves only the type on screen.

## Goals

- The top of the editor is one row of two cards of equal height.
- Simple mode builds a repeated pattern. Complex mode lists each cycle.
- Switching from Simple to Complex keeps the same practices, rests, and tempos.
- The practice page plays that list. Count-in, the BPM cap, and the rule that a session never ends on a rest stay as they are.

## Non-goals

- Look-ahead scheduling.
- A separate field for the total length.
- Per-cycle color, meter, or name.
- Saving both Simple and Complex after Done.
- A new practice-page layout. The stage, transport, and strip stay where they are.

## Layout

The screen stays a centered column, max width 960px. The header stays the session name on the left and Done on the right. An empty name still displays Practice. The heading accessible name stays Mentronome.

Under the header, two cards share one row and stretch to the same height.

The left card is the session:

- Name
- Color, the six existing dots, one color for the whole session
- A gap, then Type: Simple or Complex

The right card is the tempo:

- BPM
- Meter: 3/4, 4/4, 5/4, 6/8, 7/8
- BPM increase
- Every, beside BPM increase, only in Complex
- Click, under those fields, in both types: click-1, click-2, click-3, click-4

Below the row, Simple shows the interval builder. Complex shows the cycle list. The editor shows the calculated total under that builder. The total is not an input.

Below 800px the cards stack full width: session, then tempo, then the builder. At 800px and above they stay side by side.

## What a session stores

Shared fields: name, color, BPM, meter, BPM increase, click, and type.

BPM is an integer from 40 to 300. BPM increase is an integer of 0 or more. The played tempo is never above 300.

```
played BPM = min(300, session BPM + BPM increase × floor(practice index / every))
```

The practice index starts at 0 for the first practice and counts every practice in the session, including later rounds.

A length is either clock time in seconds, or a number of bars. A bar is the session meter: 4/4 is four beats. Clock length of a bar practice is `bars × beats in the meter × 60 / played BPM`, using that practice's played BPM. A time length does not change when the tempo changes. A rest is always clock time, in seconds, and can be 0.

### Simple

- Practices: how many practices are in one group. Integer, at least 1.
- Length: the shared practice length, time or bars.
- Rest after: clock time after a practice inside a round.
- Step the tempo: off, or a Times count of at least 1. The hidden value starts at 2. Turning the switch off keeps that number.
- Repeat the round: off, or a Rounds count of at least 1 and a Between rest in clock time. The hidden values start at 2 rounds and 0:30. Turning the switch off keeps those numbers.

Every is not shown. It is the Practices count. Step off means the group plays once. Repeat off means one round.

Expansion order is rounds, then tempo steps, then the practices in the group. The first group plays at the session BPM. The next group is one step higher. The climb continues into the next round.

The rest after every practice is Rest after, with two exceptions. The last practice of a round that is not the final round uses Between instead. The last practice of the session has no rest.

A fresh Simple session is the current default, heard the same way: name Practice, red, 80 BPM, 4/4, increase 0, click-1, one practice of 2:00, rest after 0:30, both switches off. The 0:30 is stored and does not play, because that practice is the end of the session.

The 30-second example is 3 practices of 0:30, rest after 0:05, Step on with Times 3, increase 5, Repeat on with Rounds 3 and Between 1:00, starting at 80. The groups play at 80, 85, 90, then 95, 100, 105, then 110, 115, 120. The 1:00 replaces the 0:05 at the end of the first two rounds. The session ends on the last 0:30.

### Complex

A cycle is an id, a length, and a rest in seconds. The list has at least one cycle. Add cycle appends a copy of the last cycle's length and rest, and the new cycle follows the tempo ladder. Each row can move up, move down, or be removed. The first row cannot move up, the last cannot move down, and the only row cannot be removed.

Every is an integer of at least 1, shown beside BPM increase. A Complex session started from scratch uses one cycle of 2:00, rest 0:30, and Every 1. The other shared fields match the fresh Simple session.

A cycle plays the ladder above. A migrated cycle may also store its own BPM. When it does, that number is what plays, and the row shows it with a control that clears it back to the ladder. Cycles created in the editor do not store their own BPM. Count-in uses the same BPM as the practice it precedes.

## Switching and saving

Name, color, BPM, meter, BPM increase, and click are one copy. Editing them on either type changes the session.

A visit that opened on Simple owns the pattern. Simple to Complex rebuilds the cycle list from that form: length units stay, so a bar length stays bars, each cycle's rest is the rest that will play, the final cycle's rest is 0, and Every becomes the Practices count. Complex to Simple shows the Simple form again and drops those cycles. A later switch to Complex rebuilds them from the Simple form.

A visit that opened on a saved Complex session owns the cycles. Choosing Simple shows a fresh pattern without deleting the cycles: Practices is 1, length is 2:00, rest after is 0:30, and both switches are off. Shared fields stay. Switching back to Complex before Done shows the same cycles and does not rebuild them from that fresh pattern.

Done writes the type on screen and drops the other. The next visit opens on the saved type.

Playback always uses the type that is saved. While Edit is open, playback is stopped and elapsed is reset, as it is today.

## Playback

`expandSession` turns the saved type into segments. Each practice is a count-in, then the practice, then a rest when the rest is greater than 0 and another practice follows. Count-in stays four beats in 4/4, lasting `4 × 60 / played BPM`. A rest of 0 is omitted, and the next count-in still plays. The session never ends on a rest.

The stage color stays tied to playback: yellow on a rest, green while playing or when there is no audio, red while stopped or paused. Mini cards for practices and count-ins use the session color. Rest cards stay slate.

The strip label for a practice is the session name, the practice clock length, and the played BPM. Count-in cards stay the short count-in. The footer Set count stays segment index over segment count.

The editor total is the session length: every count-in, practice, and rest that will play. On the practice page, Elapsed and Left add up to that length.

On the practice page, in-place edits still commit on blur or Enter:

- BPM shows the played tempo. For a ladder practice, the commit changes the session BPM so that this practice lands on the typed number: `session BPM = typed − BPM increase × floor(index / every)`, then the usual 40–300 clamp. A cycle with its own BPM updates that number instead.
- Meter changes the session meter. Bar lengths are recalculated. Time lengths stay.
- Duration shows clock time. The commit stores a time length of those seconds, at least 1 second. In Simple this changes the shared length. In Complex it changes that cycle, including a cycle that was in bars.
- A rest commit changes Rest after or Between in Simple, matching which rest is on screen, or that cycle's rest in Complex.

Space to play and pause, seeking from a mini card, and the audio schedule stay as they are. The schedule follows the expanded list, so an edit that changes a length, a rest, or a tempo reschedules.

## Migration

The saved document stays in `localStorage` under `mentronome.session`. A document that already has `type` loads as the new model. A document with `sets` and no `type` migrates once, on load, to Complex:

- Walk the old repeats in order. Each repetition becomes a cycle whose time length is that set's duration and whose rest is that set's rest. The last repetition's rest is stored as 0.
- Name, meter, and click are copied. The session color is the first set's color. Per-set meters and per-set colors are not kept. Durations are already in seconds, so the clock times stay.
- Session BPM is the first repetition's played BPM. BPM increase is 0 and Every is 1 when every repetition shares that BPM.
- When a later repetition's played BPM differs, that cycle stores its own BPM and the tempo card stays at the first BPM with increase 0 and Every 1. Playback uses the stored BPM, so the old session still clicks at the same tempos.

The default document, one set of 2:00 at 80 with a 30 second rest and one repeat, migrates to one cycle of 2:00, rest 0, 80 BPM, increase 0, Every 1. It sounds the same.

## Validation

Blur and Done run the same clamps. An unparseable time becomes 0, and a practice length then becomes at least 1 second. A rest may stay 0. Bars below 1 become 1. Practices, Times, Rounds, and Every below 1 become 1. BPM increase below 0 becomes 0. BPM and any cycle BPM use the existing 40–300 clamp, and the played BPM caps at 300.

## Tests

- Simple expansion of the 30-second example: 27 practices, tempos in groups of three from 80 through 120, 5 second rests inside a round, 60 second rests between rounds, no rest after the last practice.
- A bar length of 8 in 4/4 at 80 BPM lasts 24 seconds, and the same 8 bars at the next step are shorter.
- Switching Simple to Complex copies those cycles, keeps bar lengths as bars, and sets Every to the group size.
- Done on Simple persists Simple. Reopen shows Simple. Done on Complex persists Complex and drops the Simple form.
- A saved Complex session switched to Simple and back, before Done, still has its cycles.
- An old one-set document migrates to one 2:00 cycle at 80 and sounds the same.
- An old session whose repetitions change BPM migrates those tempos onto the cycles that need them.
- In-place BPM, meter, duration, and rest write the fields above.
- Count-in remains four beats. The editor total equals the summed segment lengths.
