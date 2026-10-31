import { act, fireEvent, render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"
import { snapshotAt } from "./clock"
import { expandSession } from "./expandSession"
import { Practice } from "./Practice"
import { createDefaultSession } from "./session"
import type { Session } from "./types"

function makeProps(overrides: Partial<Session> = {}) {
  const session: Session = { ...createDefaultSession(() => "s1"), ...overrides }
  const segments = expandSession(session)
  return {
    session,
    segments,
    snapshot: snapshotAt(segments, 0),
    status: "stopped" as const,
    onToggle: vi.fn(),
    onJump: vi.fn(),
    onReset: vi.fn(),
    onChange: vi.fn(),
    onSeek: vi.fn(),
  }
}

describe("Practice", () => {
  it("renders the session name and no Edit button", () => {
    render(<Practice {...makeProps()} />)
    expect(screen.getByRole("heading", { name: "Mentronome" })).toHaveTextContent("Practice")
    expect(screen.queryByRole("button", { name: "Edit" })).not.toBeInTheDocument()
  })

  it("shows beat squares for the current meter", () => {
    render(<Practice {...makeProps()} />)
    expect(screen.getByTestId("beat-1")).toBeInTheDocument()
    expect(screen.getByTestId("beat-4")).toBeInTheDocument()
    expect(screen.queryByTestId("beat-5")).not.toBeInTheDocument()
  })

  it("marks every accented beat square", () => {
    render(<Practice {...makeProps({ accents: [1, 3] })} />)
    expect(screen.getByTestId("beat-3")).toHaveAttribute("data-accent", "true")
    expect(screen.getByTestId("beat-2")).toHaveAttribute("data-accent", "false")
  })

  it("lights the first dot at the start of a beat after a rest that isn't a whole number of beats", () => {
    const base = createDefaultSession(() => "s1")
    const props = makeProps({
      practice: "routine", bpm: 80,
      beats: base.beats.map(() => ({ subdivision: "eighth" as const, slots: ["click-1" as const, "click-1" as const] })),
      routine: { ...base.routine, unit: "sec", playDuration: 10, restDuration: 1, round: { enabled: true, count: 2, restDuration: 0 } },
    })
    // Round 2 starts at 11s; 0.1s in is the first eighth of beat 1
    render(<Practice {...props} snapshot={snapshotAt(props.segments, 11.1)} status="playing" />)
    const dots = within(screen.getByRole("region", { name: "Beat display" }))
    expect(dots.getByRole("button", { name: "Beat 1 click 1" })).toHaveClass("lit")
    expect(dots.getByRole("button", { name: "Beat 1 click 2" })).not.toHaveClass("lit")
  })

  it("mutes a click by tapping its dot under the beat", async () => {
    const props = makeProps()
    render(<Practice {...props} />)
    const dot = within(screen.getByRole("region", { name: "Beat display" })).getByRole("button", { name: "Beat 2 click 1" })
    expect(dot).toHaveAttribute("aria-pressed", "true")
    await userEvent.setup().click(dot)
    expect(props.onChange.mock.calls.at(-1)![0].beats[1].slots).toEqual(["off"])
  })

  it("shows beat-1 as accent", () => {
    render(<Practice {...makeProps()} />)
    expect(screen.getByTestId("beat-1")).toHaveAttribute("data-accent", "true")
    expect(screen.getByTestId("beat-2")).toHaveAttribute("data-accent", "false")
  })

  it("shows current BPM", () => {
    render(<Practice {...makeProps()} />)
    expect(screen.getByTestId("bpm-current")).toHaveDisplayValue("80")
  })

  it("does not commit BPM when input is cleared", async () => {
    const props = makeProps()
    const user = userEvent.setup()
    render(<Practice {...props} />)
    const input = screen.getByTestId("bpm-current")
    await user.clear(input)
    await user.tab()
    expect(props.onChange).not.toHaveBeenCalled()
  })








  it("shows Play button when stopped", () => {
    render(<Practice {...makeProps()} />)
    expect(screen.getByRole("button", { name: "Play" })).toBeInTheDocument()
  })

  it("shows Pause button when playing", () => {
    const props = { ...makeProps(), status: "playing" as const }
    render(<Practice {...props} />)
    expect(screen.getByRole("button", { name: "Pause" })).toBeInTheDocument()
  })

  it("calls onToggle when Play is clicked", async () => {
    const props = makeProps()
    const user = userEvent.setup()
    render(<Practice {...props} />)
    await user.click(screen.getByRole("button", { name: "Play" }))
    expect(props.onToggle).toHaveBeenCalledOnce()
  })

  it("calls onReset when Stop is clicked", async () => {
    const props = makeProps()
    const user = userEvent.setup()
    render(<Practice {...props} />)
    await user.click(screen.getByRole("button", { name: "Stop" }))
    expect(props.onReset).toHaveBeenCalledOnce()
  })

  it("shows Meter button with current meter", () => {
    render(<Practice {...makeProps()} />)
    expect(screen.getByRole("button", { name: /Time signature: 4\/4/ })).toBeInTheDocument()
  })

  it("shows Subdivision button", () => {
    render(<Practice {...makeProps()} />)
    expect(screen.getByRole("button", { name: /Subdivision: quarter/ })).toBeInTheDocument()
  })

  it("opens meter sheet when Meter button is clicked", async () => {
    const props = makeProps()
    const user = userEvent.setup()
    render(<Practice {...props} />)
    // When closed, dialog has inert attribute - query via DOM
    expect(document.querySelector(".sheet-overlay:not(.open)")).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: /Time signature/ }))
    // After click, the meter sheet should be open
    const dialogs = document.querySelectorAll(".sheet-overlay")
    const meterDialog = Array.from(dialogs).find((el) => el.getAttribute("aria-label") === "Time Signature")
    expect(meterDialog).toHaveClass("open")
  })

  it("opens subdivision sheet when Subdivision button is clicked", async () => {
    const props = makeProps()
    const user = userEvent.setup()
    render(<Practice {...props} />)
    await user.click(screen.getByRole("button", { name: /Subdivision/ }))
    const dialogs = document.querySelectorAll(".sheet-overlay")
    const subdivDialog = Array.from(dialogs).find((el) => el.getAttribute("aria-label") === "Subdivision")
    expect(subdivDialog).toHaveClass("open")
  })





  it("does not show strip for time sessions", () => {
    render(<Practice {...makeProps()} />)
    expect(document.querySelector(".strip")).not.toBeInTheDocument()
  })






  it("routine card shows Play and Rest steppers with default values", () => {
    render(<Practice {...makeProps({ practice: "routine" })} />)
    expect(screen.getByRole("button", { name: "Increase play duration" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Decrease play duration" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Increase rest duration" })).toBeInTheDocument()
  })

  it("clicking Increase play duration calls onChange with incremented value", async () => {
    const props = makeProps({ practice: "routine" })
    const user = userEvent.setup()
    render(<Practice {...props} />)
    await user.click(screen.getByRole("button", { name: "Increase play duration" }))
    expect(props.onChange).toHaveBeenCalledWith(
      expect.objectContaining({ routine: expect.objectContaining({ playDuration: 5 }) })
    )
  })

  it("Set section is hidden when round.enabled is false", () => {
    render(<Practice {...makeProps({ practice: "routine" })} />)
    expect(screen.queryByText("Set")).not.toBeInTheDocument()
  })

  it("Set section appears when round.enabled is true", () => {
    const props = makeProps({
      practice: "routine",
      routine: { ...createDefaultSession().routine, round: { enabled: true, count: 4, restDuration: 0 } },
    })
    render(<Practice {...props} />)
    expect(screen.getByText("Set")).toBeInTheDocument()
    // Rest between only matters when sets repeat, so it waits inside Set repeat's panel
    expect(screen.queryByRole("textbox", { name: "Set rest minutes" })).not.toBeInTheDocument()
  })

  it("toggling Round repeat off clears set enabled", async () => {
    const props = makeProps({
      practice: "routine",
      routine: {
        ...createDefaultSession().routine,
        round: { enabled: true, count: 4, restDuration: 0 },
        set:   { enabled: true, count: 3, restDuration: 30 },
      },
    })
    const user = userEvent.setup()
    render(<Practice {...props} />)
    await user.click(screen.getByRole("switch", { name: "Round repeat" }))
    expect(props.onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        routine: expect.objectContaining({
          round: expect.objectContaining({ enabled: false }),
          set:   expect.objectContaining({ enabled: false }),
        }),
      })
    )
  })

  it("has no Block section and no BPM increase row", () => {
    const props = makeProps({
      practice: "routine",
      bpmIncrease: 5,
      routine: {
        ...createDefaultSession().routine,
        round: { enabled: true, count: 2, restDuration: 0 },
        set:   { enabled: true, count: 2, restDuration: 30 },
      },
    })
    render(<Practice {...props} />)
    expect(document.querySelector(".player-card")).not.toHaveTextContent(/Block/)
    expect(screen.queryByText(/BPM \+/)).not.toBeInTheDocument()
    expect(screen.getByTestId("player-round")).toHaveTextContent(/^Round 1\/2 · Set 1\/2$/)
  })

  describe("routine Start and Now BPM", () => {
    const increase = (over: Partial<Session["routine"]["increase"]>) => ({ ...createDefaultSession().routine.increase, ...over })
    function routineProps(routine: Partial<Session["routine"]>, elapsed = 0, status: "playing" | "stopped" = "stopped") {
      const props = makeProps({ practice: "routine", bpm: 80, routine: { ...createDefaultSession().routine, ...routine } })
      return { ...props, snapshot: snapshotAt(props.segments, elapsed), status }
    }

    it("shows Start BPM in the BPM card and the playing BPM in the timer card, with no Now in the BPM card", () => {
      render(<Practice {...routineProps({})} />)
      expect(screen.getByTestId("bpm-current")).toHaveValue("80")
      expect(screen.getByText("Start BPM")).toBeInTheDocument()
      expect(document.querySelector(".player-panel")).toContainElement(screen.getByTestId("player-bpm"))
      expect(screen.getByTestId("player-bpm")).toHaveTextContent("80")
      expect(document.querySelector(".bpm-block")).not.toHaveTextContent(/Now/i)
    })

    it("keeps Start in the input and shows the playing BPM as Now", () => {
      // 4 bars at 80 is 12s, so 13s is in the second round
      const props = routineProps({
        round: { enabled: true, count: 2, restDuration: 0 },
        increase: increase({ mode: "round", roundStep: 5 }),
      }, 13, "playing")
      render(<Practice {...props} />)
      expect(screen.getByTestId("bpm-current")).toHaveValue("80")
      expect(screen.getByTestId("player-bpm")).toHaveTextContent("85")
    })

    it("shows the next play's BPM as Now during a rest", () => {
      // Round 1 plays 10s at 80 then rests 5s; round 2 plays at 85
      const props = routineProps({
        unit: "sec", playDuration: 10, restDuration: 5,
        round: { enabled: true, count: 2, restDuration: 0 },
        increase: increase({ mode: "round", roundStep: 5 }),
      }, 12, "playing")
      render(<Practice {...props} />)
      expect(screen.getByTestId("player-bpm")).toHaveTextContent("85")
    })

    it("shows Start as Now when stopped", () => {
      const props = routineProps({
        round: { enabled: true, count: 2, restDuration: 0 },
        increase: increase({ mode: "round", roundStep: 5 }),
      })
      render(<Practice {...props} />)
      expect(screen.getByTestId("player-bpm")).toHaveTextContent("80")
    })

    it("shows Start as Now after the routine has finished", () => {
      const props = routineProps({
        round: { enabled: true, count: 2, restDuration: 0 },
        increase: increase({ mode: "round", roundStep: 5 }),
      })
      const total = props.segments.reduce((sum, s) => sum + s.durationSec, 0)
      render(<Practice {...props} snapshot={snapshotAt(props.segments, total)} />)
      expect(screen.getByTestId("player-bpm")).toHaveTextContent("80")
    })

    it("keeps the BPM label in Steady, with the same tempo in the timer card", () => {
      render(<Practice {...makeProps()} />)
      expect(screen.queryByText("Start BPM")).not.toBeInTheDocument()
      expect(screen.getByTestId("player-bpm")).toHaveTextContent("80")
    })

  })

  it("progress shows Round label with count", () => {
    const props = makeProps({ practice: "routine" })
    render(<Practice {...props} />)
    expect(screen.getByText(/Round 1\//)).toBeInTheDocument()
  })

  describe("routine duration units", () => {
    const timeRoutine = (over: Partial<Session["routine"]> = {}) => ({
      ...createDefaultSession().routine,
      unit: "sec" as const, playDuration: 150, restDuration: 30,
      ...over,
    })

    it("offers Bars and Time, not sec", () => {
      render(<Practice {...makeProps({ practice: "routine" })} />)
      expect(screen.getByRole("button", { name: "Bars" })).toHaveAttribute("aria-pressed", "true")
      expect(screen.getByRole("button", { name: "Time" })).toHaveAttribute("aria-pressed", "false")
      expect(screen.queryByRole("button", { name: "sec" })).not.toBeInTheDocument()
    })

    it("shows bar counts with their unit in Bars mode", () => {
      render(<Practice {...makeProps({ practice: "routine" })} />)
      expect(screen.getByText("4 bars")).toBeInTheDocument()
      expect(screen.getByText("0 bars")).toBeInTheDocument()
      expect(screen.queryByRole("textbox", { name: "Play minutes" })).not.toBeInTheDocument()
    })

    it("switching to Time resets play to 1:00 and rest to 0:00", async () => {
      const props = makeProps({ practice: "routine" })
      const user = userEvent.setup()
      render(<Practice {...props} />)
      await user.click(screen.getByRole("button", { name: "Time" }))
      expect(props.onChange).toHaveBeenCalledWith(expect.objectContaining({
        routine: expect.objectContaining({ unit: "sec", playDuration: 60, restDuration: 0 }),
      }))
    })

    it("switching back to Bars resets play to 4 bars and rest to 0", async () => {
      const props = makeProps({ practice: "routine", routine: timeRoutine() })
      const user = userEvent.setup()
      render(<Practice {...props} />)
      await user.click(screen.getByRole("button", { name: "Bars" }))
      expect(props.onChange).toHaveBeenCalledWith(expect.objectContaining({
        routine: expect.objectContaining({ unit: "bars", playDuration: 4, restDuration: 0 }),
      }))
    })

    it("shows MIN and SEC inputs in Time mode", () => {
      render(<Practice {...makeProps({ practice: "routine", routine: timeRoutine() })} />)
      expect(screen.getByRole("textbox", { name: "Play minutes" })).toHaveValue("2")
      expect(screen.getByRole("textbox", { name: "Play seconds" })).toHaveValue("30")
      expect(screen.getByRole("textbox", { name: "Rest minutes" })).toHaveValue("0")
      expect(screen.getByRole("textbox", { name: "Rest seconds" })).toHaveValue("30")
    })

    it("pads seconds to two digits", () => {
      render(<Practice {...makeProps({ practice: "routine", routine: timeRoutine({ playDuration: 65 }) })} />)
      expect(screen.getByRole("textbox", { name: "Play seconds" })).toHaveValue("05")
    })

    it("commits a typed minutes value on blur", async () => {
      const props = makeProps({ practice: "routine", routine: timeRoutine() })
      const user = userEvent.setup()
      render(<Practice {...props} />)
      const min = screen.getByRole("textbox", { name: "Play minutes" })
      await user.click(min)
      await user.keyboard("4")
      expect(props.onChange).not.toHaveBeenCalled()
      await user.tab()
      expect(props.onChange).toHaveBeenLastCalledWith(expect.objectContaining({
        routine: expect.objectContaining({ playDuration: 270 }),
      }))
    })

    it("commits on Enter", async () => {
      const props = makeProps({ practice: "routine", routine: timeRoutine() })
      const user = userEvent.setup()
      render(<Practice {...props} />)
      await user.click(screen.getByRole("textbox", { name: "Rest seconds" }))
      await user.keyboard("45{Enter}")
      expect(props.onChange).toHaveBeenLastCalledWith(expect.objectContaining({
        routine: expect.objectContaining({ restDuration: 45 }),
      }))
    })

    it("carries seconds over 59 into minutes", async () => {
      const props = makeProps({ practice: "routine", routine: timeRoutine({ playDuration: 0 + 60 }) })
      const user = userEvent.setup()
      render(<Practice {...props} />)
      await user.click(screen.getByRole("textbox", { name: "Play seconds" }))
      await user.keyboard("90")
      await user.tab()
      expect(props.onChange).toHaveBeenLastCalledWith(expect.objectContaining({
        routine: expect.objectContaining({ playDuration: 150 }),
      }))
    })

    it("ignores non-digit characters", async () => {
      const props = makeProps({ practice: "routine", routine: timeRoutine() })
      const user = userEvent.setup()
      render(<Practice {...props} />)
      const sec = screen.getByRole("textbox", { name: "Rest seconds" })
      await user.click(sec)
      await user.keyboard("1a5")
      expect(sec).toHaveValue("15")
    })

    it("keeps play at least 1 sec and allows a 0 rest", async () => {
      const props = makeProps({ practice: "routine", routine: timeRoutine() })
      const user = userEvent.setup()
      render(<Practice {...props} />)
      await user.click(screen.getByRole("textbox", { name: "Play minutes" }))
      await user.keyboard("0")
      await user.click(screen.getByRole("textbox", { name: "Play seconds" }))
      await user.keyboard("0")
      await user.tab()
      expect(props.onChange).toHaveBeenLastCalledWith(expect.objectContaining({
        routine: expect.objectContaining({ playDuration: 1 }),
      }))
    })

    it("uses MIN and SEC inputs for Set rest", () => {
      const base = createDefaultSession().routine
      const props = makeProps({
        practice: "routine",
        routine: { ...base, round: { enabled: true, count: 4, restDuration: 0 }, set: { enabled: true, count: 3, restDuration: 90 } },
      })
      render(<Practice {...props} />)
      expect(screen.getByRole("textbox", { name: "Set rest minutes" })).toHaveValue("1")
      expect(screen.getByRole("textbox", { name: "Set rest seconds" })).toHaveValue("30")
      expect(screen.queryByRole("textbox", { name: "Block rest minutes" })).not.toBeInTheDocument()
    })
  })

  describe("routine countdown", () => {
    // Play 1:00, Rest 0:10, Play 1:00 → 2:10 total
    function routineProps(atSec: number, status: "stopped" | "playing" = "playing") {
      const props = makeProps({
        practice: "routine",
        countIn: false,
        routine: {
          ...createDefaultSession().routine,
          unit: "sec", playDuration: 60, restDuration: 10,
          round: { enabled: true, count: 2, restDuration: 0 },
        },
      })
      return { ...props, status, snapshot: snapshotAt(props.segments, atSec) }
    }

    it("shows the first stretch and the full routine length when stopped", () => {
      render(<Practice {...routineProps(0, "stopped")} />)
      expect(screen.getByTestId("player-phase")).toHaveTextContent("Stopped")
      expect(screen.getByTestId("player-number")).toHaveTextContent("1:00")
      expect(screen.getByTestId("player-sub")).toHaveTextContent("2:10 left")
    })

    it("counts down the current play stretch, rounding up", () => {
      render(<Practice {...routineProps(17.4)} />)
      expect(screen.getByTestId("player-number")).toHaveTextContent("0:43")
      expect(document.querySelector(".player-panel")).not.toHaveClass("is-rest")
      expect(screen.getByTestId("player-sub")).toHaveTextContent("1:53 left")
    })

    it("shows rest time left in the rest colour with a moving progress bar", () => {
      render(<Practice {...routineProps(65)} />)
      expect(screen.getByTestId("player-phase")).toHaveTextContent("Rest")
      expect(screen.getByTestId("player-number")).toHaveTextContent("0:05")
      expect(document.querySelector(".player-panel")).toHaveClass("is-rest")
      const fill = document.querySelector(".routine-progress-bar-fill") as HTMLElement
      expect(fill).toHaveClass("is-rest")
      expect(fill.style.width).toBe("50%")
    })

    it("labels the count-in bar Ready while it plays", () => {
      const props = makeProps({ practice: "routine", countIn: true })
      render(<Practice {...props} status="playing" />)
      expect(screen.getByTestId("player-phase")).toHaveTextContent(/^Ready$/)
    })

    it("puts Play and Stop inside the player card, once", () => {
      render(<Practice {...routineProps(0, "stopped")} />)
      const card = document.querySelector(".player-card") as HTMLElement
      expect(card).toContainElement(screen.getByRole("button", { name: "Play" }))
      expect(card).toContainElement(screen.getByRole("button", { name: "Stop" }))
      expect(screen.getAllByRole("button", { name: "Play" })).toHaveLength(1)
    })

    it("toggles and stops from the card", async () => {
      const props = routineProps(0, "stopped")
      const user = userEvent.setup()
      render(<Practice {...props} />)
      await user.click(screen.getByRole("button", { name: "Play" }))
      expect(props.onToggle).toHaveBeenCalledOnce()
      await user.click(screen.getByRole("button", { name: "Stop" }))
      expect(props.onReset).toHaveBeenCalledOnce()
    })

  })

  describe("count-in toggle", () => {
    it("is an on/off switch, off by default, under the practice switch in every practice", () => {
      for (const practice of ["steady", "climb", "routine"] as const) {
        const { unmount } = render(<Practice {...makeProps({ practice })} />)
        const toggle = screen.getByRole("switch", { name: "Count-in" })
        expect(toggle).toHaveAttribute("aria-checked", "false")
        expect(document.querySelector(".player-panel")).not.toContainElement(toggle)
        unmount()
      }
    })

    it("turns the count-in on", async () => {
      const props = makeProps({ practice: "routine" })
      render(<Practice {...props} />)
      await userEvent.setup().click(screen.getByRole("switch", { name: "Count-in" }))
      expect(props.onChange).toHaveBeenCalledWith(expect.objectContaining({ countIn: true }))
    })



    it("puts the countdown, progress and Play inside a play panel above the settings", () => {
      render(<Practice {...makeProps({ practice: "routine" })} />)
      const panel = document.querySelector(".player-panel")!
      expect(panel).toContainElement(screen.getByTestId("player-number"))
      expect(panel).toContainElement(screen.getByRole("button", { name: "Play" }))
      expect(panel).not.toContainElement(screen.getByRole("switch", { name: "Round repeat" }))
    })
  })

  describe("per-beat subdivision display", () => {
    const mixed = () => [
      { subdivision: "triplet" as const, slots: ["click-1" as const, "click-1" as const, "click-1" as const] },
      { subdivision: "triplet" as const, slots: ["click-1" as const, "click-1" as const, "click-1" as const] },
      { subdivision: "sixteenth" as const, slots: ["click-1" as const, "click-1" as const, "click-1" as const, "click-1" as const] },
      { subdivision: "sixteenth" as const, slots: ["click-1" as const, "click-1" as const, "click-1" as const, "click-1" as const] },
    ]
    const subsOf = (beat: number) => screen.getByTestId(`beat-${beat}`).parentElement!.querySelectorAll(".beat-sub")

    it("shows each beat's own number of sub-dots", () => {
      render(<Practice {...makeProps({ beats: mixed() })} />)
      expect(subsOf(1)).toHaveLength(3)
      expect(subsOf(3)).toHaveLength(4)
    })

    it("lights the sub-dot of the current beat's own subdivision", () => {
      const props = makeProps({ bpm: 60, beats: mixed() })
      render(<Practice {...props} status="playing" snapshot={snapshotAt(props.segments, 2.5)} />)
      expect(subsOf(3)[2]).toHaveClass("lit")
      expect(subsOf(3)[1]).not.toHaveClass("lit")
    })

    it("labels the Subdiv button Mixed when beats differ", () => {
      render(<Practice {...makeProps({ beats: mixed() })} />)
      expect(screen.getByRole("button", { name: "Subdivision: mixed" })).toHaveTextContent("Mixed")
    })

    it("names the shared subdivision when every beat matches", () => {
      render(<Practice {...makeProps()} />)
      expect(screen.getByRole("button", { name: "Subdivision: quarter" })).toBeInTheDocument()
    })
  })

  it("keeps the subdivision sheet open while building a pattern", async () => {
    const props = makeProps()
    const user = userEvent.setup()
    render(<Practice {...props} />)
    await user.click(screen.getByRole("button", { name: /Subdivision/ }))
    await user.click(screen.getByRole("button", { name: "Triplet" }))
    expect(props.onChange).toHaveBeenCalledWith(expect.objectContaining({
      beats: expect.arrayContaining([expect.objectContaining({ subdivision: "triplet" })]),
    }))
    expect(screen.getByRole("dialog", { name: "Subdivision" })).toHaveClass("open")
  })

  it("opens the Click sheet and applies a new sound from it", async () => {
    const props = makeProps()
    const user = userEvent.setup()
    render(<Practice {...props} />)
    await user.click(screen.getByRole("button", { name: "Click: Sound 1, accent beat 1" }))
    expect(screen.getByRole("dialog", { name: "Click" })).toHaveClass("open")
    await user.click(screen.getByRole("button", { name: "Sound 2" }))
    expect(props.onChange).toHaveBeenCalledWith(expect.objectContaining({ click: "click-2" }))
  })

  it("puts − BPM + on one row and Time sig, Subdiv and Sound as a chip row below", () => {
    render(<Practice {...makeProps()} />)
    const card = document.querySelector(".bpm-block") as HTMLElement
    const order = Array.from(card.querySelectorAll("button, input")).map((el) => el.getAttribute("aria-label"))
    expect(order).toEqual(["Decrease BPM", "BPM", "Increase BPM"])
    const chips = Array.from(document.querySelectorAll(".pick-row .pick-btn")).map((el) => el.querySelector(":scope > span:last-child")?.textContent)
    expect(chips).toEqual(["Time Sig", "Subdiv", "Sound"])
  })

  it("shows the accented beats as dots on the Sound chip", () => {
    render(<Practice {...makeProps({ accents: [1, 3] })} />)
    const dots = Array.from(document.querySelectorAll(".pick-accents i")).map((el) => el.classList.contains("on"))
    expect(dots).toEqual([true, false, true, false])
  })

  it("names the accented beats on the Click button", () => {
    const { unmount } = render(<Practice {...makeProps({ accents: [] })} />)
    expect(screen.getByRole("button", { name: "Click: Sound 1, no accent" })).toBeInTheDocument()
    unmount()
    render(<Practice {...makeProps({ accents: [1, 3] })} />)
    expect(screen.getByRole("button", { name: "Click: Sound 1, accent beats 1, 3" })).toBeInTheDocument()
  })

  describe("routine per-round increase", () => {
    function roundProps(routine: Partial<Session["routine"]> = {}, increase: Partial<Session["routine"]["increase"]> = {}) {
      const base = createDefaultSession().routine
      return makeProps({
        practice: "routine",
        bpm: 110,
        routine: { ...base, round: { enabled: true, count: 4, restDuration: 0 }, ...routine, increase: { ...base.increase, ...increase } },
      })
    }
    const last = (props: ReturnType<typeof makeProps>): Session => props.onChange.mock.calls.at(-1)![0]

    it("hides Increase when Round repeat is off", () => {
      render(<Practice {...roundProps({ round: { enabled: false, count: 4, restDuration: 0 } })} />)
      expect(screen.queryByTestId("round-step")).not.toBeInTheDocument()
    })

    it("shows Increase as a +0 stepper with no On/Off button", () => {
      render(<Practice {...roundProps({}, { mode: "off", roundStep: 5 })} />)
      expect(screen.queryByRole("button", { name: "Toggle round increase" })).not.toBeInTheDocument()
      expect(screen.getByTestId("round-step")).toHaveTextContent("+0")
    })

    it("raising it from 0 starts the per-round increase", async () => {
      const props = roundProps()
      render(<Practice {...props} />)
      await userEvent.setup().click(screen.getByRole("button", { name: "Increase round increase" }))
      expect(last(props).routine.increase).toEqual({ mode: "round", roundStep: 1 })
    })

    it("lowering it to 0 means no increase, and it doesn't go below 0", async () => {
      const user = userEvent.setup()
      const props = roundProps({}, { mode: "round", roundStep: 1 })
      const { unmount } = render(<Practice {...props} />)
      await user.click(screen.getByRole("button", { name: "Decrease round increase" }))
      expect(last(props).routine.increase.mode).toBe("off")
      unmount()
      const zero = roundProps()
      render(<Practice {...zero} />)
      await user.click(screen.getByRole("button", { name: "Decrease round increase" }))
      expect(zero.onChange).not.toHaveBeenCalled()
    })

    it("makes Round and Set repeat on/off switches, off by default", async () => {
      const props = makeProps({ practice: "routine" })
      render(<Practice {...props} />)
      const round = screen.getByRole("switch", { name: "Round repeat" })
      expect(round).toHaveAttribute("aria-checked", "false")
      expect(round).not.toHaveTextContent(/On|Off/)
      await userEvent.setup().click(round)
      expect(last(props).routine.round.enabled).toBe(true)
    })

    it("shows the Set repeat switch on when Set repeat is on", () => {
      render(<Practice {...roundProps({ set: { enabled: true, count: 3, restDuration: 30 } })} />)
      expect(screen.getByRole("switch", { name: "Set repeat" })).toHaveAttribute("aria-checked", "true")
    })

    const labelsIn = (selector: string) => Array.from(document.querySelectorAll(`${selector} .routine-row-label`)).map((el) => el.textContent)

    it("orders the Round box Play, Rest, Repeat, with Times and Increase in Repeat's panel", () => {
      render(<Practice {...roundProps()} />)
      expect(labelsIn("[data-testid='round-box']")).toEqual(["Duration", "Play", "Rest", "Repeat", "Times", "Increase"])
      expect(labelsIn("[data-testid='round-repeat-panel']")).toEqual(["Times", "Increase"])
    })

    it("puts Set's Times and Rest between in Set repeat's panel", () => {
      render(<Practice {...roundProps({ set: { enabled: true, count: 3, restDuration: 30 } })} />)
      expect(labelsIn("[data-testid='set-box']")).toEqual(["Repeat", "Times", "Rest between"])
      expect(labelsIn("[data-testid='set-repeat-panel']")).toEqual(["Times", "Rest between"])
    })

    it("closes each panel while its Repeat is off", () => {
      render(<Practice {...roundProps({ round: { enabled: false, count: 4, restDuration: 0 } })} />)
      expect(screen.queryByTestId("round-repeat-panel")).not.toBeInTheDocument()
      expect(screen.queryByTestId("set-box")).not.toBeInTheDocument()
    })

    it("hides the Times row while Repeat is off", () => {
      render(<Practice {...roundProps({ round: { enabled: false, count: 4, restDuration: 0 } })} />)
      expect(screen.queryByText("Times")).not.toBeInTheDocument()
    })

    it("turning Round repeat off also turns the per-round increase off", async () => {
      const props = roundProps({}, { mode: "round" })
      render(<Practice {...props} />)
      await userEvent.setup().click(screen.getByRole("switch", { name: "Round repeat" }))
      expect(last(props).routine.round.enabled).toBe(false)
      expect(last(props).routine.increase.mode).toBe("off")
    })

    it("shows the current round's BPM as Now", () => {
      // Default 4 bars at 110 is about 8.7s, so 10s is in the second round
      const props = roundProps({}, { mode: "round", roundStep: 5 })
      render(<Practice {...props} snapshot={snapshotAt(props.segments, 10)} status="playing" />)
      expect(screen.getByTestId("player-bpm")).toHaveTextContent("115")
    })
  })

  describe("player card", () => {
    function climbProps(over: Partial<Session> = {}, elapsed = 0, status: "playing" | "stopped" = "stopped") {
      const base = createDefaultSession(() => "s1")
      const props = makeProps({
        practice: "climb", bpm: 110, bpmIncrease: 5,
        time: { ...base.time, targetBpm: 130, everyUnit: "sec", everySec: 120 },
        ...over,
      })
      return { ...props, snapshot: snapshotAt(props.segments, elapsed), status }
    }

    it("replaces the Simple | Routine switch with Steady, Climb and Routine, Steady pressed", () => {
      render(<Practice {...makeProps()} />)
      expect(screen.queryByRole("button", { name: "Simple" })).not.toBeInTheDocument()
      const group = screen.getByRole("group", { name: "How to practice" })
      expect(within(group).getByRole("button", { name: "Steady" })).toHaveAttribute("aria-pressed", "true")
      expect(within(group).getByRole("button", { name: "Climb" })).toHaveAttribute("aria-pressed", "false")
      expect(within(group).getByRole("button", { name: "Routine" })).toHaveAttribute("aria-pressed", "false")
    })

    it("choosing Climb fills its defaults", async () => {
      const props = makeProps()
      render(<Practice {...props} />)
      await userEvent.setup().click(screen.getByRole("button", { name: "Climb" }))
      expect(props.onChange).toHaveBeenCalledWith(expect.objectContaining({ practice: "climb", bpmIncrease: 5 }))
    })

    it("locks the practice switch while playing so a misclick can't end the session", () => {
      render(<Practice {...makeProps()} status="playing" />)
      for (const name of ["Steady", "Climb", "Routine"]) {
        expect(screen.getByRole("button", { name })).toBeDisabled()
      }
    })

    it("tells Routine apart when stopped or paused", () => {
      const props = makeProps({ practice: "routine" })
      const { unmount } = render(<Practice {...props} />)
      expect(screen.getByTestId("player-phase")).toHaveTextContent("Stopped")
      unmount()
      render(<Practice {...props} status="paused" />)
      expect(screen.getByTestId("player-phase")).toHaveTextContent("Paused")
    })

    it("announces phase, round and tempo changes to screen readers", () => {
      const base = createDefaultSession(() => "s1")
      const props = makeProps({
        practice: "routine", bpm: 80, countIn: false,
        routine: { ...base.routine, unit: "sec", playDuration: 10, restDuration: 5, round: { enabled: true, count: 2, restDuration: 0 }, increase: { mode: "round", roundStep: 5 } },
      })
      render(<Practice {...props} snapshot={snapshotAt(props.segments, 16)} status="playing" />)
      const live = screen.getByTestId("player-announce")
      expect(live).toHaveAttribute("aria-live", "polite")
      expect(live).toHaveTextContent("Play, 85 BPM, Round 2 of 2")
    })

    it("Steady shows elapsed time, no progress bar and no settings", () => {
      const props = makeProps()
      render(<Practice {...props} snapshot={snapshotAt(props.segments, 65)} status="playing" />)
      expect(screen.getByTestId("player-phase")).toHaveTextContent("Playing")
      expect(screen.getByTestId("player-number")).toHaveTextContent("1:05")
      expect(document.querySelector(".routine-progress-bar-wrap")).not.toBeInTheDocument()
      expect(screen.queryByRole("switch", { name: "Round repeat" })).not.toBeInTheDocument()
    })

    it("Climb when stopped shows 0:00 and the first step to come", () => {
      render(<Practice {...climbProps()} />)
      expect(screen.getByTestId("player-number")).toHaveTextContent("0:00")
      expect(screen.getByTestId("player-sub")).toHaveTextContent("Next +5 in 2:00")
      expect(screen.getByTestId("player-bpm")).toHaveTextContent("110")
      expect(screen.getByTestId("player-target")).toHaveTextContent("130")
    })

    it("Climb while climbing shows the next step and current → target", () => {
      render(<Practice {...climbProps({}, 150, "playing")} />)
      expect(screen.getByTestId("player-sub")).toHaveTextContent("Next +5 in 1:30")
      expect(screen.getByTestId("player-bpm")).toHaveTextContent("115")
      expect(screen.getByTestId("player-target")).toHaveTextContent("130")
    })

    it("Climb at the target says so and shows the target", () => {
      render(<Practice {...climbProps({}, 600, "playing")} />)
      expect(screen.getByTestId("player-sub")).toHaveTextContent("At target")
      expect(screen.getByTestId("player-bpm")).toHaveTextContent("130")
      expect(screen.queryByTestId("player-target")).not.toBeInTheDocument()
      expect(document.querySelector(".routine-progress-bar-wrap")).not.toBeInTheDocument()
    })

    it("Climb that can't climb (Step 0) shows no target line, like Steady", () => {
      render(<Practice {...climbProps({ bpmIncrease: 0 }, 30, "playing")} />)
      expect(screen.queryByTestId("player-sub")).not.toBeInTheDocument()
      expect(screen.queryByTestId("player-target")).not.toBeInTheDocument()
    })

    it("Climb in bars counts the next step in bars, rounding up", () => {
      const base = createDefaultSession(() => "s1")
      // 4 bars at 120 in 4/4 is 8s; 2s in leaves 6s, which is 3 bars
      render(<Practice {...climbProps({ bpm: 120, time: { ...base.time, targetBpm: 130, everyUnit: "bars", everyBars: 4 } }, 2, "playing")} />)
      expect(screen.getByTestId("player-sub")).toHaveTextContent("Next +5 in 3 bars")
    })
  })

  describe("climb settings", () => {
    function climb(time: Partial<Session["time"]> = {}) {
      const base = createDefaultSession(() => "s1")
      return makeProps({ practice: "climb", bpm: 110, bpmIncrease: 5, time: { ...base.time, targetBpm: 130, everyUnit: "sec", everySec: 120, ...time } })
    }
    const last = (props: ReturnType<typeof makeProps>): Session => props.onChange.mock.calls.at(-1)![0]

    it("shows Target BPM, Step and Every in minutes", () => {
      render(<Practice {...climb()} />)
      expect(screen.getByRole("textbox", { name: "Target BPM" })).toHaveValue("130")
      expect(screen.getByRole("textbox", { name: "Step" })).toHaveValue("5")
      const unit = screen.getByRole("group", { name: "Every unit" })
      expect(within(unit).getByRole("button", { name: "Min" })).toHaveAttribute("aria-pressed", "true")
      expect(screen.getByRole("textbox", { name: "Every minutes" })).toHaveValue("2")
      expect(screen.getByRole("textbox", { name: "Every seconds" })).toHaveValue("00")
    })

    it("shows Every as a bar count in Bars", () => {
      render(<Practice {...climb({ everyUnit: "bars", everyBars: 4 })} />)
      expect(screen.getByTestId("climb-every-bars")).toHaveTextContent("4 bars")
    })

    it("commits a typed target on blur and ignores a cleared step", async () => {
      const user = userEvent.setup()
      const props = climb()
      render(<Practice {...props} />)
      const target = screen.getByRole("textbox", { name: "Target BPM" })
      await user.clear(target)
      await user.type(target, "140")
      await user.tab()
      expect(last(props).time.targetBpm).toBe(140)
      props.onChange.mockClear()
      await user.clear(screen.getByRole("textbox", { name: "Step" }))
      await user.tab()
      expect(props.onChange).not.toHaveBeenCalled()
    })

    it("switching to Min sets 2:00 and to Bars sets 4 bars", async () => {
      const user = userEvent.setup()
      const bars = climb({ everyUnit: "bars", everyBars: 8 })
      const { unmount } = render(<Practice {...bars} />)
      await user.click(screen.getByRole("button", { name: "Min" }))
      expect(last(bars).time).toMatchObject({ everyUnit: "sec", everySec: 120 })
      unmount()
      const min = climb({ everySec: 30 })
      render(<Practice {...min} />)
      await user.click(screen.getByRole("button", { name: "Bars" }))
      expect(last(min).time).toMatchObject({ everyUnit: "bars", everyBars: 4 })
    })

    it("shows no Climb settings in Steady or Routine", () => {
      render(<Practice {...makeProps()} />)
      expect(screen.queryByRole("textbox", { name: "Target BPM" })).not.toBeInTheDocument()
    })

    it("has no More button, no BPM popup and no Target/Step in the BPM card", () => {
      render(<Practice {...climb()} />)
      expect(screen.queryByRole("button", { name: "More BPM settings" })).not.toBeInTheDocument()
      expect(screen.queryByRole("dialog", { name: "BPM settings", hidden: true })).not.toBeInTheDocument()
      expect(document.querySelector(".bpm-block")).not.toContainElement(screen.getByRole("textbox", { name: "Target BPM" }))
    })

    it("labels the BPM card BPM in Steady and Start BPM in Climb, with the playing BPM in the timer card", () => {
      const { unmount } = render(<Practice {...makeProps()} />)
      expect(screen.getByText("BPM", { selector: ".bpm-label" })).toBeInTheDocument()
      unmount()
      const props = climb()
      render(<Practice {...props} snapshot={snapshotAt(props.segments, 150)} status="playing" />)
      expect(screen.getByText("Start BPM")).toBeInTheDocument()
      expect(screen.getByTestId("bpm-current")).toHaveValue("110")
      expect(screen.getByTestId("player-bpm")).toHaveTextContent("115")
    })
  })

  describe("popups and keyboard", () => {
    it("keeps the Time signature popup open after a change", async () => {
      const user = userEvent.setup()
      render(<Practice {...makeProps()} />)
      await user.click(screen.getByRole("button", { name: "Time signature: 4/4" }))
      await user.selectOptions(screen.getByRole("combobox", { name: "Beats" }), "7")
      expect(screen.getByRole("dialog", { name: "Time Signature" })).toHaveClass("open")
    })

    it("moves focus into a popup and back to its chip when Done closes it", async () => {
      const user = userEvent.setup()
      render(<Practice {...makeProps()} />)
      const chip = screen.getByRole("button", { name: /^Click: Sound 1/ })
      await user.click(chip)
      const dialog = screen.getByRole("dialog", { name: "Click" })
      expect(dialog).toContainElement(document.activeElement as HTMLElement)
      await user.click(within(dialog).getByRole("button", { name: "Done" }))
      expect(dialog).not.toHaveClass("open")
      expect(chip).toHaveFocus()
    })

    it("gives every popup a Done button", () => {
      render(<Practice {...makeProps()} />)
      for (const name of ["Time Signature", "Subdivision", "Click"]) {
        const dialog = document.querySelector(`[role="dialog"][aria-label="${name}"]`) as HTMLElement
        expect(within(dialog).getByText("Done", { selector: "button" })).toBeInTheDocument()
      }
    })

    it("repeats + while it's held down", () => {
      vi.useFakeTimers()
      try {
        const props = makeProps({ bpm: 80 })
        render(<Practice {...props} />)
        const plus = screen.getByRole("button", { name: "Increase BPM" })
        fireEvent.pointerDown(plus)
        act(() => { vi.advanceTimersByTime(1000) })
        fireEvent.pointerUp(plus)
        fireEvent.click(plus)
        const bpms = props.onChange.mock.calls.map((call) => (call[0] as Session).bpm)
        expect(bpms.length).toBeGreaterThan(3)
        expect(bpms.at(-1)).toBe(80 + bpms.length)
      } finally {
        vi.useRealTimers()
      }
    })

    it("makes the beat dots one tab stop, moved with the arrow keys", async () => {
      const user = userEvent.setup()
      render(<Practice {...makeProps()} />)
      const dots = within(screen.getByRole("region", { name: "Beat display" })).getAllByRole("button")
      expect(dots.filter((dot) => dot.tabIndex === 0)).toHaveLength(1)
      dots[0].focus()
      await user.keyboard("{ArrowRight}")
      expect(dots[1]).toHaveFocus()
    })
  })
})
