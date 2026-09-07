# Cloudflare platform reference

Part of the [Hotel Thakali Inn documentation](../README.md). See also [data model](data-model.md), [admin](admin.md), [API](api.md), [frontend](frontend.md), and [operations](operations.md).

## 1. Account and zone

| Item | Value |
|---|---|
| Cloudflare account ID | not recorded here — run `wrangler whoami` |
| Active zone | `hotelthakaliinn.com` |
| Zone ID | not recorded here — visible on the zone's dashboard overview |
| Zone status | `active` |
| Zone plan | `Free Website` |
| Main Worker | `hotel-thakali-inn` |
| Main Worker custom domains | `hotelthakaliinn.com` and `www.hotelthakaliinn.com` |
| Main Worker routes | None. Custom domains are bound directly to the Worker. |
| Email Routing | Enabled and `ready` for `hotelthakaliinn.com` |

Both `hotelthakaliinn.com` and `www.hotelthakaliinn.com` serve the same Worker. They do not redirect to one another; canonicalization is handled in app metadata with `metadataBase` emitting the apex address.

Not configured in the live inventory:

- No KV namespaces.
- No Pages project.
- No Turnstile widgets.
- No zone-level Worker routes.
- No `workers_dev` host on the main Worker, so the old `*.workers.dev` host is disabled.
- No visible enabled Email Routing forwarding rule; the only listed rule is a disabled catch-all drop.

What could not be read from the API:

- Zone DNS records returned HTTP `403` for the deployment token.
- Zone rulesets/WAF/cache rulesets returned HTTP `403` for the deployment token.
- Turnstile and Pages configuration are absent from both the repository notes and live inventory.

Custom domains (their API record IDs are not recorded here; list them with `wrangler triggers` or the Workers dashboard):

| Domain | Worker | Enabled | Previews |
|---|---|---|---|
| `hotelthakaliinn.com` | `hotel-thakali-inn` production | true | false |
| `www.hotelthakaliinn.com` | `hotel-thakali-inn` production | true | false |

## 2. Main Worker

| Item | Value |
|---|---|
| Worker name | `hotel-thakali-inn` |
| Entrypoint | `vinext/server/fetch-handler` |
| Compatibility date | `2026-08-29` |
| Compatibility flags | `nodejs_compat` |
| Cron triggers | None |
| Assets binding | `ASSETS` |
| Assets `not_found_handling` | `none` |
| Observability | Not enabled |
| Logpush | false |

The main Worker is a Cloudflare Workers / vinext / Next.js 15 App Router application. It serves both:

- force-dynamic SSR pages that read D1, R2, and other bindings, and
- static client assets from `dist/client` through Workers Assets (`ASSETS`).

Security headers are emitted by the Worker through `next.config.mjs`, not through a `_headers` file. Every route using D1 or another binding is force-dynamic.

## 3. Bindings

### Main Worker: `hotel-thakali-inn`

| Binding | Type | Target / resource | Used by | Purpose |
|---|---|---|---|---|
| `ASSETS` | assets | `dist/client` static assets | Main Worker | Serves build output. `not_found_handling` is `none`. |
| `CHECK_TOKEN` | secret | Shared check token | `app/api/check/route.ts` | Authorizes `/api/check`; must match the nightly health-check Worker. |
| `DB` | D1 | `thakali-inn-contact`, ID `62a811d5-4f4b-4268-9b3d-6ea35a08d7e1` | `app/api/booking/route.ts`, `app/api/contact/route.ts`, `app/api/view/route.ts`, `app/admin/auth/google/callback/route.ts`, `app/admin/photos/upload/route.ts`, `lib/auth.ts`, `lib/audit.ts`, `lib/checks.ts`, `lib/content.ts`, `lib/analytics.ts`, `lib/media-store.ts`, `lib/permissions.ts` | Primary D1 database. |
| `EMAIL` | send_email | `notify@hotelthakaliinn.com` -> `hotelthakaliinn1@gmail.com` | `app/api/booking/route.ts`, `app/api/contact/route.ts`, `lib/audit.ts`, `lib/checks.ts` | Sends booking, contact, audit-delete, and health-check mail. |
| `FORM_IP` | ratelimit | namespace_id `1004` | `app/api/booking/route.ts`, `app/api/contact/route.ts` | Limits public form submissions to 5 per 60 seconds per IP. |
| `GOOGLE_CLIENT_ID` | plain_text var | Google OAuth client ID | `lib/google-auth.ts` | Public OAuth client identifier. |
| `GOOGLE_CLIENT_SECRET` | secret | Google OAuth client secret | `lib/google-auth.ts` | OAuth token-exchange secret. |
| `IMAGES` | images | Cloudflare Images API | Main Worker, `vite.config.ts` images optimizer | Wires Cloudflare Images into the vinext image optimizer/CDN adapter. |
| `LOGIN_ALL` | ratelimit | namespace_id `1002` | `app/admin/auth/google/callback/route.ts` | Aggregate login budget: 20 per 60 seconds globally. |
| `LOGIN_IP` | ratelimit | namespace_id `1001` | `app/admin/auth/google/callback/route.ts` | Per-IP login budget: 5 per 60 seconds. |
| `MEDIA` | R2 | `thakali-inn-media` | `app/admin/photos/upload/route.ts`, `app/img/[...key]/route.ts`, `lib/checks.ts`, `lib/content.ts`, `lib/media-store.ts` | Private media bucket. Objects are served through the Worker only. |
| `SESSION_SECRET` | secret | Main Worker session HMAC key | `lib/auth.ts`, `app/api/view/route.ts` | Signs admin session and OAuth state cookies; also HMAC visitor IDs. |
| `VIEW_IP` | ratelimit | namespace_id `1003` | `app/api/view/route.ts` | Limits page-view collection to 60 per 60 seconds per IP. |

### Worker: `thakali-inn-audit-archiver`

| Binding | Type | Target / resource | Used by | Purpose |
|---|---|---|---|---|
| `ARCHIVE` | R2 | `thakali-inn-audit-archive` | `workers/audit-archiver/index.mjs` | WORM-locked audit archive destination. |
| `ARCHIVER_TOKEN` | secret | Bearer token | `workers/audit-archiver/index.mjs` | Authorizes manual archive trigger. |
| `DB` | D1 | `thakali-inn-contact` | `workers/audit-archiver/index.mjs` | Reads unarchived `audit_log` rows and updates `archived_at`. |

### Worker: `thakali-inn-health-check`

| Binding | Type | Target / resource | Used by | Purpose |
|---|---|---|---|---|
| `CHECK_TOKEN` | secret | Shared check token | `workers/health-check/index.mjs` | Authenticates `/run` and calls `/api/check`. |
| `DB` | D1 | `thakali-inn-contact` | `workers/health-check/index.mjs` | Runs the one-year `page_views.ip` retention update. |
| `EMAIL` | send_email | `notify@hotelthakaliinn.com` -> `hotelthakaliinn1@gmail.com` | `workers/health-check/index.mjs` | Sends failure-only health-check alerts. |

### Worker: `thakali-inn-r2-backup`

| Binding | Type | Target / resource | Used by | Purpose |
|---|---|---|---|---|
| `BACKUP_TOKEN` | secret | Bearer token | `workers/r2-backup/index.mjs` | Authorizes manual mirror and restore trigger. |
| `MEDIA` | R2 | `thakali-inn-media` | `workers/r2-backup/index.mjs` | Live media bucket; mirror source and restore destination. |
| `MEDIA_BACKUP` | R2 | `thakali-inn-media-backup` | `workers/r2-backup/index.mjs` | Nightly backup destination and restore source. |

### Drift / live inventory notes

The live inventory confirms the same D1 database ID and same three R2 buckets across the expected Workers. The main Worker carries `CHECK_TOKEN`, `GOOGLE_CLIENT_SECRET`, and `SESSION_SECRET` as installed secrets. The repository config notes explicitly call out `GOOGLE_CLIENT_SECRET`; `SESSION_SECRET` and `CHECK_TOKEN` are required by the code and must remain installed even though they are not plain vars in `wrangler.jsonc`.

## 4. D1

| Item | Value |
|---|---|
| Binding name | `DB` |
| Database name | `thakali-inn-contact` |
| Database ID | `62a811d5-4f4b-4268-9b3d-6ea35a08d7e1` |
| Bound to | `hotel-thakali-inn`, `thakali-inn-audit-archiver`, `thakali-inn-health-check` |
| API-reported table count | `num_tables: 0` |
| Actual file size | `299,008` bytes |

The `num_tables: 0` API result is anomalous given the non-zero file size; see [Known issues / gotchas](#15-known-issues--gotchas).

D1 is queried through `env.DB` in route handlers, server components, and server actions. Writes that must be atomic are batched, for example `auditedWrite()` inserts the changed row and its `audit_log` row in the same `env.DB.batch()` transaction.

Migrations live in `migrations/*.sql`. They are deliberately not applied from CI. Production schema changes are applied manually with:

```bash
wrangler d1 migrations apply --remote
```

Local development and the Playwright rig require a migrated local D1. Migration `0016` performs a `DROP COLUMN`; CI explicitly does not apply migrations because a schema change landing from a push has no undo beyond Cloudflare Time Travel.

Full table/column detail belongs to the [data model](data-model.md).

## 5. R2

There are three R2 buckets.

### `thakali-inn-media`

- Binding on main Worker: `MEDIA`
- Binding on backup Worker: `MEDIA`
- Purpose: live uploaded photos, videos, WebP thumbnails, and WebP posters.
- The bucket is private. Public reads go through `/img/[...key]`.
- Upload keys are generated server-side as:
  - Main object: `${crypto.randomUUID()}.${seen.ext}`
  - Thumbnail/poster: `${crypto.randomUUID()}-${label}.webp`
- Uploaded filenames are never used as R2 keys.
- Uploaded objects are replaced by new keys rather than overwritten, which makes immutable `/img` caching safe.
- Repo-shipped `/media/*` files are served by Workers Assets, not R2.

### `thakali-inn-media-backup`

- Binding on backup Worker: `MEDIA_BACKUP`
- Purpose: nightly mirror destination for `thakali-inn-media`.
- Object keys mirror source keys exactly.
- Copies preserve `httpMetadata` and `customMetadata`.
- Same-etag objects are skipped.
- Backup keys absent from the live bucket are not deleted.
- This is not a versioned backup: if a live object changes etag, the next nightly run overwrites the backup copy.

### `thakali-inn-audit-archive`

- Binding on audit-archiver: `ARCHIVE`
- Purpose: WORM audit archive.
- Key naming: `${String(id).padStart(10, '0')}.json`, e.g. `0000000042.json`.
- Content-type on writes is `application/json`.
- A Cloudflare bucket-lock rule covers every key indefinitely.
- Normal R2 `put()` calls are immutable while the lock rule exists.
- Removing the WORM rule requires Cloudflare account access held by the developer, not a site admin.

Inspect the audit-bucket lock with:

```bash
wrangler r2 bucket lock list thakali-inn-audit-archive
```

### Backup and lifecycle summary

| Bucket | Written by | Frequency | Retention / lifecycle |
|---|---|---|---|
| `thakali-inn-media` | `/admin/photos/upload` | On admin upload | Owner-managed; deletes are protected by admin capability and audit alerting. |
| `thakali-inn-media-backup` | `thakali-inn-r2-backup` | Nightly at `0 3 * * *` | Current mirror only; never deletes absent keys. |
| `thakali-inn-audit-archive` | `thakali-inn-audit-archiver` | Every 5 minutes | WORM bucket-lock applies indefinitely. |

## 6. Cloudflare Images and image delivery

The `IMAGES` binding is installed on the main Worker and wired through the vinext image optimizer in `vite.config.ts`. The live inventory shows the binding but no account-level Cloudflare Images variant/delivery rules.

In practice, uploaded media is prepared in the browser by `components/MediaUpload.tsx`:

- Photos are resized to a `1600px` WebP plus a `400px` thumbnail before upload.
- Videos keep their original file but may include a WebP poster.
- The server then validates magic bytes and size limits.

Serving is handled directly by the R2 route, not by an on-the-fly Cloudflare Images transform:

| Route / component | Behaviour |
|---|---|
| `app/img/[...key]/route.ts` | Joins catch-all path segments after `/img/`, reads the R2 object, applies `writeHttpMetadata`, sets `ETag` from `object.httpEtag`, and returns `Cache-Control: public, max-age=31536000, immutable`. Missing objects return `404` body `Not found`. |
| `components/Img.tsx` | Uses a raw `<img>` with a per-photo `style` attribute to reproduce `next/image` fill behaviour. This is why `style-src 'unsafe-inline'` is allowed in CSP. |
| `/api/live` | Returns `Cache-Control: public, max-age=120, s-maxage=120` because rain-glass settings changes should propagate within two minutes. |

The `/img` path is deliberately used instead of `/media` because `/media/*` already exists as static asset output in `dist/client`. Because uploads receive fresh UUID keys, immutable one-year cache is safe.

## 7. Email

### Email Routing

| Item | Value |
|---|---|
| Zone | `hotelthakaliinn.com` |
| Routing status | `ready`, `synced`, not admin-locked |
| Verified destination | `hotelthakaliinn1@gmail.com`, verified `2026-09-03` |
| Rule matcher | `all` |
| Rule action | `drop` |
| Rule enabled | false |
| Rule priority | `2147483647` |

The live inventory shows no enabled forwarding rule; the only listed catch-all drop rule is disabled.

### Workers `send_email`

The main Worker and `thakali-inn-health-check` both use the `EMAIL` binding with pinned addresses:

- Allowed sender: `notify@hotelthakaliinn.com`
- Allowed destination: `hotelthakaliinn1@gmail.com`

Booking and contact mail uses `settings().email` when present, falling back to `hotelthakaliinn1@gmail.com`. The pinned `send_email` destination prevents a settings change from turning a form route into an open relay.

### Mail flows

| Flow | From | To | Subject / purpose | Failure behaviour |
|---|---|---|---|---|
| Contact form | `notify@hotelthakaliinn.com`, `replyTo` guest | `settings().email` or fallback `hotelthakaliinn1@gmail.com` | `Website enquiry — ${name}` | D1 `messages` insert happens first; mail failure is logged but does not fail the request. |
| Booking form | `notify@hotelthakaliinn.com`, `replyTo` guest | `settings().email` or fallback `hotelthakaliinn1@gmail.com` | `Booking request — ${checkIn} to ${checkOut}, ${name}` | D1 `booking_requests` insert happens first; mail failure is logged but does not fail the request. |
| Nightly health check | `notify@hotelthakaliinn.com`, display `Thakali Inn system check` | `hotelthakaliinn1@gmail.com` | `Thakali Inn — N check(s) failed` | Sent only when checks fail. A failure inside the alert path is retried once; a second failure is swallowed. No all-clear mail is sent. |
| Admin delete alert | `notify@hotelthakaliinn.com`, display `Thakali Inn admin audit` | `hotelthakaliinn1@gmail.com` | `Admin delete — <section> / <slug> — by <actor>` | Sent after the D1 batch commits. Email failure is swallowed so it cannot roll back the delete. |
| System check test email | `notify@hotelthakaliinn.com` | `hotelthakaliinn1@gmail.com` | Part of `/api/check?full=1` write checks | Reported as a failing check if the email cannot be sent. |

Contact and booking messages are plain text only, by design, for spam-filter friendliness.

## 8. Rate limiting

All rate-limit bindings are on the main Worker. The scheduled maintenance Workers do not use Cloudflare rate-limit bindings.

| Binding | Limit | Period | Key | Protects | Exceeded behaviour |
|---|---|---|---|---|---|
| `LOGIN_IP` | 5 | 60 seconds | `CF-Connecting-IP` | Google OAuth callback per IP | Login redirects to `/admin/login?e=slow` |
| `LOGIN_ALL` | 20 | 60 seconds | `"login"` | All Google OAuth callback attempts | Login redirects to `/admin/login?e=slow` |
| `FORM_IP` | 5 | 60 seconds | `booking:${ip}` or `contact:${ip}` | `/api/booking` and `/api/contact` | Returns HTTP `429` JSON `{ok:false,error:'Too many requests.'}` |
| `VIEW_IP` | 60 | 60 seconds | `ip` or `"unknown"` | `/api/view` page-view collector | Returns HTTP `204`, identical to success |

`FORM_IP` uses the `booking:` and `contact:` prefixes so the two public forms have separate budgets per IP.

Known limits:

- Cloudflare rate-limiter `period` accepts only `10` or `60` seconds.
- Rate-limit counters do not survive a deploy.
- Daily media upload caps are separate from these bindings: `CAPS.photo = 30` and `CAPS.video = 5` per Kathmandu calendar day.

## 9. Scheduled Workers

### `thakali-inn-audit-archiver`

| Item | Value |
|---|---|
| Cron | `*/5 * * * *` |
| Bindings | `DB`, `ARCHIVE` |
| Secret | `ARCHIVER_TOKEN` |
| Manual trigger | Any HTTP method / any path with `Authorization: Bearer <ARCHIVER_TOKEN>` |

Step by step:

1. Select unarchived rows: `audit_log WHERE archived_at IS NULL ORDER BY id ASC LIMIT 100`.
2. For each row, create an R2 key from the row ID left-padded to 10 digits, appended with `.json`.
3. `PUT` the entire row as JSON to `thakali-inn-audit-archive` with content type `application/json`.
4. After a successful R2 put, update that row with `archived_at = datetime('now')`.
5. Return JSON `{archived: <number>, remaining: <number>}`.

Failure behaviour:

- Per-object R2 failures are caught; the D1 row stays `archived_at IS NULL` and is retried on a later run.
- Successfully archived rows in a batch are marked archived even if other rows in the same batch fail.
- `remaining` is only the number not archived in the current batch, not total outstanding rows.
- `BATCH_LIMIT` is hardcoded to `100` per invocation, with no cursor.
- There is no separate dead-letter alert for per-object R2 failures.

Manual test:

```bash
curl -X POST -H "Authorization: Bearer ${ARCHIVER_TOKEN}" <worker-url>
```

The scheduled path does not read `ARCHIVER_TOKEN`.

### `thakali-inn-r2-backup`

| Item | Value |
|---|---|
| Cron | `0 3 * * *` |
| Bindings | `MEDIA`, `MEDIA_BACKUP` |
| Secret | `BACKUP_TOKEN` |
| Manual mirror | Any path not matching `/restore/...` with `Authorization: Bearer <BACKUP_TOKEN>` |
| Manual restore | `/restore/:urlencoded-key` with `Authorization: Bearer <BACKUP_TOKEN>` |

Mirror step by step:

1. List `MEDIA` using R2 cursors.
2. For each source key, `HEAD` the same key in `MEDIA_BACKUP`.
3. If backup etag equals source etag, skip.
4. Otherwise `GET` the source object and `PUT` it to `MEDIA_BACKUP`.
5. Preserve `httpMetadata` and `customMetadata`.
6. Return JSON `{copied: <number>, skipped: <number>}`.

Restore step by step:

1. URL-decode the key from `/restore/:urlencoded-key`.
2. `GET` the key from `MEDIA_BACKUP`.
3. `PUT` it to `MEDIA`, preserving metadata.
4. Return `{restored:true, key}`.
5. If absent from backup, return `{restored:false, reason:'not found in backup'}`.

Failure behaviour:

- Scheduled mirror has no explicit catch; a thrown error fails that invocation and the next nightly run resumes.
- The mirror is idempotent because same-etag objects are skipped.
- The mirror never deletes backup keys absent from the live bucket.
- Restore can overwrite a live object with the backup version; the Bearer token is the only confirmation.

Manual mirror examples:

```bash
curl -X POST -H "Authorization: Bearer ${BACKUP_TOKEN}" <worker-url>/run
```

```bash
curl -X POST -H "Authorization: Bearer ${BACKUP_TOKEN}" <worker-url>/restore/<urlencoded-key>
```

### `thakali-inn-health-check`

| Item | Value |
|---|---|
| Cron | `15 22 * * *` |
| Bindings | `DB`, `EMAIL` |
| Secret | `CHECK_TOKEN` |
| Manual trigger | `/run` with `X-Check-Token: <CHECK_TOKEN>` |

Nepal is UTC+5:45, so `22:15 UTC` is approximately `04:00` next day in Kathmandu. Cron has no half-hour or quarter-hour support.

Step by step:

1. Run `forgetOldAddresses()` unconditionally:
   - `UPDATE page_views SET ip = '' WHERE ip != '' AND day < date('now','-1 year')`
   - Captures `meta.changes`, falling back to `0`.
2. Call `https://hotelthakaliinn.com/api/check?full=1` with:
   - `X-Check-Token` header set to `CHECK_TOKEN`.
   - `User-Agent: thakali-inn-nightly`.
3. Filter returned checks for `ok === false`.
4. Independently fetch every route in `PUBLIC_ROUTES` from `lib/public-routes.ts`:
   - Uses `?selfcheck=<timestamp>` and `Cache-Control: no-cache`.
   - Verifies HTTP 200.
   - When `PAGE_MUST_CONTAIN` has a phrase for the route, verifies the body contains it.
5. Collapse all public-page failures into one failed entry named `Public pages` with semicolon-joined route details.
6. If any checks failed, send email from `notify@hotelthakaliinn.com` to `hotelthakaliinn1@gmail.com`.
7. Never send an all-clear email.

Manual `/run`:

```bash
curl -H "X-Check-Token: ${CHECK_TOKEN}" <worker-url>/run
```

Response is `200 application/json` with `{passed, total, failed, forgotten}`. Non-`/run` paths return `404`; a bad or missing token returns `401`. If `runChecks()` throws, the fetch rejects rather than returning JSON.

## 10. Backup and recovery

### What is backed up

| Data | Destination | Frequency | Retention |
|---|---|---|---|
| `thakali-inn-media` R2 objects | `thakali-inn-media-backup` | `0 3 * * *` | Current mirror; same key overwritten when source etag changes. |
| `audit_log` rows | `thakali-inn-audit-archive` R2 bucket | `*/5 * * * *` | Indefinite WORM bucket-lock. |
| `page_views.ip` privacy retention | `thakali-inn-health-check` | `15 22 * * *` | IPs blanked after one year, visit rows retained. |

### Media restore runbook

Use the `thakali-inn-r2-backup` Worker:

1. Identify the exact R2 object key to restore.
2. URL-encode the key.
3. Call:

```bash
curl -X POST -H "Authorization: Bearer ${BACKUP_TOKEN}" \
  <worker-url>/restore/<urlencoded-key>
```

4. Confirm `{restored:true,key:<key>}`.
5. If the key is missing from the backup, the Worker returns `{restored:false, reason:'not found in backup'}`.

The built-in restore path is single-object only. There is no bulk bucket-restore function in the Worker. For a full bucket recovery, restore objects individually with the same endpoint or use R2 tooling outside the application. Restoring overwrites the live object and preserves `httpMetadata` and `customMetadata`.

### Audit-log recovery note

The audit archive is WORM JSON. Each object `0000000042.json` contains the full pre-archive `audit_log` row. There is no automated audit-log replay Worker or script described in the repository notes. If `audit_log` in D1 were lost, recovery would be a manual D1 import/operation using the archived JSON objects.

### Backup limitations

- The media backup is not versioned. If a live object is overwritten, the next nightly mirror overwrites the backup copy.
- Deleting an object from live media does not remove it from the backup bucket, because the mirror never deletes backup keys.
- There is no separate D1/schema snapshot Worker described in the notes; D1 protection relies on Cloudflare D1 availability and, for admin writes, the WORM audit archive.

## 11. Health checks

### Main Worker `/api/check`

| Item | Value |
|---|---|
| Route | `GET /api/check` |
| Auth | `X-Check-Token` must constant-time-match `CHECK_TOKEN` |
| Optional query | `full=1` |
| Full mode | Runs write checks and a real test email |
| Success and failure response | HTTP 200 JSON `{ok, failed, total, results}` |
| Missing or wrong token | HTTP 404 body `not found` |
| Unset `CHECK_TOKEN` | Route returns 404 and is effectively disabled |

A failing check still returns HTTP 200 with `ok:false`. This is deliberate: a 500 would trigger retries and hide the result list from the nightly Worker.

### Nightly Worker

The scheduled worker:

1. Runs `page_views` IP retention first.
2. Calls `/api/check?full=1`.
3. Independently fetches every `PUBLIC_ROUTES` page and checks `PAGE_MUST_CONTAIN` phrases.
4. Emails only on failure.

`PAGE_MUST_CONTAIN` examples:

| Route | Must contain |
|---|---|
| `/rooms` | `Deluxe` |
| `/cuisine` | `Breakfast` |
| `/contact` | `Sinamangal` |
| `/privacy` | `Privacy` |

This exists because a D1-backed page can return HTTP 200 with missing content.

### Admin board

`/admin/check` is the session-protected browser board. It runs safe read-only checks on load and only runs write/email checks when explicitly requested with `?full=1` or `RUN EVERYTHING`. It uses the same `lib/checks.ts` definitions as `/api/check`.

The browser-side board also walks `lib/public-routes.ts` public pages, because a Worker fetching itself is not the same request path as a guest request.

Storage threshold:

- `BANK_WARN_BYTES` is `6 * 1024^3`, described as 60% of the 10 GB R2 free tier.
- The warning deliberately leaves headroom for the nightly mirror to double every object.

## 12. Observability

| Worker | Observability | Logpush | Tail consumers |
|---|---|---|---|
| `hotel-thakali-inn` | null / disabled | false | empty |
| `thakali-inn-audit-archiver` | null / disabled | false | empty |
| `thakali-inn-health-check` | enabled | false | empty |
| `thakali-inn-r2-backup` | null / disabled | false | empty |

`thakali-inn-health-check` observability:

- Logs enabled with head sampling rate `1`.
- `redact_query_string` is false.
- `persist` is true.
- Invocation logs are enabled.
- Traces are enabled false with persist true and head sampling rate `1`.

Only the health-check Worker currently has production observability enabled. For the other Workers, debugging relies on local `wrangler dev` console output and `wrangler tail` where available. Because main Worker logpush is false and observability is null, production logs are not persisted there unless enabled later.

## 13. Secrets and vars

### Worker secrets and plain-text vars

| Name | Held by | Type | Purpose | How to set |
|---|---|---|---|---|
| `GOOGLE_CLIENT_ID` | `hotel-thakali-inn` | plain_text var | Google OAuth client ID used in the login URL and token verification | Set in `wrangler.jsonc` vars. Not a secret. |
| `GOOGLE_CLIENT_SECRET` | `hotel-thakali-inn` | secret | Google OAuth authorization-code exchange secret | `npx wrangler secret put GOOGLE_CLIENT_SECRET` |
| `SESSION_SECRET` | `hotel-thakali-inn` | secret | HMAC key for admin session cookies, OAuth state cookies, and visitor IDs | `npx wrangler secret put SESSION_SECRET` |
| `CHECK_TOKEN` | `hotel-thakali-inn` | secret | Authorizes `/api/check` | `npx wrangler secret put CHECK_TOKEN` |
| `CHECK_TOKEN` | `thakali-inn-health-check` | secret | Authorizes `/run` and authenticates calls to `/api/check` | `npx wrangler secret put CHECK_TOKEN` in `workers/health-check` |
| `ARCHIVER_TOKEN` | `thakali-inn-audit-archiver` | secret | Bearer token for manual audit-archive trigger | `npx wrangler secret put ARCHIVER_TOKEN` in `workers/audit-archiver` |
| `BACKUP_TOKEN` | `thakali-inn-r2-backup` | secret | Bearer token for manual R2 mirror and restore trigger | `npx wrangler secret put BACKUP_TOKEN` in `workers/r2-backup` |

`CHECK_TOKEN` must be installed with the same value on both the main Worker and `thakali-inn-health-check`. Changing it in only one place makes the nightly check report failure or `401`.

Secret values are never printed or committed. The Cloudflare API returns secret names only, never values.

### GitHub Actions secrets

| Name | Used by | Purpose |
|---|---|---|
| `CLOUDFLARE_API_TOKEN` | `.github/workflows/ci.yml`, `.github/workflows/workers.yml` | Authenticates Wrangler deploys and token verification. |
| `CLOUDFLARE_ACCOUNT_ID` | `.github/workflows/ci.yml`, `.github/workflows/workers.yml` | Identifies the Cloudflare account for Worker deploys. |

These are passed per step so npm lifecycle/postinstall scripts never see credentials.

## 14. Security posture

### Public site and forms

- Contact and booking forms are rate-limited by `FORM_IP` at `5 / 60s / IP`, with separate `booking:` and `contact:` keys.
- Both forms use the honeypot field `note_ref`; bots receive a realistic `{ok:true}`.
- Guest-controlled strings destined for email headers or log lines have newlines stripped.
- Email sender and destination are pinned through Workers `send_email`, preventing open relay.
- Durable D1 writes happen before best-effort email notification.
- Page-view collection is rate-limited at `60 / 60s / IP` and always returns `204` so failures do not reveal analytics state.
- Visitor analytics use no cookies and store a stable HMAC visitor ID.
- Raw visitor IPs are excluded from normal analytics queries; IP reveal requires `analytics.ip` capability and is audited.

### Admin panel

- Google OAuth Authorization Code flow proves a verified email.
- `admin_users` is the allowlist; unknown verified emails are rejected and audited.
- The session cookie is HMAC-signed and named `ti_admin`.
- Cookie scope is `Path=/admin`, so it is never sent on public guest routes.
- Admin write endpoints live under `/admin`, not `/api`, so the session cookie is present.
- `requireSession()` re-reads `admin_users` on every admin page and Server Action.
- Roles are `owner`, `developer`, and `staff`.
- Capability enforcement covers `settings.email`, `analytics.ip`, `content.delete`, `accounts.manage`, and `audit.read`.
- Temporary grants are limited to 24 hours and only owner-grantable capabilities.
- Every admin write goes through `auditedWrite()` with a D1 audit row in the same batch.
- Delete actions send an email alert and require `content.delete`, except developer default.
- Upload validation is magic-byte based, not client MIME-trusting.
- Upload keys use `crypto.randomUUID()` to prevent path traversal and stale-image risks.

### Platform-level

- Custom domains serve the same Worker.
- `workers_dev` is disabled on the main Worker.
- The audit archive has an indefinite R2 WORM bucket-lock.
- Maintenance Worker HTTP triggers use Bearer tokens or `X-Check-Token`.
- Token and signature checks avoid plain string equality where implemented.
- CSP and security headers are applied by the Worker for every route.

Security headers set for every route include:

```text
Strict-Transport-Security: max-age=31536000; includeSubDomains
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=(), usb=()
```

CSP is:

```text
default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'none';
form-action 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline';
img-src 'self' data:; media-src 'self'; font-src 'self'; connect-src 'self';
frame-src https://maps.google.com https://www.google.com; upgrade-insecure-requests
```

CSP justifications:

- `script-src 'unsafe-inline'` is needed for Next.js inline hydration bootstrap and `HotelSchema.tsx` JSON-LD.
- `style-src 'unsafe-inline'` is needed by `components/Img.tsx` inline `style` attribute.
- `frame-src` allows the Google Maps iframe in `ContactPanel.tsx`.
- `connect-src 'self'` restricts fetches to `/api/live` and `/api/view`.
- No `unsafe-eval`, no `blob:`, and no runtime Google Fonts.

### Honest gaps

- No Turnstile is configured.
- DNS and WAF/cache rulesets could not be audited with the deployment token.
- The main Worker has observability disabled.
- The public page-view collector always returns `204`, even for failed D1 inserts.
- Maintenance Worker token comparison is not fully constant-time over differing lengths.
- `thakali-inn-r2-backup` treats any non-`/restore/...` path as a full mirror if the Bearer token is valid.
- The Email Routing API showed only a disabled drop rule; no enabled forwarding rule was readable.
- Worker secrets are names only and their rotation state is not visible in the inventory.

## 15. Known issues / gotchas

- D1 API reports `num_tables: 0` although the database file is `299,008` bytes. Table names and schemas are not visible from the account-level API.
- Zone DNS records, WAF rules, and cache rulesets returned HTTP `403` for the deployment token, so those settings could not be documented.
- No KV namespaces, Pages project, Turnstile widget, or zone Worker routes exist in the live inventory.
- The only Email Routing rule listed is disabled, matches all, and drops mail. No enabled forwarding rule is visible from the API.
- `thakali-inn-health-check` `/run` has no explicit token-presence check before `timingSafeEqual`. If `CHECK_TOKEN` is unset and the header is absent, both values become `''` and the request is authorized. `CHECK_TOKEN` must always be configured.
- Worker `timingSafeEqual()` returns early on length mismatch, so it is not fully constant-time over length; it only XORs equal-length strings.
- `audit-archiver` and `r2-backup` fetch handlers do not check HTTP method; any method with a valid token triggers the archive/mirror/restore action.
- `r2-backup` treats every path that does not match `/restore/:key` as a full mirror. An unknown path with a valid token will still run a complete mirror.
- `r2-backup` restore can overwrite a live `MEDIA` object with no confirmation beyond the Bearer token.
- The scheduled R2 mirror is not versioned. If a live object's etag changes after the previous backup, the next run overwrites the backup copy.
- Audit archiver has `BATCH_LIMIT = 100` per invocation and no cursor. Repeated cron runs drain the queue. Returned `remaining` counts only failures in the current batch.
- Per-object R2 failures during audit archiving are swallowed and retried later with no dead-letter queue or separate alert.
- `page_views` retention failure is only `console.error`'d when checks still pass; it does not by itself trigger the alert email.
- Health-check public-page failures are grouped into one `Public pages` failure, so the passed/total log line can undercount broken routes.
- If `/api/check` is unreachable, health-check reports `The site itself` with a failed entry and detail pointing at the deploy or `CHECK_TOKEN`.
- `/api/check` and `/run` depend on the same `CHECK_TOKEN`; changing it in only one Worker breaks the nightly run.
- Main Worker rate-limit counters reset on every deploy and `period` accepts only 10 or 60 seconds.
- `/api/view` always returns `204`, including on D1 insert failure, so the frontend cannot distinguish success from rate limiting or internal error.
- Large uploads use `request.formData()`, which buffers the whole body; a 25 MB clip costs about 50 MB of the Worker's 128 MB budget.
- The email `settings` row and `wrangler.jsonc` `send_email` arrays are pinned together. Changing the admin email setting without matching deploy config stops mail arriving.
- Migrations are never applied by CI. Migration `0016` performs a `DROP COLUMN` and must be applied manually.
- In `.github/workflows/workers.yml`, any change under `workers/**` redeploys both `audit-archiver` and `r2-backup`, even if only one changed.
- The Cloudflare smoke test accepts HTTP 200 or a 403 with `cf-mitigated: challenge`, so Bot Fight Mode can prevent strict page-HTML verification.
- Main Worker and the cron Workers except `thakali-inn-health-check` do not have observability enabled; `logpush` is false on every Worker.
- The old `*.workers.dev` host is disabled by omission of `workers_dev`; there is deliberately no second staging URL.
- `r2-backup` backups deleted live objects by keeping them in the backup bucket, but it does not retain historical versions of overwritten live objects.
- There is no automated audit-log replay Worker or script; `thakali-inn-audit-archive` is a durable JSON record, but D1 recovery from it is manual.
- `check` in CI is intended to run all configured checks; a comment in `.github/workflows/ci.yml` describes a shorter check list, while `package.json` actually runs six Node scripts plus typecheck and lint.
