import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { useState } from "react"
import { describe, expect, it, vi } from "vitest"
import { createDefaultSession } from "./session"
import { SubdivisionSheet } from "./SubdivisionSheet"
import type { Session } from "./types"

function setup(open = true) {
  const onChange = vi.fn()
  const onClose = vi.fn()
  function Harness(props: { open: boolean }) {
    const [session, setSession] = useState<Session>(() => createDefaultSession(() => "s1"))
    return (
      <SubdivisionSheet
        session={session}
        open={props.open}
        onClose={onClose}
        onChange={(next) => { setSession(next); onChange(next) }}
      />
    )
  }
  const view = render(<Harness open={open} />)
  const last = (): Session => onChange.mock.calls.at(-1)![0]
  const rerenderOpen = (next: boolean) => view.rerender(<Harness open={next} />)
  return { onChange, onClose, last, rerenderOpen, user: userEvent.setup() }
}

const beat = (n: number) => screen.getByRole("button", { name: `Beat ${n}` })
const option = (name: string) => screen.getByRole("button", { name })

describe("SubdivisionSheet", () => {
  it("shows one tile per beat of the meter, all selected", () => {
    setup()
    for (const n of [1, 2, 3, 4]) expect(beat(n)).toHaveAttribute("aria-pressed", "true")
    expect(screen.queryByRole("button", { name: "Beat 5" })).not.toBeInTheDocument()
  })

  it("sets every beat in two taps and stays open", async () => {
    const { user, last, onClose } = setup()
    await user.click(option("Triplet"))
    expect(last().beats.map((b) => b.subdivision)).toEqual(["triplet", "triplet", "triplet", "triplet"])
    expect(last().beats[0].slots).toEqual(["click-1", "click-1", "click-1"])
    expect(onClose).not.toHaveBeenCalled()
  })

  it("builds 1-2 triplets and 3-4 sixteenths", async () => {
    const { user, last } = setup()
    await user.click(beat(3))
    await user.click(beat(4))
    await user.click(option("Triplet"))
    await user.click(beat(1))
    await user.click(beat(2))
    await user.click(beat(3))
    await user.click(beat(4))
    await user.click(option("16th"))
    expect(last().beats.map((b) => b.subdivision)).toEqual(["triplet", "triplet", "sixteenth", "sixteenth"])
  })

  it("highlights an option only when every selected beat shares it", async () => {
    const { user } = setup()
    await user.click(beat(4))
    await user.click(option("Eighth"))
    expect(option("Eighth")).toHaveAttribute("aria-pressed", "true")
    await user.click(screen.getByRole("button", { name: "All beats" }))
    expect(option("Eighth")).toHaveAttribute("aria-pressed", "false")
    expect(option("Quarter")).toHaveAttribute("aria-pressed", "false")
    for (const n of [1, 2, 3, 4]) expect(beat(n)).toHaveAttribute("aria-pressed", "true")
  })

  it("mutes and unmutes a single click", async () => {
    const { user, last } = setup()
    await user.click(option("Triplet"))
    const dot = screen.getByRole("button", { name: "Beat 2 click 2" })
    expect(dot).toHaveAttribute("aria-pressed", "true")
    await user.click(dot)
    expect(last().beats[1].slots).toEqual(["click-1", "off", "click-1"])
    expect(last().beats[0].slots).toEqual(["click-1", "click-1", "click-1"])
    expect(screen.getByRole("button", { name: "Beat 2 click 2" })).toHaveAttribute("aria-pressed", "false")
    await user.click(screen.getByRole("button", { name: "Beat 2 click 2" }))
    expect(last().beats[1].slots).toEqual(["click-1", "click-1", "click-1"])
  })

  it("clears a beat's mutes when its subdivision changes", async () => {
    const { user, last } = setup()
    await user.click(option("Triplet"))
    await user.click(screen.getByRole("button", { name: "Beat 1 click 3" }))
    await user.click(option("Triplet"))
    expect(last().beats[0].slots).toEqual(["click-1", "click-1", "click-1"])
  })

  it("does nothing when no beat is selected", async () => {
    const { user, onChange } = setup()
    for (const n of [1, 2, 3, 4]) await user.click(beat(n))
    await user.click(option("Triplet"))
    expect(onChange).not.toHaveBeenCalled()
  })

  it("selects every beat again when reopened", async () => {
    const { user, rerenderOpen } = setup()
    await user.click(beat(2))
    expect(beat(2)).toHaveAttribute("aria-pressed", "false")
    rerenderOpen(false)
    rerenderOpen(true)
    expect(beat(2)).toHaveAttribute("aria-pressed", "true")
  })
})
