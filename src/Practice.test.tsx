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
        onChange={() => {}}
        onSeek={() => {}}
      />,
    )
    expect(screen.getByRole("heading", { name: "Mentronome" })).toBeInTheDocument()
    expect(screen.getByRole("heading", { name: "Mentronome" })).toHaveTextContent("Practice")
    expect(screen.getByRole("button", { name: "Play" })).toHaveClass("play-toggle")
    expect(screen.getByTestId("stage-label")).toHaveTextContent("Practice")
    expect(document.querySelector(".stage")).toHaveClass("color-red")
    expect(screen.getByTestId("stage-time")).toHaveValue("0:03")
    expect(screen.getByTestId("beat-1")).toHaveAttribute("data-current", "true")
    expect(screen.getByTestId("footer-set")).toHaveTextContent("1 / 2")
    expect(document.querySelector('.strip button[data-current="true"]')).toHaveClass("color-red")
    await user.click(screen.getByRole("button", { name: "Edit" }))
    expect(onEdit).toHaveBeenCalledOnce()
  })

  it("shows the following stretch during a rest", () => {
    const session = createDefaultSession(() => "set-1")
    session.simple.practices = 2
    session.simple.restAfterSec = 30
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
        onChange={() => {}}
        onSeek={() => {}}
      />,
    )
    expect(screen.getByTestId("stage-label")).toHaveTextContent("Rest")
    expect(document.querySelector(".stage")).toHaveClass("color-yellow")
    expect(screen.getByTestId("next-up")).toHaveTextContent("Next · Practice at 80")
    expect(screen.queryByTestId("beat-1")).not.toBeInTheDocument()
  })

  it("labels the transport Pause when sound is unavailable", () => {
    const session = createDefaultSession(() => "set-1")
    const segments = expandSession(session)
    render(
      <Practice
        session={session}
        segments={segments}
        snapshot={snapshotAt(segments, 0)}
        status="no-audio"
        onToggle={() => {}}
        onJump={() => {}}
        onReset={() => {}}
        onEdit={() => {}}
        onChange={() => {}}
        onSeek={() => {}}
      />,
    )
    expect(screen.getByRole("button", { name: "Pause" })).toBeInTheDocument()
    expect(document.querySelector(".stage")).toHaveClass("color-green")
    expect(screen.getByRole("status")).toHaveTextContent("Sound is unavailable. The countdown is still running.")
  })

  it("edits duration, tempo, and meter on the stage", async () => {
    const session = createDefaultSession(() => "set-1")
    const segments = expandSession(session)
    const onChange = vi.fn()
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
        onEdit={() => {}}
        onChange={onChange}
        onSeek={() => {}}
      />,
    )
    const duration = screen.getByRole("textbox", { name: "Duration" })
    await user.click(duration)
    expect(duration).toHaveValue("2:00")
    await user.clear(duration)
    await user.type(duration, "1:30")
    await user.tab()
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({
      simple: expect.objectContaining({ length: { unit: "time", seconds: 90 } }),
    }))

    const bpm = screen.getByRole("textbox", { name: "BPM" })
    await user.clear(bpm)
    await user.type(bpm, "100")
    await user.tab()
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({
      bpm: 100,
    }))

    await user.selectOptions(screen.getByRole("combobox", { name: "Meter" }), "3/4")
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ meter: "3/4" }))
  })

  it("moves the stage when a minicard is clicked", async () => {
    const session = createDefaultSession(() => "set-1")
    const segments = expandSession(session)
    const onSeek = vi.fn()
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
        onEdit={() => {}}
        onChange={() => {}}
        onSeek={onSeek}
      />,
    )
    await user.click(screen.getByRole("button", { name: "Practice 2:00 · 80" }))
    expect(onSeek).toHaveBeenCalledWith(1)
  })

  it("commits a duration draft to the practice that was focused", async () => {
    const session = createDefaultSession(() => "set-1")
    session.simple.practices = 2
    session.simple.restAfterSec = 30
    const segments = expandSession(session)
    const playIndex = segments.findIndex((segment) => segment.kind === "play")
    const restIndex = segments.findIndex((segment) => segment.kind === "rest")
    const playElapsed = segments.slice(0, playIndex).reduce((sum, segment) => sum + segment.durationSec, 0)
    const restElapsed = segments.slice(0, restIndex).reduce((sum, segment) => sum + segment.durationSec, 0)
    const onChange = vi.fn()
    const props = {
      session,
      segments,
      status: "playing" as const,
      onToggle: () => {},
      onJump: () => {},
      onReset: () => {},
      onEdit: () => {},
      onChange,
      onSeek: () => {},
    }
    const user = userEvent.setup()
    const view = render(<Practice {...props} snapshot={snapshotAt(segments, playElapsed)} />)
    const duration = screen.getByRole("textbox", { name: "Duration" })
    await user.click(duration)
    await user.clear(duration)
    await user.type(duration, "1:30")
    view.rerender(<Practice {...props} snapshot={snapshotAt(segments, restElapsed)} />)
    expect(screen.getByTestId("stage-label")).toHaveTextContent("Rest")
    await user.tab()
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({
      simple: expect.objectContaining({
        length: { unit: "time", seconds: 90 },
        restAfterSec: 30,
      }),
    }))
  })

  it("drops an unedited duration draft when playback moves to another segment", async () => {
    const session = createDefaultSession(() => "set-1")
    session.simple.practices = 2
    session.simple.restAfterSec = 30
    const segments = expandSession(session)
    const playIndex = segments.findIndex((segment) => segment.kind === "play")
    const restIndex = segments.findIndex((segment) => segment.kind === "rest")
    const playElapsed = segments.slice(0, playIndex).reduce((sum, segment) => sum + segment.durationSec, 0)
    const restElapsed = segments.slice(0, restIndex).reduce((sum, segment) => sum + segment.durationSec, 0)
    const onChange = vi.fn()
    const props = {
      session,
      segments,
      status: "playing" as const,
      onToggle: () => {},
      onJump: () => {},
      onReset: () => {},
      onEdit: () => {},
      onChange,
      onSeek: () => {},
    }
    const user = userEvent.setup()
    const view = render(<Practice {...props} snapshot={snapshotAt(segments, playElapsed)} />)
    const duration = screen.getByRole("textbox", { name: "Duration" })
    await user.click(duration)
    expect(duration).toHaveValue("2:00")
    view.rerender(<Practice {...props} snapshot={snapshotAt(segments, restElapsed)} />)
    expect(duration).toHaveValue("0:30")
    await user.tab()
    expect(onChange).not.toHaveBeenCalled()
  })

  it("keeps a complex cycle bpm when duration changes", async () => {
    const session = createDefaultSession(() => "cycle-1")
    session.type = "complex"
    session.cycles = [{ id: "cycle-1", length: { unit: "bars", bars: 8 }, restSec: 0, bpm: 90 }]
    const segments = expandSession(session)
    const onChange = vi.fn()
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
        onEdit={() => {}}
        onChange={onChange}
        onSeek={() => {}}
      />,
    )
    const duration = screen.getByRole("textbox", { name: "Duration" })
    await user.click(duration)
    await user.clear(duration)
    await user.type(duration, "1:00")
    await user.tab()
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({
      cycles: [expect.objectContaining({ length: { unit: "time", seconds: 60 }, bpm: 90 })],
    }))
  })
})
