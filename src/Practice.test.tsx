import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"
import { snapshotAt } from "./clock"
import { expandSession } from "./expandSession"
import { Practice } from "./Practice"
import { createDefaultSession } from "./session"

describe("Practice", () => {
  it("shows the first count-in while stopped", async () => {
    const session = createDefaultSession(() => "set-1")
    const segments = expandSession(session)
    const onEdit = vi.fn()
    const user = userEvent.setup()
    render(
      <Practice
        session={session}
        segments={segments}
        snapshot={snapshotAt(segments, 0)}
        status="stopped"
        onToggle={() => {}}
        onJump={() => {}}
        onReset={() => {}}
        onEdit={onEdit}
      />,
    )
    expect(screen.getByRole("heading", { name: "Mentronome" })).toBeInTheDocument()
    expect(screen.getByTestId("stage-label")).toHaveTextContent("Set 1")
    expect(screen.getByTestId("stage-time")).toHaveTextContent("0:03")
    expect(screen.getByTestId("beat-1")).toHaveAttribute("data-current", "true")
    expect(screen.getByTestId("footer-set")).toHaveTextContent("1 / 1")
    await user.click(screen.getByRole("button", { name: "Edit" }))
    expect(onEdit).toHaveBeenCalledOnce()
  })

  it("shows the following stretch during a rest", () => {
    const session = createDefaultSession(() => "set-1")
    session.sets[0].repeats = 2
    session.bpmIncrease = 5
    const segments = expandSession(session)
    const restIndex = segments.findIndex((segment) => segment.kind === "rest")
    const elapsed = segments.slice(0, restIndex).reduce((sum, segment) => sum + segment.durationSec, 0)
    render(
      <Practice
        session={session}
        segments={segments}
        snapshot={snapshotAt(segments, elapsed)}
        status="playing"
        onToggle={() => {}}
        onJump={() => {}}
        onReset={() => {}}
        onEdit={() => {}}
      />,
    )
    expect(screen.getByTestId("stage-label")).toHaveTextContent("Rest")
    expect(screen.getByTestId("next-up")).toHaveTextContent("Next · Set 1 at 85")
    expect(screen.queryByTestId("beat-1")).not.toBeInTheDocument()
  })
})
