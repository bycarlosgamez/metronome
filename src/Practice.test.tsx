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
    onEdit: vi.fn(),
    onChange: vi.fn(),
    onSeek: vi.fn(),
  }
}

describe("Practice", () => {
  it("renders the session name and Edit button", async () => {
    const props = makeProps()
    const user = userEvent.setup()
    render(<Practice {...props} />)
    expect(screen.getByRole("heading", { name: "Mentronome" })).toHaveTextContent("Practice")
    await user.click(screen.getByRole("button", { name: "Edit" }))
    expect(props.onEdit).toHaveBeenCalledOnce()
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

  it("Block section is hidden when set.enabled is false", () => {
    const props = makeProps({
      routineEnabled: true,
      routine: { ...createDefaultSession().routine, round: { enabled: true, count: 4, restDuration: 0 } },
    })
    render(<Practice {...props} />)
    expect(screen.queryByText("Block")).not.toBeInTheDocument()
  })

  it("Block section appears when set.enabled is true", () => {
    const props = makeProps({
      routineEnabled: true,
      routine: {
        ...createDefaultSession().routine,
        round: { enabled: true, count: 4, restDuration: 0 },
        set:   { enabled: true, count: 3, restDuration: 30 },
      },
    })
    render(<Practice {...props} />)
    expect(screen.getByText("Block")).toBeInTheDocument()
  })

  it("toggling Round repeat off clears set and block enabled", async () => {
    const props = makeProps({
      routineEnabled: true,
      routine: {
        ...createDefaultSession().routine,
        round: { enabled: true, count: 4, restDuration: 0 },
        set:   { enabled: true, count: 3, restDuration: 30 },
        block: { enabled: true, count: 2, restDuration: 60 },
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
          block: expect.objectContaining({ enabled: false }),
        }),
      })
    )
  })

  it("toggling Set repeat off clears block enabled", async () => {
    const props = makeProps({
      routineEnabled: true,
      routine: {
        ...createDefaultSession().routine,
        round: { enabled: true, count: 4, restDuration: 0 },
        set:   { enabled: true, count: 3, restDuration: 30 },
        block: { enabled: true, count: 2, restDuration: 60 },
      },
    })
    const user = userEvent.setup()
    render(<Practice {...props} />)
    await user.click(screen.getByRole("button", { name: "Toggle set repeat" }))
    expect(props.onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        routine: expect.objectContaining({
          set:   expect.objectContaining({ enabled: false }),
          block: expect.objectContaining({ enabled: false }),
        }),
      })
    )
  })

  it("BPM row is hidden when bpmIncrease is 0", () => {
    render(<Practice {...makeProps({ routineEnabled: true, bpmIncrease: 0 })} />)
    expect(screen.queryByText(/BPM \+/)).not.toBeInTheDocument()
  })

  it("BPM row shows when bpmIncrease > 0", () => {
    render(<Practice {...makeProps({ routineEnabled: true, bpmIncrease: 5 })} />)
    expect(screen.getByText(/BPM \+5 every/)).toBeInTheDocument()
  })

  it("progress shows Round label with count", () => {
    const props = makeProps({ routineEnabled: true })
    render(<Practice {...props} />)
    expect(screen.getByText(/Round 1\//)).toBeInTheDocument()
  })

  it("BpmSheet does not show BPM step card in routine mode", () => {
    const props = makeProps({ routineEnabled: true, bpmIncrease: 5 })
    render(<Practice {...props} />)
    // BpmSheet starts closed; verify Step label is not in DOM
    expect(screen.queryByLabelText("Step")).not.toBeInTheDocument()
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

    it("uses MIN and SEC inputs for Set and Block rest", async () => {
      const base = createDefaultSession().routine
      const props = makeProps({
        routineEnabled: true,
        routine: { ...base, round: { enabled: true, count: 4, restDuration: 0 }, set: { enabled: true, count: 3, restDuration: 90 } },
      })
      const user = userEvent.setup()
      render(<Practice {...props} />)
      expect(screen.getByRole("textbox", { name: "Set rest minutes" })).toHaveValue("1")
      expect(screen.getByRole("textbox", { name: "Set rest seconds" })).toHaveValue("30")
      expect(screen.getByRole("textbox", { name: "Block rest minutes" })).toHaveValue("1")
      await user.click(screen.getByRole("textbox", { name: "Block rest minutes" }))
      await user.keyboard("2{Enter}")
      expect(props.onChange).toHaveBeenLastCalledWith(expect.objectContaining({
        routine: expect.objectContaining({ block: expect.objectContaining({ restDuration: 120 }) }),
      }))
    })
  })
})
