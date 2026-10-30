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
    routineEnabled,
    routine: { ...base.routine, ...routine, increase: { ...base.routine.increase, ...increase } },
  }
  const onChange = vi.fn()
  render(<BpmSheet session={session} open onClose={vi.fn()} onChange={onChange} />)
  return { session, onChange, last: (): Session => onChange.mock.calls.at(-1)![0], user: userEvent.setup() }
}

describe("BpmSheet routine increase", () => {
  it("shows the same Increase to target card as Simple, plus Every", () => {
    setup()
    expect(screen.getByText("Increase to target")).toBeInTheDocument()
    const group = screen.getByRole("group", { name: "BPM increase" })
    expect(within(group).getByRole("button", { name: "Off" })).toHaveAttribute("aria-pressed", "true")
    expect(within(group).getByRole("button", { name: "On" })).toHaveAttribute("aria-pressed", "false")
    expect(screen.getByLabelText("Target BPM")).toHaveValue("120")
    expect(screen.getByLabelText("Step")).toHaveValue("5")
    expect(screen.getByLabelText("Every (bars)")).toHaveValue("4")
  })

  it("turning it On starts the climb and changes only the routine increase", async () => {
    const { user, last, session } = setup()
    await user.click(screen.getByRole("button", { name: "On" }))
    expect(last().routine.increase.mode).toBe("target")
    expect(last().bpmIncrease).toBe(session.bpmIncrease)
    expect(last().time).toEqual(session.time)
  })

  it("turning it Off returns to the per-round step", async () => {
    const { user, last } = setup({ mode: "target" })
    expect(screen.getByRole("button", { name: "On" })).toHaveAttribute("aria-pressed", "true")
    await user.click(screen.getByRole("button", { name: "Off" }))
    expect(last().routine.increase.mode).toBe("round")
  })

  it("shows Every in seconds when the routine uses Time", () => {
    setup({ mode: "target", every: 30 }, { unit: "sec" })
    expect(screen.getByLabelText("Every (sec)")).toHaveValue("30")
  })

  it("commits a typed target on blur", async () => {
    const { user, last } = setup({ mode: "target" })
    const target = screen.getByLabelText("Target BPM")
    await user.clear(target)
    await user.type(target, "130")
    await user.tab()
    expect(last().routine.increase.targetBpm).toBe(130)
  })

  it("does not commit a cleared step", async () => {
    const { user, onChange } = setup({ mode: "target" })
    await user.clear(screen.getByLabelText("Step"))
    await user.tab()
    expect(onChange).not.toHaveBeenCalled()
  })

  it("Simple keeps its own card bound to Simple's settings", async () => {
    const { user, last } = setup({}, {}, false)
    await user.click(screen.getByRole("button", { name: "On" }))
    expect(last().time.increaseEvery).toBe("bars")
    expect(screen.queryByLabelText(/Every/)).not.toBeInTheDocument()
  })
})
