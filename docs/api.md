# HTTP API Reference

Part of the [Hotel Thakali Inn documentation](../README.md) · HTTP API reference.

This chapter covers the HTTP surfaces of `sadine27/HotelThakaliInn`: the public `app/api/*` route handlers, admin OAuth and upload routes, R2 media serving, server-action mutations, the three scheduled Worker HTTP entry points, metadata routes, and rate limiting. For deployment resources and secrets, see [cloudflare.md](cloudflare.md). For admin UI details, see [admin.md](admin.md). For table schemas, see [data-model.md](data-model.md). For public components and page behaviour, see [frontend.md](frontend.md). For cron schedules and maintenance operations, see [operations.md](operations.md).

## 1. Overview

### Route model

The application is a Cloudflare Workers/Next.js App Router app. API surfaces are implemented as Next.js route handlers:

- `app/api/*/route.ts`
- `app/admin/auth/google/start/route.ts`
- `app/admin/auth/google/callback/route.ts`
- `app/admin/photos/upload/route.ts`
- `app/img/[...key]/route.ts`
- `app/manifest.ts`
- `app/opengraph-image.tsx`

Every route handler that touches a Cloudflare binding declares:

```ts
export const dynamic = "force-dynamic"
```

Cloudflare bindings are accessed through `env` from `cloudflare:workers`. Examples: `env.DB`, `env.MEDIA`, `env.EMAIL`, `env.SESSION_SECRET`, `env.CHECK_TOKEN`.

### Auth schemes in play

| Surface | Auth scheme |
| --- | --- |
| Public pages and public `app/api/*` routes | No session required |
| Admin pages/admin server actions | Signed admin session cookie `ti_admin` with `Path=/admin` |
| `GET /api/check` | Shared `X-Check-Token` header, constant-time compared against `env.CHECK_TOKEN` |
| `POST /admin/photos/upload` | Admin session cookie; path deliberately lives under `/admin` so the cookie is sent |
| Google OAuth start/callback | Public, OAuth state cookie `ti_oauth_state` |
| `workers/audit-archiver` manual trigger | `Authorization: Bearer <ARCHIVER_TOKEN>` |
| `workers/health-check` manual trigger | `X-Check-Token: <CHECK_TOKEN>` |
| `workers/r2-backup` manual mirror/restore | `Authorization: Bearer <BACKUP_TOKEN>` |

The admin session cookie is HMAC-signed and has this shape:

```text
<username>|<unix-expiry>.<hex-HMAC(SHA-256)>
```

The cookie is `httpOnly`, `secure`, `sameSite=Lax`, `path=/admin`, with a 12-hour max age.

### Shared response/error conventions

| Route family | Success convention | Error convention |
| --- | --- | --- |
| `/api/booking`, `/api/contact` | `200` with `{ "ok": true }` | `400`, `429`, `500` with `{ "ok": false, "error": "message" }` |
| `/api/live` | `200` with nullable live-data fields | No application error responses; upstream failures become `null` fields |
| `/api/view` | Always `204` empty body | Always `204` empty body, even for invalid/rate-limited/failed insert |
| `/api/check` | `200` with `{ ok, failed, total, results }` | `404` plain text `not found` on auth/config failure; failed checks still use HTTP `200` |
| `/admin/auth/google/*` | `302` redirect | `302` to `/admin/login?e=<code>` on failure |
| `/admin/photos/upload` | `200` JSON `{ ok: true, ... }` | `400`, `401`, `429`, `500` JSON `{ ok: false, refusal: "human sentence" }` |
| `/img/[...key]` | `200` raw object body | `404` plain text `Not found` |

Important ordering convention: durable D1 writes happen before email notifications. Public form inserts are the must-not-lose part; email failures are logged and do not fail the request.

## 2. `app/api` endpoints

### 2.1 Endpoint table

| Method + path | File | Auth | Rate limiter / quota | Main side effects |
| --- | --- | --- | --- | --- |
| `POST /api/booking` | `app/api/booking/route.ts` | Public | `FORM_IP` key `booking:${ip}` | Insert into `booking_requests`; send booking email |
| `POST /api/contact` | `app/api/contact/route.ts` | Public | `FORM_IP` key `contact:${ip}` | Insert into `messages`; send enquiry email |
| `GET /api/live` | `app/api/live/route.ts` | Public | None | Fetch Open-Meteo forecast + air quality |
| `POST /api/view` | `app/api/view/route.ts` | Public | `VIEW_IP` key IP or `unknown` | Insert into `page_views` |
| `GET /api/check` | `app/api/check/route.ts` | `X-Check-Token` | None | Run `lib/checks.ts`; `full=1` enables write/email checks |
| `GET /img/[...key]` | `app/img/[...key]/route.ts` | Public | None | Serve R2 object from `env.MEDIA` |

### 2.2 `POST /api/booking`

File: `app/api/booking/route.ts`

Auth: public.

Request body: JSON.

| Field | Constraints | Notes |
| --- | --- | --- |
| `name` | `<= 80` chars, required | |
| `email` | `<= 160` chars, required | Lenient email validation, but whitespace and `?&#%,;<>" '` are rejected |
| `phone` | `<= 40` chars | |
| `room` | `<= 60` chars | |
| `notes` | `<= 1000` chars | |
| `guests` | integer `1-10` | |
| `check_in` | `YYYY-MM-DD` | Must be a real calendar day |
| `check_out` | `YYYY-MM-DD` | Must be after arrival, at most 30 nights |
| `note_ref` | any non-empty value is treated as a bot | Honeypot |

Success response:

```json
{ "ok": true }
```

The honeypot also returns `{ "ok": true }` so bots do not learn they were trapped.

Error responses:

| Status | Body |
| --- | --- |
| `400` | `{ "ok": false, "error": "..." }` for malformed JSON or validation |
| `429` | `{ "ok": false, "error": "Too many requests." }` |
| `500` | `{ "ok": false, "error": "That did not send." }` |

Exact validation messages:

- `Please fill in your name, a valid email and a room.`
- `How many guests?`
- `Please choose arrival and departure dates.`
- `Departure must be after arrival, and at most 30 nights.`

Side effects:

1. D1 insert into `booking_requests`.
2. Best-effort email send after the D1 insert.
   - From: `notify@hotelthakaliinn.com`
   - To: `settings().email` or fallback `hotelthakaliinn1@gmail.com`
   - Reply-To: guest email
   - Subject: `Booking request — ${checkIn} to ${checkOut}, ${name}`

Email failure is `console.error`’d but does not fail the request.

Date validation uses real-day round-trip:

```ts
new Date(`${d}T00:00:00Z`)
```

Kathmandu-local `todayKtm()` is built with `Intl.DateTimeFormat('en-CA', { timeZone: TZ })`.

### 2.3 `POST /api/contact`

File: `app/api/contact/route.ts`

Auth: public.

Request body: JSON.

| Field | Constraints | Notes |
| --- | --- | --- |
| `name` | `<= 80` chars, required | |
| `email` | `<= 160` chars, required | |
| `message` | `<= 2000` chars, required | |
| `note_ref` | any non-empty value is treated as a bot | Honeypot |

Success response:

```json
{ "ok": true }
```

The honeypot also returns `{ "ok": true }`.

Error responses:

| Status | Body |
| --- | --- |
| `400` | `{ "ok": false, "error": "Please fill in your name, a valid email, and a message." }` |
| `429` | `{ "ok": false, "error": "Too many requests." }` |
| `500` | `{ "ok": false, "error": "That did not send." }` |

Side effects:

1. D1 insert into `messages`.
2. Best-effort email after the insert.
   - From: `notify@hotelthakaliinn.com`
   - To: `settings().email` or fallback `hotelthakaliinn1@gmail.com`
   - Reply-To: guest email
   - Subject: `Website enquiry — ${name}`

The trap is checked after the rate limiter. A trapped bot logs `[contact] trap fired`.

### 2.4 `GET /api/live`

File: `app/api/live/route.ts`

Auth: public.

Request: none.

Uses settings `lat`/`lng` when configured, otherwise defaults:

```text
latitude=27.6981357
longitude=85.3540451
timezone=Asia/Kathmandu
```

Response: `200` JSON.

| Field | Type |
| --- | --- |
| `time` | `HH:mm` in Kathmandu |
| `daypart` | `'day' \| 'dawn' \| 'dusk' \| 'night'` |
| `temp` | `number \| null` |
| `sky` | `string \| null` |
| `skyKey` | `'clear' \| 'cloudy' \| 'fog' \| 'rain' \| 'snow' \| 'storm' \| null` |
| `aqi` | `number \| null` |
| `air` | `string \| null` |
| `phone` | string from settings |
| `whatsapp` | string from settings or fallback to `phone` |
| `socials` | `{ label: string, href: string }[]` |
| `address` | string from settings |
| `email` | string from settings |
| `rainGlass` | boolean |

No application error response is returned. Upstream failures produce `null` fields but still HTTP `200`.

Caching:

```text
Cache-Control: public, max-age=120, s-maxage=120
```

Two minutes is deliberately short so `/admin/settings` rain-glass toggles propagate quickly.

Details:

- Uses two Open-Meteo upstreams with no API key.
- Daypart is derived from sunrise/sunset with `±60` minute bands; missing sun data falls back to `day`.
- AQI labels: `Good <= 50`, `Moderate <= 100`, `Poor <= 150`, `Unhealthy <= 200`, `Hazardous > 200`.
- WhatsApp falls back to phone unless `config.whatsapp_same === '0'` and `config.whatsapp` is set.
- Each upstream fetch uses a catchable `grab()`.

### 2.5 `POST /api/view`

File: `app/api/view/route.ts`

Auth: public.

Request body: JSON.

| Field | Constraints |
| --- | --- |
| `path` | optional string, max 64 chars |
| `referrer` | optional string |

Request headers used:

- `User-Agent`
- `CF-Connecting-IP`
- `CF-IPCountry`
- `request.cf` for `city`, `region`, `asOrganization`

Response: always HTTP `204` with an empty body for success, bot, rate limit, invalid JSON, invalid path, referrer, or failed insert.

Side effects:

- Insert into `page_views`.
- Visistor ID is a 12-hex-char HMAC-SHA-256 of `${ip}|${ua}` keyed with `env.SESSION_SECRET`.
- IP is stored and later blanked after one year.
- IP reveals are restricted and audited outside this route.

Bot filtering regex:

```text
/bot|crawl|spider|slurp|headless|preview|monitor|lighthouse|curl|wget|python|axios|node-fetch/i
```

Path validation:

```text
/^\/(?:[a-z0-9-]+(?:\/[a-z0-9-]+)*)?$/
```

Paths starting with `/admin` or `/api` are rejected.

Device classification: `tablet`, `phone`, or `desktop`.

Browser classification checked in order: `Edge`, `Opera`, `Samsung`, `Firefox`, `Chrome`, `Safari`.

Referrer is kept as bare hostname, `www` stripped, and only when different from the site’s own hostname.

Failed insert logs:

```text
[view] insert failed
```

but the response remains `204`.

### 2.6 `GET /api/check`

File: `app/api/check/route.ts`

Auth: token.

Request header:

```text
X-Check-Token: <CHECK_TOKEN>
```

Optional query:

```text
?full=1
```

Success response, always HTTP `200`:

```json
{
  "ok": false,
  "failed": 1,
  "total": 8,
  "results": []
}
```

`ok` is `true` only when `failed === 0`.

Error response:

```text
404
body: not found
```

This fires when `env.CHECK_TOKEN` is not configured or the header does not constant-time-match the configured token.

A failing check is still HTTP `200` with `ok:false` because the calling Worker needs the result list; a `500` would trigger retries and hide the body.

The same `runChecks()` from `lib/checks.ts` powers the session-protected `/admin/check` board.

## 3. Admin endpoints

### 3.1 Endpoint table

| Method + path | File | Auth | Limiter / quota | Purpose |
| --- | --- | --- | --- | --- |
| `GET /admin/auth/google/start` | `app/admin/auth/google/start/route.ts` | Public | None | Begin Google OAuth |
| `GET /admin/auth/google/callback` | `app/admin/auth/google/callback/route.ts` | Public | `LOGIN_IP` + `LOGIN_ALL` | Complete Google OAuth, whitelist check, start session |
| `POST /admin/photos/upload` | `app/admin/photos/upload/route.ts` | Admin session | Daily `CAPS.photo` / `CAPS.video` | Upload one photo/video plus optional thumbnail/poster |

### 3.2 `GET /admin/auth/google/start`

File: `app/admin/auth/google/start/route.ts`

Auth: public.

Request: none. Deliberately a top-level navigation, not a Server Action.

Response: `302` redirect to the Google authorization URL containing:

- `redirect_uri` to `/admin/auth/google/callback` on the current origin
- a one-time `randomUUID()` state

State is stored with `setOAuthState(state)`.

Errors: none handled locally. OAuth/verification errors appear later on the callback.

### 3.3 `GET /admin/auth/google/callback`

File: `app/admin/auth/google/callback/route.ts`

Auth: public.

Query params:

| Param | Purpose |
| --- | --- |
| `code` | Google authorization code |
| `state` | One-time OAuth state |

Success: `302` redirect to `/admin`.

Failure: `302` redirect to `/admin/login?e=<code>`.

| `e` value | Meaning |
| --- | --- |
| `state` | Missing/invalid state or code |
| `google` | Google token/verification failure |
| `notwhitelisted` | Verified email is not present in `admin_users` |
| `slow` | `LOGIN_IP` or `LOGIN_ALL` rate limit exceeded |

Rate limiting:

- `env.LOGIN_IP.limit({ key: CF-Connecting-IP })`
- `env.LOGIN_ALL.limit({ key: "login" })`

Both are checked with `Promise.all`; either failure redirects to `/admin/login?e=slow`.

Audit:

- Rejected whitelist email:
  - `actor = 'google-oauth'`
  - `action = 'admin_login.rejected'`
  - `slug = <verified email>`
- Successful login:
  - `actor = <admin username>`
  - `action = 'admin_login.ok'`
  - best-effort `.catch(() => {})`

On success, `startSession(row.username)` is called and the browser is redirected to `/admin`.

### 3.4 `POST /admin/photos/upload`

File: `app/admin/photos/upload/route.ts`

Auth: admin session required.

Content type: `multipart/form-data`.

Request fields:

| Field | Required | Constraints |
| --- | --- | --- |
| `file` | yes | Main photo/video file |
| `name` | yes | Trimmed to 120 chars |
| `filename` | no | Original filename used only to help magic-byte sniffing |
| `thumb` | no | Optional WebP thumbnail; max `MAX_BYTES.photo` |
| `poster` | no | Optional video poster; max `MAX_BYTES.photo` |
| `width` | no | Optional numeric string |
| `height` | no | Optional numeric string |

Uses `.stream()` for uploads.

Success response, HTTP `200`:

```json
{
  "ok": true,
  "item": {
    "path": "/img/<key>",
    "thumb": "/img/<thumbKey or key>",
    "name": "...",
    "bytes": 12345,
    "kind": "photo"
  },
  "left": 29
}
```

`left` is `CAPS[kind] - used - 1`.

Refusal response:

```json
{ "ok": false, "refusal": "human sentence" }
```

Statuses:

| Status | When |
| --- | --- |
| `401` | No admin session |
| `400` | No file, missing name, magic sniff refusal, too-large file, or `FormData` parse failure |
| `429` | Daily cap reached for that kind |
| `500` | Audited D1 write or R2 put fails after partial write; stored objects are deleted before responding |

Daily quotas:

| Cap | Limit | Period |
| --- | --- | --- |
| `CAPS.photo` | 30 | Kathmandu calendar day |
| `CAPS.video` | 5 | Kathmandu calendar day |

Per-upload byte limits:

| Limit | Value | Applies to |
| --- | --- | --- |
| `MAX_BYTES.photo` | `2097152` bytes | Photos, thumbnails, posters |
| `MAX_BYTES.video` | `26214400` bytes | Main video file |

Magic sniffing:

- `sniff(head, originalFilename)` checks the first 16 bytes plus optional original filename.
- Returns `{ kind, ext, mime }` or a refusal.
- Original filename is never used as the R2 key.

R2 object keys:

- Main: `${crypto.randomUUID()}.${seen.ext}`
- Thumbnail/poster: `${crypto.randomUUID()}-${label}.webp`

Uploaded filename is never persisted as a column.

D1 side effects:

- Insert one `media_assets` row.
- `bytes` column is `file.size + thumb.size + poster.size`.
- `auditedWrite` records:
  - `action = 'media.upload'`
  - `section = 'media'`
  - `slug = <key>`
  - `after = { name, kind, bytes }`

On later failure, all written R2 keys are deleted.

Design note: the route handler is used instead of a Server Action because `next.config.mjs` caps Server Action bodies at 3 MB. However, `request.formData()` still buffers the entire body; a 25 MB clip costs about 50 MB of the Worker’s 128 MB budget.

## 4. Media serving: `GET /img/[...key]`

File: `app/img/[...key]/route.ts`

Auth: public.

Catch-all path after `/img/` is joined with `/` and used as the raw R2 object key.

Example:

```text
/img/abc/def -> R2 key "abc/def"
```

Response:

- `200` with the R2 object body.
- Headers from `object.writeHttpMetadata`.
- `Cache-Control: public, max-age=31536000, immutable`
- `ETag` from `object.httpEtag`

Missing object:

```text
404
body: Not found
```

Rate limiting: none; this route is CDN-cached.

Important details:

- It is not under `/media` because `/media/*` already exists as static assets in `dist/client`.
- Uploaded keys are UUID-based, so an object can be cached forever; a replaced photo gets a new key and no stale-image risk.
- This handler serves the stored R2 object byte-for-byte. No Cloudflare Images transform query parameters are used by this route, even though the main Worker has an `IMAGES` binding.

## 5. Server actions / non-REST mutation paths

These are not separate route files under `app/api`; they are Next.js Server Actions inside admin pages.

| Source / page | Mutation path | Auth/permission | Side effects |
| --- | --- | --- | --- |
| `/admin/content` | Content CRUD for `hero`, `service`, `room`, `gallery` sections | `requireSession()` | D1 `content` writes through `auditedWrite`; `published` controls public visibility |
| `/admin/amenities` | Dedicated amenity editor | `requireSession()` at write time | Writes `content` rows with `section='amenity'`; controls category membership, paid marker, highlights grid, six-symbol little-touches strip; audited |
| `/admin/menu` | Per-category CRUD for dishes/drinks and price rows | `requireSession()` | Writes menu `content.extra` through the rules in `lib/menu.ts` |
| `/admin/photos` | Media metadata edit and protected deletion | `requireSession()`; deletion requires `content.delete` | Edits `media_assets`; deletions audited and send an alert |
| `/admin/settings` | Structured settings save | `requireSession()`; email row requires `settings.email` capability or grant | Writes settings and room size changes in one audited D1 batch |
| `/admin/accounts` | Add/change admin accounts, grant/revoke capabilities | `requireSession()`; `accounts.manage` to add/change accounts | Writes `admin_users` and `permission_grants`; audited |
| `/admin/analytics` | Raw IP reveal | `analytics.ip` capability or 24-hour grant | Every IP reveal is audited |

Server Actions do not run layouts, so each admin page/action must call `requireSession()` directly. Writes generally go through `auditedWrite()` so the write and one `audit_log` row land in the same D1 batch transaction.

## 6. Scheduled Worker HTTP endpoints

The three maintenance Workers are separate Cloudflare Workers under `workers/`. Scheduled cron paths do not use HTTP or tokens; manual triggers do.

### 6.1 Manual HTTP endpoints

| Worker | Allowed path | Auth | Success response | Error response |
| --- | --- | --- | --- | --- |
| `thakali-inn-audit-archiver` | Any path; handler does not inspect URL | `Authorization: Bearer <ARCHIVER_TOKEN>` | `200` JSON `{ archived: number, remaining: number }` | `403` plain text `forbidden` |
| `thakali-inn-health-check` | `/run` | `X-Check-Token: <CHECK_TOKEN>` | `200` JSON `{ passed: number, total: number, failed: array, forgotten: number }` | `404` plain text `not found`; `401` plain text `no` |
| `thakali-inn-r2-backup` | `/restore/:urlencoded-key` for restore; any non-`/restore/...` path runs a full mirror | `Authorization: Bearer <BACKUP_TOKEN>` | Mirror: `{ copied: number, skipped: number }`; restore: `{ restored: true, key: string }` | `403` plain text `forbidden`; missing restore source returns `{ restored: false, reason: "not found in backup" }` |

### 6.2 `thakali-inn-audit-archiver`

Manual trigger auth: `ARCHIVER_TOKEN`.

Behaviour:

- Selects up to `BATCH_LIMIT=100` rows:

```sql
archived_at IS NULL
ORDER BY id ASC
```

- Archives each row as JSON to:

```text
thakali-inn-audit-archive/{10-digit-padded id}.json
```

Example: `0000000042.json`.

- On successful R2 `put`, updates D1 with `archived_at = datetime('now')`.
- Per-object R2 errors are swallowed; the current row remains `NULL` and retries later.
- `remaining` is only the count not archived in this batch, not the total unarchived count.

### 6.3 `thakali-inn-health-check`

Manual trigger auth: `X-Check-Token` equal to `CHECK_TOKEN`.

`GET /run` / any method on `/run`:

1. Runs `forgetOldAddresses()` first, which blanks:

```sql
page_views.ip
```

for rows where:

```sql
ip != ''
AND day < date('now', '-1 year')
```

2. Runs `runChecks()`.
3. If `failed.length` is non-zero, sends an alert email from `notify@hotelthakaliinn.com` to `hotelthakaliinn1@gmail.com`.
4. Returns JSON.

The email send is awaited, so an email failure can prevent the JSON response.

### 6.4 `thakali-inn-r2-backup`

Manual trigger auth: `BACKUP_TOKEN`.

Full mirror:

- Mirrors every object from `thakali-inn-media` to `thakali-inn-media-backup`.
- Uses R2 list cursors.
- HEADs the backup key and compares ETags.
- Skips unchanged objects.
- Preserves `httpMetadata` and `customMetadata`.
- Never deletes backup keys absent from the live bucket.

Restore:

- Reads an object from `thakali-inn-media-backup`.
- Writes it to `thakali-inn-media`.
- Preserves `httpMetadata` and `customMetadata`.
- Returns `{ restored: false, reason: "not found in backup" }` if absent.

Restore can overwrite the live object with no extra confirmation beyond the Bearer token.

### 6.5 Cron schedules

| Worker | Cron | What it does |
| --- | --- | --- |
| `thakali-inn-audit-archiver` | `*/5 * * * *` | Archival pass described above |
| `thakali-inn-r2-backup` | `0 3 * * *` | Nightly live-to-backup mirror |
| `thakali-inn-health-check` | `15 22 * * *` | 22:15 UTC; IP retention, `/api/check?full=1`, public page probes, alert email on failure |

The health-check Worker calls:

```text
https://hotelthakaliinn.com/api/check?full=1
```

with:

```text
X-Check-Token: <CHECK_TOKEN>
User-Agent: thakali-inn-nightly
```

It also independently fetches every route from `lib/public-routes.ts`:

```text
PUBLIC_ROUTES
PAGE_MUST_CONTAIN
```

Page fetches use:

```text
?selfcheck=<timestamp>
Cache-Control: no-cache
```

## 7. Metadata routes

| Metadata surface | File/convention | Notes |
| --- | --- | --- |
| Sitemap | `app/sitemap.ts` | Uses `PUBLIC_ROUTES` from `lib/public-routes.ts`; base URL from `SITE_URL` in `lib/site.ts` |
| Manifest | `app/manifest.ts` | Uses the shared `DESCRIPTION` constant from `lib/site.ts` |
| OpenGraph image | `app/opengraph-image.tsx` | Present as a Next.js generated metadata image route; no dynamic handler details extracted in the source notes |
| Robots | No `app/robots.ts` appears in the repository census | No explicit robots route is documented in the source notes |

## 8. Rate limits

Numeric limits below come from the live Cloudflare resource inventory `cf-live.json`.

| Limiter / quota | Binding or constant | Limit | Period | Applies to | Key | Exceeded behaviour |
| --- | --- | --- | --- | --- | --- | --- |
| Login per IP | `LOGIN_IP` | 5 | 60 seconds | `GET /admin/auth/google/callback` | `CF-Connecting-IP` | `302 /admin/login?e=slow` |
| Login global | `LOGIN_ALL` | 20 | 60 seconds | `GET /admin/auth/google/callback` | `"login"` | `302 /admin/login?e=slow` |
| View collector | `VIEW_IP` | 60 | 60 seconds | `POST /api/view` | visitor IP or `"unknown"` | HTTP `204` silently |
| Form submissions | `FORM_IP` | 5 | 60 seconds | `POST /api/booking` | `booking:${ip}` | HTTP `429` JSON |
| Form submissions | `FORM_IP` | 5 | 60 seconds | `POST /api/contact` | `contact:${ip}` | HTTP `429` JSON |
| Photo upload quota | `CAPS.photo` | 30 | Kathmandu calendar day | `POST /admin/photos/upload` | daily `media_assets` count | HTTP `429` JSON `{ ok: false, refusal: "..." }` |
| Video upload quota | `CAPS.video` | 5 | Kathmandu calendar day | `POST /admin/photos/upload` | daily `media_assets` count | HTTP `429` JSON `{ ok: false, refusal: "..." }` |

Per-upload byte ceilings are not Cloudflare rate limiters, but they are enforced before storage:

| Constant | Limit |
| --- | --- |
| `MAX_BYTES.photo` | 2,097,152 bytes |
| `MAX_BYTES.video` | 26,214,400 bytes |

## 9. Known issues / gotchas

### Auth and OAuth

- `CHECK_TOKEN` must be configured on both the main Worker and `thakali-inn-health-check`. Changing it in only one place makes the nightly run fail.
- If `CHECK_TOKEN` is unset, `/api/check` intentionally returns `404`, not an open empty-string-token endpoint.
- The local `timingSafeEqual()` helper returns early on length mismatch, so it is not fully constant-time over length; only equal-length values get constant-time XOR.
- Health-check `/run` has no explicit token-presence check before `timingSafeEqual`. If `CHECK_TOKEN` is ever unset and the `X-Check-Token` header is absent, both values become `''` and the request is authorized.
- Admin session revocation depends on a DB lookup at `requireSession()` time. If `admin_users` is unreachable, guarded pages behave as logged out.
- Successful login audit writes are best-effort and must never fail a login.
- `sameSite=Lax` is required for the admin and OAuth state cookies; `Strict` would be dropped mid-redirect-chain after Google returns.

### Forms and public APIs

- Honeypots in `/api/booking` and `/api/contact` are checked after the rate limiter, so bots cannot hammer the logging path for free.
- `/api/view` always returns `204`, including for `D1` insert errors, so front-end code cannot distinguish success from rate limiting or failure.
- `/api/view` uses `request.cf`, which may be absent under local adapters; the code falls back to `CF-IPCountry` and empty strings.
- Relying only on email regex or `nights()` NaN for booking-date validation is not enough; a syntactically valid but impossible date is caught by the real-day round-trip.
- Form and booking email failures are logged but do not fail the request. The D1 row is the durable record.

### Uploads and media

- Server Action bodies are capped at 3 MB by `next.config.mjs`, which is why uploads use a route handler.
- `request.formData()` buffers the whole upload body; a 25 MB clip costs about 50 MB of the Worker’s 128 MB budget.
- An upload route under `/api` would not receive the session cookie because the cookie `Path` is `/admin`.
- Uploaded files must be served from `/img`, not `/media`; `/media/*` is static asset output in `dist/client`.
- Daily upload counts are per Kathmandu day, not UTC or browser day.
- Partial upload failures delete written R2 keys, but delete errors are swallowed.

### Media backup

- `thakali-inn-r2-backup` treats every path that does not match `/restore/:key` as a full mirror. A valid token on an unintended path will run a full mirror.
- The r2-backup restore route can overwrite a live `MEDIA` object from `MEDIA_BACKUP` with no confirmation beyond `BACKUP_TOKEN`.
- The nightly mirror is not a versioning backup for overwritten objects. If the live object’s ETag changes after a backup, the next nightly run overwrites the backup copy.
- Objects deleted from live media are not removed from the backup bucket.

### Audit archiving

- The audit archiver and r2-backup fetch handlers do not check the HTTP method; any method with a valid token triggers the action.
- Audit archiver `remaining` is only current-batch failures, not total unarchived rows.
- There is no cursor; repeated cron runs drain the queue.
- Per-object R2 failures during audit archiving are silently caught and retried later; there is no dead-letter queue or separate alert in that Worker.

### Health check

- A `page_views` retention failure is only `console.error`’d when checks still pass; it does not by itself trigger an alert email.
- Public-page failures are collapsed into one grouped check, so the passed/total count can undercount the number of broken routes.
- If `/api/check` is unreachable, the health-check Worker reports a failed entry named `The site itself`.
- Health-check page fetches cancel the body when `PAGE_MUST_CONTAIN` has no entry for a route.
- Email is sent only on failure; there is deliberately no nightly all-clear email.

### Permissions and settings

- The email destination is pinned in deploy configuration. Changing the `settings.email` row without a matching deploy can stop mail arriving.
- `staff` role cannot receive any 24-hour grant.
- Permission grants expire after 24 hours; revoked or expired rows remain in the table for audit history but disappear from live queries.
- `bankStats()` only sums `media_assets`; git-shipped repo media contributes `0` bytes to the storage gauge.
- Repo media path items cannot be deleted from the admin because the files live in git and are served by Cloudflare assets, not R2.

### Caching

- Do not set `cf.cacheTtl` on outbound fetches from `/api/live`: force-dynamic propagates no-store to subrequests, and the Workers cache refuses `CacheTtl` on a no-store request.
- The `/api/live` two-minute cache is intentional; settings-driven live fields such as rain-glass toggles become visible within two minutes.

### Data assumptions

- `page_views` rows written before migration `0020` have empty `visitor`, `at`, geography, and device strings. Analytics helpers handle these deliberately.
- `SQLite strftime('%w')` returns `0` for Sunday; weekday results are relabeled to a Monday-start axis by the panel.
- Raw visitor IPs are not included in default list queries; reveals require `analytics.ip` and are audited.

## Cross-links

- [README](../README.md)
- [Cloudflare resources and deployment](cloudflare.md)
- [Admin panel](admin.md)
- [Data model](data-model.md)
- [Frontend](frontend.md)
- [Operations and scheduled Workers](operations.md)

## Server library modules (`lib/`)

Related chapters: [`docs/cloudflare.md`](cloudflare.md) for bindings and rate limits, [`docs/admin.md`](admin.md) for capability enforcement in the UI, [`docs/data-model.md`](data-model.md) for table schemas, [`docs/operations.md`](operations.md) for scripts, cron and self-checks.

### Module table

| Module path | What it exports | Responsibility | Used by |
|---|---|---|---|
| `lib/amenities.ts` | `CATEGORY_ICONS`, `TOUCH_NAMES`, `AmenityExtra`, `composeAmenityExtra()` | Shared amenity category icons, touch names, extra JSON shape, and composition guard. | Public amenity page, `/admin/amenities`, `scripts/amenity-check.mjs`, `components/TouchGlyph.tsx`. |
| `lib/analytics.ts` | `dailyCounts()`, `topPages()`, `topReferrers()`, `topCountries()`, `recentVisitors()`, `visitorJourney()`, `returningVisitors()`, `uniqueVisitors()`, `byHour()`, `byWeekday()`, `visitorAddress()`, `sparklineSeries()` | D1 `page_views` SQL helpers for the dashboard and detailed visit analytics. | `/admin/analytics`, admin dashboard summary. |
| `lib/audit.ts` | `auditedWrite()`, `alertDelete()` | Atomic admin writes with audit-log insertion in one D1 batch; delete email alerts. | Every admin write Server Action (`/admin/content`, `/admin/settings`, `/admin/menu`, `/admin/amenities`, `/admin/accounts`, `/admin/photos`, requests/messages actions). |
| `lib/auth.ts` | `requireSession()`, `getActor()`, `hasSession()`, `peekSession()`, `startSession()`, `setOAuthState()`, `consumeOAuthState()` | HMAC-signed admin session cookies and OAuth state cookies; re-reads `admin_users` on guarded calls. | Every admin page and Server Action; Google OAuth callback; admin navigation/dashboard. |
| `lib/carousel.ts` | `DRAG`, `SWAY` | Shared carousel tuning constants. | `components/HeroCarousel.tsx`, `components/RoomsCarousel.tsx`, `components/ServicesCarousel.tsx`. |
| `lib/chart.ts` | `axisIndices()` | Pure chart/axis arithmetic with no imports. | `/admin/analytics`, admin dashboard chart rendering, `scripts/sparkline-check.mjs`. |
| `lib/checks.ts` | `CHECKS`, `runChecks()` | Full self-check definitions, split into read and write checks. | `/admin/check` (`CheckBoard.tsx`), nightly health-check Worker. |
| `lib/content.ts` | `section()`, `settings()`, `list()`, `parseExtra()`, `mediaReferences()` | Intended D1 reader for content cards/settings and media-reference tracking. | Public pages, `/admin/content`, `/admin/photos`, photo sweeps. |
| `lib/google-auth.ts` | `verifyGoogleCode()` | Google OAuth authorization-code exchange and ID-token verification. | `/admin/auth/google/start`, `/admin/auth/google/callback`. |
| `lib/live.ts` | Kathmandu-time helpers, `Live` payload type/shape, `SkyKey` sky keys, `rainGlass` resolution | Kathmandu-local date/time and live payload shape shared by public UI. | `components/Live.tsx`, root layout, public pages, WhatsApp/float logic. |
| `lib/media-store.ts` | `dailyCount()`, `bankStats()`, `bankItems()` | D1-backed media accounting and full picker bank including repo-shipped files. | `/admin/photos`, media picker, content image chooser. |
| `lib/media.ts` | `ACCEPT`, `CAPS`, `MAX_BYTES`, `MAGIC`, `RAW_REFUSAL`, `BANK_FREE_BYTES`, `BANK_WARN_BYTES`, `CAP_RESET`, `formatBytes()`, `sniff()` | Pure upload rules, byte budgets, magic-byte sniffing, and byte formatting. | `/admin/photos`, `/admin/photos/upload`, `/admin/content`, browser uploader. |
| `lib/menu.ts` | `SIZE_NAMES`, `composeMenuExtra()` | Menu multi-pour size and price composition/validation. | `/cuisine`, `/admin/menu`, `scripts/menu-check.mjs`. |
| `lib/permissions.ts` | `CAPABILITIES`, `can()`, `decisions()`, `liveGrants()`, `grantStatement()`, `revokeStatement()`, `timeLeft` re-export | Role/capability authorization and 24-hour permission grants. | `/admin/accounts`, `/admin/settings`, `/admin/analytics`, `/admin/content`, `/admin/photos`. |
| `lib/public-routes.ts` | `PUBLIC_ROUTES`, `PAGE_MUST_CONTAIN` | Dependency-free public route list and expected render phrases. | `/admin/check` browser probe, nightly health Worker, `app/sitemap.ts`. |
| `lib/repo-media.ts` | `REPO_MEDIA` | Lists git-shipped files under `public/media`. | `lib/media-store.ts`, `scripts/media-check.mjs`. |
| `lib/settings-schema.ts` | Vocabularies, normalizers, validators, parsers, composers, `FormValues`, `RoomRow`, `toFormValues`, `sanitizeFormValues`, `computeErrors`, `composeAll`, `jsonList` | Full schema/validation/composition for settings and property-fact rows. | `/admin/settings` server action, `components/../SettingsForm.tsx`, `scripts/settings-check.mjs`, public contact/booking helpers. |
| `lib/site.ts` | `SITE_URL`, `DESCRIPTION`, `phoneHref()`, `waHref()`, `normalizeEmail()`, `mapEmbedUrl()`, `directionsUrl()`, `timeLeft()` | Hardcoded deployment constants and derived public URL/phone/email helpers. | Public layout/metadata/sitemap/footer, `/contact`, admin grants, Google OAuth callback. |
| `lib/sparkline.ts` | `sparklinePoints()`, `weekDelta()` | Pure SVG sparkline points and week-over-week percentage math. | Admin dashboard sparkline, `scripts/sparkline-check.mjs`. |

### `lib/auth.ts`

Main concerns:

- Creates and verifies the admin session cookie `ti_admin`.
- Cookie value format: `<username>|<unix-expiry>.<hex-HMAC(SHA-256)>`.
- Cookie constraints: `httpOnly`, `secure`, `sameSite=Lax`, `path=/admin`, `maxAge=43200s` (12 hours).
- Usernames cannot contain `.` or `|`.
- `SESSION_SECRET` is cached as a non-extractable `CryptoKey`.
- `requireSession()` re-reads `admin_users` on every call, so deleting an admin row revokes an issued cookie.
- `getActor()` returns the username for audit attribution.
- `hasSession()`/`peekSession()` are UI helpers and must not be used as guards.
- OAuth CSRF state uses `ti_oauth_state`, path `/admin/auth/google`, TTL 300s.
- `setOAuthState()` stores state; `consumeOAuthState(expected)` validates and deletes it.
- Uses `cookies()` from `next/headers` and `redirect()` from `next/navigation`.

Gotchas:

- Next.js layouts do not protect Server Actions; every admin page and action must call `requireSession()` itself.
- `sameSite=Lax` is required because `Strict` would be dropped mid-OAuth redirect chain.
- `SESSION_SECRET` rotation, or a username containing forbidden characters, invalidates sessions.
- If `admin_users` cannot be read, guarded pages behave as logged out and redirect to `/admin/login`.

### `lib/google-auth.ts`

Main concern:

- `verifyGoogleCode()` exchanges a Google authorization code and verifies the returned ID token.
- Uses `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`.
- Verifies signature with `jose` against `https://www.googleapis.com/oauth2/v3/certs`.
- Requires issuer to be `https://accounts.google.com` or `accounts.google.com`.
- Requires audience to be `GOOGLE_CLIENT_ID`.
- Requires `payload.email_verified` to be `true`.
- OAuth scope is `openid email`; response type is `code`; prompt is `select_account`.
- Emails are normalized with `normalizeEmail()` from `lib/site.ts`.

Gotchas:

- The OAuth state cookie must also use `sameSite=Lax` for the same redirect-chain reason as the session cookie.
- The `admin_users` table is the whitelist; a verified Google email can start a session only if it already exists there.

### `lib/permissions.ts`

Main concern:

- Implements role/capability authorization.
- Roles: `owner`, `developer`, `staff`.
- `CAPABILITIES` maps each capability to `holders` and `grantable` roles.
- Capabilities:
  - `settings.email`: change enquiry-destination email; holders `[developer]`, grantable `[owner]`.
  - `analytics.ip`: reveal visitor IP; holders `[developer]`, grantable `[owner]`.
  - `content.delete`: permanently delete rooms/pages/photos/accounts; holders `[developer]`, grantable `[owner]`.
  - `accounts.manage`: add/change admin accounts; holders `[developer]`, grantable `[owner]`.
  - `audit.read`: read audit log; holders `[developer, owner]`, grantable `[]`.
- Functions: `can()`, `decisions()`, `liveGrants()`, `grantStatement()`, `revokeStatement()`.
- Grant/revoke are statements so callers can batch them with audit rows through `auditedWrite()`.
- Grants expire using `datetime('now', '+24 hours')`.
- `revoked_at` soft-revokes while preserving audit history.
- Re-exports `timeLeft` from `lib/site.ts`.

Gotchas:

- A missing `permission_grants` table must deny, not throw.
- `staff` cannot receive any of the four developer-only grants.
- `accounts.manage` is dangerous because the accounts table is the login whitelist.
- `analytics.ip` reveals must be audit-logged each time.

### `lib/audit.ts`

Main concern:

- `auditedWrite()` performs the admin write and inserts an audit row in the same `env.DB.batch()` transaction.
- Audit fields: `actor`, `action`, `section`, `slug`, `before` JSON, `after` JSON.
- `alertDelete()` runs for action strings ending in `.delete`.
- Delete alert subject: `Admin delete — <section> / <slug> — by <actor>`.
- Hardcoded sender: `notify@hotelthakaliinn.com`.
- Hardcoded recipient: `hotelthakaliinn1@gmail.com`.

Gotchas:

- Email failure is swallowed after the D1 batch commits; mail cannot roll back the admin mutation.
- WORM R2 archiving is eventual by design; cron copies unarchived rows later.

### `lib/analytics.ts`

Main helpers:

- `dailyCounts()` — one query serving today, both 7-day windows, and the 30-day sparkline.
- `topPages()`, `topReferrers()`, `topCountries()`, `recentVisitors()`, `visitorJourney()`.
- `returningVisitors()` — a returning visitor is one appearing on more than one Kathmandu day.
- `visitorAddress()` — fetches one visitor’s last non-empty `ip`, only when capability-gated `SHOW IP` is pressed.
- `byHour()` — ignores `at=''` from pre-migration rows rather than counting them as midnight.
- `byWeekday()` — raw SQLite weekdays must be relabelled to a Monday-start axis.

Error contract:

- `null` means the query threw.
- `[]` means a legitimate empty answer.
- Callers must not render a wrong number as if it were true.

Gotchas:

- `topPages`/`topReferrers`/`topCountries`/`recentVisitors`/`visitorJourney` interpolate internal limit integers into SQL; user input must not be passed there.
- IPs are never selected by normal list queries.
- Pre-0020 rows have empty `visitor`/`at`/geography/device strings and must be handled specially.

### `lib/checks.ts`

Main concern:

- Defines `CHECKS` as read checks and write checks.
- `runChecks(full)` runs read checks on board open and add write/email checks when `full` is true, such as nightly cron or an explicit full check.
- Checks cover settings presence, content/media availability, audit-write ability, account uniqueness, permission-grant liveness, storage, and email.
- Write checks run sequentially, never with `Promise.all`.

Gotchas:

- The public-pages-load check deliberately does not run as a worker self-fetch; it runs in the browser `CheckBoard` and the separate nightly health Worker using `lib/public-routes.ts`.
- A failing check reports its own lamp rather than taking down the board.

### `lib/content.ts`

Main functions:

- `section(name, includeHidden=true)` — reads published content cards; public pages call it without hidden rows, admin calls it with hidden rows.
- `settings()` — loads every settings row in one round trip.
- `list()` — parses JSON-list settings strings.
- `parseExtra()` — returns `{}` when `extra` is invalid JSON.
- `mediaReferences()` — one `UNION ALL` over `content.image`, `content.video`, and `content.icon`, returning a `Map<file, {section, slug}[]>`.

Gotchas:

- This module imports `cloudflare:workers`; importing it from any `use client` component fails at build time by design.
- The media-reference scan must include every column that stores media paths, or the sweeper may delete a live photo.
- Public pages use `section()`/`settings()` rather than touching D1 directly.

### `lib/media.ts`

Pure upload rules shared by browser and server:

- `ACCEPT`: `image/jpeg`, `image/png`, `image/webp`, `video/mp4`.
- `CAPS`: `photo` 30 per Kathmandu day, `video` 5 per Kathmandu day.
- `MAX_BYTES`: `photo` 2 MB, `video` 25 MB.
- `CAP_RESET`: `"midnight, Kathmandu time"`.
- `MAGIC`/`sniff(head, filename)`: validates real bytes, not client MIME.
- `formatBytes()` formats storage totals.
- `BANK_FREE_BYTES`/`BANK_WARN_BYTES` drive the storage gauge.
- `RAW_REFUSAL` tells staff to upload the `.JPG` twin of a camera negative.

Magic-byte rules:

- JPEG: `FF D8 FF`.
- PNG: `89 50 4E 47`.
- WebP: `RIFF` plus `WEBP` at bytes 8–12.
- MP4: `ftyp` at offset 4.
- Camera RAW/TIFF negatives are rejected before normal signature checks.

Gotchas:

- Caps are hotel-wide per day, not per person.
- The 2 MB photo cap assumes the browser resized to a 1600px WebP first.
- A legitimate TIFF would be refused, but TIFF is not an accepted upload type.

### `lib/media-store.ts`

Main functions:

- `dailyCount(kind)` — counts today’s `media_assets` rows by Kathmandu day and kind.
- `bankStats()` — one aggregate over `media_assets`: total bytes plus photo/video counts.
- `bankItems()` — returns uploaded media newest-first plus repo files alphabetically; includes `usedBy` from `mediaReferences()`.

Path conventions:

- Uploaded original path: `/img/<key>`.
- Thumbnail selection order: `thumb_key`, then `poster_key`, then the original path.
- Repo media path: `/media/...`.

Gotchas:

- `bankStats()` sums only `media_assets`; repo media contributes `0` bytes to the storage gauge.
- Thumbnails and posters are counted because they are real R2 objects.
- Repo entries use `bytes:0`, `repo:true`, and cannot be deleted from admin.

### `lib/menu.ts`

Main concern:

- `SIZE_NAMES` is offered as a datalist, so bar staff can enter unforeseen sizes.
- `composeMenuExtra()` validates and stores multi-pour size/price rows in menu `extra`.
- `price` remains the first/smallest pour for legacy readers.
- Blank price rows are silently ignored.
- Non-blank rows require unique case-insensitive labels.

Gotchas:

- Validation errors are returned as `{ error: 'price' | 'label' | 'duplicate' }`, not thrown.
- This module must remain free of Cloudflare imports so browser, server, and `scripts/menu-check.mjs` can share it.

### `lib/amenities.ts`

Main concern:

- `CATEGORY_ICONS` maps an amenity category label to its glyph.
- `TOUCH_NAMES` are `cup`, `fruit`, `wine`, `buffet`, `minibar`, `diet`.
- `composeAmenityExtra()` rejects unknown touch names instead of silently dropping them from the touch strip.
- `AmenityExtra` stores `{}` when a row has neither `featured` nor `touch`.

Gotchas:

- A staff-typed category not present in `CATEGORY_ICONS` renders as a bare dot.
- `TouchGlyph` has one case per `TOUCH_NAMES` entry; an unrecognized name draws nothing.

### `lib/live.ts`

Main concerns:

- Kathmandu-local helpers: `kathmanduDay()`, `kathmanduNow()`, `kathmanduDayBefore()`.
- `kathmanduDay()` uses `Intl.DateTimeFormat('en-CA', { timeZone })` for ISO dates.
- `kathmanduNow()` uses `formatToParts` with `hourCycle: h23`.
- `kathmanduDayBefore()` anchors on UTC noon to avoid the `+05:45` offset crossing midnight.
- `SkyKey`: `clear`, `cloudy`, `fog`, `rain`, `snow`, `storm`; the client stamps `data-sky` with the key, never a human string.
- Live payload carries `phone`, `whatsapp`, `socials`, `address`, `email`, and nullable `temp`/`sky`/`aqi`.
- Rain-glass toggles are resolved server-side into one `rainGlass` boolean.

Gotchas:

- An empty `phone` means the floating WhatsApp button does not render.
- Kathmandu is `UTC+5:45`; all date/day logic must remain Kathmandu-local rather than UTC.

### `lib/site.ts`

Main constants/functions:

- `SITE_URL = https://hotelthakaliinn.com`, no trailing slash.
- `DESCRIPTION` is the single site pitch used in metadata, manifest, JSON-LD, and footer.
- `phoneHref(stored phone) -> tel: URL`.
- `waHref(stored phone) -> wa.me URL`, attempting to guarantee `+977`.
- `normalizeEmail()` for whitelist identity comparisons.
- `mapEmbedUrl(lat, lng)` for keyless Google Maps embed.
- `directionsUrl(plusCode)` for directions.
- `timeLeft()` for admin grant expiry display.

Gotchas:

- These values are hardcoded deploy config and not staff-editable.
- `timeLeft` appends `Z` to a bare wall-clock string before parsing; this matters in Kathmandu’s `UTC+5:45`.

### `lib/settings-schema.ts`

This is the largest shared pure-logic module. It owns:

- Vocabularies: `COUNTRY_CODES`, `AMENITIES`, `SOCIAL_PLATFORMS`, `MAPS_HOSTS`, `BOOKING_HOSTS`, `ARRIVAL_UNITS`, `ROOM_SIZE_UNITS`, `MEALS`, `MEAL_STYLES`.
- Normalizers: `tidy`, `digitsOnly`, `tidyEmail`, `tidyUrl`, `tidyPlusCode`.
- Validators: `checkRequired`, `checkPhone`, `checkEmail`, `checkUrl`, `checkLat`, `checkLng`, `checkCoord`, `checkPlusCode`, `checkPostal`, `checkArrivalValue`, `checkRoomSize`.
- Time: `parseHm`, `clock`, `meridiem`, `timeRange`.
- Coordinates: `coordsFromMapsUrl`.
- Composers: `composePhone`, `composeAddress`, `composeAmenities`, `composeSizePair`, `composeRoomSize`, `smallestRoomSize`, `composeMeal`, `composeGoodRow`, `composeArrival`, `composeArrivalLine`, `composeGoodToKnow`.
- Parsers: `parsePhone`, `parseAmenities`, `parseArrival`, `parseGoodRow`.
- Form support: `FormValues`, `RoomRow`, `toFormValues`, `sanitizeFormValues`, `computeErrors`, `composeAll`.
- Duplicated JSON-list fallback: `jsonList`.

Constants:

- `SQFT_PER_M2 = 10.7639104`.

Gotchas:

- It is imported by both the client `SettingsForm` and the server action so validation cannot drift.
- Social labels must come from a locked select because they key `SiteFooter` icons.
- Social hosts are matched on registrable suffix to reject lookalike hostnames.
- Plus codes use the Open Location Code alphabet and a `+` separator.
- Nepali postal codes are exactly 5 digits.
- Address and room size do not round-trip and remain prose rows.
- `sanitizeFormValues` drops unknown keys and caps list lengths at 40 so malicious payloads cannot throw inside a Server Action.
- Blank `good_rows` or all-blank room sizes are form errors because composing empty lines would blank public-site content.

### `lib/chart.ts`

Main concern:

- Pure chart/axis arithmetic with no imports.
- `axisIndices()` labels the first and last date and picks a stride based on `labelWidth`, default `78px`, so dated labels do not collide.

### `lib/sparkline.ts`

Main functions:

- `sparklinePoints(values, width, height)` returns SVG-compatible polyline points, with `x,y` pairs separated by commas.
- `weekDelta(thisWeek, lastWeek)` returns a rounded `%` or `null`.

Gotchas:

- No imports, so it can run under bare Node and in browser bundles.

### `lib/public-routes.ts`

Main concern:

- No imports, so it can be used by a client component, a separate nightly Worker, and `app/sitemap.ts`.
- `PUBLIC_ROUTES` lists checked public URLs.
- `PAGE_MUST_CONTAIN` maps pages to expected content phrases.

| Route | `PAGE_MUST_CONTAIN` value |
|---|---|
| `/` | none |
| `/rooms` | `Deluxe` |
| `/cuisine` | `Breakfast` |
| `/amenities` | none |
| `/gallery` | none |
| `/contact` | `Sinamangal` |
| `/book` | none |
| `/privacy` | `Privacy` |

Gotchas:

- HTTP 200 does not prove D1 content rendered; the must-contain phrase exists because an empty D1 room result still returns HTTP 200.
- Copy changes must keep `PAGE_MUST_CONTAIN` in sync with the nightly Worker and browser check board.

### `lib/repo-media.ts`

Main concern:

- `REPO_MEDIA` is a single constant listing every git-shipped file under `public/media`.
- These files are served by the assets binding, not R2, and cannot be deleted from the admin.

Exact repository media files grouped by folder:

| Folder | Files |
|---|---|
| `/media` | `ambient.mp4` |
| `/media/amenities` | `front-desk.jpg` |
| `/media/breakfast` | `buffet.jpg`, `dining.jpg`, `fruit.jpg` |
| `/media/gallery` | `arrival.jpg`, `arrival.mp4`, `bathrooms.jpg`, `bathrooms.mp4`, `bedside.jpg`, `bedside.mp4`, `breakfast.jpg`, `breakfast.mp4`, `buffet.jpg`, `buffet.mp4`, `corridor.jpg`, `corridor.mp4`, `dining.jpg`, `dining.mp4`, `lobby.jpg`, `lobby.mp4`, `minibar.jpg`, `minibar.mp4`, `rooms.jpg`, `rooms.mp4`, `signage.jpg`, `signage.mp4`, `window.jpg`, `window.mp4` |
| `/media/hero` | `arrival.jpg`, `breakfast.jpg`, `desk.jpg`, `rooms.jpg` |
| `/media/menu` | `hotel-sketch.png` |
| `/media/rooms` | `deluxe-double.jpg`, `deluxe-king.jpg`, `family.jpg` |
| `/media/services` | `amenities.jpg`, `breakfast.jpg`, `contact.jpg`, `gallery.jpg`, `rooms.jpg` |

Gotchas:

- `scripts/media-check.mjs` compares `REPO_MEDIA` against `public/media` on `npm run check`, so new repo files are not forgotten.

### `lib/carousel.ts`

Main constants:

- `DRAG = 44` px — pointer travel before a drag counts as a swipe/turn.
- `SWAY = 4` degrees of `rotateY` lean.

Used by:

- `HeroCarousel`
- `RoomsCarousel`
- `ServicesCarousel`

Gotcha:

- Constants live in one file so tuning the shared carousel feel touches one module instead of three components.
