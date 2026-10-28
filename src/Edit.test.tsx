import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"
import { Edit } from "./Edit"
import { expandSession } from "./expandSession"
import { formatClock } from "./format"
import { createDefaultSession, freshComplex, freshSimple, freshTime } from "./session"

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
    expect(screen.queryByRole("combobox", { name: "Click" })).not.toBeInTheDocument()
    expect(screen.getByRole("combobox", { name: "Beat click" })).toBeInTheDocument()
  })

  it("fills a subdivision with the current click and keeps that click when the first slot changes", async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    const session = createDefaultSession(() => "cycle-1")
    session.click = "click-2"
    session.slots = ["click-2"]
    const { rerender } = render(<Edit session={session} onChange={onChange} onDone={() => {}} />)
    expect(screen.queryByRole("combobox", { name: "Click" })).not.toBeInTheDocument()
    expect(screen.getByRole("combobox", { name: "Beat click" })).toHaveValue("click-2")
    await user.selectOptions(screen.getByRole("combobox", { name: "Subdivision" }), "triplet")
    const triplet = onChange.mock.calls.at(-1)?.[0]
    expect(triplet.subdivision).toBe("triplet")
    expect(triplet.slots).toEqual(["click-2", "click-2", "click-2"])
    rerender(<Edit session={triplet} onChange={onChange} onDone={() => {}} />)
    expect(screen.getByRole("combobox", { name: "1 click" })).toBeInTheDocument()
    expect(screen.getByRole("combobox", { name: "trip click" })).toBeInTheDocument()
    expect(screen.getByRole("combobox", { name: "let click" })).toBeInTheDocument()
    await user.selectOptions(screen.getByRole("combobox", { name: "trip click" }), "off")
    const muted = onChange.mock.calls.at(-1)?.[0]
    expect(muted.slots).toEqual(["click-2", "off", "click-2"])
    expect(muted.click).toBe("click-2")
    rerender(<Edit session={muted} onChange={onChange} onDone={() => {}} />)
    await user.selectOptions(screen.getByRole("combobox", { name: "1 click" }), "click-4")
    const next = onChange.mock.calls.at(-1)?.[0]
    expect(next.click).toBe("click-4")
    expect(next.slots[0]).toBe("click-4")
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
    expect(saved.time).toEqual(freshTime())
    expect(onDone).toHaveBeenCalledOnce()
  })

  it("edits a time session by clock time or by bars", async () => {
    const user = userEvent.setup()
    const session = createDefaultSession(() => "cycle-1")
    session.simple.practices = 4
    const onChange = vi.fn()
    const { rerender } = render(<Edit session={session} onChange={onChange} onDone={() => {}} />)
    const types = screen.getByRole("group", { name: "Type" })
    await user.click(within(types).getByRole("button", { name: "Time" }))
    const opened = onChange.mock.calls.at(-1)?.[0]
    expect(opened.type).toBe("time")
    expect(opened.time).toEqual(freshTime())
    expect(opened.simple.practices).toBe(4)
    rerender(<Edit session={opened} onChange={onChange} onDone={() => {}} />)

    expect(screen.getByRole("textbox", { name: "Duration" })).toHaveValue("2:00")
    expect(screen.getByText("Total 2:03")).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Add cycle" })).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Repeat the round" })).not.toBeInTheDocument()
    const increase = screen.getByRole("group", { name: "Increase every" })
    expect(within(increase).getByRole("button", { name: "Time" })).toHaveAttribute("aria-pressed", "true")
    expect(within(increase).queryByRole("button", { name: "Interval" })).not.toBeInTheDocument()
    expect(screen.getByRole("textbox", { name: "Every" })).toHaveValue("0:30")

    await user.click(within(increase).getByRole("button", { name: "Bars" }))
    const bars = onChange.mock.calls.at(-1)?.[0]
    expect(bars.time.increaseEvery).toBe("bars")
    expect(bars.time.everySec).toBe(30)
    rerender(<Edit session={bars} onChange={onChange} onDone={() => {}} />)
    expect(screen.getByRole("textbox", { name: "Every" })).toHaveValue("4")

    await user.click(within(screen.getByRole("group", { name: "Increase every" })).getByRole("button", { name: "Time" }))
    const backToTime = onChange.mock.calls.at(-1)?.[0]
    expect(backToTime.time.everySec).toBe(30)
    rerender(<Edit session={backToTime} onChange={onChange} onDone={() => {}} />)
    expect(screen.getByRole("textbox", { name: "Every" })).toHaveValue("0:30")

    await user.click(within(screen.getByRole("group", { name: "Type" })).getByRole("button", { name: "Simple" }))
    const restored = onChange.mock.calls.at(-1)?.[0]
    expect(restored.type).toBe("simple")
    expect(restored.simple.practices).toBe(4)
  })

  it("keeps a time pattern when the visit opened on time", async () => {
    const user = userEvent.setup()
    const session = createDefaultSession(() => "cycle-1")
    session.type = "time"
    session.time.seconds = 90
    session.cycles = [
      { id: "a", length: { unit: "time", seconds: 30 }, restSec: 5 },
      { id: "b", length: { unit: "time", seconds: 45 }, restSec: 5 },
    ]
    const onChange = vi.fn()
    const onDone = vi.fn()
    const { rerender } = render(<Edit session={session} onChange={onChange} onDone={onDone} />)
    await user.click(within(screen.getByRole("group", { name: "Type" })).getByRole("button", { name: "Complex" }))
    const preview = onChange.mock.calls.at(-1)?.[0]
    expect(preview.type).toBe("complex")
    expect(preview.complex).toEqual(freshComplex())
    expect(preview.cycles).toEqual([
      { id: expect.any(String), length: { unit: "time", seconds: 120 }, restSec: 30 },
    ])
    expect(preview.time.seconds).toBe(90)
    rerender(<Edit session={preview} onChange={onChange} onDone={onDone} />)
    await user.click(within(screen.getByRole("group", { name: "Type" })).getByRole("button", { name: "Time" }))
    const returned = onChange.mock.calls.at(-1)?.[0]
    expect(returned.type).toBe("time")
    expect(returned.time.seconds).toBe(90)

    rerender(<Edit session={returned} onChange={onChange} onDone={onDone} />)
    await user.click(screen.getByRole("button", { name: "Done" }))
    const saved = onChange.mock.calls.at(-1)?.[0]
    expect(saved.type).toBe("time")
    expect(saved.time.seconds).toBe(90)
    expect(saved.simple).toEqual(freshSimple())
    expect(saved.complex).toEqual(freshComplex())
    expect(saved.cycles).toEqual([
      { id: expect.any(String), length: { unit: "time", seconds: 120 }, restSec: 30 },
    ])
    expect(onDone).toHaveBeenCalledOnce()
  })

  it("commits typed Every and Duration values on a time session", async () => {
    const user = userEvent.setup()
    const session = createDefaultSession(() => "cycle-1")
    session.type = "time"
    const onChange = vi.fn()
    const { rerender } = render(<Edit session={session} onChange={onChange} onDone={() => {}} />)
    const every = screen.getByRole("textbox", { name: "Every" })
    await user.clear(every)
    await user.type(every, "0:45")
    await user.tab()
    const afterEvery = onChange.mock.calls.at(-1)?.[0]
    expect(afterEvery.time.everySec).toBe(45)
    rerender(<Edit session={afterEvery} onChange={onChange} onDone={() => {}} />)

    await user.click(within(screen.getByRole("group", { name: "Increase every" })).getByRole("button", { name: "Bars" }))
    const bars = onChange.mock.calls.at(-1)?.[0]
    rerender(<Edit session={bars} onChange={onChange} onDone={() => {}} />)
    const everyBars = screen.getByRole("textbox", { name: "Every" })
    await user.clear(everyBars)
    await user.type(everyBars, "8")
    await user.tab()
    const afterBars = onChange.mock.calls.at(-1)?.[0]
    expect(afterBars.time.everyBars).toBe(8)
    rerender(<Edit session={afterBars} onChange={onChange} onDone={() => {}} />)

    const duration = screen.getByRole("textbox", { name: "Duration" })
    await user.clear(duration)
    await user.type(duration, "3:00")
    await user.tab()
    expect(onChange.mock.calls.at(-1)?.[0].time.seconds).toBe(180)
  })

  it("keeps a complex cycle edit after returning from time", async () => {
    const user = userEvent.setup()
    const session = createDefaultSession(() => "cycle-1")
    session.type = "time"
    const onChange = vi.fn()
    const { rerender } = render(<Edit session={session} onChange={onChange} onDone={() => {}} />)
    await user.click(within(screen.getByRole("group", { name: "Type" })).getByRole("button", { name: "Complex" }))
    const complex = onChange.mock.calls.at(-1)?.[0]
    rerender(<Edit session={complex} onChange={onChange} onDone={() => {}} />)
    const practice = screen.getByRole("textbox", { name: "Practice" })
    await user.clear(practice)
    await user.type(practice, "0:45")
    await user.tab()
    const edited = onChange.mock.calls.at(-1)?.[0]
    expect(edited.cycles[0].length).toEqual({ unit: "time", seconds: 45 })
    rerender(<Edit session={edited} onChange={onChange} onDone={() => {}} />)
    await user.click(within(screen.getByRole("group", { name: "Type" })).getByRole("button", { name: "Time" }))
    const time = onChange.mock.calls.at(-1)?.[0]
    rerender(<Edit session={time} onChange={onChange} onDone={() => {}} />)
    await user.click(within(screen.getByRole("group", { name: "Type" })).getByRole("button", { name: "Complex" }))
    const back = onChange.mock.calls.at(-1)?.[0]
    expect(back.cycles[0].length).toEqual({ unit: "time", seconds: 45 })
  })

  it("freshens time when complex is saved", async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    const session = createDefaultSession(() => "cycle-1")
    session.type = "complex"
    session.time.seconds = 45
    session.cycles = [{ id: "a", length: { unit: "time", seconds: 30 }, restSec: 5 }]
    render(<Edit session={session} onChange={onChange} onDone={() => {}} />)
    await user.click(screen.getByRole("button", { name: "Done" }))
    const saved = onChange.mock.calls.at(-1)?.[0]
    expect(saved.type).toBe("complex")
    expect(saved.time).toEqual(freshTime())
    expect(saved.cycles).toEqual([{ id: "a", length: { unit: "time", seconds: 30 }, restSec: 5 }])
    expect(saved.simple).toEqual(freshSimple())
  })

  it("puts Time first and stores the two time-signature numbers", async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<Edit session={createDefaultSession(() => "cycle-1")} onChange={onChange} onDone={() => {}} />)
    const types = within(screen.getByRole("group", { name: "Type" })).getAllByRole("button")
    expect(types.map((button) => button.textContent)).toEqual(["Time", "Simple", "Complex"])
    const signature = screen.getByRole("group", { name: "Time signature" })
    expect(within(signature).getByRole("combobox", { name: "Beats" })).toHaveValue("4")
    expect(within(signature).getByRole("combobox", { name: "Note" })).toHaveValue("4")
    expect(screen.queryByRole("combobox", { name: "Meter" })).not.toBeInTheDocument()
    const beatOptions = [...within(signature).getByRole("combobox", { name: "Beats" }).querySelectorAll("option")].map((option) => option.value)
    const noteOptions = [...within(signature).getByRole("combobox", { name: "Note" }).querySelectorAll("option")].map((option) => option.value)
    expect(beatOptions).toEqual(["1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12", "13", "14", "15", "16"])
    expect(noteOptions).toEqual(["1", "2", "4", "8"])
    await user.selectOptions(within(signature).getByRole("combobox", { name: "Beats" }), "16")
    await user.selectOptions(within(signature).getByRole("combobox", { name: "Note" }), "8")
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ meter: "16/8" }))
  })
})
