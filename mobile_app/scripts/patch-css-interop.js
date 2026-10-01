#!/usr/bin/env node
// Fixes a crash in react-native-css-interop (NativeWind's runtime) that this
// project hit directly: printUpgradeWarning() — a dev-only diagnostic log —
// calls stringify() on a component's props via Object.entries(), which
// eagerly reads every nested property including getters. When a prop tree
// happens to reference React Navigation's default context sentinel (its
// getters are defined to throw "Couldn't find a navigation context...", see
// expo-router's NavigationStateContext.js), that throw took the entire
// render down with it — a misleading crash for what's supposed to be a
// harmless log line. See https://github.com/nativewind/nativewind/issues/1536
// for the same underlying class of bug.
//
// pnpm's own `patch` mechanism is the "correct" tool for this, but hits a
// known Windows-only pnpm bug (ENOENT scandir on its own temp dir —
// https://github.com/pnpm/pnpm/issues/6961) that leaves `pnpm install`
// permanently exiting non-zero even though the patch itself applies fine.
// This plain postinstall script does the same edit without going through
// that mechanism at all. Safe to re-run — it's idempotent (skips already-
// patched or already-updated-upstream files) and only touches this one
// function in this one file.
const fs = require("fs");
const path = require("path");

const target = path.join(__dirname, "..", "node_modules", "react-native-css-interop", "dist", "runtime", "native", "render-component.js");

const OLD = `        const newValue = Array.isArray(value) ? [] : {};
        for (const entry of Object.entries(value)) {
            newValue[entry[0]] = replace(entry[0], entry[1]);
        }
        seen.delete(value);`;

const NEW = `        const newValue = Array.isArray(value) ? [] : {};
        for (const key of Object.keys(value)) {
            let propValue;
            try {
                propValue = value[key];
            }
            catch (e) {
                propValue = \`[Unreadable: \${e instanceof Error ? e.message : String(e)}]\`;
            }
            newValue[key] = replace(key, propValue);
        }
        seen.delete(value);`;

if (!fs.existsSync(target)) {
  console.log("patch-css-interop: react-native-css-interop not installed, skipping.");
  process.exit(0);
}

const contents = fs.readFileSync(target, "utf8");

// Fingerprint on the loop construct itself rather than an exact multi-line
// block, so this stays idempotent even if a previous run of this same
// script left its own comments/formatting behind.
if (contents.includes("for (const key of Object.keys(value))")) {
  console.log("patch-css-interop: already patched.");
  process.exit(0);
}

if (!contents.includes(OLD)) {
  console.log("patch-css-interop: upstream file no longer matches the expected pre-patch shape (likely fixed or changed upstream) — leaving it alone.");
  process.exit(0);
}

fs.writeFileSync(target, contents.replace(OLD, NEW));
console.log("patch-css-interop: patched stringify() in react-native-css-interop.");
