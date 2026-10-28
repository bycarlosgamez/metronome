import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"
import { snapshotAt } from "./clock"
import { expandSession } from "./expandSession"
import { Practice } from "./Practice"
import { createDefaultSession } from "./session"
import type { Session } from "./types"

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
    expect(document.querySelector(".strip")).not.toBeInTheDocument()
    expect(screen.queryByText("Left")).not.toBeInTheDocument()
    expect(screen.getByText("Elapsed")).toBeInTheDocument()
    expect(screen.getByTestId("footer-set")).toHaveTextContent("1 / 2")
    await user.click(screen.getByRole("button", { name: "Edit" }))
    expect(onEdit).toHaveBeenCalledOnce()
  })

  it("shows the following stretch during a rest", () => {
    const session = createDefaultSession(() => "set-1")
    session.type = "simple"
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
    expect(screen.queryByRole("button", { name: "Time signature" })).not.toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Pause" })).toBeInTheDocument()
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
    session.type = "simple"
    const segments = expandSession(session)
    const onChange = vi.fn()
    const user = userEvent.setup()
    const { rerender } = render(
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

    expect(screen.queryByRole("combobox", { name: "Beat click" })).not.toBeInTheDocument()
    expect(screen.queryByText("Time signature")).not.toBeInTheDocument()
    expect(screen.queryByText("Subdivision")).not.toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "Time signature" }))
    await user.selectOptions(screen.getByRole("combobox", { name: "Beats" }), "7")
    await user.selectOptions(screen.getByRole("combobox", { name: "Note" }), "8")
    const signed = onChange.mock.calls.at(-1)?.[0]
    expect(signed.meter).toBe("7/8")
    rerender(
      <Practice
        session={signed}
        segments={expandSession(signed)}
        snapshot={snapshotAt(expandSession(signed), 0)}
        status="stopped"
        onToggle={() => {}}
        onJump={() => {}}
        onReset={() => {}}
        onEdit={() => {}}
        onChange={onChange}
        onSeek={() => {}}
      />,
    )
    expect(screen.getByRole("button", { name: "Time signature" })).toHaveTextContent("7/8")
    expect(screen.getByRole("combobox", { name: "Beats" })).toBeInTheDocument()
    await user.keyboard("{Escape}")
    expect(screen.queryByRole("combobox", { name: "Beats" })).not.toBeInTheDocument()
  })

  it("moves the stage when a minicard is clicked", async () => {
    const session = createDefaultSession(() => "set-1")
    session.type = "simple"
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
    session.type = "simple"
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
    session.type = "simple"
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

  it("commits a between rest without changing the rest after a practice", async () => {
    const session = createDefaultSession(() => "set-1")
    session.type = "simple"
    session.simple.practices = 2
    session.simple.repeatRound = true
    session.simple.rounds = 2
    session.simple.restAfterSec = 5
    session.simple.restBetweenSec = 30
    const segments = expandSession(session)
    const restIndex = segments.findIndex((segment) => segment.restRole === "between")
    const elapsed = segments.slice(0, restIndex).reduce((sum, segment) => sum + segment.durationSec, 0)
    const onChange = vi.fn()
    const user = userEvent.setup()
    render(
      <Practice
        session={session}
        segments={segments}
        snapshot={snapshotAt(segments, elapsed)}
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
    const next = onChange.mock.calls.at(-1)?.[0]
    expect(next.simple.restBetweenSec).toBe(60)
    expect(next.simple.restAfterSec).toBe(5)
  })

  it("commits one cycle rest", async () => {
    const session = createDefaultSession(() => "cycle-1")
    session.type = "complex"
    session.cycles = [
      { id: "a", length: { unit: "time", seconds: 30 }, restSec: 10 },
      { id: "b", length: { unit: "time", seconds: 45 }, restSec: 0 },
    ]
    const segments = expandSession(session)
    const restIndex = segments.findIndex((segment) => segment.kind === "rest" && segment.cycleIndex === 0)
    const elapsed = segments.slice(0, restIndex).reduce((sum, segment) => sum + segment.durationSec, 0)
    const onChange = vi.fn()
    const user = userEvent.setup()
    render(
      <Practice
        session={session}
        segments={segments}
        snapshot={snapshotAt(segments, elapsed)}
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
    await user.type(duration, "0:20")
    await user.tab()
    const next = onChange.mock.calls.at(-1)?.[0]
    expect(next.cycles[0].restSec).toBe(20)
    expect(next.cycles[1].restSec).toBe(0)
    expect(next.bpm).toBe(session.bpm)
  })

  it("writes the session tempo so a later practice lands on the typed BPM", async () => {
    const session = createDefaultSession(() => "cycle-1")
    session.type = "complex"
    session.bpmIncrease = 5
    session.cycles = [0, 1, 2, 3].map((index) => ({
      id: `cycle-${index}`,
      length: { unit: "time" as const, seconds: 30 },
      restSec: 0,
    }))
    const segments = expandSession(session)
    const playIndex = segments.findIndex((segment) => segment.kind === "play" && segment.cycleIndex === 3)
    const elapsed = segments.slice(0, playIndex).reduce((sum, segment) => sum + segment.durationSec, 0)
    const onChange = vi.fn()
    const user = userEvent.setup()
    render(
      <Practice
        session={session}
        segments={segments}
        snapshot={snapshotAt(segments, elapsed)}
        status="stopped"
        onToggle={() => {}}
        onJump={() => {}}
        onReset={() => {}}
        onEdit={() => {}}
        onChange={onChange}
        onSeek={() => {}}
      />,
    )
    const bpm = screen.getByRole("textbox", { name: "BPM" })
    await user.click(bpm)
    await user.clear(bpm)
    await user.type(bpm, "100")
    await user.tab()
    const next = onChange.mock.calls.at(-1)?.[0]
    expect(next.bpm).toBe(85)
    expect(next.cycles[3].bpm).toBeUndefined()
  })

  it("writes the session tempo so a later round practice lands on the typed BPM", async () => {
    const session = createDefaultSession(() => "cycle-1")
    session.type = "complex"
    session.bpmIncrease = 5
    session.complex.increaseEvery = "round"
    session.complex.repeatRound = true
    session.complex.rounds = 3
    session.cycles = [0, 1, 2].map((index) => ({
      id: `cycle-${index}`,
      length: { unit: "time" as const, seconds: 30 },
      restSec: 0,
    }))
    const segments = expandSession(session)
    const playIndex = segments.findIndex((segment) => segment.kind === "play" && segment.cycleIndex === 7)
    const elapsed = segments.slice(0, playIndex).reduce((sum, segment) => sum + segment.durationSec, 0)
    const onChange = vi.fn()
    const user = userEvent.setup()
    render(
      <Practice
        session={session}
        segments={segments}
        snapshot={snapshotAt(segments, elapsed)}
        status="stopped"
        onToggle={() => {}}
        onJump={() => {}}
        onReset={() => {}}
        onEdit={() => {}}
        onChange={onChange}
        onSeek={() => {}}
      />,
    )
    const bpm = screen.getByRole("textbox", { name: "BPM" })
    await user.click(bpm)
    await user.clear(bpm)
    await user.type(bpm, "100")
    await user.tab()
    const next = onChange.mock.calls.at(-1)?.[0]
    expect(next.bpm).toBe(90)
  })

  it("writes a complex between rest onto the round", async () => {
    const session = createDefaultSession(() => "cycle-1")
    session.type = "complex"
    session.complex.repeatRound = true
    session.complex.rounds = 2
    session.complex.restBetweenSec = 30
    session.cycles = [0, 1].map((index) => ({
      id: `cycle-${index}`,
      length: { unit: "time" as const, seconds: 30 },
      restSec: 5,
    }))
    const segments = expandSession(session)
    const restIndex = segments.findIndex((segment) => segment.restRole === "between")
    const elapsed = segments.slice(0, restIndex).reduce((sum, segment) => sum + segment.durationSec, 0)
    const onChange = vi.fn()
    const user = userEvent.setup()
    render(
      <Practice
        session={session}
        segments={segments}
        snapshot={snapshotAt(segments, elapsed)}
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
    const next = onChange.mock.calls.at(-1)?.[0]
    expect(next.complex.restBetweenSec).toBe(60)
    expect(next.cycles.map((cycle: { restSec: number }) => cycle.restSec)).toEqual([5, 5])
  })

  it("writes a cycle tempo without changing the session BPM", async () => {
    const session = createDefaultSession(() => "cycle-1")
    session.type = "complex"
    session.cycles = [{ id: "cycle-1", length: { unit: "time", seconds: 60 }, restSec: 0, bpm: 90 }]
    const segments = expandSession(session)
    const playIndex = segments.findIndex((segment) => segment.kind === "play" && segment.cycleIndex === 0)
    const elapsed = segments.slice(0, playIndex).reduce((sum, segment) => sum + segment.durationSec, 0)
    const onChange = vi.fn()
    const user = userEvent.setup()
    render(
      <Practice
        session={session}
        segments={segments}
        snapshot={snapshotAt(segments, elapsed)}
        status="stopped"
        onToggle={() => {}}
        onJump={() => {}}
        onReset={() => {}}
        onEdit={() => {}}
        onChange={onChange}
        onSeek={() => {}}
      />,
    )
    const bpm = screen.getByRole("textbox", { name: "BPM" })
    await user.click(bpm)
    await user.clear(bpm)
    await user.type(bpm, "100")
    await user.tab()
    const next = onChange.mock.calls.at(-1)?.[0]
    expect(next.bpm).toBe(80)
    expect(next.cycles[0].bpm).toBe(100)
  })

  it("shows one time play and keeps a later typed BPM on screen", async () => {
    const session = createDefaultSession(() => "cycle-1")
    session.type = "time"
    session.bpm = 80
    session.bpmIncrease = 5
    session.time = { seconds: 120, increaseEvery: "time", everySec: 30, everyBars: 4 }
    const segments = expandSession(session)
    expect(segments.map((segment) => segment.kind)).toEqual(["count-in", "play"])
    const onChange = vi.fn()
    const user = userEvent.setup()
    const { rerender } = render(
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
    expect(screen.getByTestId("footer-set")).toHaveTextContent("1 / 2")
    expect(screen.getByRole("textbox", { name: "BPM" })).toHaveValue("80")
    rerender(
      <Practice
        session={session}
        segments={segments}
        snapshot={snapshotAt(segments, 63)}
        status="stopped"
        onToggle={() => {}}
        onJump={() => {}}
        onReset={() => {}}
        onEdit={() => {}}
        onChange={onChange}
        onSeek={() => {}}
      />,
    )
    expect(screen.getByTestId("footer-set")).toHaveTextContent("2 / 2")
    const bpm = screen.getByRole("textbox", { name: "BPM" })
    expect(bpm).toHaveValue("90")
    await user.click(bpm)
    await user.clear(bpm)
    await user.type(bpm, "100")
    await user.tab()
    expect(onChange.mock.calls.at(-1)?.[0].bpm).toBe(90)
  })

  it("writes a time duration from the count-in", async () => {
    const session = createDefaultSession(() => "cycle-1")
    session.type = "time"
    session.time.increaseEvery = "time"
    session.time.seconds = 120
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
    expect(screen.getByTestId("stage-label")).toHaveTextContent("Practice")
    const duration = screen.getByRole("textbox", { name: "Duration" })
    await user.click(duration)
    await user.clear(duration)
    await user.type(duration, "1:00")
    await user.tab()
    expect(onChange.mock.calls.at(-1)?.[0].time.seconds).toBe(60)
  })

  it("writes a time duration from the practice page", async () => {
    const session = createDefaultSession(() => "cycle-1")
    session.type = "time"
    session.time.increaseEvery = "time"
    session.time.seconds = 120
    const segments = expandSession(session)
    const playIndex = segments.findIndex((segment) => segment.kind === "play")
    const elapsed = segments.slice(0, playIndex).reduce((sum, segment) => sum + segment.durationSec, 0)
    const onChange = vi.fn()
    const user = userEvent.setup()
    render(
      <Practice
        session={session}
        segments={segments}
        snapshot={snapshotAt(segments, elapsed)}
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
    expect(onChange.mock.calls.at(-1)?.[0].time.seconds).toBe(60)
  })

  it("shows one dot per beat while the eighths play", () => {
    const session = createDefaultSession(() => "cycle-1")
    session.subdivision = "eighth"
    session.slots = ["click-1", "click-2"]
    const segments = expandSession(session)
    const playIndex = segments.findIndex((segment) => segment.kind === "play")
    const elapsed = segments.slice(0, playIndex).reduce((sum, segment) => sum + segment.durationSec, 0)
    render(
      <Practice
        session={session}
        segments={segments}
        snapshot={snapshotAt(segments, elapsed + 0.4)}
        status="stopped"
        onToggle={() => {}}
        onJump={() => {}}
        onReset={() => {}}
        onEdit={() => {}}
        onChange={() => {}}
        onSeek={() => {}}
      />,
    )
    expect(screen.getAllByTestId(/beat-/)).toHaveLength(4)
    expect(screen.getByTestId("beat-1")).toHaveAttribute("data-current", "true")
  })

  it("shows one dot per beat in a 16/8 play bar", () => {
    const session = createDefaultSession(() => "cycle-1")
    session.meter = "16/8"
    const segments = expandSession(session)
    const playIndex = segments.findIndex((segment) => segment.kind === "play")
    const elapsed = segments.slice(0, playIndex).reduce((sum, segment) => sum + segment.durationSec, 0)
    render(
      <Practice
        session={session}
        segments={segments}
        snapshot={snapshotAt(segments, elapsed)}
        status="stopped"
        onToggle={() => {}}
        onJump={() => {}}
        onReset={() => {}}
        onEdit={() => {}}
        onChange={() => {}}
        onSeek={() => {}}
      />,
    )
    expect(screen.getAllByTestId(/beat-/)).toHaveLength(16)
  })

  it("does not show slot clicks on the practice stage", () => {
    const session = createDefaultSession(() => "cycle-1")
    session.subdivision = "sixteenth"
    session.slots = ["click-1", "click-1", "click-1", "click-1"]
    const segments = expandSession(session)
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
        onSeek={() => {}}
      />,
    )
    expect(screen.queryByRole("combobox", { name: "e click" })).not.toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Subdivision" })).toBeInTheDocument()
  })

  it("orders the clock, the two buttons, BPM, the dots, and Play", () => {
    const session = createDefaultSession(() => "cycle-1")
    const segments = expandSession(session)
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
        onSeek={() => {}}
      />,
    )
    const stage = document.querySelector(".stage")!
    expect(screen.getByRole("button", { name: "Time signature" })).toHaveTextContent("4/4")
    const nodes = [
      screen.getByTestId("stage-time"),
      screen.getByRole("button", { name: "Time signature" }),
      screen.getByRole("button", { name: "Subdivision" }),
      screen.getByRole("button", { name: "BPM increase" }),
      screen.getByRole("textbox", { name: "BPM" }),
      screen.getByTestId("beat-1"),
      screen.getByRole("button", { name: "Play" }),
    ]
    nodes.forEach((node) => expect(stage.contains(node)).toBe(true))
    for (let index = 1; index < nodes.length; index += 1) {
      expect(nodes[index - 1].compareDocumentPosition(nodes[index]) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    }
  })

  it("hides the cards only for a Time session", () => {
    const session = createDefaultSession(() => "cycle-1")
    session.type = "simple"
    const segments = expandSession(session)
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
        onSeek={() => {}}
      />,
    )
    expect(document.querySelector(".strip")).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "BPM increase" })).not.toBeInTheDocument()
  })

  it("counts an Off play upward and edits the climb from the third button", async () => {
    const user = userEvent.setup()
    const session = createDefaultSession(() => "cycle-1")
    session.bpm = 80
    const segments = expandSession(session)
    const countIn = segments[0].durationSec
    const onChange = vi.fn()
    const { rerender } = render(
      <Practice
        session={session}
        segments={segments}
        snapshot={snapshotAt(segments, countIn + 2)}
        status="stopped"
        onToggle={() => {}}
        onJump={() => {}}
        onReset={() => {}}
        onEdit={() => {}}
        onChange={onChange}
        onSeek={() => {}}
      />,
    )
    const clock = screen.getByTestId("stage-time")
    expect(clock).toHaveAccessibleName("Played")
    expect(clock).toHaveValue("0:02")
    await user.click(clock)
    await user.tab()
    expect(onChange).not.toHaveBeenCalled()
    const increase = screen.getByRole("button", { name: "BPM increase" })
    expect(increase).toHaveAccessibleDescription("Off")
    expect(increase).toHaveTextContent("∞")
    await user.click(increase)
    await user.click(screen.getByRole("button", { name: "Time", exact: true }))
    const timed = onChange.mock.calls.at(-1)?.[0]
    expect(timed.time.increaseEvery).toBe("time")
    expect(timed.time.seconds).toBe(120)
    rerender(
      <Practice
        session={timed}
        segments={expandSession(timed)}
        snapshot={snapshotAt(expandSession(timed), 0)}
        status="stopped"
        onToggle={() => {}}
        onJump={() => {}}
        onReset={() => {}}
        onEdit={() => {}}
        onChange={onChange}
        onSeek={() => {}}
      />,
    )
    expect(screen.getByRole("button", { name: "Time", exact: true })).toHaveAttribute("aria-pressed", "true")
    expect(screen.getByRole("textbox", { name: "Amount" })).toHaveValue("0")
    expect(screen.getByRole("textbox", { name: "Every" })).toHaveValue("0:30")
    expect(screen.getByRole("textbox", { name: "End" })).toHaveValue("2:00")
    expect(screen.getByText("Left")).toBeInTheDocument()

    const show = (next: Session) => {
      const nextSegments = expandSession(next)
      rerender(
        <Practice
          session={next}
          segments={nextSegments}
          snapshot={snapshotAt(nextSegments, 0)}
          status="stopped"
          onToggle={() => {}}
          onJump={() => {}}
          onReset={() => {}}
          onEdit={() => {}}
          onChange={onChange}
          onSeek={() => {}}
        />,
      )
    }
    onChange.mockImplementation(show)

    const end = screen.getByRole("textbox", { name: "End" })
    await user.clear(end)
    await user.type(end, "1:00")
    await user.tab()
    const ended = onChange.mock.calls.at(-1)?.[0]
    expect(ended.time.seconds).toBe(60)
    show(ended)
    expect(screen.getByRole("textbox", { name: "End" })).toHaveValue("1:00")

    const every = screen.getByRole("textbox", { name: "Every" })
    await user.clear(every)
    await user.type(every, "0:45")
    await user.tab()
    const everyTime = onChange.mock.calls.at(-1)?.[0]
    expect(everyTime.time.everySec).toBe(45)

    await user.click(screen.getByRole("button", { name: "Bars", exact: true }))
    const bars = onChange.mock.calls.at(-1)?.[0]
    show(bars)
    const everyBars = screen.getByRole("textbox", { name: "Every" })
    await user.clear(everyBars)
    await user.type(everyBars, "8")
    await user.tab()
    expect(onChange.mock.calls.at(-1)?.[0].time.everyBars).toBe(8)

    await user.click(screen.getByRole("button", { name: "Off", exact: true }))
    const stopped = onChange.mock.calls.at(-1)?.[0]
    expect(stopped.time.increaseEvery).toBe("off")
    expect(stopped.time.seconds).toBe(60)
    expect(screen.queryByRole("button", { name: "Time", exact: true })).not.toBeInTheDocument()
  })

  it("saves a typed End when Play closes the Time panel", async () => {
    const user = userEvent.setup()
    const session = createDefaultSession(() => "cycle-1")
    const segments = expandSession(session)
    const onChange = vi.fn()
    const { rerender } = render(
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
    await user.click(screen.getByRole("button", { name: "BPM increase" }))
    await user.click(screen.getByRole("button", { name: "Time", exact: true }))
    const timed = onChange.mock.calls.at(-1)?.[0]
    const timedSegments = expandSession(timed)
    rerender(
      <Practice
        session={timed}
        segments={timedSegments}
        snapshot={snapshotAt(timedSegments, 0)}
        status="stopped"
        onToggle={() => {}}
        onJump={() => {}}
        onReset={() => {}}
        onEdit={() => {}}
        onChange={onChange}
        onSeek={() => {}}
      />,
    )
    const end = screen.getByRole("textbox", { name: "End" })
    await user.clear(end)
    await user.type(end, "3:00")
    const blur = HTMLElement.prototype.blur
    HTMLElement.prototype.blur = function () {}
    try {
      screen.getByRole("button", { name: "Play" }).dispatchEvent(
        new Event("pointerdown", { bubbles: true }),
      )
    } finally {
      HTMLElement.prototype.blur = blur
    }
    expect(onChange.mock.calls.at(-1)?.[0].time.seconds).toBe(180)
  })

  it("describes the current time signature and subdivision", async () => {
    const user = userEvent.setup()
    const session = createDefaultSession(() => "cycle-1")
    const segments = expandSession(session)
    const { rerender } = render(
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
        onSeek={() => {}}
      />,
    )
    expect(screen.getByRole("button", { name: "Time signature" })).toHaveAccessibleDescription("4/4")
    expect(screen.getByRole("button", { name: "Subdivision" })).toHaveAccessibleDescription("Quarter")
    const next = { ...session, meter: "7/8" as const, subdivision: "quintuplet" as const }
    const nextSegments = expandSession(next)
    rerender(
      <Practice
        session={next}
        segments={nextSegments}
        snapshot={snapshotAt(nextSegments, 0)}
        status="stopped"
        onToggle={() => {}}
        onJump={() => {}}
        onReset={() => {}}
        onEdit={() => {}}
        onChange={() => {}}
        onSeek={() => {}}
      />,
    )
    expect(screen.getByRole("button", { name: "Time signature" })).toHaveAccessibleDescription("7/8")
    expect(screen.getByRole("button", { name: "Subdivision" })).toHaveAccessibleDescription("Quintuplet")
    await user.click(screen.getByRole("button", { name: "Subdivision" }))
    expect(screen.getByRole("button", { name: "Quintuplet" })).toHaveAttribute("aria-pressed", "true")
    expect(screen.getByRole("button", { name: "Quarter" })).toHaveAttribute("aria-pressed", "false")
  })

  it("chooses a quintuplet from the subdivision panel", async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    const session = createDefaultSession(() => "cycle-1")
    session.click = "click-2"
    const segments = expandSession(session)
    const { rerender } = render(
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
    const button = screen.getByRole("button", { name: "Subdivision" })
    expect(button).not.toHaveTextContent("5")
    await user.click(button)
    await user.click(screen.getByRole("button", { name: "Quintuplet" }))
    const next = onChange.mock.calls.at(-1)?.[0]
    expect(next.subdivision).toBe("quintuplet")
    expect(next.slots).toEqual(["click-2", "click-2", "click-2", "click-2", "click-2"])
    rerender(
      <Practice
        session={next}
        segments={expandSession(next)}
        snapshot={snapshotAt(expandSession(next), 0)}
        status="stopped"
        onToggle={() => {}}
        onJump={() => {}}
        onReset={() => {}}
        onEdit={() => {}}
        onChange={onChange}
        onSeek={() => {}}
      />,
    )
    expect(screen.getByRole("button", { name: "Subdivision" })).toHaveTextContent("5")
    expect(screen.queryByRole("button", { name: "Quintuplet" })).not.toBeInTheDocument()
  })
})
