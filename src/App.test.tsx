import { act, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, describe, expect, it, vi } from "vitest"
import { App } from "./App"
import { clicksInSegment } from "./clock"
import { expandSession } from "./expandSession"
import { SESSION_KEY } from "./store"
import type { Session } from "./types"

class FakeAudioContext {
  state = "running"
  currentTime = 0
  destination = {}
  sampleRate = 44100
  resume() {
    return Promise.resolve()
  }
  createBuffer(_channels: number, length: number) {
    return { getChannelData: () => new Float32Array(length) }
  }
  createBufferSource() {
    return {
      buffer: null as AudioBuffer | null,
      connect() {},
      start() {},
      stop() {},
    }
  }
}

describe("App", () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
    window.localStorage.removeItem(SESSION_KEY)
  })

  it("shows the Mentronome wordmark", () => {
    render(<App />)
    expect(screen.getByRole("heading", { name: "Mentronome" })).toBeInTheDocument()
  })

  it("stops playback when Edit opens", async () => {
    vi.stubGlobal("AudioContext", FakeAudioContext)
    const user = userEvent.setup()
    render(<App />)
    await user.click(screen.getByRole("button", { name: "Play" }))
    await user.click(screen.getByRole("button", { name: "Edit" }))
    expect(screen.getByRole("button", { name: "Add set" })).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "Done" }))
    expect(screen.getByRole("button", { name: "Play" })).toBeInTheDocument()
  })

  it("returns elapsed to the start when Edit opens", async () => {
    vi.stubGlobal("AudioContext", FakeAudioContext)
    vi.spyOn(performance, "now").mockReturnValue(0)
    let tick: FrameRequestCallback | null = null
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
      tick ??= callback
      return 1
    })
    vi.stubGlobal("cancelAnimationFrame", () => {})
    const user = userEvent.setup()
    render(<App />)
    await user.click(screen.getByRole("button", { name: "Play" }))
    await act(async () => {
      tick?.(10_000)
    })
    await user.click(screen.getByRole("button", { name: "Edit" }))
    await user.clear(screen.getByLabelText("Duration"))
    await user.type(screen.getByLabelText("Duration"), "0:01")
    await user.tab()
    await user.click(screen.getByRole("button", { name: "Done" }))
    expect(screen.getByText("Elapsed").nextElementSibling).toHaveTextContent("0:00")
  })

  it("starts again from the beginning when Play is pressed at the end", async () => {
    window.localStorage.setItem(
      SESSION_KEY,
      JSON.stringify({
        name: "Practice",
        meter: "4/4",
        perSetMeter: false,
        bpmIncrease: 0,
        click: "click-1",
        sets: [
          {
            id: "set-1",
            name: "Set 1",
            durationSec: 1,
            bpm: 80,
            restSec: 0,
            repeats: 1,
            color: "red",
            meter: "4/4",
          },
        ],
      }),
    )
    vi.stubGlobal("AudioContext", FakeAudioContext)
    vi.spyOn(performance, "now").mockReturnValue(0)
    let tick: FrameRequestCallback | null = null
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
      tick ??= callback
      return 1
    })
    vi.stubGlobal("cancelAnimationFrame", () => {})
    const user = userEvent.setup()
    render(<App />)
    await user.click(screen.getByRole("button", { name: "Play" }))
    await act(async () => {
      tick?.(10_000)
    })
    await user.click(screen.getByRole("button", { name: "Play" }))
    await act(async () => {
      tick?.(10_100)
    })
    expect(screen.getByRole("button", { name: "Pause" })).toBeInTheDocument()
  })

  it("starts the downbeat when playback enters a segment a few milliseconds late", async () => {
    const countInSec = (4 * 60) / 80
    const lateSec = 0.008
    const nodes: { when: number; stopped: boolean }[] = []
    let armedAt = 0
    let tick: FrameRequestCallback | null = null
    class LateBoundaryAudioContext extends FakeAudioContext {
      currentTime = countInSec
      createBufferSource() {
        const node = {
          buffer: null as AudioBuffer | null,
          when: Number.NaN,
          stopped: false,
          connect() {},
          start(when = 0) {
            node.when = when
          },
          stop() {
            node.stopped = true
          },
        }
        nodes.push(node)
        return node
      }
    }
    window.localStorage.setItem(
      SESSION_KEY,
      JSON.stringify({
        name: "Practice",
        meter: "4/4",
        perSetMeter: false,
        bpmIncrease: 0,
        click: "click-1",
        sets: [
          {
            id: "set-1",
            name: "Set 1",
            durationSec: 120,
            bpm: 80,
            restSec: 0,
            repeats: 1,
            color: "red",
            meter: "4/4",
          },
        ],
      }),
    )
    vi.stubGlobal("AudioContext", LateBoundaryAudioContext)
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
      if (!tick) {
        tick = callback
        armedAt = performance.now()
      }
      return 1
    })
    vi.stubGlobal("cancelAnimationFrame", () => {})
    const user = userEvent.setup()
    render(<App />)
    await user.click(screen.getByRole("button", { name: "Play" }))
    const scheduledBefore = nodes.length
    await act(async () => {
      tick?.(armedAt + (countInSec + lateSec) * 1000)
    })
    const downbeat = nodes[scheduledBefore]
    expect(downbeat.when).toBe(countInSec)
    expect(downbeat.stopped).toBe(false)
  })

  it("keeps later clicks on time when the audio clock is behind the playhead", async () => {
    const bpm = 80
    const countInSec = (4 * 60) / bpm
    const intoSec = 10
    const nodes: { when: number; started: boolean }[] = []
    let armedAt = 0
    let tick: FrameRequestCallback | null = null
    class ClockBehindAudioContext extends FakeAudioContext {
      currentTime = 0
      createBufferSource() {
        const node = {
          buffer: null as AudioBuffer | null,
          when: Number.NaN,
          started: false,
          connect() {},
          start(when = 0) {
            node.when = when
            node.started = true
          },
          stop() {},
        }
        nodes.push(node)
        return node
      }
    }
    const session: Session = {
      name: "Practice",
      meter: "4/4",
      perSetMeter: false,
      bpmIncrease: 0,
      click: "click-1",
      sets: [
        {
          id: "set-1",
          name: "Set 1",
          durationSec: 120,
          bpm,
          restSec: 0,
          repeats: 1,
          color: "red",
          meter: "4/4",
        },
      ],
    }
    const play = expandSession(session).find((segment) => segment.kind === "play")!
    const marks = clicksInSegment(play)
    const next = marks.find((mark) => mark.offsetSec > intoSec)!
    window.localStorage.setItem(SESSION_KEY, JSON.stringify(session))
    vi.spyOn(performance, "now").mockReturnValue(0)
    vi.stubGlobal("AudioContext", ClockBehindAudioContext)
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
      if (!tick) {
        tick = callback
        armedAt = performance.now()
      }
      return 1
    })
    vi.stubGlobal("cancelAnimationFrame", () => {})
    const user = userEvent.setup()
    render(<App />)
    await user.click(screen.getByRole("button", { name: "Play" }))
    const scheduledBefore = nodes.length
    await act(async () => {
      tick?.(armedAt + (countInSec + intoSec) * 1000)
    })
    const playNodes = nodes.slice(scheduledBefore)
    expect(next.offsetSec).toBe(10.5)
    expect(playNodes[0].started).toBe(false)
    expect(playNodes[marks.indexOf(next)].started).toBe(true)
    expect(playNodes[marks.indexOf(next)].when).toBe(0.5)
    expect(playNodes.some((node) => node.started && node.when < 0)).toBe(false)
  })
})
