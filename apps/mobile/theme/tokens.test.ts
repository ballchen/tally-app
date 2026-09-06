import { describe, expect, it } from "vitest"
import { palette, typography } from "./tokens"

describe("design tokens", () => {
  it("light and dark palettes expose the same keys", () => {
    expect(Object.keys(palette.dark).sort()).toEqual(Object.keys(palette.light).sort())
  })

  it("every color is a 6-digit hex", () => {
    for (const scheme of Object.values(palette)) {
      for (const value of Object.values(scheme)) {
        expect(value).toMatch(/^#[0-9A-F]{6}$/i)
      }
    }
  })

  it("amount styles use tabular figures", () => {
    for (const key of ["amountXL", "amountL", "amountM"] as const) {
      expect(typography[key].fontVariant).toContain("tabular-nums")
    }
  })
})
