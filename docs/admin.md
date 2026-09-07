# Admin panel

Part of the Hotel Thakali Inn documentation — [back to README](../README.md).

## 1. Overview

The admin panel is the staff and maintainer interface for `hotelthakaliinn.com`. It is a custom Next.js App Router / Cloudflare Workers application, not a generic CMS. Admin edits write directly to the same Cloudflare D1 database that the public pages read. Media uploads go to the Cloudflare R2 bucket bound as `MEDIA`.

Who uses it:

| Role | Purpose |
|---|---|
| `owner` | Day-to-day hotel work: enquiries, bookings, content, amenities, menu, photos, contact settings and property facts |
| `developer` | Full access including account whitelist management, all destructive capabilities, grants and system checks |
| `staff` | Front-desk everyday work only; no account management, audit read, raw IP access, email-row access, or destructive deletes by default |

Reached at `/admin`. The shell is `app/admin/layout.tsx`, which wraps every admin page in `.adm` and renders `AdminNav`. The layout intentionally has **no auth guard**; every page and Server Action calls `requireSession()` itself. All admin pages are `force-dynamic`.

Related chapters:

- Cloudflare resources, Workers and backups: [`docs/cloudflare.md`](cloudflare.md)
- D1 table schema: [`docs/data-model.md`](data-model.md)
- Public/admin HTTP endpoints: [`docs/api.md`](api.md)
- Public site rendering: [`docs/frontend.md`](frontend.md)
- Checks, cron Workers and operations: [`docs/operations.md`](operations.md)

---

## 2. Signing in

### Auth routes

| Route | File | Purpose |
|---|---|---|
| `/admin/login` | `app/admin/login/page.tsx` | Google sign-in entry point and error display |
| `/admin/auth/google/start` | `app/admin/auth/google/start/route.ts` | Begins Google OAuth; rate-limited |
| `/admin/auth/google/callback` | `app/admin/auth/google/callback/route.ts` | Receives Google callback, whitelists the email and issues an admin session |

### Flow

1. Staff member opens `/admin/login` and clicks **Sign in with Google**.
2. `/admin/auth/google/start` redirects to Google with an OAuth `code` flow and CSRF `state`.
3. Google returns to `/admin/auth/google/callback`.
4. `lib/google-auth.ts` verifies the Google ID token using `jose`:
   - signature is checked against Google JWKS
   - issuer must be `https://accounts.google.com` or `accounts.google.com`
   - audience must be `GOOGLE_CLIENT_ID`
   - `email_verified` must be `true`
   - email is normalized by `normalizeEmail()`
5. The normalized email is looked up in `admin_users`. `admin_users` is the **only** allow-list.
6. If present, an admin session starts and an `admin_login.ok` audit row is written.

### Login errors

`/admin/login` translates these query parameters into human-readable errors:

| Query | Meaning |
|---|---|
| `?e=slow` | OAuth start rate limit hit; try again in about one minute |
| `?e=state` | OAuth state was missing, tampered with, or expired |
| `?e=google` | Google could not confirm sign-in |
| `?e=notwhitelisted` | Google account is not present in `admin_users` |

### Session and cookies

| Fact | Value |
|---|---|
| Cookie name | `ti_admin` |
| Value format | `<username>|<unix-expiry>.<hex-HMAC-SHA-256>` |
| Signing secret | `SESSION_SECRET` binding, cached as a non-extractable `CryptoKey` |
| Cookie flags | `httpOnly`, `secure`, `sameSite=Lax` |
| Path | `/admin` |
| Lifetime | 12 hours (`maxAge 43200s`) |
| Username restriction | cannot contain `.` or `|` |
| Signature check | `crypto.subtle.verify`, never string comparison |
| Revocation | `requireSession()` re-reads `admin_users` on every call; deleting the account row revokes an already-issued cookie while `admin_users` is reachable |
| OAuth state cookie | `ti_oauth_state`; path `/admin/auth/google`, 5-minute TTL, HMAC-signed `<state>|<exp>` |

`sameSite=Lax` is required because the admin cookie is set mid-redirect-chain after Google returns; `Strict` would be silently dropped.

### Sign-out

The dashboard has a sign-out Server Action in `app/admin/page.tsx`. It:

1. calls `requireSession()`
2. calls `endSession()`
3. redirects to `/admin/login`

Sign-out deletes the local cookie; it is not server-side revocation.

### Login rate limits

| Target | Limit | Failure UX |
|---|---|---|
| `/admin/auth/google/start` | Not shown in these notes; binding unknown | Redirects to `/admin/login?e=slow` with “Too many attempts. Try again in a minute.” |

---

## 3. Accounts and hierarchy

### Roles

| Role | Default abilities |
|---|---|
| `owner` | Everyday hotel admin work; view accounts and audit log; can be lent developer-only capabilities for a fixed 24-hour grant |
| `developer` | Everything, including account whitelist management, all destructive capabilities, and issuing/revoking grants |
| `staff` | Enquiries, bookings, site content, amenities, pages, rooms, photos, contact settings and property facts; no account management, audit read, IP reveal, email-row edit, or destructive delete by default |

Roles are stored in `admin_users.role`.

### `admin_users` table

`admin_users` is both the login credential table and the Google email whitelist.

| Column | Purpose |
|---|---|
| `username` | Unique admin identifier, used in session cookie and audit actor |
| `email` | Exact Google account; unique |
| `role` | `owner`, `developer`, or `staff` |
| `created_at` | UTC timestamp |

Migration `0013_admin_users.sql` creates the table; migration `0015_seed_admin_users.sql` seeds initial accounts. The exact seed values are not shown in the provided notes.

### `/admin/accounts`

File: `app/admin/accounts/page.tsx`.

Auth:

| Task | Requirement |
|---|---|
| View account list and matrix | `owner` or `developer` via `requireManager()`; staff is redirected to `/admin` |
| Add/edit/delete `admin_users` rows | `accounts.manage` capability |
| Grant temporary capabilities | Developer only |
| Revoke temporary capabilities | Developer only |

What the page does:

- Lists all `admin_users` ordered by `created_at ASC`.
- Shows last sign-in per account derived from `audit_log` where `action='admin_login.ok'`.
- Add, edit and delete account rows.
- Rejects deleting the currently signed-in account with `err=self`.
- Filters grant recipients to existing `owner`-role accounts.
- Renders the capability matrix from the same `CAPABILITIES` constant the server enforces.

Writes and audit events:

| Server action | Audit action | Notes |
|---|---|---|
| `createAccount` | `admin_user.create` | Insert into `admin_users` |
| `updateAccount` | `admin_user.update` | Update username/email/role |
| `deleteAccount` | `admin_user.delete` | Rejects self-deletion |
| `grantAccess` | `permission.grant` | Developer-only; 24-hour expiry |
| `revokeAccess` | `permission.revoke` | Developer-only; sets `revoked_at` |

`permission_grants` columns:

| Column | Purpose |
|---|---|
| `id` | Primary key used for revoke |
| `capability` | Granted capability string |
| `grantee` | Admin username |
| `granted_by` | Developer username |
| `granted_at` | Timestamp |
| `expires_at` | Expiry, set with `datetime('now', '+24 hours')` |
| `revoked_at` | Null until revoked |

A grant is live only when:

```sql
revoked_at IS NULL AND expires_at > datetime('now')
```

Adding an `admin_users` row immediately grants that Google email sign-in access. Deleting a row immediately revokes access, even if a session cookie already exists.

---

## 4. Permissions

Permission logic lives in `lib/permissions.ts`.

### Capabilities

| Capability | Meaning | Role holders | Grantable to |
|---|---|---|---|
| `settings.email` | Change the public email address setting | `developer` | `owner` |
| `analytics.ip` | Reveal raw visitor IP addresses | `developer` | `owner` |
| `content.delete` | Permanently delete rooms/pages/photos and admin accounts | `developer` | `owner` |
| `accounts.manage` | Add, edit and delete admin accounts / whitelist entries | `developer` | `owner` |
| `audit.read` | Read the permanent audit log | `developer`, `owner` | not grantable |

### Rules

- Invalid roles deny immediately without touching D1.
- D1 errors in permission queries are caught and converted to denial.
- If migration `0019` has not created `permission_grants`, permission queries fail closed and deny.
- Grants last exactly 24 hours; the period is hardcoded, not configurable.
- Only roles listed in a capability’s `grantable` array can receive a grant. Staff cannot receive any of the four developer capabilities.
- Granting is developer-only and is **not itself grantable**.
- Expired or revoked grant rows remain in `permission_grants` for audit, but disappear from live queries.

### Where capabilities are enforced

| Capability | Enforced in |
|---|---|
| `accounts.manage` | `/admin/accounts` page and every account Server Action |
| `content.delete` | Content, amenities, menu and photos delete actions and delete UI visibility |
| `settings.email` | `/admin/settings` email lock in `SettingsForm`, plus again inside `save()` |
| `analytics.ip` | `/admin/analytics` IP reveal path |
| `audit.read` | `/admin/audit` page guard |

Page render checks are for UX only. Every Server Action re-checks the current session and capability at write time because a grant may expire while the page is open.

### What a user without a grant sees

- Account editing is disabled or hidden; staff is redirected away from `/admin/accounts`.
- Delete forms are hidden; attempted delete actions return `err=perm`.
- Raw IPs are not shown on analytics; only country/city/network are visible.
- Audit page redirects to `/admin`.
- Settings email field is disabled/locked; attempted email change is refused server-side.

---

## 5. Every admin page

| Page | File | Primary permission |
|---|---|---|
| Dashboard | `app/admin/page.tsx` | any admin session |
| Accounts | `app/admin/accounts/page.tsx` | view: owner/developer; edit: `accounts.manage`; grant: developer |
| Amenities | `app/admin/amenities/page.tsx` | view/edit: any admin; delete: `content.delete` |
| Analytics | `app/admin/analytics/page.tsx` | any admin; IP reveal: `analytics.ip` |
| Audit | `app/admin/audit/page.tsx` | `audit.read` |
| Check | `app/admin/check/page.tsx` + `CheckBoard.tsx` | any admin |
| Content | `app/admin/content/page.tsx` | edit: any admin; delete: `content.delete` |
| Login | `app/admin/login/page.tsx` | public |
| Menu | `app/admin/menu/page.tsx` | edit: any admin; delete: `content.delete` |
| Messages | `app/admin/messages/page.tsx` | any admin |
| Photos | `app/admin/photos/page.tsx` | edit metadata: any admin; delete: `content.delete` |
| Requests | `app/admin/requests/page.tsx` | any admin |
| Settings | `app/admin/settings/page.tsx` + `SettingsForm.tsx` | any admin; email change: `settings.email` |

### 5.1 Dashboard (`/admin`)

File: `app/admin/page.tsx`.

- Uses one `Promise.all` to gather live counts and analytics.
- Counts:
  - upcoming booking requests from today’s Kathmandu date
  - booking requests and enquiries in the last 7 Kathmandu days
  - total settings rows
  - published/unpublished non-menu content rows
  - published/unpublished menu rows
  - audit rows in the last 7 days
  - next arrival
- Tiles:
  - Booking requests
  - Enquiries
  - Settings
  - Content
  - Menu
  - System check
  - Audit log — owner/developer only
  - Accounts — owner/developer only
- 30-day analytics section uses:
  - `dailyCounts(29, now)`
  - `topPagesQuery(since7)`
  - `topReferrers(since7)`
  - `viewSpanQuery()`
  - `directCount(since7)`
  - inline SVG sparkline via local `Sparkline`, no chart library
- When any count query throws, the tile renders a dash or omits the number, never a fake zero.
- Sign-out action lives here: `requireSession()`, `endSession()`, redirect.

### 5.2 Accounts (`/admin/accounts`)

File: `app/admin/accounts/page.tsx`.

Covered in detail in Section 3.

### 5.3 Amenities (`/admin/amenities`)

File: `app/admin/amenities/page.tsx`.

- Edits `content` rows where `section='amenity'`.
- Uses `section('amenity', true)` so unpublished rows remain editable.
- Search is a plain GET form with `?q=`; filters by `title`, `slug`, `tag`.
- Groups by category `tag` in position order.
- Each amenity is a native `<details>` row; the summary shows title, metadata and `shown`/`hidden` badge.
- Save upserts on `(section, slug)` using `INSERT ... ON CONFLICT DO UPDATE`.
- Slug is read-only after creation.
- Fields:
  - title and body
  - category picker from `CATEGORIES` with `AmenityGlyph`
  - free-text tag override
  - `Included` vs `Extra-charge` paid picker
  - featured highlights checkbox
  - one of six little-touch symbols from `TOUCH_NAMES`
  - hidden image field preserves the seeded photo
- Add form has hidden `published=on`, so a new amenity is public immediately unless edited afterwards.
- Delete is a sibling `<details>/<form>` because a nested form is invalid HTML.
- Delete requires `content.delete`.

Audit actions:
- `content.create`
- `content.update`
- `content.delete`

### 5.4 Analytics (`/admin/analytics`)

File: `app/admin/analytics/page.tsx`.

- Requires any signed-in admin session.
- Supports query parameters:

| Param | Purpose |
|---|---|
| `?w=7` | 7-day window |
| `?w=30` | 30-day window |
| `?w=90` | 90-day window |
| `?w=all` | all data, implemented as 3650 days |
| `?open=<visitor hex id>` | expand a visitor journey |
| `?ip=<visitor hex id>` | reveal and audit-log that visitor’s raw IP; requires `analytics.ip` |

- Runs ten parallel analytics queries unconditionally.
- Adds an eleventh `visitorJourney()` query when `open` is supplied.
- Displays:
  - daily SVG views chart
  - people, pages opened, came-back figures
  - countries/devices
  - busy hours and weekdays heat strips
  - top pages and top referrers
  - per-visitor table with expandable journeys
- Country, city, region, network, device and browser are visible to every signed-in admin.
- Raw IPs are never selected by default list queries and require the `analytics.ip` capability.
- IP reveal is guarded against Next.js prefetch requests and writes `analytics.reveal_ip` to the audit log.

More detail in Section 9.

### 5.5 Audit (`/admin/audit`)

File: `app/admin/audit/page.tsx`.

- Requires session plus `audit.read`; otherwise redirects to `/admin`.
- Filters are additive via a GET form:
  - `action` exact
  - `actor` exact
  - `section` substring
  - `from` and `to` timestamps
- SQL is parameterized over fixed column names only; user values are bound parameters.
- Shows latest 200 matching rows, newest first.
- Shows archive status as `yes` or `pending` based on whether `archived_at` is null.
- `before` and `after` JSON detail is inside a `<details>` element.
- No pagination beyond 200; older rows require narrower filters.

Section 10 has full audit log detail.

### 5.6 Check (`/admin/check`)

File: `app/admin/check/page.tsx` with client component `CheckBoard.tsx`.

- Any signed-in admin may view.
- Safe read-only checks run on every page load via `runChecks(false)`.
- Full write/email checks run only when `?full=1` is requested and the request is not a Next.js prefetch.
- The server also rejects `full=1` if the `Next-Router-Prefetch` header is `1`.
- `CheckBoard` fetches every public route from `lib/public-routes.ts` in the browser to mimic a real guest request.
- Full mode sends a real email, writes and removes a test audit row, and creates and removes a test account.
- The same checks run nightly at 4 a.m. Kathmandu time from a separate health-check Worker.

More in [`docs/operations.md`](operations.md).

### 5.7 Content (`/admin/content`)

File: `app/admin/content/page.tsx`.

- Manages four active content sections:
  - `hero` — Home slides
  - `service` — Home cards
  - `room` — Rooms
  - `gallery` — Gallery
- URL query parameters: `s`, `q`, `sort`, `page`, `ok`, `err`.
- Search filters only `title`, `slug` and `tag`, deliberately excluding `body`.
- Sort by `position`, `title`, or `updated`.
- Pagination uses `PAGE_SIZE=40`.
- Rows are `<details>` elements; existing slug is read-only because `(section, slug)` is the primary key.
- Editable fields include title, tag, body, href, image/video via `PhotoPicker`, hidden icon, room-specific `extra`, and published state.
- Add new rows is allowed only for `hero` and `gallery`.
- `service` and `room` are fixed: editable but cannot be added or deleted.
- Fixed-section enforcement happens server-side, not just in UI.
- New rows default to `published=on` and `position = last position + 10`.
- Delete requires `content.delete` and is unavailable for fixed sections.
- All writes are audited: `content.create`, `content.update`, `content.delete`.

### 5.8 Login (`/admin/login`)

File: `app/admin/login/page.tsx`.

Covered in Section 2. This is the only admin page without `requireSession()` because it exists to obtain a session. The layout uses `peekSession()` only for navigation.

### 5.9 Menu (`/admin/menu`)

File: `app/admin/menu/page.tsx`.

- Edits four `content` sections:
  - `menu_breakfast`
  - `menu_snacks`
  - `menu_mains`
  - `menu_bar`
- Tabs: Breakfast, Snacks & Starters, Mains, Bar & Drinks.
- Search `?q=` filters title, slug and tag.
- Groups rows by contiguous heading `tag` in table `position` order.
- Each expanded row edits:
  - title
  - heading/tag
  - body
  - optional image
  - position
  - published checkbox
  - repeatable price rows via `PriceRows`
- Bar rows support size labels and multiple prices.
- Other menu sections use plain single-price rows.
- Size/price arrays are revalidated server-side by `composeMenuExtra`, returning `price`, `label`, or `duplicate` errors before writing.
- Save upserts on `(section, slug)` and audits `content.create` or `content.update`.
- Delete requires `content.delete` and audits `content.delete`.
- New rows default to `published=on`; slug is required and read-only after creation.
- Menu photos are stored for future public use; the Cuisine page does not show them yet.

Section 7 has full menu structure detail.

### 5.10 Messages (`/admin/messages`)

File: `app/admin/messages/page.tsx`.

- Inbox for public contact form submissions.
- Reads the `messages` table, newest first.
- SQL selects:
  - `id`
  - `name`
  - `email`
  - `message`
  - `created_at`
- Ordered by `id DESC LIMIT 200`.
- Search `?q=` filters name/email/message in JavaScript over the 200-result window.
- No pagination past 200.
- Reply link opens `mailto:` to the guest.
- Guest email is `encodeURIComponent`-escaped to prevent mailto header injection from older malformed rows.
- Timestamps are stored UTC and visibly labeled `UTC`.

### 5.11 Photos (`/admin/photos`)

File: `app/admin/photos/page.tsx`.

- Photo and video bank backed by R2 `MEDIA` and D1 `media_assets`.
- Renders `BankBoard` contact sheet and single-item detail pane.
- Shows storage gauge from `bankStats()`.
- Shows remaining daily uploads with `dailyCount('photo')` and `CAPS.photo`.
- `saveDetails` updates:
  - `media_assets.name`
  - `media_assets.origin_url`
- Name is trimmed and max 120 chars; no empty name allowed.
- `origin_url` is trimmed and max 500 chars; if non-empty, must start with `http://` or `https://`.
- Metadata edits audit `media.update`.
- `removeItem` requires `content.delete`.
- Deletion first checks `mediaReferences()`; an `/img/<key>` still referenced by content cannot be deleted.
- Deletion audits `media.delete`.
- D1 row is deleted first, then R2 objects `key`, `thumb_key` and `poster_key` are deleted with best-effort suppression.
- Uploads go to `app/admin/photos/upload/route.ts` because Server Actions have roughly a 3 MB body ceiling.

Section 8 has full photo/media flow.

### 5.12 Requests (`/admin/requests`)

File: `app/admin/requests/page.tsx`.

- Inbox/queue of public booking form submissions.
- Reads `booking_requests`, sorted by arrival date rather than submission date.
- SQL order: `ORDER BY check_in ASC, id DESC`.
- Limited to 200 rows.
- Search `?q=` filters name, email, room and notes in JavaScript.
- Past stays are marked with `· past` by comparing `check_in` to the current Kathmandu date.
- Reply link opens encoded `mailto:`; phone is shown when present.
- No status or archive columns are exposed.

### 5.13 Settings (`/admin/settings`)

File: `app/admin/settings/page.tsx` with client component `SettingsForm.tsx`.

- Edits contact details, property facts and per-room measured sizes.
- Server component loads:
  - all settings rows via `settings()`
  - room `content` rows via `section('room', true)`
- `SettingsForm` receives `initial`, `emailAccess` and a `save` Server Action.
- The form submits one hidden JSON field named `values`.
- Server action:
  1. parses `values`
  2. runs `sanitizeFormValues()`
  3. re-runs the same `computeErrors()` as the client
  4. writes settings and room sizes in one audited batch
- Email row changes require `settings.email`, checked at page load and again at save time.
- Fields include:
  - front desk and WhatsApp phone numbers
  - email address, locked by default
  - Booking.com URL
  - social links
  - Google Maps URL, lat/lng and plus code
  - address and Getting here rows
  - in-room amenity checkboxes and custom chips
  - room sizes for all rooms
  - meals and service style/pricing
  - Good to know rows
  - rain-on-glass day/night toggles
- Live previews use `composeAll()` and `lib/site.ts` helpers.
- Validation messages are actionable human sentences, not bare `Invalid input`.

Audit action:
- `settings.update`
- `before` and `after` include all settings rows plus room size values.

---

## 6. Content editing

### How edits reach the live site

- Public pages read D1 through `@/lib/content` helpers such as `section()` and `settings()`.
- Public pages are `force-dynamic`, so D1-backed pages are not emitted as a stale static HTML build.
- Admin pages write directly to D1. There is no separate draft database.
- The `published` field controls public visibility:
  - `published=1`: public page includes the row
  - `published=0`: hidden from public, but still visible to admin because admin uses `includeUnpublished=true`
- No explicit cache revalidation step is recorded in these notes. The build prerender pass has no `env.DB`.

### Drafts vs live

- “Drafts” are simply `published=0` rows.
- Unpublishing a row does not remove it from the admin editor.
- Some settings changes may take a couple of minutes to appear on the public site, such as rain-on-glass toggles.

### Failure modes

| Situation | Result |
|---|---|
| Invalid hidden `extra` JSON on content save | Redirect `err=json`; nothing saved |
| Attempt to create a fixed `service` or `room` row | Redirect `err=fixed` |
| Delete without `content.delete` | Redirect `err=perm` |
| Delete with `content.delete` on a fixed section | Redirect `err=fixed` |
| Double-submit duplicate admin username/email | D1 `UNIQUE constraint failed` caught and shown as already-taken |
| Server Action captures a local function | Closure serialization error; redirect helpers must be module-level |
| Saving a new content row | `paid` is inserted as `0`; updating an existing row does not alter `paid` |

---

## 7. The menu system

### Storage model

Menu items are rows in the generic `content` table with these sections:

- `menu_breakfast`
- `menu_snacks`
- `menu_mains`
- `menu_bar`

Each row has:

| Field | Purpose |
|---|---|
| `title` | Dish/drink name |
| `tag` | Menu heading/group |
| `body` | Description |
| `image` | Optional future dish photo |
| `position` | Order within heading |
| `published` | Public visibility |
| `extra` | Price/size JSON |

`MenuExtra` shape:

```json
{
  "price": 100,
  "sizes": [
    { "label": "30ml", "price": 100 },
    { "label": "Bottle 650ml", "price": 350 }
  ]
}
```

For simple dishes, `extra` is usually:

```json
{
  "price": 100
}
```

### Categories, headings and sizes

- Menu headings are stored in `tag`.
- Admin groups contiguous rows by `tag` in `position` order.
- Size labels for bar/drink rows are free text with the shared datalist `adm-size-names`.
- The datalist is not an exclusive select, so staff can enter a new size.
- `composeMenuExtra` enforces:
  - blank price rows are silently ignored
  - multiple filled rows require a size label
  - labels must be unique case-insensitively
  - `price`, `label`, or `duplicate` errors otherwise

### Availability

- Unpublishing a dish uses the `Show` checkbox; it disappears from the public page but remains in the admin editor.
- Deletion is permanent and requires `content.delete`.
- The recommended seasonal off-menu approach is unpublish, not delete.

### How menu changes reach the public page

- `/cuisine` reads the same menu content rows through shared menu rules.
- `MenuBook.tsx` renders the public menu as a tabbed book.
- Migration `0008` seeded the original full à la carte menu.
- Migration `0011` fixed one menu price transcription error.
- Migration `0022` merged multiple bar-size rows into one row per drink with `sizes` in `extra`.

---

## 8. Photos and media

### Photo picker and upload flow

- Content editors use `PhotoPicker` to select from the media bank.
- Chosen values are stored in fields such as `content.image` or `content.video`.
- `MediaUpload.tsx` is the admin photo-bank uploader:
  - decodes camera files in the browser
  - resizes photos to a 1600px WebP plus a 400px thumbnail
  - posts human-readable names to `/admin/photos/upload`
- Uploads go through a Route Handler because Server Actions have roughly a 3 MB request-body ceiling.

### Shared browser/server rules

| Rule | Value |
|---|---|
| Photo MIME types | `image/jpeg`, `image/png`, `image/webp` |
| Video MIME types | `video/mp4` |
| Photo max bytes | `2 * 1024 * 1024` (`MAX_BYTES.photo`) |
| Video max bytes | `25 * 1024 * 1024` (`MAX_BYTES.video`) |
| Photo daily cap | `CAPS.photo` = 30 per Kathmandu day |
| Video daily cap | `CAPS.video` = 5 per Kathmandu day |
| Quota reset | midnight Kathmandu time |
| JPEG magic bytes | `FF D8 FF` |
| PNG magic bytes | `89 50 4E 47` |
| WebP check | `RIFF` at byte 0 and `WEBP` at bytes 8–12 |
| MP4 check | `ftyp` at offset 4 |
| RAW/TIFF | rejected; uploader is told to upload the `.JPG` twin |

These rules live in `lib/media.ts` and are enforced in browser and server.

### Where files land

| Item | Location |
|---|---|
| Uploaded originals, thumbs and posters | R2 bucket bound as `MEDIA` |
| Metadata | D1 `media_assets` |
| Uploaded media public URL | `/img/<key>` |
| Git-shipped repo media | `public/media`, served by assets binding |

`media_assets` columns used by the bank:

| Column | Purpose |
|---|---|
| `key` | R2 object key exposed as `/img/<key>` |
| `kind` | `photo` or `video` |
| `day` | Kathmandu calendar day |
| `name` | Display/search name |
| `bytes` | Object size |
| `width` | Width |
| `height` | Height |
| `thumb_key` | Thumbnail R2 object key |
| `poster_key` | Poster R2 object key |
| `origin_url` | External original source link |
| `caption` | Caption |
| `uploaded_by` | Admin uploader |
| `uploaded_at` | Upload timestamp |

### Compression and serving

- Browser-side photo resize produces a 1600px WebP and a 400px thumbnail.
- Videos are uploaded unmodified; the 25 MB cap is the real object-size ceiling.
- Thumbnails and posters are real R2 objects and count in storage totals.
- Repository media reports `bytes: 0` and cannot be deleted from admin.

### Replacing and deleting images

- Replacement happens by picking another item in `PhotoPicker`; the old bank object is not automatically deleted.
- Deleting from the photo bank:
  1. requires `content.delete`
  2. re-reads the `media_assets` row
  3. checks `mediaReferences()` so any `/img/<key>` still referenced by content is refused
  4. audits `media.delete`
  5. deletes the D1 row first
  6. best-effort deletes R2 objects `key`, `thumb_key` and `poster_key`
- Orphan R2 objects may remain if R2 deletion fails.

---

## 9. Analytics and page views

### What is tracked

`page_views` records:

| Column | Purpose |
|---|---|
| `visitor` | Hex visitor id, hash-derived |
| `path` | Public page path |
| `at` | Kathmandu timestamp `YYYY-MM-DD HH:MM:SS` |
| `day` | Kathmandu date `YYYY-MM-DD` |
| `referrer` | Referrer; empty string is direct |
| `country` | Country code |
| `city` | City |
| `region` | Region |
| `network` | Network |
| `device` | Device |
| `browser` | Browser |
| `ip` | Raw IP address |
| `created_at` | Legacy UTC timestamp, no longer used for analytics |

### How it is recorded

- Public `ViewBeacon` posts one page-view event per public page to `/api/view`.
- It uses no cookies and no third-party scripts.
- Referrer/source and address data exist from around September 2026.
- Rows before migration `0020` have empty visitor/geography/device strings.

### Visitor identification

- A hash-derived `visitor` id identifies the same visitor without cookies.
- Returning visitors are counted only when the same visitor appears on more than one Kathmandu day.
- Two visits an hour apart count as one visit, not returning.
- Raw IPs are stored, but are not selected in normal list queries.
- IP reveal is gated by `analytics.ip` and written to the audit log because it is personal data.

### Admin dashboard and detail page

Dashboard:

- 30-day sparkline
- today, last-7-days and all-time figures
- top pages and top referrers
- direct visit count
- week-over-week delta

`/admin/analytics`:

- daily SVG chart with native `<title>` tooltips
- countries, devices, pages and referrers as horizontal bars
- hour and weekday heat strips
- per-visitor table with expandable journey
- raw IP reveal to permitted users

### Chart and sparkline implementation

- `lib/chart.ts` and `lib/sparkline.ts` provide pure SVG coordinate math.
- No charting library is used.
- `sparklineSeries` pads missing days with zeroes so quiet days are not visually bridged.
- `axisIndices()` spaces date labels to avoid collisions.

---

## 10. Audit log

### Record shape

`audit_log` columns:

| Column | Purpose |
|---|---|
| `id` | Row identity |
| `created_at` | UTC SQLite datetime string |
| `actor` | Admin username |
| `action` | Event name |
| `section` | Affected section/table-area |
| `slug` | Affected object identifier |
| `before` | JSON/null old state |
| `after` | JSON/null new state |
| `archived_at` | Set after WORM R2 archive copy; null means pending |

Every admin write goes through `lib/audit.ts` `auditedWrite()`. The business-data write and audit row are inserted in a single D1 `batch()` transaction; either both commit or neither.

### Audited actions

| Action | Trigger |
|---|---|
| `admin_login.ok` | Successful Google sign-in |
| `admin_user.create` | Add admin account |
| `admin_user.update` | Update admin account |
| `admin_user.delete` | Delete admin account |
| `permission.grant` | Developer grants temporary capability |
| `permission.revoke` | Developer revokes grant |
| `analytics.reveal_ip` | Authorized raw IP reveal |
| `content.create` | Create content/amenity/menu row |
| `content.update` | Edit content/amenity/menu row |
| `content.delete` | Delete content/amenity/menu row |
| `media.update` | Edit photo metadata |
| `media.delete` | Delete uploaded photo/video |
| `settings.update` | Save settings |
| `system.check` | Temporary self-test row written then deleted by check |

### Delete alerts

- For any audited action ending in `.delete`, `auditedWrite()` sends an email alert after the D1 batch succeeds.
- From: `notify@hotelthakaliinn.com`
- To: `hotelthakaliinn1@gmail.com`
- Subject: `Admin delete — <section> / <slug> — by <actor>`
- Email failure is swallowed; it does not roll back the delete.

### Retention and archival

- Audit rows remain in D1.
- `workers/audit-archiver` copies unarchived rows to the WORM-protected R2 bucket `thakali-inn-audit-archive` every five minutes.
- After copy, it stamps `archived_at`.
- Archival is eventual by design so an R2 outage cannot roll back a committed D1 write.
- Rows with `archived_at IS NULL` appear as `pending` on the audit page.

See [`docs/operations.md`](operations.md) for the archive, backup and health-check Workers.

### Reading the audit page

Filters:

- `action` exact
- `actor` exact
- `section` substring
- `from` timestamp
- `to` timestamp

Action and actor dropdown options are sourced from `SELECT DISTINCT` queries.

Each row shows:

- when
- actor
- action
- section / slug
- archive status
- raw `before`/`after` inside `<details>`

Limit is fixed at 200 rows; no pagination.

---

## 11. Messages and booking requests

### Contact messages inbox

Table `messages`:

| Column | Purpose |
|---|---|
| `id` | Primary key |
| `name` | Guest name |
| `email` | Guest email |
| `message` | Message body |
| `created_at` | UTC SQLite datetime |

Admin page: `/admin/messages`  
File: `app/admin/messages/page.tsx`

- Read-only; no delete, update or status controls.
- Search by name, email or message.
- Newest first by `id DESC LIMIT 200`.
- Display timestamps are labeled `UTC`.
- Reply is a `mailto:` link.
- The public `/api/contact` notification mail has Reply-To set to the guest address, so replying from staff email should already reach the guest.

### Booking request queue

Table `booking_requests`:

| Column | Purpose |
|---|---|
| `id` | Primary key |
| `name` | Guest name |
| `email` | Guest email |
| `phone` | Phone |
| `room` | Selected room or room interest |
| `guests` | Guest count |
| `check_in` | `YYYY-MM-DD` Kathmandu date |
| `check_out` | `YYYY-MM-DD` Kathmandu date |
| `notes` | Guest notes |
| `created_at` | UTC SQLite datetime |

Admin page: `/admin/requests`  
File: `app/admin/requests/page.tsx`

- Sorted by arrival date rather than submission date: `ORDER BY check_in ASC, id DESC`.
- Limited to 200 rows.
- Search by name, email, room or notes.
- Past stays are marked with `· past` using Kathmandu today.
- No status or archive columns are exposed.

### Notifications

- Contact form submissions have an email notification path with Reply-To set to the guest.
- Delete alerts are described in Section 10.
- The provided notes do not record a separate booking-request notification email path.

---

## 12. Admin UI components

### Shared admin components

| Component | File | Purpose |
|---|---|---|
| `AdminNav` | `components/AdminNav.tsx` | Admin navigation; receives `role` prop |
| `AdminNotice` | `components/AdminNotice.tsx` | Renders `ok`/`err` notice from query params |
| `SubmitButton` | `components/SubmitButton.tsx` | Submit button with pending text |
| `PhotoPicker` | `components/PhotoPicker.tsx` | Select a photo/video from the media bank |
| `MediaUpload` | `components/MediaUpload.tsx` | Decode, resize and upload admin photos |
| `PriceRows` | `components/PriceRows.tsx` | Menu price-row editor with optional sizes |
| `BankBoard` | `components/BankBoard.tsx` | Full photo-bank contact-sheet/detail UI |
| `AmenityGlyph` | `components/AmenityGlyph.tsx` | Known amenity category symbol |
| `TouchGlyph` | `components/TouchGlyph.tsx` | Six little-touch symbols |
| `Glyph` | `components/Glyph.tsx` | Shared SVG glyph helper |
| `LogoMark` | `components/LogoMark.tsx` | Pagoda/TH monogram SVG |
| `WhatsAppMark` | `components/WhatsAppMark.tsx` | WhatsApp marker icon |
| `SocialMarks` | `components/SocialMarks.tsx` | Social platform icon map |

### Shared admin CSS classes

Admin CSS is split into a generic `.adm-*` system and the untokenised console skin `.adm-con-*`.

| Class | Purpose |
|---|---|
| `adm` | Admin scope wrapper |
| `adm-page` | Page-level container |
| `adm-con` | Constrained admin content column |
| `adm-back` | Back link |
| `adm-sub` | Subtitle text |
| `adm-con-help` / `adm-con-help-body` | Collapsible help panels |
| `adm-tabs` | Section tab navigation |
| `adm-toolbar` | Search/action toolbar |
| `adm-search` | Plain GET search form |
| `adm-count` | Result count |
| `adm-pager` | Pagination |
| `adm-group` / `adm-group-head` / `adm-group-count` | Grouped list headings and counts |
| `adm-row` | Collapsible `<details>` row |
| `adm-summary`, `adm-summary-main`, `adm-summary-title`, `adm-summary-meta` | Row summary line |
| `adm-thumb`, `adm-thumb--empty`, `adm-thumb--glyph` | Thumbnails and placeholders |
| `adm-item`, `adm-item-bar`, `adm-item-danger`, `adm-item-locked` | Item forms, action bars, delete zones |
| `adm-con-panel` | Fieldset panel |
| `adm-con-grid` | Responsive field grid |
| `adm-con-field`, `adm-con-wide`, `adm-con-pair` | Field wrappers |
| `adm-con-tick` | Checkbox label row |
| `adm-con-ticks` | Checkbox group |
| `adm-con-legend` | Group label inside a panel |
| `adm-con-hint` | Hint text |
| `adm-con-warn` | Warning text |
| `adm-con-mono` | Monospace tokens |
| `adm-con-readout` | Read-only preview/status |
| `adm-con-row`, `adm-con-row--wrap`, `adm-con-rows`, `adm-con-rowlabel` | Repeatable row layout |
| `adm-con-note` | Inline error inside a repeater row |
| `adm-con-empty` | Empty state |
| `adm-con-err` | Error text |
| `adm-con-summary` | Focusable validation summary |
| `adm-con-lamp` | Validation lamp with data-state `ok`, `bad`, `req`, `off` |
| `adm-con-choice` | Button-group choice control |
| `adm-con-pick`, `adm-con-pick-btn`, `adm-con-pick-mark`, `adm-con-pick-name`, `adm-con-pick-on` | Pictogram pickers |
| `adm-con-lock` | Email lock badge with `data-open` |
| `adm-con-preview` / `adm-con-preview-body` | Live preview pane |
| `adm-con-map` | Map preview |
| `adm-con-chips` / `adm-con-chip` | Custom chips |
| `adm-con-bar` / `adm-con-bar-state` | Sticky save bar and status |
| `adm-btn`, `adm-btn--go`, `adm-btn--bad`, `adm-btn--x`, `adm-btn--sm` | Button base and modifiers |
| `badge`, `badge--on`, `badge--off` | Visibility badges |
| `adm-tiles`, `adm-tile`, `adm-tile-label`, `adm-tile-number`, `adm-tile-desc`, `adm-tile-secondary` | Dashboard tiles |
| `adm-messages`, `adm-meta`, `adm-from`, `adm-body`, `adm-past` | Inbox/list styling |
| `adm-an-windows`, `adm-an-chart`, `adm-an-grid`, `adm-an-ylabel`, `adm-an-xlabel`, `adm-an-area`, `adm-an-line`, `adm-an-dot`, `adm-an-two`, `adm-an-bars`, `adm-an-strip`, `adm-an-cell`, `adm-an-table`, `adm-an-journey`, `adm-an-ip`, `adm-an-reveal` | Analytics detail page |
| `adm-audit-table` | Audit log table |
| `adm-chk-summary`, `adm-chk-list`, `adm-chk-lamp`, `adm-chk-name`, `adm-chk-detail`, `adm-chk-state`, `adm-chk-ms` | Check board |
| `adm-stats`, `adm-stats-head`, `adm-stats-empty`, `adm-stats-note`, `adm-spark-wrap`, `adm-spark`, `adm-spark-fill`, `adm-spark-line`, `adm-spark-peak`, `adm-delta` | Dashboard analytics |

### Adding a new admin page

1. Create `app/admin/<name>/page.tsx`.
2. Set `export const dynamic = "force-dynamic"`.
3. Start with `await requireSession()`.
4. Add finer permission checks with `can(session, "capability")` where needed.
5. Use `env.DB` from `cloudflare:workers` for D1.
6. Use plain GET forms and URL query parameters for search/filter state, not client state.
7. Route all writes through `auditedWrite()`.
8. Re-check capability at write time.
9. Make destructive forms sibling `<details>/<form>` blocks, never nested inside a save form.
10. Do not close over non-serializable local functions in Server Actions; use module-level helpers.
11. Use shared components: `AdminNav`, `AdminNotice`, `SubmitButton`, `PhotoPicker`, etc.
12. Use the `adm-*` and `adm-con-*` CSS classes.

---

## 13. Known issues / gotchas

- **No layout-level auth guard.** Next.js layouts do not run for Server Actions or route handlers; every admin page and Server Action must call `requireSession()` first.
- **`admin_users` is the sole login whitelist.** Adding a row permits Google sign-in; deleting it revokes an already-issued cookie at next `requireSession()`.
- **Delete actions require `content.delete`.** Page-render checks are UX only; every delete Server Action re-checks at write time because grants expire.
- **Do not use `/admin/content` for menu rows.** The generic content editor rebuilds `extra` from its form boxes and can discard multi-size drink data from migration `0022`.
- **Do not use `/admin/content` for amenities.** Amenities moved to `/admin/amenities` because generic editing could silently drop `extra` fields added by migration `0023`.
- **Nested HTML forms are invalid.** Delete confirmations are separate sibling `<details>/<form>` blocks.
- **D1 batch limitations.** `batch()` cannot feed `RETURNING` output into another statement’s bindings; code pre-reads the existing row with `SELECT` before create/update/delete.
- **Server Action closures.** Capturing a local function can throw “Functions cannot be passed directly to Client Components”; redirect helpers must be module-level.
- **Settings email row is not the actual delivery destination.** `wrangler.jsonc` pins `send_email.allowed_destination_addresses`. Changing `settings.email` without a matching deploy silently stops enquiry mail; it is gated by `settings.email`.
- **Email grants last 24 hours and can expire while the page is open.** Settings and other actions re-check at write time.
- **Pre-migration analytics rows.** `page_views` rows before migration `0020` have empty visitor/geography/device strings; analytics queries exclude them where counting would invent facts.
- **SQLite timestamps.** `datetime('now')` is UTC without a zone marker and often uses a space. Admin display must append `Z`/replace space with `T` to avoid wrong elapsed time.
- **200-row inbox limits.** Messages, requests and audit pages cap at 200 with no pagination.
- **Photo upload body ceiling.** Server Actions have roughly a 3 MB body ceiling; uploads must use the route handler at `app/admin/photos/upload/route.ts`.
- **Photo deletion race.** The reference check is not locked. Another tab could attach a photo between check and deletion and leave a broken reference.
- **Photo deletion best-effort.** D1 row is deleted first; if R2 deletion fails, an orphan object remains invisible to the bank/gauge.
- **New amenities are public immediately.** The Add form includes a hidden `published=on`.
- **Slug fields are read-only in edit forms.** `(section, slug)` is the primary key; renaming in edit would create a duplicate, not rename.
- **Hidden carried inputs are attacker-reachable.** Content and amenity forms carry hidden values for image/video/icon/extra; only `extra` is JSON-parsed/validated on the content screen.
- **Next.js prefetch can trigger side effects.** IP reveal and full system check are guarded with `prefetch={false}` and server checks of `Next-Router-Prefetch`.
- **IP reveal can produce two audit rows for one user action.** A real click may cause both RSC payload and document requests; this is accepted over-recording, but no reveal goes unwritten.
- **Analytics query contract.** `null` means database/query error; `[]` means legitimately empty. Dashboards do not render wrong numbers as if they were true zeros.
- **SQLite `strftime('%w')` weekday numbering.** Sunday is `0`; the analytics panel relabels to a Monday-first axis.
- **Mailto safety.** Older malformed messages must still be encoded on read even though the contact endpoint now rejects dangerous characters.
- **Repository media is non-deletable.** `/media/...` files ship in git/assets; only uploaded `/img/<key>` objects can be deleted from `/admin/photos`.
- **`bankStats()` only sums `media_assets`.** Repo-shipped media contributes `0` bytes to the storage gauge.
- **Duplicate repo filenames.** Repo bank names include folder prefixes to disambiguate; repo media is filtered out when an uploaded item already uses the same path.
- **Storage warning is deliberately conservative.** `BANK_WARN_BYTES` is 6 GiB, about 60% of the R2 free tier, leaving room for the nightly backup mirror.
- **`sameSite=Lax` is required for admin/OAuth cookies.** Strict cookies would be dropped during the Google return-redirect chain.
- **Audit archive is eventual.** Rows may show `pending` until the five-minute `audit-archiver` Worker copies them to WORM R2.
- **Session revocation requires a DB read.** If `admin_users` is unreachable, guarded pages behave as logged out and redirect to `/admin/login`.
- **Public route health checks use content phrases.** An HTTP 200 alone does not prove D1 content loaded; `PAGE_MUST_CONTAIN` strings must be updated when public copy changes.
- **`lib/content.ts` imports `cloudflare:workers`.** It cannot be imported from a `'use client'` bundle; keep pure helpers separate.
