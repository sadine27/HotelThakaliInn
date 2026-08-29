#!/usr/bin/env node
/* Every var(--x) in the stylesheet must resolve to a token the stylesheet
   defines. A model writing CSS reaches for the palette it saw most in training
   — --foreground, --muted, --border — and those silently fall back to their
   light-theme literals, which on a dark ground is invisible text. Three landed
   before this check existed. Run it after every CSS pass.
   Set via JS at runtime, so legitimately absent from the stylesheet: */
const RUNTIME = new Set(["--font-mono", "--font-serif", "--shot", "--i"]);
import { readFileSync } from "node:fs";
const src = readFileSync(process.argv[2] ?? "app/globals.css", "utf8");
const defined = new Set([
  ...[...src.matchAll(/^\s*(--[a-z0-9-]+)\s*:/gm)].map((m) => m[1]),
  ...[...src.matchAll(/@property\s+(--[a-z0-9-]+)/g)].map((m) => m[1]),
]);
const missing = [...new Set([...src.matchAll(/var\(\s*(--[a-z0-9-]+)/g)].map((m) => m[1]))]
  .filter((t) => !defined.has(t) && !RUNTIME.has(t));
if (missing.length) {
  console.error("undefined custom properties:", missing.join(", "));
  process.exit(1);
}
console.log(`css-check ok — ${defined.size} tokens defined, all references resolve`);
