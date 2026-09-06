// Design tokens for the Tally iOS app. Source of truth: plan §4.1.
// Light and dark palettes must expose the same keys (enforced by tokens.test.ts).

export const palette = {
  light: {
    primary: "#5B5BD6",
    onPrimary: "#FFFFFF",
    primarySoft: "#ECEBFB",
    background: "#F7F7FB",
    surface: "#FFFFFF",
    surfaceElevated: "#FFFFFF",
    text: "#1C1C2E",
    textSecondary: "#6E6E85",
    border: "#E4E4EE",
    positive: "#1F9D55",
    negative: "#D9474A",
    warning: "#D98A1F",
    settlement: "#7A5BD6",
  },
  dark: {
    primary: "#8B8BF0",
    onPrimary: "#0F0F1A",
    primarySoft: "#26264A",
    background: "#0F0F17",
    surface: "#1A1A26",
    surfaceElevated: "#232333",
    text: "#F2F2F7",
    textSecondary: "#A0A0B8",
    border: "#2C2C3E",
    positive: "#4CD07C",
    negative: "#F0666A",
    warning: "#F0B24C",
    settlement: "#A88BF0",
  },
} as const

export type ColorScheme = keyof typeof palette
export type ColorToken = keyof (typeof palette)["light"]

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const
export const radius = { sm: 8, md: 12, lg: 16, xl: 24, full: 9999 } as const
export const screenPadding = spacing.lg

// iOS system font at Dynamic Type default sizes. Amounts use tabular figures.
export const typography = {
  largeTitle: { fontSize: 34, fontWeight: "700" },
  title1: { fontSize: 28, fontWeight: "700" },
  title2: { fontSize: 22, fontWeight: "600" },
  headline: { fontSize: 17, fontWeight: "600" },
  body: { fontSize: 17, fontWeight: "400" },
  callout: { fontSize: 16, fontWeight: "400" },
  subhead: { fontSize: 15, fontWeight: "400" },
  footnote: { fontSize: 13, fontWeight: "400" },
  caption: { fontSize: 12, fontWeight: "400" },
  amountXL: { fontSize: 40, fontWeight: "700", fontVariant: ["tabular-nums"] },
  amountL: { fontSize: 24, fontWeight: "600", fontVariant: ["tabular-nums"] },
  amountM: { fontSize: 17, fontWeight: "600", fontVariant: ["tabular-nums"] },
} as const

export type TypographyToken = keyof typeof typography

export const maxFontSizeMultiplier = 1.6

export const shadow = {
  light: {
    shadowColor: "#1C1C2E",
    shadowOpacity: 0.06,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
  },
  // Dark surfaces rely on surfaceElevated instead of shadows.
  dark: {
    shadowColor: "transparent",
    shadowOpacity: 0,
    shadowRadius: 0,
    shadowOffset: { width: 0, height: 0 },
  },
} as const

export const blurIntensity = 40
