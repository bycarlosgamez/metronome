// @vitest-environment node
import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

const css = readFileSync(new URL("./tokens.css", import.meta.url), "utf8")

describe("tokens", () => {
  it("defines the restyle values", () => {
    expect(css).toContain("--page: #0c0c0c;")
    expect(css).toContain("--surface: #1a1a1a;")
    expect(css).toContain("--ink: #ffffff;")
    expect(css).toContain("--ink-muted: #bdbdbd;")
    expect(css).toContain("--ink-on-yellow: #1a1a1a;")
    expect(css).toContain("--play: #ffffff;")
    expect(css).toContain("--play-ink: #111111;")
    expect(css).toContain("--line: #2e2e2e;")
    expect(css).toContain("--red: #e23b32;")
    expect(css).toContain("--orange: #f07820;")
    expect(css).toContain("--yellow: #f0c429;")
    expect(css).toContain("--green: #2ea85a;")
    expect(css).toContain("--blue: #2f7fe0;")
    expect(css).toContain("--pink: #e24b8a;")
    expect(css).toContain("--rest: #4a5968;")
    expect(css).toContain("--radius-stage: 28px;")
    expect(css).toContain("--radius-card: 16px;")
    expect(css).toContain("--radius-field: 12px;")
    expect(css).toContain("--radius-pill: 999px;")
    expect(css).toContain("--time-size: clamp(4.5rem, 18vw, 9rem);")
  })
})
