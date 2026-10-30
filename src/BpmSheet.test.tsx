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
  it("offers Off, Per round and To target with Off pressed by default and no fields", () => {
    setup()
    const group = screen.getByRole("group", { name: "Routine BPM increase" })
    expect(within(group).getByRole("button", { name: "Off" })).toHaveAttribute("aria-pressed", "true")
    expect(within(group).getByRole("button", { name: "Per round" })).toHaveAttribute("aria-pressed", "false")
    expect(within(group).getByRole("button", { name: "To target" })).toHaveAttribute("aria-pressed", "false")
    expect(screen.queryByLabelText("Step")).not.toBeInTheDocument()
  })

  it("choosing Per round changes only the routine increase", async () => {
    const { user, last, session } = setup()
    await user.click(screen.getByRole("button", { name: "Per round" }))
    expect(last().routine.increase.mode).toBe("round")
    expect(last().bpmIncrease).toBe(session.bpmIncrease)
    expect(last().time).toEqual(session.time)
  })

  it("Per round shows Step and Next set BPM when Set repeat is on", async () => {
    const { user, last } = setup({ mode: "round" }, { set: { enabled: true, count: 3, restDuration: 30 } })
    expect(screen.getByLabelText("Step")).toHaveValue("5")
    const next = screen.getByRole("group", { name: "Next set BPM" })
    expect(within(next).getByRole("button", { name: "Reset" })).toHaveAttribute("aria-pressed", "true")
    expect(within(next).getByRole("button", { name: "Keep" })).toBeInTheDocument()
    await user.click(within(next).getByRole("button", { name: "+N" }))
    expect(last().routine.increase.nextSet).toBe("raise")
    expect(screen.queryByLabelText("Raise each set by")).not.toBeInTheDocument()
  })

  it("+N shows the raise field", () => {
    setup({ mode: "round", nextSet: "raise" }, { set: { enabled: true, count: 3, restDuration: 30 } })
    expect(screen.getByLabelText("Raise each set by")).toHaveValue("2")
  })

  it("hides Next set BPM when Set repeat is off", () => {
    setup({ mode: "round" })
    expect(screen.queryByRole("group", { name: "Next set BPM" })).not.toBeInTheDocument()
  })

  it("To target shows Target BPM, Step and Every in the routine's unit", () => {
    setup({ mode: "target" })
    expect(screen.getByLabelText("Target BPM")).toHaveValue("120")
    expect(screen.getByLabelText("Step")).toBeInTheDocument()
    expect(screen.getByLabelText("Every (bars)")).toHaveValue("4")
  })

  it("To target in Time shows Every (sec)", () => {
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
    const { user, onChange } = setup({ mode: "round" })
    await user.clear(screen.getByLabelText("Step"))
    await user.tab()
    expect(onChange).not.toHaveBeenCalled()
  })

  it("shows only the routine card in Routine and only the Simple card in Simple", () => {
    setup()
    expect(screen.queryByText("Increase to target")).not.toBeInTheDocument()

    document.body.innerHTML = ""
    setup({}, {}, false)
    expect(screen.getByText("Increase to target")).toBeInTheDocument()
    expect(screen.queryByRole("group", { name: "Routine BPM increase" })).not.toBeInTheDocument()
  })
})
