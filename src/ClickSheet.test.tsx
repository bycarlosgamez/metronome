import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"
import { ClickSheet } from "./ClickSheet"
import { createDefaultSession } from "./session"
import type { Session } from "./types"

function setup(overrides: Partial<Session> = {}) {
  const session: Session = { ...createDefaultSession(() => "s1"), ...overrides }
  const onChange = vi.fn()
  render(<ClickSheet session={session} open onClose={vi.fn()} onChange={onChange} />)
  return { onChange, last: (): Session => onChange.mock.calls.at(-1)![0], user: userEvent.setup() }
}

describe("ClickSheet", () => {
  it("marks the current sound and accent", () => {
    setup()
    expect(screen.getByRole("button", { name: "Sound 1" })).toHaveAttribute("aria-pressed", "true")
    expect(screen.getByRole("button", { name: "Sound 3" })).toHaveAttribute("aria-pressed", "false")
    expect(screen.getByRole("button", { name: "Accent beat 1" })).toHaveAttribute("aria-pressed", "true")
  })

  it("changes the sound of every click in the bar and keeps mutes", async () => {
    const { user, last } = setup({
      beats: [
        { subdivision: "triplet", slots: ["click-1", "off", "click-2"] },
        { subdivision: "quarter", slots: ["click-1"] },
        { subdivision: "quarter", slots: ["click-4"] },
        { subdivision: "quarter", slots: ["off"] },
      ],
    })
    await user.click(screen.getByRole("button", { name: "Sound 3" }))
    expect(last().click).toBe("click-3")
    expect(last().beats.map((beat) => beat.slots)).toEqual([
      ["click-3", "off", "click-3"], ["click-3"], ["click-3"], ["off"],
    ])
  })

  it("turns the beat-1 accent off", async () => {
    const { user, last } = setup()
    await user.click(screen.getByRole("button", { name: "Accent beat 1" }))
    expect(last().accent).toBe(false)
  })
})
