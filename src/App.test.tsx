import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, describe, expect, it, vi } from "vitest"
import { App } from "./App"

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
      buffer: null,
      connect() {},
      start() {},
      stop() {},
    }
  }
}

describe("App", () => {
  afterEach(() => {
    vi.unstubAllGlobals()
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
})
