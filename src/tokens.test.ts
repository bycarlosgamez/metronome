// @vitest-environment node
import { describe, expect, it } from "vitest"
import css from "./tokens.css?raw"

describe("tokens", () => {
  it("defines the restyle values", () => {
    expect(css).toContain("--page: #0c0c0c;")
    expect(css).toContain("--surface: #1a1a1a;")
    expect(css).toContain("--surface-raised: #2a2a2a;")
    expect(css).toContain("--surface-high: #3a3a3a;")
    expect(css).toContain("--ink: #ffffff;")
    expect(css).toContain("--ink-muted: #bdbdbd;")
    expect(css).toContain("--play: #ffffff;")
    expect(css).toContain("--play-ink: #111111;")
    expect(css).toContain("--line: #2e2e2e;")
    expect(css).toContain("--stage-stop: #e23b32;")
    expect(css).toContain("--stage-play: #2ea85a;")
    expect(css).toContain("--yellow: #e4c56a;")
    expect(css).toContain("--blue: #2f7fe0;")
    expect(css).toContain("--radius-card: 16px;")
    expect(css).toContain("--radius-field: 12px;")
    expect(css).toContain("--radius-pill: 999px;")
    expect(css).toContain("--time-size: clamp(4.5rem, 8vw, 8rem);")
    expect(css).toContain("--control-edge: #777777;")
    expect(css).toContain("--rest-ink: var(--yellow);")
  })
})
