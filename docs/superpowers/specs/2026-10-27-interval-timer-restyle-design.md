# Interval Timer restyle

Restyle the practice page and the editor so they sit closer to [Interval Timer](https://www.intervaltimer.com/). The session, the segment list, playback, and saving stay as they are. The change is paint, a few header and control shapes, and a color picker made of dots.

## Goals

- One token stylesheet feeds both screens.
- The practice page is a full-window countdown: a quiet header, a stage in the segment color, colored cards, and a readable transport bar with a white circular Play control.
- The editor uses the same page, the same set colors on its chips, and roomy dark fields. A narrow window still opens one set on its own screen. At 800px and wider, the list and the fields stay side by side.
- The metronome stays on the stage: BPM, beat dots, and meter. A rest stays slate, shows the next set and its BPM, and has no beat dots.

## Non-goals

- Changing durations, BPM rules, rests, repeats, meters, count-ins, or what gets saved.
- A new screen, a font download, or Interval Timer’s logo.
- Rebuilding Practice or Edit into new components.

## Tokens

`src/tokens.css` defines custom properties on `:root`. `src/app.css` imports it. Practice and Edit do not hard-code these colors, sizes, or radii.

| Token | Value | Use |
| --- | --- | --- |
| `--page` | `#0c0c0c` | Page background |
| `--surface` | `#1a1a1a` | Fields, quiet buttons |
| `--ink` | `#ffffff` | Primary text |
| `--ink-muted` | `#bdbdbd` | Labels |
| `--ink-on-yellow` | `#1a1a1a` | Text on a yellow set |
| `--play` | `#ffffff` | Play circle fill |
| `--play-ink` | `#111111` | Glyph on the Play circle |
| `--line` | `#2e2e2e` | Quiet borders |
| `--red` | `#e23b32` | Set color |
| `--orange` | `#f07820` | Set color |
| `--yellow` | `#f0c429` | Set color |
| `--green` | `#2ea85a` | Set color |
| `--blue` | `#2f7fe0` | Set color |
| `--pink` | `#e24b8a` | Set color |
| `--rest` | `#4a5968` | Rest stage and rest cards |
| `--radius-stage` | `28px` | Stage |
| `--radius-card` | `16px` | Segment cards and set chips |
| `--radius-field` | `12px` | Fields |
| `--radius-pill` | `999px` | Edit, Done, and small actions |
| `--time-size` | `clamp(4.5rem, 18vw, 9rem)` | Countdown |

The countdown is weight 700 with tight letter-spacing. A current card or chip uses a 2px solid white outline.

## Practice page

The header’s visible text is the session title (`Practice` when the name is empty). The heading keeps `aria-label="Mentronome"`. Edit is a quiet outlined pill. There is one heading, so the session title is not repeated beside the wordmark.

The stage fills the space above the card row. Its background is the segment color. Yellow text uses `--ink-on-yellow` on the stage, on cards, and on editor chips. The stage shows the segment label and the countdown. A count-in or a playing stretch also shows `BPM · meter` and the beat dots. The current beat is a light dot with dark text. The other beats are translucent. A rest is labeled Rest, shows `Next · {name} at {bpm}`, and has no dots. The existing “Sound is unavailable” message stays on the stage when audio cannot run.

Cards scroll sideways. Each card’s background is its segment color. A playing card shows its length and BPM. The current card has the white outline.

The transport has two rows on a narrow window: Elapsed, Set, and Left, each a muted label over a white number; then Previous, Play or Pause, Next, and Reset. At 800px and wider those groups share one row. The page stays one column, and the countdown uses the larger end of `--time-size`. Previous and Next stay arrow buttons. Play and Pause are the white circle with a play or pause glyph. Their accessible names stay Play and Pause. Reset stays a text button.

## Editor

The header’s visible text is the session title, with the same Mentronome accessible name. Done is a quiet outlined pill.

Set chips use the set color and show the same text they show now: name, BPM, rest, repeats, and duration. The selected chip has the white outline. Add set, Move up, Move down, and Delete set stay on the list, as do session name, meter, per-set meter, BPM increase, and click. Those controls use the surface field style.

On a narrow window, choosing a set still opens its fields alone, with Back. At 800px and wider, the list and the fields are both visible and Back is hidden. Fields are name, duration, BPM, rest, repeats, color, and set meter when per-set meter is on. Labels are muted. Values sit on `--surface` with `--radius-field`.

Color is six dot buttons, one per set color, in a group labeled Color. The selected dot has the white outline. Choosing a dot sets that color immediately. The stored values stay `red`, `orange`, `yellow`, `green`, `blue`, and `pink`.

## Testing

The current tests must pass without new product behavior. Buttons and fields they already query keep their names: Mentronome heading, Edit, Done, Add set, Delete set, Play, Pause, Duration, BPM, Set meter, and the sound-unavailable status.

After the tests pass, check four views in the browser: the narrow practice page, the narrow editor list, the narrow set screen, and the wide editor with both columns. Confirm a yellow set uses dark text, a rest is slate, and the transport numbers do not run into the controls.
