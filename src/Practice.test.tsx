import { render, screen, within } from "@testing-library/react"
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
    expect(screen.getByRole("textbox", { name: "Set rest minutes" })).toBeInTheDocument()
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
    await user.click(screen.getByRole("button", { name: "Toggle round repeat" }))
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
    expect(screen.getByText("Round 1/2")).toBeInTheDocument()
    expect(screen.getByText("Set 1/2")).toBeInTheDocument()
  })

  describe("routine Start and Now BPM", () => {
    const increase = (over: Partial<Session["routine"]["increase"]>) => ({ ...createDefaultSession().routine.increase, ...over })
    function routineProps(routine: Partial<Session["routine"]>, elapsed = 0, status: "playing" | "stopped" = "stopped") {
      const props = makeProps({ practice: "routine", bpm: 80, routine: { ...createDefaultSession().routine, ...routine } })
      return { ...props, snapshot: snapshotAt(props.segments, elapsed), status }
    }

    it("shows Start BPM and no Now when the increase is Off", () => {
      render(<Practice {...routineProps({})} />)
      expect(screen.getByTestId("bpm-current")).toHaveValue("80")
      expect(screen.getByText("Start BPM")).toBeInTheDocument()
      expect(screen.queryByTestId("bpm-now")).not.toBeInTheDocument()
    })

    it("keeps Start in the input and shows the playing BPM as Now", () => {
      // 4 bars at 80 is 12s, so 13s is in the second round
      const props = routineProps({
        round: { enabled: true, count: 2, restDuration: 0 },
        increase: increase({ mode: "round", roundStep: 5 }),
      }, 13, "playing")
      render(<Practice {...props} />)
      expect(screen.getByTestId("bpm-current")).toHaveValue("80")
      expect(screen.getByTestId("bpm-now")).toHaveTextContent("85")
      expect(screen.getByText("Now")).toBeInTheDocument()
    })

    it("shows the next play's BPM as Now during a rest", () => {
      // Round 1 plays 10s at 80 then rests 5s; round 2 plays at 85
      const props = routineProps({
        unit: "sec", playDuration: 10, restDuration: 5,
        round: { enabled: true, count: 2, restDuration: 0 },
        increase: increase({ mode: "round", roundStep: 5 }),
      }, 12, "playing")
      render(<Practice {...props} />)
      expect(screen.getByTestId("bpm-now")).toHaveTextContent("85")
    })

    it("shows Start as Now when stopped", () => {
      const props = routineProps({
        round: { enabled: true, count: 2, restDuration: 0 },
        increase: increase({ mode: "round", roundStep: 5 }),
      })
      render(<Practice {...props} />)
      expect(screen.getByTestId("bpm-now")).toHaveTextContent("80")
    })

    it("shows Start as Now after the routine has finished", () => {
      const props = routineProps({
        round: { enabled: true, count: 2, restDuration: 0 },
        increase: increase({ mode: "round", roundStep: 5 }),
      })
      const total = props.segments.reduce((sum, s) => sum + s.durationSec, 0)
      render(<Practice {...props} snapshot={snapshotAt(props.segments, total)} />)
      expect(screen.getByTestId("bpm-now")).toHaveTextContent("80")
    })

    it("keeps the BPM label and no Now in Simple mode", () => {
      render(<Practice {...makeProps()} />)
      expect(screen.queryByText("Start BPM")).not.toBeInTheDocument()
      expect(screen.queryByTestId("bpm-now")).not.toBeInTheDocument()
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
      expect(screen.getByTestId("player-phase")).toHaveTextContent("Play")
      expect(screen.getByTestId("player-number")).toHaveTextContent("1:00")
      expect(screen.getByTestId("player-sub")).toHaveTextContent("2:10 left")
    })

    it("counts down the current play stretch, rounding up", () => {
      render(<Practice {...routineProps(17.4)} />)
      expect(screen.getByTestId("player-number")).toHaveTextContent("0:43")
      expect(screen.getByTestId("player-number")).not.toHaveClass("is-rest")
      expect(screen.getByTestId("player-sub")).toHaveTextContent("1:53 left")
    })

    it("shows rest time left in red with a moving progress bar", () => {
      render(<Practice {...routineProps(65)} />)
      expect(screen.getByTestId("player-phase")).toHaveTextContent("Rest")
      expect(screen.getByTestId("player-number")).toHaveTextContent("0:05")
      expect(screen.getByTestId("player-number")).toHaveClass("is-rest")
      const fill = document.querySelector(".routine-progress-bar-fill") as HTMLElement
      expect(fill).toHaveClass("is-rest")
      expect(fill.style.width).toBe("50%")
    })

    it("labels the count-in bar Ready, so it doesn't repeat the Count-in button beside it", () => {
      const props = makeProps({ practice: "routine", countIn: true })
      render(<Practice {...props} />)
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
    it("toggles Count-in from the phase row in Steady", async () => {
      const props = makeProps({ countIn: false })
      const user = userEvent.setup()
      render(<Practice {...props} />)
      const toggle = screen.getByRole("button", { name: "Count-in" })
      expect(toggle).toHaveAttribute("aria-pressed", "false")
      expect(screen.getByTestId("player-phase").parentElement).toContainElement(toggle)
      await user.click(toggle)
      expect(props.onChange).toHaveBeenCalledWith(expect.objectContaining({ countIn: true }))
    })

    it("shows Count-in on the phase row of the routine play panel, not under Play", () => {
      render(<Practice {...makeProps({ practice: "routine", countIn: true })} />)
      const toggle = screen.getByRole("button", { name: "Count-in" })
      expect(toggle).toHaveAttribute("aria-pressed", "true")
      expect(screen.getByTestId("player-phase").parentElement).toContainElement(toggle)
      expect(toggle.closest(".play-controls")).toBeNull()
    })

    it("puts the countdown, progress and Play inside a play panel above the settings", () => {
      render(<Practice {...makeProps({ practice: "routine" })} />)
      const panel = document.querySelector(".player-panel")!
      expect(panel).toContainElement(screen.getByTestId("player-number"))
      expect(panel).toContainElement(screen.getByRole("button", { name: "Play" }))
      expect(panel).not.toContainElement(screen.getByRole("button", { name: "Toggle round repeat" }))
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
    await user.click(screen.getByRole("button", { name: "Click: Sound 1, accent on" }))
    expect(screen.getByRole("dialog", { name: "Click" })).toHaveClass("open")
    await user.click(screen.getByRole("button", { name: "Sound 2" }))
    expect(props.onChange).toHaveBeenCalledWith(expect.objectContaining({ click: "click-2" }))
  })

  it("shows accent off on the Click button", () => {
    render(<Practice {...makeProps({ accent: false })} />)
    expect(screen.getByRole("button", { name: "Click: Sound 1, accent off" })).toBeInTheDocument()
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
      expect(screen.queryByRole("button", { name: "Toggle round increase" })).not.toBeInTheDocument()
    })

    it("shows Increase off with no step until turned on", () => {
      render(<Practice {...roundProps()} />)
      expect(screen.getByRole("button", { name: "Toggle round increase" })).toHaveAttribute("aria-pressed", "false")
      expect(screen.queryByTestId("round-step")).not.toBeInTheDocument()
    })

    it("turning it on switches to the per-round increase", async () => {
      const props = roundProps()
      render(<Practice {...props} />)
      await userEvent.setup().click(screen.getByRole("button", { name: "Toggle round increase" }))
      expect(last(props).routine.increase.mode).toBe("round")
    })

    it("turning it off means no increase", async () => {
      const props = roundProps({}, { mode: "round" })
      render(<Practice {...props} />)
      await userEvent.setup().click(screen.getByRole("button", { name: "Toggle round increase" }))
      expect(last(props).routine.increase.mode).toBe("off")
    })

    it("steps the round increase by 1 and not below 1", async () => {
      const user = userEvent.setup()
      const props = roundProps({}, { mode: "round", roundStep: 1 })
      render(<Practice {...props} />)
      expect(screen.getByTestId("round-step")).toHaveTextContent("+1")
      await user.click(screen.getByRole("button", { name: "Decrease round increase" }))
      expect(last(props).routine.increase.roundStep).toBe(1)
      await user.click(screen.getByRole("button", { name: "Increase round increase" }))
      expect(last(props).routine.increase.roundStep).toBe(2)
    })

    it("turning Round repeat off also turns the per-round increase off", async () => {
      const props = roundProps({}, { mode: "round" })
      render(<Practice {...props} />)
      await userEvent.setup().click(screen.getByRole("button", { name: "Toggle round repeat" }))
      expect(last(props).routine.round.enabled).toBe(false)
      expect(last(props).routine.increase.mode).toBe("off")
    })

    it("shows the current round's BPM as Now", () => {
      // Default 4 bars at 110 is about 8.7s, so 10s is in the second round
      const props = roundProps({}, { mode: "round", roundStep: 5 })
      render(<Practice {...props} snapshot={snapshotAt(props.segments, 10)} status="playing" />)
      expect(screen.getByTestId("bpm-now")).toHaveTextContent("115")
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

    it("choosing Climb fills its defaults and stops playback", async () => {
      const props = { ...makeProps(), status: "playing" as const }
      render(<Practice {...props} />)
      await userEvent.setup().click(screen.getByRole("button", { name: "Climb" }))
      expect(props.onChange).toHaveBeenCalledWith(expect.objectContaining({ practice: "climb", bpmIncrease: 5 }))
      expect(props.onReset).toHaveBeenCalledOnce()
    })

    it("Steady shows elapsed time, no progress bar and no settings", () => {
      const props = makeProps()
      render(<Practice {...props} snapshot={snapshotAt(props.segments, 65)} status="playing" />)
      expect(screen.getByTestId("player-phase")).toHaveTextContent("Playing")
      expect(screen.getByTestId("player-number")).toHaveTextContent("1:05")
      expect(document.querySelector(".routine-progress-bar-wrap")).not.toBeInTheDocument()
      expect(screen.queryByRole("button", { name: "Toggle round repeat" })).not.toBeInTheDocument()
    })

    it("Climb when stopped shows 0:00 and the first step to come", () => {
      render(<Practice {...climbProps()} />)
      expect(screen.getByTestId("player-number")).toHaveTextContent("0:00")
      expect(screen.getByTestId("player-sub")).toHaveTextContent("Next +5 in 2:00")
      expect(screen.getByTestId("player-info")).toHaveTextContent("110 → 130")
    })

    it("Climb while climbing shows the next step and current → target", () => {
      render(<Practice {...climbProps({}, 150, "playing")} />)
      expect(screen.getByTestId("player-sub")).toHaveTextContent("Next +5 in 1:30")
      expect(screen.getByTestId("player-info")).toHaveTextContent("115 → 130")
    })

    it("Climb at the target says so and shows the target", () => {
      render(<Practice {...climbProps({}, 600, "playing")} />)
      expect(screen.getByTestId("player-sub")).toHaveTextContent("At target")
      expect(screen.getByTestId("player-info")).toHaveTextContent(/^130$/)
      expect(document.querySelector(".routine-progress-bar-wrap")).not.toBeInTheDocument()
    })

    it("Climb that can't climb (Step 0) shows no target line, like Steady", () => {
      render(<Practice {...climbProps({ bpmIncrease: 0 }, 30, "playing")} />)
      expect(screen.queryByTestId("player-sub")).not.toBeInTheDocument()
      expect(screen.queryByTestId("player-info")).not.toBeInTheDocument()
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

    it("labels the BPM card BPM in Steady and Start BPM in Climb, with Now in Climb", () => {
      const { unmount } = render(<Practice {...makeProps()} />)
      expect(screen.getByText("BPM", { selector: ".bpm-label" })).toBeInTheDocument()
      expect(screen.queryByTestId("bpm-now")).not.toBeInTheDocument()
      unmount()
      const props = climb()
      render(<Practice {...props} snapshot={snapshotAt(props.segments, 150)} status="playing" />)
      expect(screen.getByText("Start BPM")).toBeInTheDocument()
      expect(screen.getByTestId("bpm-current")).toHaveValue("110")
      expect(screen.getByTestId("bpm-now")).toHaveTextContent("115")
    })
  })
})
