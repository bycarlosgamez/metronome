import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"
import { Edit } from "./Edit"
import { expandSession } from "./expandSession"
import { formatClock } from "./format"
import { createDefaultSession, freshComplex } from "./session"

describe("Edit", () => {
  it("edits the session card and the tempo card", async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<Edit session={createDefaultSession(() => "cycle-1")} onChange={onChange} onDone={() => {}} />)
    expect(screen.getByRole("heading", { name: "Mentronome" })).toHaveTextContent("Practice")
    await user.click(screen.getByRole("radio", { name: "blue" }))
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ color: "blue" }))
    await user.clear(screen.getByRole("textbox", { name: "BPM" }))
    await user.type(screen.getByRole("textbox", { name: "BPM" }), "12")
    await user.tab()
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ bpm: 40 }))
    expect(screen.queryByRole("textbox", { name: "Every" })).not.toBeInTheDocument()
    expect(screen.getByRole("combobox", { name: "Click" })).toBeInTheDocument()
  })

  it("hides the repeat fields until the switches are on", async () => {
    const user = userEvent.setup()
    render(<Edit session={createDefaultSession(() => "cycle-1")} onChange={() => {}} onDone={() => {}} />)
    expect(screen.queryByRole("textbox", { name: "Times" })).not.toBeInTheDocument()
    expect(screen.queryByRole("textbox", { name: "Rounds" })).not.toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "Repeat interval" }))
    expect(screen.getByRole("textbox", { name: "Times" })).toHaveValue("2")
    await user.click(screen.getByRole("button", { name: "Repeat the round" }))
    expect(screen.getByRole("textbox", { name: "Rounds" })).toHaveValue("2")
    expect(screen.getByRole("textbox", { name: "Between" })).toHaveValue("0:30")
  })

  it("builds complex cycles from the simple pattern", async () => {
    const user = userEvent.setup()
    const session = createDefaultSession(() => "cycle-1")
    session.simple.practices = 3
    session.simple.stepTempo = true
    session.simple.times = 2
    session.simple.restAfterSec = 30
    const onChange = vi.fn()
    render(<Edit session={session} onChange={onChange} onDone={() => {}} />)
    await user.click(screen.getByRole("button", { name: "Complex" }))
    const next = onChange.mock.calls.at(-1)?.[0]
    expect(next.type).toBe("complex")
    expect(next.cycles).toHaveLength(6)
    expect(next.cycles.every((cycle: { bpm?: number; restSec: number }) => cycle.bpm === undefined && cycle.restSec === 30)).toBe(true)
    expect(next.complex).toEqual({
      increaseEvery: "interval",
      repeatRound: false,
      rounds: 2,
      restBetweenSec: 30,
    })
    expect(screen.queryByRole("textbox", { name: "Every" })).not.toBeInTheDocument()
  })

  it("returns to the same cycles when a complex session peeks at simple", async () => {
    const user = userEvent.setup()
    const session = createDefaultSession(() => "cycle-1")
    session.type = "complex"
    session.cycles = [
      { id: "a", length: { unit: "time", seconds: 30 }, restSec: 5 },
      { id: "b", length: { unit: "bars", bars: 4 }, restSec: 0 },
    ]
    const onChange = vi.fn()
    const { rerender } = render(<Edit session={session} onChange={onChange} onDone={() => {}} />)
    await user.click(screen.getByRole("button", { name: "Simple" }))
    const preview = onChange.mock.calls.at(-1)?.[0]
    expect(preview.type).toBe("simple")
    expect(preview.simple.practices).toBe(1)
    expect(preview.cycles).toHaveLength(2)
    rerender(<Edit session={preview} onChange={onChange} onDone={() => {}} />)
    await user.click(screen.getByRole("button", { name: "Complex" }))
    const back = onChange.mock.calls.at(-1)?.[0]
    expect(back.cycles.map((cycle: { id: string }) => cycle.id)).toEqual(["a", "b"])
  })

  it("adds, moves, and refuses to remove the last cycle", async () => {
    const user = userEvent.setup()
    const session = createDefaultSession(() => "cycle-1")
    session.type = "complex"
    session.every = 1
    const onChange = vi.fn()
    const { rerender } = render(<Edit session={session} onChange={onChange} onDone={() => {}} />)
    expect(screen.getByRole("button", { name: "Remove cycle 1" })).toBeDisabled()
    await user.click(screen.getByRole("button", { name: "Add cycle" }))
    const added = onChange.mock.calls.at(-1)?.[0]
    expect(added.cycles).toHaveLength(2)
    rerender(<Edit session={added} onChange={onChange} onDone={() => {}} />)
    await user.click(screen.getByRole("button", { name: "Move cycle 2 up" }))
    const moved = onChange.mock.calls.at(-1)?.[0]
    expect(moved.cycles[0].id).toBe(added.cycles[1].id)
  })

  it("shows the stored value when a commit clamps back to it", async () => {
    const user = userEvent.setup()
    render(<Edit session={createDefaultSession(() => "cycle-1")} onChange={() => {}} onDone={() => {}} />)
    const practices = screen.getByRole("textbox", { name: "Practices" })
    await user.clear(practices)
    await user.type(practices, "0")
    await user.tab()
    expect(practices).toHaveValue("1")
  })

  it("shows the total of every segment, including rests", () => {
    const session = createDefaultSession(() => "cycle-1")
    session.simple.practices = 2
    session.simple.restAfterSec = 5
    const totalSec = expandSession(session).reduce((sum, segment) => sum + segment.durationSec, 0)
    render(<Edit session={session} onChange={() => {}} onDone={() => {}} />)
    expect(screen.getByText(`Total ${formatClock(totalSec)}`)).toBeInTheDocument()
  })

  it("chooses a round increase for simple and for complex", async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    const { rerender } = render(<Edit session={createDefaultSession(() => "cycle-1")} onChange={onChange} onDone={() => {}} />)
    expect(screen.getByRole("group", { name: "Increase every" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Interval" })).toHaveAttribute("aria-pressed", "true")
    expect(screen.queryByRole("textbox", { name: "Every" })).not.toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "Round" }))
    const simpleRound = onChange.mock.calls.at(-1)?.[0]
    expect(simpleRound.simple.increaseEvery).toBe("round")
    rerender(<Edit session={simpleRound} onChange={onChange} onDone={() => {}} />)
    await user.click(screen.getByRole("button", { name: "Complex" }))
    const complex = onChange.mock.calls.at(-1)?.[0]
    expect(complex.complex.increaseEvery).toBe("round")
    rerender(<Edit session={complex} onChange={onChange} onDone={() => {}} />)
    expect(screen.getByRole("group", { name: "Increase every" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Round" })).toHaveAttribute("aria-pressed", "true")
    expect(screen.queryByRole("textbox", { name: "Every" })).not.toBeInTheDocument()
    expect(screen.queryByText("Interval", { selector: ".card-title" })).not.toBeInTheDocument()
    expect(screen.queryByRole("textbox", { name: "Rounds" })).not.toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "Repeat the round" }))
    const repeated = onChange.mock.calls.at(-1)?.[0]
    expect(repeated.complex.repeatRound).toBe(true)
    rerender(<Edit session={repeated} onChange={onChange} onDone={() => {}} />)
    expect(screen.getByRole("textbox", { name: "Rounds" })).toHaveValue("2")
    expect(screen.getByRole("textbox", { name: "Between" })).toHaveValue("0:30")
  })

  it("drops the complex pattern when simple is saved", async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    const onDone = vi.fn()
    const session = createDefaultSession(() => "cycle-1")
    session.complex.repeatRound = true
    render(<Edit session={session} onChange={onChange} onDone={onDone} />)
    await user.click(screen.getByRole("button", { name: "Done" }))
    const saved = onChange.mock.calls.at(-1)?.[0]
    expect(saved.type).toBe("simple")
    expect(saved.complex).toEqual(freshComplex())
    expect(onDone).toHaveBeenCalledOnce()
  })
})
