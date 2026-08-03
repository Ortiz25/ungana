# Ungana — SvelteKit SPA port

This is a 1:1 port of the Ungana Figma-Make UI (originally a single ~3,400-line
React file, `App.tsx`) to a runnable **SvelteKit + Svelte 5 (runes)** static SPA.
Fidelity to the original UI was the priority: same layout, colors, gradients,
shadows, animations, and interaction behavior.

## What it is

A phone-framed demo app with a screen state machine. Screens:
`packages → payment → initiated → connecting → active → warning → ended`,
plus `activator-login`, `activator-dashboard`, `coordinator-login`,
`coordinator-dashboard`, and the `timeline` (watch-and-earn) flow. Everything is
mock data; no backend.

## How to run

```bash
npm install
npm run dev        # dev server (http://localhost:5173)
npm run build      # static production build → ./build
npm run preview    # serve the production build
npm run check      # svelte-check
```

The app must be served over HTTP (dev/preview/any static host). It uses
`document`, `window`, `navigator.clipboard`, `document.title`, and the Page
Visibility API, so SSR and prerendering are disabled.

## Stack

- **SvelteKit 2** + **Svelte 5** (runes: `$state`, `$derived`, `$effect`, `$props`).
- **@sveltejs/adapter-static** with SPA fallback (`fallback: 'index.html'`).
  SSR/prerender off globally via `src/routes/+layout.js`
  (`export const ssr = false; export const prerender = false;`).
- **Tailwind CSS v4** via `@tailwindcss/vite`. Tokens + fonts + custom keyframes
  live in `src/app.css` (imported by the root layout).
- **Vite 6**.

## Library replacements

| Original (React)         | Here (Svelte)                                            |
| ------------------------ | ------------------------------------------------------- |
| `lucide-react`           | `@lucide/svelte` (same `size`/`color`/`strokeWidth` API; legacy names like `CheckCircle2`, `BarChart2`, `Edit3`, `HelpCircle`, `AlertTriangle` are re-exported aliases) |
| `recharts`               | Hand-rolled SVG/CSS charts: `BarChartMini.svelte` (rounded-top bars, optional dashed gridlines + x labels) and `AreaChartMini.svelte` (gradient area + non-scaling-stroke line, responsive via `viewBox`) |
| shadcn/ui, MUI, motion, react-dnd, react-slick | Not used by `App.tsx`; dropped |

## Structure

- `src/routes/+layout.js` — `ssr`/`prerender` off.
- `src/routes/+layout.svelte` — imports `app.css`, renders `{@render children()}`.
- `src/routes/+page.svelte` — root state machine (mirrors React `App()`); holds
  screen + shared state, renders `IPhoneFrame` around the current screen.
- `src/lib/data.js` — all constants (ACTIVATORS, PACKAGES, TL_* content, mock
  roster, coordinator data, chart series) + helpers (`formatTime`,
  `daysUntilExpiry`).
- `src/lib/components/` — shared: `UnganaLogoMark`, `ScreenBg`, `DemoBadge`,
  `IPhoneFrame`, `ActivatorDropdown`, `TLContentCard`, and the two charts.
- `src/lib/screens/` — one `.svelte` per screen.

## Conversion notes / things to double-check

- **Charts are approximations, not recharts.** They reproduce the visual result
  (series color, gradient fill, rounded bars, heights) but omit interactive
  tooltips and precise axis ticks. If pixel-exact axis labeling matters, revisit
  `BarChartMini.svelte` / `AreaChartMini.svelte`. The area chart uses
  `preserveAspectRatio="none"` + `vector-effect="non-scaling-stroke"`, so the
  line stays crisp at any width.
- **Nested `<button>`:** the React "at-risk activator" row nested a nudge button
  inside a clickable card button (invalid HTML that React tolerated). The outer
  element is now a `<div role="button">` so both click targets work.
- **Page Visibility / countdown timers** (`ActiveScreen`, `WarningScreen`,
  `ConnectingScreen`, `InitiatedScreen`, `TimelineScreen`): timers and their
  cleanup are preserved inside `$effect`. Effects that must run once read only
  stable props in setup (e.g. `WarningScreen` reads `remaining`, not the
  reactive `secs`) to avoid re-subscribing every tick.
- **Custom `ping` keyframes** for the ConnectingScreen rings are defined in
  `app.css` as `ping-ring` (renamed to avoid colliding with Tailwind's built-in
  `animate-ping`). `animate-pulse` / `animate-spin` use Tailwind's built-ins.
- **`svelte-check`:** 0 errors. 8 `state_referenced_locally` warnings remain —
  these are intentional initial-value snapshots of props that never change
  during a screen's lifetime (the direct analog of React `useState(initial)`);
  safe to ignore. `checkJs` is off in `jsconfig.json` because components are
  plain untyped JS by design.
- **a11y:** a few Svelte a11y hints (autofocus, click-on-non-interactive) were
  addressed with `role`/`tabindex`/`svelte-ignore`; nothing outstanding blocks
  the build.
- Remote Unsplash image URLs are used exactly as in the original (dashboard hero
  backgrounds, timeline cards); they require network access to display.
