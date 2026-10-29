import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"
import { Edit } from "./Edit"
import { expandSession } from "./expandSession"
import { formatClock } from "./format"
import { createDefaultSession } from "./session"

describe("Edit", () => {
  it("edits the session card and the tempo card", async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    const session = createDefaultSession(() => "cycle-1")
    session.type = "simple"
    render(<Edit session={session} onChange={onChange} onDone={() => {}} />)
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
    expect(next.slots).toEqual(["click-4", "off", "click-2"])
    rerender(<Edit session={{ ...muted, slots: [...muted.slots] }} onChange={onChange} onDone={() => {}} />)
    await user.selectOptions(screen.getByRole("combobox", { name: "1 click" }), "off")
    const cleared = onChange.mock.calls.at(-1)?.[0]
    expect(cleared.click).toBe("click-2")
    expect(cleared.slots[0]).toBe("off")
  })

  it("shows a caption for each quintuplet and sextuplet slot", async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    const { rerender } = render(<Edit session={createDefaultSession(() => "cycle-1")} onChange={onChange} onDone={() => {}} />)
    await user.selectOptions(screen.getByRole("combobox", { name: "Subdivision" }), "quintuplet")
    const quintuplet = onChange.mock.calls.at(-1)?.[0]
    expect(quintuplet.subdivision).toBe("quintuplet")
    expect(quintuplet.slots).toEqual(["click-1", "click-1", "click-1", "click-1", "click-1"])
    rerender(<Edit session={quintuplet} onChange={onChange} onDone={() => {}} />)
    expect(screen.getByRole("combobox", { name: "ta click" })).toBeInTheDocument()
    expect(screen.getByRole("combobox", { name: "ka click" })).toBeInTheDocument()
    expect(screen.getByRole("combobox", { name: "di click" })).toBeInTheDocument()
    expect(screen.getByRole("combobox", { name: "mi click" })).toBeInTheDocument()
    expect(screen.getByText("ta")).toBeInTheDocument()
    await user.selectOptions(screen.getByRole("combobox", { name: "Subdivision" }), "sextuplet")
    const sextuplet = onChange.mock.calls.at(-1)?.[0]
    expect(sextuplet.slots).toHaveLength(6)
    rerender(<Edit session={sextuplet} onChange={onChange} onDone={() => {}} />)
    expect(screen.getByRole("combobox", { name: "li click" })).toBeInTheDocument()
    const slotRow = document.querySelector(".slot-row")
    if (!(slotRow instanceof HTMLElement)) throw new Error("missing slot row")
    const captions = ["1 click", "ta click", "la click", "ta click", "li click", "ta click"]
    const combos = within(slotRow).getAllByRole("combobox")
    expect(combos).toHaveLength(captions.length)
    captions.forEach((name, index) => expect(combos[index]).toHaveAccessibleName(name))
  })

  it("hides the repeat fields until the switches are on", async () => {
    const user = userEvent.setup()
    const session = createDefaultSession(() => "cycle-1")
    session.type = "simple"
    render(<Edit session={session} onChange={() => {}} onDone={() => {}} />)
    expect(screen.queryByRole("textbox", { name: "Times" })).not.toBeInTheDocument()
    expect(screen.queryByRole("textbox", { name: "Rounds" })).not.toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "Repeat interval" }))
    expect(screen.getByRole("textbox", { name: "Times" })).toHaveValue("2")
    await user.click(screen.getByRole("button", { name: "Repeat the round" }))
    expect(screen.getByRole("textbox", { name: "Rounds" })).toHaveValue("2")
    expect(screen.getByRole("textbox", { name: "Between" })).toHaveValue("0:30")
  })

  it("shows the stored value when a commit clamps back to it", async () => {
    const user = userEvent.setup()
    const session = createDefaultSession(() => "cycle-1")
    session.type = "simple"
    render(<Edit session={session} onChange={() => {}} onDone={() => {}} />)
    const practices = screen.getByRole("textbox", { name: "Practices" })
    await user.clear(practices)
    await user.type(practices, "0")
    await user.tab()
    expect(practices).toHaveValue("1")
  })

  it("shows the total of every segment, including rests", () => {
    const session = createDefaultSession(() => "cycle-1")
    session.type = "simple"
    session.simple.practices = 2
    session.simple.restAfterSec = 5
    const totalSec = expandSession(session).reduce((sum, segment) => sum + segment.durationSec, 0)
    render(<Edit session={session} onChange={() => {}} onDone={() => {}} />)
    expect(screen.getByText(`Total ${formatClock(totalSec)}`)).toBeInTheDocument()
  })

  it("calls onDone when Done is clicked", async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    const onDone = vi.fn()
    const session = createDefaultSession(() => "cycle-1")
    session.type = "simple"
    render(<Edit session={session} onChange={onChange} onDone={onDone} />)
    await user.click(screen.getByRole("button", { name: "Done" }))
    expect(onChange).toHaveBeenCalledOnce()
    expect(onDone).toHaveBeenCalledOnce()
  })

  it("stores the two time-signature numbers", async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<Edit session={createDefaultSession(() => "cycle-1")} onChange={onChange} onDone={() => {}} />)
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
