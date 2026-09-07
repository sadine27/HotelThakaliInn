# Hotel Thakali Inn

Hotel Thakali Inn Pvt Ltd is a hotel in Sinamangal Kalimatidol, Kathmandu, Nepal, operating at **hotelthakaliinn.com**. This repository contains the production site and staff tooling: a public marketing, gallery, dining and booking site, plus a custom admin panel for hotel staff, all built as a Cloudflare Workers application.

## What the site does

The **public side** is a content-managed hotel site. It presents the hotel’s home page, rooms, amenities, gallery, cuisine/menu, breakfast information, booking form, contact page and privacy policy. Public pages are backed by D1 content, settings and media rows, so hotel staff can reorder and rewrite the site without code changes. The site also includes live Kathmandu time, weather and air-quality information, an image and video gallery, a menu book, room exploration with reduced-motion support, a WhatsApp contact path, and a booking request flow that writes to D1 and emails the hotel.

The **admin side** is a custom content-management panel used by hotel staff. It provides a dashboard summary, account and permission management, amenity editing, analytics, an immutable audit log, a system check board, general content editing, menu editing, contact-message and booking-request inboxes, a photo and video bank, and a structured settings console. Admin sign-in is Google OAuth, writes are permission-checked and audit-logged, and sensitive actions require explicit roles or temporary grants.

## Architecture at a glance

One main worker serves both server-rendered pages and static assets. It is supported by shared Cloudflare data services and three separate maintenance workers.

```text
Public site and admin panel
            │
            ▼
 hotel-thakali-inn — one Cloudflare Worker
 vinext/Next.js 15 App Router on Vite/RSC
            │
            ├── D1 database: thakali-inn-contact (binding DB)
            ├── R2 bucket: thakali-inn-media (binding MEDIA)
            ├── Cloudflare Images: image optimisation (binding IMAGES)
            ├── Email Routing: outbound sends (binding EMAIL)
            ├── Static assets: dist/client (binding ASSETS)
            └── Workers rate limiters:
                 LOGIN_IP, LOGIN_ALL, VIEW_IP, FORM_IP

Sidecar workers
   thakali-inn-audit-archiver  every 5 minutes
      D1 audit_log ──> R2 thakali-inn-audit-archive
   thakali-inn-r2-backup       nightly
      R2 thakali-inn-media ──> thakali-inn-media-backup
   thakali-inn-health-check    22:15 UTC
      privacy retention, /api/check, public-route probes, email alert
```

D1 stores all application data. R2 stores private media served through the worker. Cloudflare Images handles image optimisation. Email Routing sends only from `notify@hotelthakaliinn.com` to the pinned hotel address. The scheduled workers run outside the main request path and each have their own `wrangler.jsonc` and deploy workflow.

## Tech stack

| Name | Version | Used for |
| --- | --- | --- |
| `next` | `^15.0.0` | App Router framework for public pages and admin panel |
| `vinext` | `^1.0.0-beta.8` | Build/dev/deploy layer that runs Next.js on Cloudflare Workers |
| `@vinext/cloudflare` | `^1.0.0-beta.6` | Cloudflare integration, CDN adapter, image optimiser, deploy command |
| `react` / `react-dom` | `^19.0.0` | UI runtime and DOM renderer |
| `react-server-dom-webpack` | `^19.2.8` | React Server Components integration required by Next RSC output |
| `vite` | `^8.2.2` | Build tooling behind vinext/Cloudflare |
| `@vitejs/plugin-react` | `^6.1.1` | React plugin for Vite |
| `@vitejs/plugin-rsc` | `^0.5.34` | React Server Components plugin for Vite/RSC |
| `@cloudflare/vite-plugin` | `^1.54.2` | Ties the Vite/vinext environment to Cloudflare |
| `wrangler` | `^4.127.1` | Cloudflare Workers CLI, deploys, D1 migrations, secrets |
| `typescript` | `^5.6.0` | Type checking with `tsc --noEmit` |
| Node.js | 24 | Local and CI runtime; used for native TypeScript type stripping in check scripts |
| `eslint` | `^10.9.1` | Repository linting |
| `typescript-eslint` | `^8.68.0` | Type-aware ESLint config |
| `eslint-plugin-react-hooks` | `^7.1.1` | React Hooks lint rules including `set-state-in-effect` |
| `framer-motion` | `^13.1.1` | Public-site animation |
| `jose` | `^6.2.10` | JWT/JOSE utilities used by the authentication/session layer |
| `playwright-core` | `^1.63.0` | Browser automation used by the admin UI test rig |
| Cloudflare Workers | `compatibility_date = 2026-08-29` | Main worker runtime and scheduled worker runtime |
| Cloudflare D1 | — | Primary transactional database |
| Cloudflare R2 | — | Private media and backup/archive storage |
| Cloudflare Images | — | Image optimisation pipeline |
| Cloudflare Email Routing | — | Pinned outbound email delivery |
| Workers Rate Limiting | — | Login, form and page-view rate limiting |

## Quick start

Prerequisites:

- Node.js 24 and npm
- A Cloudflare account authenticated with `wrangler`
- Access to the configured Cloudflare D1 database, R2 buckets, Cloudflare Images and Email Routing
- Google OAuth client credentials for admin sign-in
- GitHub Actions secrets `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` for CI deploys

Install dependencies:

```bash
npm install
```

Create `.dev.vars` for local secrets. Never commit `.dev.vars`. The confirmed local secret is:

| Env var | Purpose |
| --- | --- |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret, set in production with `npx wrangler secret put GOOGLE_CLIENT_SECRET` |

Non-secret `GOOGLE_CLIENT_ID` is configured in `wrangler.jsonc`.

Apply the D1 migrations locally with `wrangler` before running pages that touch D1. The `scripts/rig` Playwright tests require a migrated local D1 and a server on `127.0.0.1:8787`. CI deliberately never applies migrations; production migrations are applied manually with `wrangler d1 migrations apply --remote`.

Run the main commands:

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start local vinext/Next dev server on port `3001` |
| `npm run build` | Build the vinext/Next app |
| `npm start` | Run the built worker locally with `wrangler dev --config dist/server/wrangler.json --persist-to .wrangler/state` |
| `npm run check` | Run typecheck, ESLint, `css-check`, `sparkline-check`, `settings-check`, `media-check`, `menu-check` and `amenity-check` |
| `npm run deploy:vinext` | Deploy the main worker with `vinext-cloudflare deploy --config dist/server/wrangler.json` |

The package also defines aliases: `dev:vinext`, `build:vinext` and `start:vinext`.

## Repository layout

| Top-level entry | What it holds |
| --- | --- |
| `.github/workflows/` | CI workflow for the main worker (`ci.yml`) and the cron-worker deployment workflow (`workers.yml`) |
| `app/` | Next.js App Router pages, admin screens, public pages, API route handlers, split `globals.css`, OpenGraph/manifest/error/not-found files and the root layout |
| `assets/` | Vendored and demo assets, including `assets/adminator` template files, hotel photos, menu photos, amenity photos, fonts, PDF/ZIP/image samples and static documentation assets |
| `components/` | 29 shared React components for public and admin UI |
| `lib/` | 19 TypeScript library modules for auth, content, analytics, audit, permissions, media, settings, live data, public routes and shared logic |
| `migrations/` | 23 D1 SQL migrations defining schema, seed data and later content/data fixes |
| `public/media/` | Repo-shipped hero, gallery, room, breakfast, menu, amenity, service and ambient video/image files |
| `scripts/` | Node/ESM validation scripts, ffmpeg/sharp export scripts, Playwright rig, DeepSeek code-generation notes, and shell helpers |
| `workers/` | Three standalone workers: `audit-archiver`, `health-check`, `r2-backup`, each with its own `index.mjs` and `wrangler.jsonc` |
| Root config files | `package.json`, `wrangler.jsonc`, `next.config.mjs`, `vite.config.ts`, `tsconfig.json`, `eslint.config.mjs` |
| Root data/ops files | `information.txt` for canonical business details, `cf-live.json` for a read-only dump of the live Cloudflare account |
| Generated/ignored paths | `worker-configuration.d.ts`, `dist/`, `.wrangler/`, `.vinext/`, `.next/`, `.ds/` and similar generated or writer-local paths are not turned into production source |

`assets/adminator/` is a vendored template and is intentionally ignored by ESLint, along with generated `worker-configuration.d.ts`.

## Documentation index

| Chapter | What the reader will find |
| --- | --- |
| [`docs/cloudflare.md`](docs/cloudflare.md) | Cloudflare resources, bindings, rate limiters, routes/custom domains, security headers, CI/CD shape, and account-level operational decisions. |
| [`docs/admin.md`](docs/admin.md) | Admin panel screens, Google OAuth, sessions, roles, permission grants, audit logging, settings, media bank, inboxes, analytics and the check board. |
| [`docs/data-model.md`](docs/data-model.md) | D1 tables, migrations, seed content, content/settings/media models, analytics and audit storage. |
| [`docs/api.md`](docs/api.md) | Public and admin HTTP endpoints, route handlers, rate limits, auth, D1/R2/Email interactions and known endpoint behaviours. |
| [`docs/frontend.md`](docs/frontend.md) | Public components, admin components, CSS custom-property system, animation/accessibility decisions, media pipeline and page structure. |
| [`docs/operations.md`](docs/operations.md) | Deployment, manual migration policy, scheduled workers, backup/restore, health checks, secrets, local workflow and incident considerations. |

This page is an index only. Route tables, API references, SQL schema, component lists and CSS token tables belong in the chapter files above.

## Deployment

Pushes to `main` that pass `npm run check` and `npm run build:vinext` deploy the main worker through the CI workflow. The cron workers deploy from a separate workflow triggered by changes under `workers/**`. The old `*.workers.dev` hostname is disabled by omission of `workers_dev`; both `hotelthakaliinn.com` and `www.hotelthakaliinn.com` serve the same worker. Production D1 migrations are never applied from CI. For full deploy, scheduled-worker, backup/restore and manual migration instructions, see [`docs/operations.md`](docs/operations.md).

## Known issues / gotchas

These are repo-level issues found in the extracted notes. They do not replace the deeper operational notes in `docs/operations.md`.

| Issue | Notes |
| --- | --- |
| Migration `0016` includes a `DROP COLUMN` | Never applied by CI. A schema-changing migration landed on `main` does not migrate remote D1; it must be run manually with `wrangler d1 migrations apply --remote`. |
| `tsconfig.json` comment inconsistency | Comment says the `.next/types` glob is deliberately absent, but `include` still contains `.next/types/**/*.ts`. |
| CI comment vs actual `check` script | CI text says `npm run check` runs typecheck + ESList + `css-check` + `sparkline-check` only. The actual script also runs `settings-check`, `media-check`, `menu-check` and `amenity-check`. |
| CSP requires `script-src 'unsafe-inline'` | Used by Next’s inline hydration bootstrap and `HotelSchema` JSON-LD. No middleware exists on this worker, so a nonce cannot be added until middleware exists. |
| Cloudflare smoke test can pass on a 403 challenge | CI accepts HTTP 200 or a 403 whose `cf-mitigated` header is `challenge`. With Bot Fight Mode enabled, CI cannot truly verify page HTML; disable Bot Fight Mode to restore the strict check. |
| Server Action body limit | Oversized uploads can surface as `ERR_CONNECTION_RESET`. `next.config.mjs` raises the limit to `3mb` so uploads reach app-level checks; the admin page’s size check is the real referee. |
| Email routing is pinned at both ends | The `email` settings row and `wrangler.jsonc` `send_email` sender/destination arrays must match. Changing the hotel email setting also requires a matching `wrangler.jsonc` edit. |
| Rate-limiter counters are ephemeral | `wrangler` rate-limiter `period` accepts only 10 or 60 seconds, and counters do not survive deploys. |
| No second staging URL | `workers_dev` is omitted deliberately, so there is no `*.workers.dev` host to test against. |
| Cron-worker workflow redeploys both workers | Any change under `workers/**` redeploys both `audit-archiver` and `r2-backup`, even if only one changed. Accepted as a version-bump no-op. |
| Cron-worker deploys depend on repo root | Both worker `wrangler.jsonc` files reference `node_modules/wrangler/config-schema.json` relative to the repo root; deploy from the root. |
| Vendored and generated files are lint-ignored | `assets/**` vendored bundles and generated `worker-configuration.d.ts` should not be linted/formatted. |
| Windows `wrangler dev` test issue | The Playwright rig aborts two requests that crash `wrangler dev` on Windows. |
| `cf-live.json` anomalies | The live Cloudflare dump records D1 `num_tables` as `0` even though the database file is `299,008` bytes; DNS/WAF/cache rulesets were unreadable because the wrangler OAuth token received HTTP 403. |
| Tracked binary/vendored media | The repo intentionally ships binary/font/media files under `assets/` and `public/media/`; treat `assets/adminator/` as vendored generated output rather than hand-written source. |
