import { describe, expect, it } from "vitest"
import { formatClock } from "./format"

describe("formatClock", () => {
  it("formats minutes and hours", () => {
    expect(formatClock(0)).toBe("0:00")
    expect(formatClock(65)).toBe("1:05")
    expect(formatClock(3600)).toBe("1:00:00")
    expect(formatClock(65.9)).toBe("1:05")
  })
})
