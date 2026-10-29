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

  it("routine timer block is hidden in Simple mode", () => {
    render(<Practice {...makeProps()} />)
    expect(document.querySelector(".routine-timer")).not.toBeInTheDocument()
  })

  it("routine timer block shows when routineEnabled is true", () => {
    const props = makeProps({ routineEnabled: true })
    render(<Practice {...props} />)
    expect(document.querySelector(".routine-timer")).toBeInTheDocument()
  })

  it("routine timer shows cycle/level/rep labels", () => {
    const props = makeProps({ routineEnabled: true })
    render(<Practice {...props} />)
    expect(screen.getByText(/Cycle/)).toBeInTheDocument()
    expect(screen.getAllByText(/Level/).length).toBeGreaterThan(0)
  })

  it("routine timer fields are rendered with correct values", () => {
    const props = makeProps({
      routineEnabled: true,
      routine: { barsPerLevel: 8, numLevels: 4, repeatCount: 3, restAfterSec: 10, loop: false },
    })
    render(<Practice {...props} />)
    expect(screen.getByRole("spinbutton", { name: "Bars / level" })).toHaveValue(8)
    expect(screen.getByRole("spinbutton", { name: "Levels" })).toHaveValue(4)
    expect(screen.getByRole("spinbutton", { name: "Repeat ×" })).toHaveValue(3)
    expect(screen.getByRole("spinbutton", { name: "Rest (sec)" })).toHaveValue(10)
  })
})
