/**
 * Same palette as tailwind.config.js's `theme.extend.colors`, as plain hex
 * strings — for the places a Tailwind className can't reach: SVG `fill`,
 * `LinearGradient` colors, chart strokes, and anything computed at runtime
 * (e.g. a priority color picked by a variable, not a static class).
 * Keep these two files in sync if the palette ever changes.
 */
export const colors = {
  background: "#E8D4B0",
  foreground: "#1D3C2A",
  card: "#2E5A3E",
  cardForeground: "#E8D4B0",
  secondary: "#3C6A4A",
  muted: "#3C6A4A",
  mutedForeground: "#C4DAC0",
  accent: "#C45C38",
  accentForeground: "#FFFFFF",
  accentGold: "#CC8830",
  destructive: "#B85038",
  destructiveForeground: "#FFFFFF",
  border: "rgba(232, 212, 176, 0.25)",
  inputBackground: "#3C6A4A",
} as const;
