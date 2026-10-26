import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { App } from "./App"

describe("App", () => {
  it("shows the Mentronome wordmark", () => {
    render(<App />)
    expect(screen.getByRole("heading", { name: "Mentronome" })).toBeInTheDocument()
  })
})
