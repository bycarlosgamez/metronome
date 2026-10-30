import { act, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, describe, expect, it, vi } from "vitest"
import { App } from "./App"
import { clicksInSegment } from "./clock"
import { expandSession } from "./expandSession"
import { createDefaultSession } from "./session"
import { SESSION_KEY } from "./store"

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

  it("plays and pauses with the space bar", async () => {
    vi.stubGlobal("AudioContext", FakeAudioContext)
    const user = userEvent.setup()
    render(<App />)
    await user.keyboard(" ")
    expect(screen.getByRole("button", { name: "Pause" })).toBeInTheDocument()
    await user.keyboard(" ")
    expect(screen.getByRole("button", { name: "Play" })).toBeInTheDocument()
    await user.click(screen.getByTestId("bpm-current"))
    await user.keyboard(" ")
    expect(screen.getByRole("button", { name: "Play" })).toBeInTheDocument()
  })

  it("starts again from the beginning when Play is pressed at the end", async () => {
    const session = createDefaultSession(() => "cycle-1")
    session.practice = "routine"
    session.routine = { ...session.routine, unit: "sec", playDuration: 1 }
    window.localStorage.setItem(SESSION_KEY, JSON.stringify(session))
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
        countIn: true,
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
    const saved = createDefaultSession(() => "cycle-1")
    saved.bpm = bpm
    saved.countIn = true
    saved.practice = "routine"
    saved.routine = { ...saved.routine, unit: "sec", playDuration: 120 }
    const play = expandSession(saved).find((segment) => segment.kind === "play")!
    const marks = clicksInSegment(play)
    const next = marks.find((mark) => mark.offsetSec > intoSec)!
    window.localStorage.setItem(SESSION_KEY, JSON.stringify(saved))
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

  it("updates Start BPM from the BPM card while playing a Climb", async () => {
    const session = createDefaultSession(() => "cycle-1")
    session.type = "time"
    session.meter = "4/4"
    session.bpm = 80
    session.bpmIncrease = 5
    session.time = { seconds: 180, targetBpm: 120, everyUnit: "bars", everySec: 30, everyBars: 4 }
    session.countIn = true
    window.localStorage.setItem(SESSION_KEY, JSON.stringify(session))
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
    const countInSec = (4 * 60) / 80
    await act(async () => {
      tick?.((countInSec + 30) * 1000)
    })
    const bpm = screen.getByTestId("bpm-current")
    expect(bpm).toHaveValue("80")
    await user.clear(bpm)
    await user.type(bpm, "150")
    await user.tab()
    expect(screen.getByTestId("bpm-current")).toHaveValue("150")
  })

  it("keeps playing an Off session and keeps a typed BPM at the same moment", async () => {
    vi.stubGlobal("AudioContext", FakeAudioContext)
    vi.spyOn(performance, "now").mockReturnValue(0)
    let tick: FrameRequestCallback | null = null
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
      tick ??= callback
      return 1
    })
    vi.stubGlobal("cancelAnimationFrame", () => {})
    const session = createDefaultSession(() => "cycle-1")
    session.bpm = 80
    session.countIn = true
    window.localStorage.setItem(SESSION_KEY, JSON.stringify(session))
    const user = userEvent.setup()
    render(<App />)
    await user.click(screen.getByRole("button", { name: "Play" }))
    const countInSec = (4 * 60) / 80
    await act(async () => {
      tick?.((countInSec + 10) * 1000)
    })
    expect(screen.getByRole("button", { name: "Pause" })).toBeInTheDocument()
    const bpm = screen.getByTestId("bpm-current")
    await user.clear(bpm)
    await user.type(bpm, "100")
    await user.tab()
    expect(screen.getByTestId("player-number")).toHaveTextContent("0:13")
    expect(screen.getByRole("button", { name: "Pause" })).toBeInTheDocument()
  })

  it("keeps the current Climb step when Start BPM changes while playing", async () => {
    vi.stubGlobal("AudioContext", FakeAudioContext)
    vi.spyOn(performance, "now").mockReturnValue(0)
    let tick: FrameRequestCallback | null = null
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
      tick ??= callback
      return 1
    })
    vi.stubGlobal("cancelAnimationFrame", () => {})
    const session = createDefaultSession(() => "cycle-1")
    session.practice = "climb"
    session.bpm = 110
    session.bpmIncrease = 5
    session.time = { ...session.time, targetBpm: 130, everyUnit: "bars", everyBars: 4 }
    window.localStorage.setItem(SESSION_KEY, JSON.stringify(session))
    const user = userEvent.setup()
    render(<App />)
    await user.click(screen.getByRole("button", { name: "Play" }))
    // 4 bars at 110 is about 8.7s, so 10s is early in the second step (115)
    await act(async () => {
      tick?.(10_000)
    })
    const bpm = screen.getByTestId("bpm-current")
    expect(screen.getByTestId("bpm-now")).toHaveTextContent("115")
    await user.clear(bpm)
    await user.type(bpm, "60")
    await user.tab()
    // 4 bars at 60 is 16s, so without carrying the step 10s would land back on the first step (60)
    expect(screen.getByTestId("bpm-now")).toHaveTextContent("65")
  })

  it("keeps the current Climb step when Every changes while playing", async () => {
    vi.stubGlobal("AudioContext", FakeAudioContext)
    vi.spyOn(performance, "now").mockReturnValue(0)
    let tick: FrameRequestCallback | null = null
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
      tick ??= callback
      return 1
    })
    vi.stubGlobal("cancelAnimationFrame", () => {})
    const session = createDefaultSession(() => "cycle-1")
    session.practice = "climb"
    session.bpm = 110
    session.bpmIncrease = 5
    session.time = { ...session.time, targetBpm: 130, everyUnit: "sec", everySec: 120 }
    window.localStorage.setItem(SESSION_KEY, JSON.stringify(session))
    const user = userEvent.setup()
    render(<App />)
    await user.click(screen.getByRole("button", { name: "Play" }))
    await act(async () => {
      tick?.(150_000)
    })
    expect(screen.getByTestId("bpm-now")).toHaveTextContent("115")
    const minutes = screen.getByRole("textbox", { name: "Every minutes" })
    await user.clear(minutes)
    await user.type(minutes, "1")
    await user.tab()
    // With 1:00 windows, 150s would be the third step (120) without carrying the step
    expect(screen.getByTestId("bpm-now")).toHaveTextContent("115")
    // The practice clock keeps counting from where it was; only the climb position moves
    expect(screen.getByTestId("player-number")).toHaveTextContent("2:30")
  })
})
