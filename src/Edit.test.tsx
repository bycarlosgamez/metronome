import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"
import { Edit } from "./Edit"
import { createDefaultSession } from "./session"

describe("Edit", () => {
  it("writes simple length when Length blurs", async () => {
    const user = userEvent.setup()
    const session = createDefaultSession(() => "cycle-1")
    const onChange = vi.fn()
    const onDone = vi.fn()
    render(<Edit session={session} onChange={onChange} onDone={onDone} />)

    expect(screen.getByRole("heading", { name: "Mentronome" })).toHaveTextContent("Practice")
    const length = screen.getByRole("textbox", { name: "Length" })
    expect(length).toHaveValue("2:00")
    await user.clear(length)
    await user.type(length, "0:00")
    await user.tab()
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({
      simple: expect.objectContaining({ length: { unit: "time", seconds: 1 } }),
    }))

    await user.click(screen.getByRole("button", { name: "Done" }))
    expect(onDone).toHaveBeenCalledOnce()
  })
})
