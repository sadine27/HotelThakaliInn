#!/usr/bin/env node
/* DeepSeek orchestration harness.
 *
 * Claude writes a brief, DeepSeek writes the code, this moves bytes between
 * them. It is deliberately dumb: no agent loop, no tool calls, no retries on
 * bad output. The one thing it is NOT lazy about is applying edits — a patch
 * that silently misses is worse than no patch, so every SEARCH block must
 * match exactly once or the whole run aborts having written nothing.
 *
 *   node scripts/ds.mjs brief.md [--model=deepseek-v4-pro] [--img=shot.png] [--apply]
 *
 * A brief may pull repo files into the prompt with a line: `@ path/to/file`
 * Responses come back as edit blocks (see PROTOCOL) and land in .ds/ either way.
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { basename, dirname, extname } from "node:path";

const KEY = (readFileSync(".env.local", "utf8").match(/DEEPSEEK_API_KEY=(.+)/) || [])[1]?.trim();
if (!KEY) throw new Error("no DEEPSEEK_API_KEY in .env.local");

const args = process.argv.slice(2);
const briefPath = args.find((a) => !a.startsWith("--"));
const flag = (n, d) => args.find((a) => a.startsWith(`--${n}=`))?.split("=").slice(1).join("=") ?? d;
const MODEL = flag("model", "deepseek-v4-pro");
const IMGS = args.filter((a) => a.startsWith("--img=")).map((a) => a.slice(6));
const APPLY = args.includes("--apply");

const PROTOCOL = `
Return ONLY edit blocks. No preamble, no explanation, no summary after.

To change an existing file — SEARCH must be copied byte-for-byte from the file
I gave you (including indentation) and must appear EXACTLY ONCE in it. Prefer
several small precise blocks over one huge one:

=== EDIT: path/to/file.css ===
<<<<<<< SEARCH
the exact existing lines
=======
the replacement lines
>>>>>>> REPLACE
=== END ===

SEARCH must be UNIQUE in the file. CSS files repeat blocks like
"color: var(--green); background: var(--surface);" many times, so a short
anchor silently matches several places. Always include enough surrounding
lines - the selector line above it is usually enough - that the block can only
match once. A block matching twice is rejected exactly like one matching zero
times.

NEVER abbreviate inside a SEARCH block. No comment ellipses, no "unchanged
lines here", no placeholder of any kind. SEARCH is matched as a literal string,
so any elision makes it match nothing and the whole run is thrown away. If a
block would be long, pick a SHORTER unique anchor instead of shortening it with
an ellipsis.

=== FILE: is ONLY for a file that does not exist yet. If I gave you the
contents of a file, it exists, and you MUST edit it with EDIT blocks. Rewriting
a large existing file whole will truncate against the output limit and lose
everything you wrote. This is not a style preference, it is the difference
between a run that lands and a run that is thrown away.

To create a NEW file:

=== FILE: path/to/file.tsx ===
...complete file contents...
=== END ===
`;

/* `@ path` lines in a brief become fenced file dumps. Line-numbered? No — the
   model has to echo bytes back exactly for SEARCH to match, and line numbers
   are the single most common thing it echoes back by mistake. */
const brief = (briefPath ? readFileSync(briefPath, "utf8") : "").replace(/^@ (.+)$/gm, (_, p) => {
  const path = p.trim();
  return `\n--- FILE: ${path} ---\n${readFileSync(path, "utf8")}\n--- END ${path} ---\n`;
});

const MIME = { ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp" };
const content = [
  ...IMGS.map((p) => ({
    type: "image_url",
    image_url: { url: `data:${MIME[extname(p).toLowerCase()]};base64,${readFileSync(p).toString("base64")}` },
  })),
  { type: "text", text: brief + "\n\n" + PROTOCOL },
];

/* --from replays a saved response instead of paying for the same tokens twice.
   The apply step is where most iterations happen, so this is the difference
   between reviewing an edit and re-buying it. */
const REPLAY = flag("from", null);
const t0 = Date.now();
const res = REPLAY ? null : await fetch("https://api.deepseek.com/chat/completions", {
  method: "POST",
  headers: { "Content-Type": "application/json", Authorization: `Bearer ${KEY}` },
  body: JSON.stringify({
    model: MODEL,
    /* Left alone, v4 spends EVERY completion token on `reasoning_content` and
       returns an empty `content` — two full-price calls proved it. "low" keeps
       enough thinking for design judgement; "none" is right for mechanical
       passes where the brief already contains the decisions. */
    reasoning_effort: flag("effort", "low"),
    max_tokens: Number(flag("max", "16000")),
    messages: [
      { role: "system", content: "You are a senior frontend engineer with strong visual taste. You output code, never commentary." },
      { role: "user", content: IMGS.length ? content : brief + "\n\n" + PROTOCOL },
    ],
  }),
});
const json = REPLAY ? { choices: [{ message: { content: readFileSync(REPLAY, "utf8") }, finish_reason: "replay" }], usage: {} } : await res.json();
if (json.error) throw new Error(JSON.stringify(json.error));
const msg = json.choices?.[0]?.message ?? {};
const fin = json.choices?.[0]?.finish_reason;
/* v4-pro is a reasoner: it spends completion tokens on `reasoning_content`
   before it writes a byte of `content`. Cap it too low and you pay full price
   for an empty string, so surface the split and fall back to the reasoning
   channel if the model put its blocks there. */
const out = (msg.content && msg.content.trim()) ? msg.content : (msg.reasoning_content ?? "");
const u = json.usage ?? {};
if (!REPLAY) writeFileSync(".ds/last-raw.json", JSON.stringify(json, null, 1));

mkdirSync(".ds", { recursive: true });
const stamp = `${basename(briefPath ?? "replay", ".md")}-${Date.now()}`;
writeFileSync(`.ds/${stamp}.md`, out);
const rt = u.completion_tokens_details?.reasoning_tokens ?? 0;
console.log(
  `${MODEL} · ${((Date.now() - t0) / 1000).toFixed(1)}s · in ${u.prompt_tokens} (cache hit ${u.prompt_cache_hit_tokens ?? 0}) · out ${u.completion_tokens} (${rt} reasoning) · finish=${fin} · → .ds/${stamp}.md`,
);
if (!out.trim()) { console.log(`EMPTY — ${rt}/${u.completion_tokens} tokens went to reasoning. Raise --max or split the brief.`); process.exit(1); }

/* Parse first, apply second. Nothing touches disk until every block resolves —
   half-applied edits across three files is the failure that costs an hour. */
const planned = [];
const errors = [];
const fileEol = new Map(); // path → the line ending its file was checked out with
for (const [, path, body] of out.matchAll(/^=== (?:EDIT|FILE): (.+?) ===\n([\s\S]*?)\n=== END ===/gm)) {
  const isEdit = body.includes("<<<<<<< SEARCH");
  if (!isEdit) { planned.push({ path, next: body.replace(/^```[a-z]*\n|\n```$/g, "") }); continue; }
  if (!existsSync(path)) { errors.push(`${path}: EDIT on a file that does not exist`); continue; }
  let next = planned.find((p) => p.path === path)?.next ?? readFileSync(path, "utf8");
  /* Working trees on Windows are CRLF (core.autocrlf); a model's anchor is LF.
     Normalise once, remember the file's own ending, restore it on write. */
  if (!fileEol.has(path)) fileEol.set(path, next.includes("\r\n") ? "\r\n" : "\n");
  next = next.replace(/\r\n/g, "\n");
  for (const [, find, repl] of body.matchAll(/<<<<<<< SEARCH\n([\s\S]*?)\n=======\n([\s\S]*?)\n>>>>>>> REPLACE/g)) {
    /* A doubled ======= or a nested marker means the model emitted a malformed
       block. The non-greedy regex still "parses" it and would write the second
       half of the garbage into the file, so reject it outright — a patch that
       applies cleanly and means nothing is the worst failure mode here. */
    if (/^(=======|<<<<<<< SEARCH|>>>>>>> REPLACE)$/m.test(find) || /^(=======|<<<<<<< SEARCH)$/m.test(repl)) {
      errors.push(`${path}: malformed block, stray conflict marker inside SEARCH/REPLACE`);
      continue;
    }
    const f = find.replace(/\r\n/g, "\n");
    const r = repl.replace(/\r\n/g, "\n");
    const hits = next.split(f).length - 1;
    if (hits !== 1) { errors.push(`${path}: SEARCH matched ${hits}x (need exactly 1): ${f.slice(0, 70)}…`); continue; }
    next = next.replace(f, () => r);
  }
  const slot = planned.find((p) => p.path === path);
  if (slot) slot.next = next; else planned.push({ path, next });
}

for (const e of errors) console.log("  ✗ " + e);
if (!planned.length && !errors.length) console.log("  (no edit blocks found)");
if (!APPLY) { console.log(`  ${planned.length} file(s) ready — rerun with --apply`); process.exit(errors.length ? 1 : 0); }
if (errors.length) { console.log("  ABORTED, nothing written — fix the brief and retry"); process.exit(1); }
/* Belt and braces. A malformed block once wrote 23 stray ======= lines into a
   stylesheet; CSS error-recovery swallows the marker AND the rule after it, so
   the damage was silent and cost an hour to find. Never again: refuse to write
   a file that still contains a conflict marker. */
const dirty = planned.filter(({ next }) => /^(=======|<<<<<<< SEARCH|>>>>>>> REPLACE)$/m.test(next));
if (dirty.length) {
  for (const { path } of dirty) console.log(`  ✗ ${path}: result still contains a conflict marker`);
  console.log("  ABORTED, nothing written");
  process.exit(1);
}
for (const { path, next } of planned) {
  /* A new file may name a directory that does not exist yet — a whole new admin
     screen is one folder and one page.tsx, and failing on the folder throws away
     the call that just paid to write it. */
  mkdirSync(dirname(path), { recursive: true });
  const eol = fileEol.get(path) ?? "\n";
  writeFileSync(path, eol === "\r\n" ? next.replace(/\n/g, "\r\n") : next);
  console.log("  ✓ wrote " + path);
}
