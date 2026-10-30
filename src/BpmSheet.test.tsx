import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"
import { BpmSheet } from "./BpmSheet"
import { createDefaultSession } from "./session"
import type { RoutineIncrease, RoutinePattern, Session } from "./types"

function setup(increase: Partial<RoutineIncrease> = {}, routine: Partial<RoutinePattern> = {}, routineEnabled = true) {
  const base = createDefaultSession(() => "s1")
  const session: Session = {
    ...base,
    practice: routineEnabled ? "routine" : "steady",
    routine: { ...base.routine, ...routine, increase: { ...base.routine.increase, ...increase } },
  }
  const onChange = vi.fn()
  render(<BpmSheet session={session} open onClose={vi.fn()} onChange={onChange} />)
  return { session, onChange, last: (): Session => onChange.mock.calls.at(-1)![0], user: userEvent.setup() }
}

describe("BpmSheet", () => {
  it("Simple keeps its own card bound to Simple's settings", async () => {
    const { user, last } = setup({}, {}, false)
    await user.click(screen.getByRole("button", { name: "On" }))
    expect(last().practice).toBe("climb")
    expect(screen.queryByLabelText(/Every/)).not.toBeInTheDocument()
  })
})
