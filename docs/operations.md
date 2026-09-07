# Operations

Part of the Hotel Thakali Inn documentation — see [../README.md](../README.md).

## 1. Prerequisites and setup

- **Node** — Node 24 is used locally and in CI. The check scripts import `.ts` files directly and rely on Node native type stripping.
- **npm** — `package.json` is `"type": "module"` and private.
- **Wrangler** — `wrangler` `^4.127.1` is a project dependency. It must be authenticated to Cloudflare account `3a6818b85519fb4d497000aa7570bb1d`.
- **Google OAuth** — Admin sign-in uses Google OAuth. `GOOGLE_CLIENT_ID` is a non-secret `wrangler.jsonc` var; `GOOGLE_CLIENT_SECRET` is a Cloudflare secret.
- **Cloudflare resources** — The project expects one D1 database, three R2 buckets, Cloudflare Images, Email Routing, Worker assets, and four rate-limit bindings.
- **FFmpeg** — needed only for media regeneration scripts. Expected on `PATH` unless `FFMPEG` is set.

### Local environment keys

| Location | Key | Purpose |
|---|---|---|
| `.dev.vars` | `SESSION_SECRET` | HMAC-SHA256 secret for signing `ti_admin` session cookies as `<user>|<expiry>.<digest>`. Required by the Worker and by `scripts/rig/lib.mjs`. |
| `.dev.vars` or Worker secret | `CHECK_TOKEN` | Token sent as `X-Check-Token`; must be identical on the main Worker and `thakali-inn-health-check` for `/api/check` and `/run`. |
| `.dev.vars` or Worker secret | `GOOGLE_CLIENT_SECRET` | Google OAuth client secret. Remote is set with `wrangler secret put GOOGLE_CLIENT_SECRET`. |
| `wrangler.jsonc` var | `GOOGLE_CLIENT_ID` | Non-secret OAuth client ID. Entered as a `vars` value, not a secret. |
| `.env.local` | `DEEPSEEK_API_KEY` | Used only by `scripts/ds.mjs` for the DeepSeek edit harness. |
| Environment variable | `FFMPEG` | Optional override for the ffmpeg executable path used by export scripts. |

### Remote Worker secrets by name

| Secret name | Worker(s) | Purpose |
|---|---|---|
| `GOOGLE_CLIENT_SECRET` | `hotel-thakali-inn` | Google OAuth secret. |
| `SESSION_SECRET` | `hotel-thakali-inn` | Session signing secret. |
| `CHECK_TOKEN` | `hotel-thakali-inn`, `thakali-inn-health-check` | Shared `/api/check` / health-check token. |
| `ARCHIVER_TOKEN` | `thakali-inn-audit-archiver` | Bearer token for manual audit archive trigger. |
| `BACKUP_TOKEN` | `thakali-inn-r2-backup` | Bearer token for manual mirror and restore. |

### First-run database setup

The primary D1 database is named `thakali-inn-contact`, binding name `DB`, with database ID `62a811d5-4f4b-4268-9b3d-6ea35a08d7e1`.

1. Point local Wrangler at the project and ensure the D1 binding exists.
2. Apply the migrations in `migrations/` against local D1 before using admin flows, because the rig expects migration `0023` to be applied.
3. Production uses the explicit human-only D1 migration command; see [Migrations in production](#8-migrations-in-production).
4. `npm run check` does **not** require a running server or migrated D1, but `scripts/rig/*` tests do.

## 2. Local development

| Command | What it runs |
|---|---|
| `npm run dev` | `vinext dev --port 3001` |
| `npm run dev:vinext` | Same as `npm run dev`. |

**What vinext does:** runs Next.js 15 App Router with React 19 on Vite/RSC, targeting Cloudflare Workers. Public D1-backed pages carry `export const dynamic = "force-dynamic"` because the build prerender pass has no `env.DB`.

### Local persistence

`npm start` uses:

```sh
wrangler dev --config dist/server/wrangler.json --persist-to .wrangler/state
```

Local D1/R2 state lives under `.wrangler/state`. This is not the live D1/R2 data.

### Seeding local data

- Run the repository’s migrations against local D1 before admin use.
- The seated content lives in migrations `0003_seed_content.sql`, `0004_seed_pages.sql`, `0010_seed_amenities.sql`, `0012_seed_rain_glass_settings.sql`, `0015_seed_admin_users.sql`, `0018_meals_and_good_rows.sql`, and related migration files.

### Limits of local vs remote behaviour

- Local state is isolated from live `thakali-inn-contact`, `thakali-inn-media`, `thakali-inn-media-backup`, and `thakali-inn-audit-archive`.
- Email Routing and Cloudflare Images remote behaviour cannot be fully exercised against a local loopback worker.
- Cloudflare rate limiter `period` accepts only `10` or `60` seconds, and counters reset on deploy.
- Worker logs and observability are configured remotely; local Wrangler may differ.
- The site has no `workers_dev` URL; the old `*.workers.dev` host is disabled.
- The Playwright rig is Windows-specific and hardcodes a local Chromium path.

## 3. Build and preview

| Command | What it runs |
|---|---|
| `npm run build` | `vinext build` |
| `npm run build:vinext` | `vinext build` — also used by CI. |
| `npm start` | `wrangler dev --config dist/server/wrangler.json --persist-to .wrangler/state` |
| `npm run start:vinext` | Same as `npm start`. |
| `npm run deploy:vinext` | `vinext-cloudflare deploy --config dist/server/wrangler.json` |

The build lands in `dist/`:

- `dist/client` — static assets served through `ASSETS`.
- `dist/server/wrangler.json` — generated Worker config used by local preview and deploy.

`dist/` is gitignored.

## 4. The verification gate

Command:

```sh
npm run check
```

Actual chain from `package.json`:

```sh
npm run typecheck &&
npm run lint &&
node scripts/css-check.mjs &&
node scripts/sparkline-check.mjs &&
node scripts/settings-check.mjs &&
node scripts/media-check.mjs &&
node scripts/menu-check.mjs &&
node scripts/amenity-check.mjs
```

It does **not** include the Playwright rig.

| Check | What it asserts | What a failure means |
|---|---|---|
| `npm run typecheck` | `tsc --noEmit` across the repo. | A TypeScript error in source or config types. |
| `npm run lint` | `eslint .` using the flat config. | A lint violation, including React Hooks rules such as `set-state-in-effect`. |
| `node scripts/css-check.mjs` | Every `var(--x)` resolves to a token defined in the same stylesheet, except the runtime-set allowlist `--font-mono`, `--font-serif`, `--shot`, `--i`. | An undefined token can silently fall back to light-theme literals on dark grounds. |
| `node scripts/sparkline-check.mjs` | SVG sparkline/chart math, `normalizeEmail`, and WhatsApp href building. | A chart or identity/link composer changed unexpectedly. |
| `node scripts/settings-check.mjs` | `/admin/settings` schema validation, composers, sanitizers, and live settings fixture invariants. | A settings string shown to guests changed or a validator became unsafe. |
| `node scripts/media-check.mjs` | Media sniffing, raw-file refusals, `formatBytes`, storage budget arithmetic, and matching `lib/repo-media.ts` against disk under `public/media`. | Media rules diverged from browser/server shared logic or shipped media manifest is out of sync. |
| `node scripts/menu-check.mjs` | `composeMenuExtra()`, `sizeRows()`, blank/price/size handling, duplicate label rejection, and `SIZE_NAMES` uniqueness. | Menu price rows or pour sizes silently break or collapse. |
| `node scripts/amenity-check.mjs` | `composeAmenityExtra()`, accepted touch names, amenity-extra round trip, and category icon coverage. | A bad amenity touch/feature/extra value can empty a public strip without rendering an error. |

Failures are hard failures: non-zero exit and CI does not deploy.

## 5. Every script

| File | How to run | Arguments | What it does | When to run |
|---|---|---|---|---|
| `scripts/amenity-check.mjs` | `node scripts/amenity-check.mjs` | none | Validates amenity category/touch/feature/icon rules and round trips. | As part of `npm run check` or after amenity model changes. |
| `scripts/css-check.mjs` | `node scripts/css-check.mjs [stylesheet]` | optional path, default `app/globals.css` | Fails unless all `var(--x)` references resolve to tokens defined in the stylesheet. | As part of `npm run check` or after CSS edits. |
| `scripts/demo code.md` | Not executable | n/a | Saved external demo: “3D Carousel Using TweenMax.js & jQuery”. | Reference only; not part of the app. |
| `scripts/ds.mjs` | `node scripts/ds.mjs brief.md --apply` | `briefPath`; `--model`, `--img`, `--apply`, `--from`, `--effort`, `--max` | DeepSeek edit harness using SEARCH/REPLACE blocks, saves to `.ds/`, optionally applies edits. | One-off AI-assisted code edits. |
| `scripts/encode-ambient.sh` | `./scripts/encode-ambient.sh [master.MP4]` | optional source; default `public/media/RB6998.MP4` | Regenerates `public/media/ambient.mp4` from camera master. | Re-encode the background ambient video. |
| `scripts/export-gallery-clips.mjs` | `node scripts/export-gallery-clips.mjs` | none; `PANELS` table hardcoded | Cuts 12 five-second ping-pong loops and poster JPGs into `public/media/gallery`. | One-off export or reproducible regeneration. |
| `scripts/export-page-photos.mjs` | `node scripts/export-page-photos.mjs` | none | Sharp-resizes breakfast and amenity page photos into `public/media/breakfast` and `public/media/amenities`. | One-off export. |
| `scripts/export-room-photos.mjs` | `node scripts/export-room-photos.mjs` | none | Sharp-resizes the three room hero photos into `public/media/rooms`. | One-off export. |
| `scripts/media-check.mjs` | `node scripts/media-check.mjs` | none | Validates `lib/media.ts` sniffing/budget/formatting and disk/media manifest sync. | As part of `npm run check` or after `public/media` changes. |
| `scripts/menu-check.mjs` | `node scripts/menu-check.mjs` | none | Validates menu price and pour-size serialization rules. | As part of `npm run check` or after menu changes. |
| `scripts/rig/amenities.mjs` | `node scripts/rig/amenities.mjs [shots-dir]` after `npm run start` | optional screenshots directory | Playwright rig for phase 4 `/admin/amenities` and public strips; proves a staff delete is refused. | During admin amenity rebuild or regression testing. |
| `scripts/rig/lib.mjs` | Not run directly; imported by phase scripts | consumed via `open({user,width,height})` and helpers | Shared admin rig: mints `ti_admin` cookie, opens Chromium, aborts crashing routes, captures/replays Server Action POSTs. | Used by `scripts/rig/*` phase scripts. |
| `scripts/settings-check.mjs` | `node scripts/settings-check.mjs` | none | Assertion suite for `/admin/settings` validation, composers, sanitizers and live fixture. | As part of `npm run check` or after settings logic changes. |
| `scripts/sparkline-check.mjs` | `node scripts/sparkline-check.mjs` | none | Pins SVG chart math, `normalizeEmail`, and `waHref`. | As part of `npm run check` or after chart/link changes. |

### Rig prerequisites

The Playwright rig requires:

- `npm run start` already listening on `http://127.0.0.1:8787`.
- Local D1 migrated.
- `SESSION_SECRET` in `.dev.vars`.
- The Windows Chromium build installed by `npx playwright install`.

It is intentionally excluded from `npm run check`.

## 6. Media tooling

### Regeneration tools

| Tool | Source | Output | Settings |
|---|---|---|---|
| `scripts/encode-ambient.sh` | Camera master, default `public/media/RB6998.MP4` | `public/media/ambient.mp4` | Crop `1080:608`, scale `1280:720`, 25 fps, `libx264 high`, CRF 28, GOP 50, `+faststart` |
| `scripts/export-gallery-clips.mjs` | 1080×1920 50 fps, rotation=90 camera clips | `public/media/gallery/<slug>.mp4` + `<slug>.jpg` | 1080×1920, 25 fps, H.264 high, CRF 26, yuv420p, faststart, ping-pong loop; poster JPEG q3 |
| `scripts/export-page-photos.mjs` | Camera JPGs under `assets/Hotel Thakali Inn Reels n photos/DCIM/100MSDCF` | `public/media/breakfast/*.jpg`, `public/media/amenities/*.jpg` | Sharp resize width 1600, mozjpeg q80, without enlargement |
| `scripts/export-room-photos.mjs` | Same camera originals | `public/media/rooms/*.jpg` | Sharp resize width 2000, mozjpeg q80, without enlargement |

### Outputs on disk

- `public/media/ambient.mp4`
- `public/media/gallery/*.mp4` and `*.jpg`
- `public/media/breakfast/buffet.jpg`, `fruit.jpg`, `dining.jpg`
- `public/media/amenities/front-desk.jpg`
- `public/media/rooms/deluxe-double.jpg`, `deluxe-king.jpg`, `family.jpg`

### End-to-end photo flow

1. Camera originals live outside `public/` under `assets/Hotel Thakali Inn Reels n photos/`.
2. The one-off export scripts encode web-sized copies into `public/media/`.
3. `lib/repo-media.ts` enumerates the shipped files under `public/media`.
4. `scripts/media-check.mjs` fails if `lib/repo-media.ts` and disk differ in either direction; regenerate the manifest when files change.
5. For admin-uploaded photos, `components/MediaUpload.tsx` decodes camera files in the browser, resizes them to a 1600px WebP plus a 400px thumbnail, and posts them to `/admin/photos/upload` under a daily quota.
6. Uploads are stored in R2 bucket `thakali-inn-media`, served through the Worker `/img/*` route, and mirrored to `thakali-inn-media-backup` nightly.

## 7. Deployment

### Main Worker deployment

`npm run deploy:vinext` runs:

```sh
vinext-cloudflare deploy --config dist/server/wrangler.json
```

CI runs this on main pushes after `npm run check` and `npm run build:vinext`.

### Scheduled Worker deployment

Run from the repository root because both cron worker configs reference `node_modules/wrangler/config-schema.json` relative to root.

| Worker | Config |
|---|---|
| `thakali-inn-audit-archiver` | `workers/audit-archiver/wrangler.jsonc` |
| `thakali-inn-r2-backup` | `workers/r2-backup/wrangler.jsonc` |
| `thakali-inn-health-check` | `workers/health-check/wrangler.jsonc` |

### GitHub Actions workflows

#### `.github/workflows/ci.yml`

- **Purpose:** protect and deploy the main site Worker.
- **Triggers by intent:** push to main deploys after checks; PR runs are non-deploy checks. Concurrency cancels superseded PR runs but never main runs.
- **Secret verification:** Cloudflare credential validity is checked before `npm ci`, specifically to avoid building for ~6 minutes with a dead token.
- **Steps observed from notes:** setup Node 24 / checkout / credential check / `npm ci` / `npm run check` / `npm run build:vinext` / deploy on main.
- **Required repository secrets:** `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`.

#### `.github/workflows/workers.yml`

- **Purpose:** deploy the maintenance Worker set under `workers/**`.
- **Path filter:** any change under `workers/**` redeploys both `audit-archiver` and `r2-backup`, even when only one changed.
- **Steps:** deploy `thakali-inn-audit-archiver` and `thakali-inn-r2-backup` from repo root with Wrangler secrets passed per step.
- **Required repository secrets:** `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`.
- **Gotcha:** workflow never cancels in-progress runs.

See [`docs/cloudflare.md`](cloudflare.md) for resource/binding detail.

## 8. Migrations in production

### Exact remote command

```sh
wrangler d1 migrations apply --remote
```

This is kept human-only because migration `0016` performs a `DROP COLUMN` schema change, which has no undo apart from Cloudflare Time Travel.

### Safety checklist

1. Apply migrations manually with `wrangler d1 migrations apply --remote`; never expect CI to migrate.
2. Ensure you are applying against shared D1 database `thakali-inn-contact`, database ID `62a811d5-4f4b-4268-9b3d-6ea35a08d7e1`.
3. If the migration is a schema change, coordinate application and main Worker deploy order carefully. Landing a schema change on `main` deploys the Worker but does **not** migrate remote D1.
4. Before applying `0016_admin_users_google.sql` or any `DROP COLUMN`, take a backup/export if available.
5. Confirm maintenance Workers are unaffected for `audit_log`, `page_views`, `content`, `menu`, and `media_assets` changes.
6. After migrating, run `/admin/check` or the nightly health-check to verify sign-in, public pages, mail, D1, R2, and Cloudflare Images still pass.

## 9. Monitoring and incident response

### Logs and observability

| Worker | Observability / logpush state |
|---|---|
| `hotel-thakali-inn` | `observability` null, `logpush` false, `tail_consumers` empty |
| `thakali-inn-audit-archiver` | `observability` null, `logpush` false, `tail_consumers` empty |
| `thakali-inn-r2-backup` | `observability` null, `logpush` false, `tail_consumers` empty |
| `thakali-inn-health-check` | `observability` enabled, `logpush` false, `tail_consumers` empty |

Use `wrangler tail` against a Worker where invocation logs are available. Health-check is the most instrumented.

### Scheduled health check

`thakali-inn-health-check` runs at `15 22 * * *` UTC:

1. Blanks `page_views.ip` older than one year, as promised by `/privacy`.
2. Calls `https://hotelthakaliinn.com/api/check?full=1` with `X-Check-Token`.
3. Fetches every route in `lib/public-routes.ts`, looking for expected phrases.
4. Emails only when a check is red.

### Alert email

- Sender: `notify@hotelthakaliinn.com`.
- Destination: `hotelthakaliinn1@gmail.com`.
- Subject: `Thakali Inn — N check(s) failed`.
- Body: failed check names, details, `where` hints, and optionally forgotten visitor-address count.
- No all-clear email is sent.

### What an alert means and first steps

| Symptom | Meaning | First response |
|---|---|---|
| `The site itself` failed: `/api/check answered <status>` | Live Worker down, or `CHECK_TOKEN` mismatch. | Check deploy health and verify `CHECK_TOKEN` is identical on main Worker and health-check Worker. |
| `Public pages` failed | One or more URLs from `lib/public-routes.ts` did not return HTTP 200 / expected phrase. | Open the reported route path(s); the check groups multiple broken routes into one semicolon-joined entry. |
| Health-check email does not arrive | `send_email` destination/sender mismatch or email setting changed. | Check Email Routing `notify@hotelthakaliinn.com` -> `hotelthakaliinn1@gmail.com` and the pinned `wrangler.jsonc` send_email arrays. |
| No alert but logging shows `page_views` retention issue | Retention failure is only `console.error`d; it does not by itself cause an alert. | Monitor Worker logs after scheduled 22:15 UTC run. |
| `/api/check` 401 | `CHECK_TOKEN` absent/mismatch between main Worker and health-check Worker. | Re-set `CHECK_TOKEN` in both places. |

## 10. Benchmarks

No benchmark report is present in the supplied repository notes or directory census. The only performance-adjacent verification in the codebase is deterministic: `scripts/sparkline-check.mjs` pins chart math, and `scripts/media-check.mjs` validates media budget arithmetic. No recorded benchmark conclusions are available.

## 11. Known issues / gotchas

### Build, CI and config

- Migration `0016` performs a `DROP COLUMN` schema change and is deliberately not applied by CI. It must be applied manually with `wrangler d1 migrations apply --remote`.
- `tsconfig.json` says the `.next/types` glob is deliberately absent, but `include` still contains `.next/types/**/*.ts`.
- The CI step comment says `npm run check` runs typecheck, eslint, css-check and sparkline-check only, but the actual `package.json` also runs settings-check, media-check, menu-check and amenity-check.
- `scripts-2` references `scripts/permissions-check.mjs`, but the repository census does not list that file at `scripts/`.
- CSP uses `script-src 'unsafe-inline'` because `HotelSchema` emits JSON-LD and Next needs its inline hydration bootstrap. No middleware exists to permit a nonce.
- CI smoke testing accepts either HTTP 200 or 403 with `cf-mitigated: challenge`; Bot Fight Mode can prevent strict HTML verification.
- Exceeding `experimental.serverActions.bodySizeLimit` of `3mb` results in `ERR_CONNECTION_RESET`, so the admin page size check is the actual refusal layer.
- The `email` settings row and `wrangler.jsonc` send_email arrays are pinned together. Changing the hotel admin email requires a matching Wrangler edit.
- `wrangler` rate limiter `period` accepts only 10 or 60 seconds. Rate limit counters reset on deploy.
- The old `*.workers.dev` URL is disabled; no second staging host exists.
- `workers.yml` redeploys both `audit-archiver` and `r2-backup` for any `workers/**` change.
- Wrangler deploys of cron Workers must run from repo root because both configs reference root-relative schema paths.

### Maintenance Workers

- `thakali-inn-health-check` has no explicit token-presence check before `timingSafeEqual`. If `CHECK_TOKEN` is unset and the header is absent, both values can become `''` and authorize the request.
- The local `timingSafeEqual()` returns immediately on length mismatch, so it is not fully constant-time for different-length strings.
- `audit-archiver` and `r2-backup` fetch handlers do not check HTTP method; any method with a valid token triggers the action.
- `r2-backup` treats every path that is not `/restore/:key` as a full mirror; unknown paths can therefore trigger a full mirror with a valid token.
- `r2-backup` restore overwrites an existing live `MEDIA` object without extra confirmation beyond the bearer token.
- The R2 backup is not versioned: changing a live object’s etag causes the next nightly run to overwrite the backup copy. Only objects deleted from live are retained in backup.
- `audit-archiver` archives only up to `BATCH_LIMIT=100` rows per invocation with no cursor. Its `remaining` count is only failures in that batch, not the total unarchived backlog.
- Per-object R2 failures in audit archiving are swallowed and retried later; there is no dead-letter queue or separate alert.
- Health checks count public-page failures as one grouped check, so `passed/total` can undercount the number of broken routes.
- `page_views` retention failure does not trigger an alert email if all other checks pass; it requires log monitoring.

### Media and scripts

- `media-check` assumes nightly `r2-backup` doubles every photo object and assumes a 10 GB free-tier bank; changing those assumptions breaks budget math.
- Media sniffing trusts content bytes, not filenames. A `.txt` renamed to `.jpg` is refused, and raw `ARW`/`CR3`/`TIFF` files are refused even when renamed.
- `lib/repo-media.ts` must be regenerated whenever `public/media` changes; `media-check` catches both missing and extra files.
- The default ambient master is `public/media/RB6998.MP4`, but camera/gallery/page sources live under `assets/Hotel Thakali Inn Reels n photos/` with spaces in the folder name.
- `composeAmenityExtra()` returns `extra.featured` as absent, not `0`; code checking for falsy `0` can break the highlights strip.
- Ping-pong gallery encoding drops the first and last frame of the reversed half; `-ss`/`-t` must be ffmpeg **input** options, not output options.
- Gallery clip selection by motion score alone is unsafe; always inspect what the window shows.
- `RB6964` is the only genuinely landscape source clip; mixing it into the portrait gallery grid breaks layout.

### DeepSeek harness

- `scripts/ds.mjs` model completion may spend tokens on `reasoning_content`; too-low `--max` can return empty content and bill full price. Mechanical passes should use `--effort none`.
- `ds.mjs` aborts if a SEARCH block matches zero or more than once, if a conflict marker is malformed, or if the post-apply result still contains a conflict marker.
- On Windows, SEARCH anchors are normalized from CRLF to LF, and output files are written back with original CRLF line endings.

### Admin rig and local tests

- The Playwright rig hardcodes a Windows Chromium path: `AppData/Local/ms-playwright/chromium-1217/chrome-win64/chrome.exe`.
- `open()` aborts `**/_next/image*` and `**/api/view` because those can crash `wrangler dev` on Windows during navigation.
- Server Action refusals redirect via `x-action-redirect`, not `Location`; `replay()` reads all response headers.
- The admin amenity row returns closed after save; the rig re-navigates and re-opens the `<details>` rather than reusing stale locators.

### Settings and database semantics

- `LIVE_MAPS_URL` stores two coordinate pairs: `@27.6954876,85.2756856` is the viewport, while `!3d27.6981357!4d85.3540451` is the hotel pin. Picking the viewport moves the contact map, weather strip, and AQI strip ~8 km away.
- SQLite `datetime('now')` is UTC with no zone marker, but bare timestamps can be parsed as local time. In Kathmandu UTC+5:45, a permission grant can incorrectly appear live for up to ~5h45m unless expiry boundaries are handled carefully.
- `normalizeEmail()` is Gmail-specific: `owner+admin@gmail.com` becomes `owner@gmail.com`, while `desk+tag@hotelthakaliinn.com` keeps its `+tag`.
- `sanitizeFormValues()` must be applied before `computeErrors()` / `composeAll()`; hostile nested values can otherwise throw inside a Server Action.
