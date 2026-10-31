# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Instrument students building speed and accuracy through structured practice. They practise on a laptop or desktop, with the app open beside their sheet music or other practice material, and their hands on the instrument while it runs.

## Product Purpose

Mentronome is a metronome for practice sessions. It doesn't just keep a steady beat: it runs the tempo work a student would otherwise manage by hand. Success means a student sets up a session once, presses Play, and practises without touching the app until they stop.

## Positioning

Mentronome is a metronome that runs a practice plan, not just a beat, and stays simpler than the big metronome apps. All four of these are confirmed as the core of the product:

- **Tempo climbing:** steps the BPM up toward a target on its own, every N bars or every N minutes, then holds there.
- **Structured routines:** rounds and sets of play and rest that run hands-free, with an optional per-round BPM increase.
- **Per-beat control:** each beat has its own subdivision, muted clicks and accent.
- **Simplicity:** fewer options than full-featured metronome apps, and quick to set up and start.

## Operating Context

- It runs in a desktop browser during a practice session. The student glances at it while playing rather than handling it.
- There are three ways to practise, chosen in the player card: Steady (one tempo until stopped), Climb (step up to a target) and Routine (rounds and sets).
- An optional count-in bar plays before the first play.

## Capabilities and Constraints

- React 19 and TypeScript single-page app built with Vite. There is no backend: the session is stored in `localStorage` under `mentronome.session`.
- Audio comes from the Web Audio API, with four click sounds and an accent tone per sound.
- Older saved sessions must keep loading through `clampSession` and `migrateLegacy`.
- Terms used in the app: Steady, Climb and Routine; Round and Set; Repeat, Times, Increase; Start BPM; Count-in; Time Sig, Subdiv, Sound.
- **Undecided:** whether phone use matters. Desktop is the confirmed primary context.

## Brand Commitments

- The product is named Mentronome.

## Evidence on Hand

There are no testimonials, user numbers, reviews or press. Future work must not invent any.

## Product Principles

1. **Hands stay on the instrument.** Once a session starts, it runs without the student touching the app.
2. **Plan the practice, not just the beat.** Tempo changes and structure are part of the session, not something the student tracks in their head.
3. **Simple first.** Every option has to earn its place against a quick set-up and start.
4. **Readable at a glance.** The current state (tempo, phase, time left) is legible from a normal practice distance.
