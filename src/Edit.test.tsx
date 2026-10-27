import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"
import { Edit } from "./Edit"
import { createDefaultSession } from "./session"

describe("Edit", () => {
  it("adds a set, blocks deleting the last set, and snaps BPM", async () => {
    const user = userEvent.setup()
    const session = createDefaultSession(() => "set-1")
    const onChange = vi.fn()
    render(<Edit session={session} selectedId="set-1" onChange={onChange} onSelect={() => {}} onDone={() => {}} />)

    await user.click(screen.getByRole("button", { name: "Add set" }))
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({
      sets: expect.arrayContaining([expect.objectContaining({ name: "Set 2", durationSec: 60, repeats: 1, color: "orange" })]),
    }))

    expect(screen.getByRole("button", { name: "Delete set" })).toBeDisabled()

    await user.clear(screen.getByLabelText("BPM"))
    await user.type(screen.getByLabelText("BPM"), "12")
    await user.tab()
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({
      sets: [expect.objectContaining({ bpm: 40 })],
    }))
  })

  it("hides the set meter until the session switch is on", () => {
    const session = createDefaultSession(() => "set-1")
    const { rerender } = render(
      <Edit session={session} selectedId="set-1" onChange={() => {}} onSelect={() => {}} onDone={() => {}} />,
    )
    expect(screen.queryByLabelText("Set meter")).not.toBeInTheDocument()
    rerender(
      <Edit
        session={{ ...session, perSetMeter: true }}
        selectedId="set-1"
        onChange={() => {}}
        onSelect={() => {}}
        onDone={() => {}}
      />,
    )
    expect(screen.getByLabelText("Set meter")).toBeInTheDocument()
  })

  it("sets the set color from a dot and shows the session title", async () => {
    const user = userEvent.setup()
    const session = createDefaultSession(() => "set-1")
    const onChange = vi.fn()
    render(<Edit session={session} selectedId="set-1" onChange={onChange} onSelect={() => {}} onDone={() => {}} />)

    expect(screen.getByRole("heading", { name: "Mentronome" })).toHaveTextContent("Practice")
    expect(screen.getByRole("radio", { name: "red" })).toHaveAttribute("aria-checked", "true")
    await user.click(screen.getByRole("radio", { name: "blue" }))
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({
      sets: [expect.objectContaining({ color: "blue" })],
    }))
  })
})
