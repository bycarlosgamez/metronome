import { render, screen } from "@testing-library/react"
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

  it("shows Target and Step inputs when target is on in simple mode", () => {
    render(<Practice {...makeProps({ bpmIncrease: 5, time: { seconds: 120, targetBpm: 120, increaseEvery: "bars", everySec: 30, everyBars: 4 } })} />)
    expect(screen.getByRole("textbox", { name: "Target BPM" })).toBeInTheDocument()
    expect(screen.getByRole("textbox", { name: "BPM step" })).toBeInTheDocument()
  })

  it("hides Target and Step when target is off", () => {
    render(<Practice {...makeProps()} />)
    expect(screen.queryByRole("textbox", { name: "Target BPM" })).not.toBeInTheDocument()
    expect(screen.queryByRole("textbox", { name: "BPM step" })).not.toBeInTheDocument()
  })

  it("hides Target and Step in routine mode even when increaseEvery is bars", () => {
    render(<Practice {...makeProps({ routineEnabled: true, time: { seconds: 120, targetBpm: 120, increaseEvery: "bars", everySec: 30, everyBars: 4 } })} />)
    expect(screen.queryByRole("textbox", { name: "Target BPM" })).not.toBeInTheDocument()
    expect(screen.queryByRole("textbox", { name: "BPM step" })).not.toBeInTheDocument()
  })

  it("commits target BPM on blur", async () => {
    const props = makeProps({ bpmIncrease: 5, time: { seconds: 120, targetBpm: 120, increaseEvery: "bars", everySec: 30, everyBars: 4 } })
    const user = userEvent.setup()
    render(<Practice {...props} />)
    const input = screen.getByRole("textbox", { name: "Target BPM" })
    await user.clear(input)
    await user.type(input, "140")
    await user.tab()
    expect(props.onChange).toHaveBeenCalledWith(expect.objectContaining({
      time: expect.objectContaining({ targetBpm: 140 })
    }))
  })

  it("commits step on blur", async () => {
    const props = makeProps({ bpmIncrease: 5, time: { seconds: 120, targetBpm: 120, increaseEvery: "bars", everySec: 30, everyBars: 4 } })
    const user = userEvent.setup()
    render(<Practice {...props} />)
    const input = screen.getByRole("textbox", { name: "BPM step" })
    await user.clear(input)
    await user.type(input, "10")
    await user.tab()
    expect(props.onChange).toHaveBeenCalledWith(expect.objectContaining({ bpmIncrease: 10 }))
  })

  it("does not commit target when cleared", async () => {
    const props = makeProps({ bpmIncrease: 5, time: { seconds: 120, targetBpm: 120, increaseEvery: "bars", everySec: 30, everyBars: 4 } })
    const user = userEvent.setup()
    render(<Practice {...props} />)
    const input = screen.getByRole("textbox", { name: "Target BPM" })
    await user.clear(input)
    await user.tab()
    expect(props.onChange).not.toHaveBeenCalled()
  })

  it("does not commit step when cleared", async () => {
    const props = makeProps({ bpmIncrease: 5, time: { seconds: 120, targetBpm: 120, increaseEvery: "bars", everySec: 30, everyBars: 4 } })
    const user = userEvent.setup()
    render(<Practice {...props} />)
    const input = screen.getByRole("textbox", { name: "BPM step" })
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

  it("opens BPM sheet when More BPM settings is clicked", async () => {
    const props = makeProps()
    const user = userEvent.setup()
    render(<Practice {...props} />)
    await user.click(screen.getByRole("button", { name: "More BPM settings" }))
    const dialogs = document.querySelectorAll(".sheet-overlay")
    const bpmDialog = Array.from(dialogs).find((el) => el.getAttribute("aria-label") === "BPM settings")
    expect(bpmDialog).toHaveClass("open")
  })

  it("shows elapsed time above play button when playing in simple mode", () => {
    const props = { ...makeProps(), status: "playing" as const }
    render(<Practice {...props} />)
    expect(screen.getByTestId("play-elapsed")).toBeInTheDocument()
  })

  it("does not show elapsed time when stopped", () => {
    render(<Practice {...makeProps()} />)
    expect(screen.queryByTestId("play-elapsed")).not.toBeInTheDocument()
  })

  it("does not show elapsed time in routine mode when playing", () => {
    const props = { ...makeProps({ routineEnabled: true }), status: "playing" as const }
    render(<Practice {...props} />)
    expect(screen.queryByTestId("play-elapsed")).not.toBeInTheDocument()
  })

  it("does not show strip for time sessions", () => {
    render(<Practice {...makeProps()} />)
    expect(document.querySelector(".strip")).not.toBeInTheDocument()
  })

  it("renders Simple and Routine mode buttons", () => {
    render(<Practice {...makeProps()} />)
    expect(screen.getByRole("button", { name: "Simple" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Routine" })).toBeInTheDocument()
  })

  it("Simple is pressed by default", () => {
    render(<Practice {...makeProps()} />)
    expect(screen.getByRole("button", { name: "Simple" })).toHaveAttribute("aria-pressed", "true")
    expect(screen.getByRole("button", { name: "Routine" })).toHaveAttribute("aria-pressed", "false")
  })

  it("toggling to Routine calls onChange with routineEnabled true and stops play", async () => {
    const props = { ...makeProps(), status: "playing" as const }
    const user = userEvent.setup()
    render(<Practice {...props} />)
    await user.click(screen.getByRole("button", { name: "Routine" }))
    expect(props.onChange).toHaveBeenCalledWith(
      expect.objectContaining({ routineEnabled: true })
    )
    expect(props.onReset).toHaveBeenCalledOnce()
  })

  it("routine card is hidden in Simple mode", () => {
    render(<Practice {...makeProps()} />)
    expect(document.querySelector(".routine-card")).not.toBeInTheDocument()
  })

  it("routine card shows when routineEnabled is true", () => {
    render(<Practice {...makeProps({ routineEnabled: true })} />)
    expect(document.querySelector(".routine-card")).toBeInTheDocument()
  })

  it("routine card shows Play and Rest steppers with default values", () => {
    render(<Practice {...makeProps({ routineEnabled: true })} />)
    expect(screen.getByRole("button", { name: "Increase play duration" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Decrease play duration" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Increase rest duration" })).toBeInTheDocument()
  })

  it("clicking Increase play duration calls onChange with incremented value", async () => {
    const props = makeProps({ routineEnabled: true })
    const user = userEvent.setup()
    render(<Practice {...props} />)
    await user.click(screen.getByRole("button", { name: "Increase play duration" }))
    expect(props.onChange).toHaveBeenCalledWith(
      expect.objectContaining({ routine: expect.objectContaining({ playDuration: 5 }) })
    )
  })

  it("Set section is hidden when round.enabled is false", () => {
    render(<Practice {...makeProps({ routineEnabled: true })} />)
    expect(screen.queryByText("Set")).not.toBeInTheDocument()
  })

  it("Set section appears when round.enabled is true", () => {
    const props = makeProps({
      routineEnabled: true,
      routine: { ...createDefaultSession().routine, round: { enabled: true, count: 4, restDuration: 0 } },
    })
    render(<Practice {...props} />)
    expect(screen.getByText("Set")).toBeInTheDocument()
    expect(screen.getByRole("textbox", { name: "Set rest minutes" })).toBeInTheDocument()
  })

  it("toggling Round repeat off clears set enabled", async () => {
    const props = makeProps({
      routineEnabled: true,
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
      routineEnabled: true,
      bpmIncrease: 5,
      routine: {
        ...createDefaultSession().routine,
        round: { enabled: true, count: 2, restDuration: 0 },
        set:   { enabled: true, count: 2, restDuration: 30 },
      },
    })
    render(<Practice {...props} />)
    expect(document.querySelector(".routine-card")).not.toHaveTextContent(/Block/)
    expect(screen.queryByText(/BPM \+/)).not.toBeInTheDocument()
    expect(screen.getByText("Round 1/2")).toBeInTheDocument()
    expect(screen.getByText("Set 1/2")).toBeInTheDocument()
  })

  describe("routine Start and Now BPM", () => {
    const increase = (over: Partial<Session["routine"]["increase"]>) => ({ ...createDefaultSession().routine.increase, ...over })
    function routineProps(routine: Partial<Session["routine"]>, elapsed = 0, status: "playing" | "stopped" = "stopped") {
      const props = makeProps({ routineEnabled: true, bpm: 80, routine: { ...createDefaultSession().routine, ...routine } })
      return { ...props, snapshot: snapshotAt(props.segments, elapsed), status }
    }

    it("shows Start BPM and no Now when the increase is Off", () => {
      render(<Practice {...routineProps({})} />)
      expect(screen.getByTestId("bpm-current")).toHaveValue("80")
      expect(screen.getByText("Start BPM")).toBeInTheDocument()
      expect(screen.queryByTestId("bpm-now")).not.toBeInTheDocument()
    })

    it("keeps Start in the input and shows the playing BPM as Now", () => {
      const props = routineProps({
        round: { enabled: true, count: 2, restDuration: 0 },
        increase: increase({ mode: "round", step: 5 }),
      }, 13, "playing")
      render(<Practice {...props} />)
      expect(screen.getByTestId("bpm-current")).toHaveValue("80")
      expect(screen.getByTestId("bpm-now")).toHaveTextContent("85")
      expect(screen.getByText("Now")).toBeInTheDocument()
    })

    it("shows the next play's BPM as Now during a rest", () => {
      const props = routineProps({
        unit: "sec", playDuration: 10, restDuration: 5,
        round: { enabled: true, count: 2, restDuration: 0 },
        increase: increase({ mode: "round", step: 5 }),
      }, 12, "playing")
      render(<Practice {...props} />)
      expect(screen.getByTestId("bpm-now")).toHaveTextContent("85")
    })

    it("shows Start as Now when stopped", () => {
      const props = routineProps({
        round: { enabled: true, count: 2, restDuration: 0 },
        increase: increase({ mode: "round", step: 5 }),
      })
      render(<Practice {...props} />)
      expect(screen.getByTestId("bpm-now")).toHaveTextContent("80")
    })

    it("keeps the BPM label and no Now in Simple mode", () => {
      render(<Practice {...makeProps()} />)
      expect(screen.queryByText("Start BPM")).not.toBeInTheDocument()
      expect(screen.queryByTestId("bpm-now")).not.toBeInTheDocument()
    })

    it("To target shows the computed play length instead of a stepper", () => {
      render(<Practice {...routineProps({ unit: "sec", playDuration: 60, increase: increase({ mode: "target", step: 4, targetBpm: 125, every: 30 }) })} />)
      expect(screen.getByTestId("routine-play-computed")).toHaveTextContent("6:30")
      expect(screen.queryByRole("textbox", { name: "Play minutes" })).not.toBeInTheDocument()
    })

    it("To target in Bars shows the computed length in bars", () => {
      render(<Practice {...routineProps({ increase: increase({ mode: "target", step: 10, targetBpm: 90, every: 4 }) })} />)
      expect(screen.getByTestId("routine-play-computed")).toHaveTextContent("8 bars")
      expect(screen.queryByRole("button", { name: "Increase play duration" })).not.toBeInTheDocument()
    })

    it("switching Bars and Time resets Every to 30 sec or 4 bars", async () => {
      const user = userEvent.setup()
      const bars = routineProps({ increase: increase({ mode: "target", every: 4 }) })
      const { unmount } = render(<Practice {...bars} />)
      await user.click(screen.getByRole("button", { name: "Time" }))
      expect(bars.onChange.mock.calls.at(-1)![0].routine.increase.every).toBe(30)
      unmount()
      const sec = routineProps({ unit: "sec", playDuration: 60, increase: increase({ mode: "target", every: 30 }) })
      render(<Practice {...sec} />)
      await user.click(screen.getByRole("button", { name: "Bars" }))
      expect(sec.onChange.mock.calls.at(-1)![0].routine.increase.every).toBe(4)
    })
  })

  it("progress shows Round label with count", () => {
    const props = makeProps({ routineEnabled: true })
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
      render(<Practice {...makeProps({ routineEnabled: true })} />)
      expect(screen.getByRole("button", { name: "Bars" })).toHaveAttribute("aria-pressed", "true")
      expect(screen.getByRole("button", { name: "Time" })).toHaveAttribute("aria-pressed", "false")
      expect(screen.queryByRole("button", { name: "sec" })).not.toBeInTheDocument()
    })

    it("shows bar counts with their unit in Bars mode", () => {
      render(<Practice {...makeProps({ routineEnabled: true })} />)
      expect(screen.getByText("4 bars")).toBeInTheDocument()
      expect(screen.getByText("0 bars")).toBeInTheDocument()
      expect(screen.queryByRole("textbox", { name: "Play minutes" })).not.toBeInTheDocument()
    })

    it("switching to Time resets play to 1:00 and rest to 0:00", async () => {
      const props = makeProps({ routineEnabled: true })
      const user = userEvent.setup()
      render(<Practice {...props} />)
      await user.click(screen.getByRole("button", { name: "Time" }))
      expect(props.onChange).toHaveBeenCalledWith(expect.objectContaining({
        routine: expect.objectContaining({ unit: "sec", playDuration: 60, restDuration: 0 }),
      }))
    })

    it("switching back to Bars resets play to 4 bars and rest to 0", async () => {
      const props = makeProps({ routineEnabled: true, routine: timeRoutine() })
      const user = userEvent.setup()
      render(<Practice {...props} />)
      await user.click(screen.getByRole("button", { name: "Bars" }))
      expect(props.onChange).toHaveBeenCalledWith(expect.objectContaining({
        routine: expect.objectContaining({ unit: "bars", playDuration: 4, restDuration: 0 }),
      }))
    })

    it("shows MIN and SEC inputs in Time mode", () => {
      render(<Practice {...makeProps({ routineEnabled: true, routine: timeRoutine() })} />)
      expect(screen.getByRole("textbox", { name: "Play minutes" })).toHaveValue("2")
      expect(screen.getByRole("textbox", { name: "Play seconds" })).toHaveValue("30")
      expect(screen.getByRole("textbox", { name: "Rest minutes" })).toHaveValue("0")
      expect(screen.getByRole("textbox", { name: "Rest seconds" })).toHaveValue("30")
    })

    it("pads seconds to two digits", () => {
      render(<Practice {...makeProps({ routineEnabled: true, routine: timeRoutine({ playDuration: 65 }) })} />)
      expect(screen.getByRole("textbox", { name: "Play seconds" })).toHaveValue("05")
    })

    it("commits a typed minutes value on blur", async () => {
      const props = makeProps({ routineEnabled: true, routine: timeRoutine() })
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
      const props = makeProps({ routineEnabled: true, routine: timeRoutine() })
      const user = userEvent.setup()
      render(<Practice {...props} />)
      await user.click(screen.getByRole("textbox", { name: "Rest seconds" }))
      await user.keyboard("45{Enter}")
      expect(props.onChange).toHaveBeenLastCalledWith(expect.objectContaining({
        routine: expect.objectContaining({ restDuration: 45 }),
      }))
    })

    it("carries seconds over 59 into minutes", async () => {
      const props = makeProps({ routineEnabled: true, routine: timeRoutine({ playDuration: 0 + 60 }) })
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
      const props = makeProps({ routineEnabled: true, routine: timeRoutine() })
      const user = userEvent.setup()
      render(<Practice {...props} />)
      const sec = screen.getByRole("textbox", { name: "Rest seconds" })
      await user.click(sec)
      await user.keyboard("1a5")
      expect(sec).toHaveValue("15")
    })

    it("keeps play at least 1 sec and allows a 0 rest", async () => {
      const props = makeProps({ routineEnabled: true, routine: timeRoutine() })
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
        routineEnabled: true,
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
        routineEnabled: true,
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
      expect(screen.getByTestId("routine-phase")).toHaveTextContent("Play")
      expect(screen.getByTestId("routine-countdown")).toHaveTextContent("1:00")
      expect(screen.getByTestId("routine-total-left")).toHaveTextContent("2:10 left")
    })

    it("counts down the current play stretch, rounding up", () => {
      render(<Practice {...routineProps(17.4)} />)
      expect(screen.getByTestId("routine-countdown")).toHaveTextContent("0:43")
      expect(screen.getByTestId("routine-countdown")).not.toHaveClass("is-rest")
      expect(screen.getByTestId("routine-total-left")).toHaveTextContent("1:53 left")
    })

    it("shows rest time left in red with a moving progress bar", () => {
      render(<Practice {...routineProps(65)} />)
      expect(screen.getByTestId("routine-phase")).toHaveTextContent("Rest")
      expect(screen.getByTestId("routine-countdown")).toHaveTextContent("0:05")
      expect(screen.getByTestId("routine-countdown")).toHaveClass("is-rest")
      const fill = document.querySelector(".routine-progress-bar-fill") as HTMLElement
      expect(fill).toHaveClass("is-rest")
      expect(fill.style.width).toBe("50%")
    })

    it("labels the count-in", () => {
      const props = makeProps({ routineEnabled: true, countIn: true })
      render(<Practice {...props} />)
      expect(screen.getByTestId("routine-phase")).toHaveTextContent("Count-in")
    })

    it("puts Play and Stop inside the routine card, once", () => {
      render(<Practice {...routineProps(0, "stopped")} />)
      const card = document.querySelector(".routine-card") as HTMLElement
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

    it("keeps Simple mode play controls outside any routine card", () => {
      render(<Practice {...makeProps()} />)
      expect(document.querySelector(".routine-card")).not.toBeInTheDocument()
      expect(screen.getByRole("button", { name: "Play" }).closest(".play-controls")).not.toBeNull()
    })
  })

  describe("count-in toggle", () => {
    it("toggles Count-in from the play controls in Simple mode", async () => {
      const props = makeProps({ countIn: false })
      const user = userEvent.setup()
      render(<Practice {...props} />)
      const toggle = screen.getByRole("button", { name: "Count-in" })
      expect(toggle).toHaveAttribute("aria-pressed", "false")
      expect(toggle.closest(".play-controls")).not.toBeNull()
      await user.click(toggle)
      expect(props.onChange).toHaveBeenCalledWith(expect.objectContaining({ countIn: true }))
    })

    it("shows Count-in on inside the routine card", () => {
      render(<Practice {...makeProps({ routineEnabled: true, countIn: true })} />)
      const toggle = screen.getByRole("button", { name: "Count-in" })
      expect(toggle).toHaveAttribute("aria-pressed", "true")
      expect(document.querySelector(".routine-card")).toContainElement(toggle)
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
})
