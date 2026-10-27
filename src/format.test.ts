import { describe, expect, it } from "vitest"
import { formatClock, formatDuration, parseDuration } from "./format"

describe("formatClock", () => {
  it("formats minutes and hours", () => {
    expect(formatClock(0)).toBe("0:00")
    expect(formatClock(65)).toBe("1:05")
    expect(formatClock(3600)).toBe("1:00:00")
    expect(formatClock(65.9)).toBe("1:05")
  })
})

describe("duration", () => {
  it("formats and parses m:ss", () => {
    expect(formatDuration(90)).toBe("1:30")
    expect(parseDuration("1:30")).toBe(90)
  })
})
