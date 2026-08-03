# Ungana (SvelteKit SPA)

A SvelteKit + Svelte 5 static SPA port of the Ungana Figma-Make UI.

## Run

```bash
npm install
npm run dev        # http://localhost:5173
```

## Build

```bash
npm run build      # static SPA → ./build (SPA fallback: index.html)
npm run preview    # preview the production build
npm run check      # svelte-check
```

Serve over HTTP (dev/preview or any static host). The app relies on browser APIs
(`document`, `navigator.clipboard`, Page Visibility), so SSR and prerendering are
disabled — do not open `index.html` from the filesystem.

See `HANDOFF.md` for architecture, the file map, and porting notes.
