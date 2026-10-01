// Design tokens ported 1:1 from frontend/src/app.css's :root custom
// properties — same names, same hex values, so a class like `bg-accent` or
// `text-foreground` means the same color in both apps. See
// src/theme/tokens.ts for the same values as plain JS constants, for the
// handful of places (SVG fills, inline gradients) that need a raw hex
// string rather than a className.
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      fontFamily: {
        serif: ["PlayfairDisplay_700Bold"],
        "serif-italic": ["PlayfairDisplay_700Bold_Italic"],
        sans: ["Inter_400Regular"],
        "sans-medium": ["Inter_500Medium"],
        "sans-semibold": ["Inter_600SemiBold"],
      },
      colors: {
        background: "#E8D4B0",
        foreground: "#1D3C2A",
        card: "#2E5A3E",
        "card-foreground": "#E8D4B0",
        primary: "#1D3C2A",
        "primary-foreground": "#E8D4B0",
        secondary: "#3C6A4A",
        "secondary-foreground": "#E8D4B0",
        muted: "#3C6A4A",
        "muted-foreground": "#C4DAC0",
        accent: "#C45C38",
        "accent-foreground": "#FFFFFF",
        "accent-gold": "#CC8830",
        destructive: "#B85038",
        "destructive-foreground": "#FFFFFF",
        border: "rgba(232, 212, 176, 0.25)",
        "input-background": "#3C6A4A",
      },
    },
  },
  plugins: [],
};
