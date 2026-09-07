# D1 data reference

Part of the Hotel Thakali Inn documentation — [Back to README](../README.md)

This chapter covers the complete Cloudflare D1 schema, the migration history, seeded data, querying conventions, and operational notes. For live Cloudflare bindings and cron schedules, see [docs/cloudflare.md](cloudflare.md). For how admin pages use this data, see [docs/admin.md](admin.md). For API routes that write to it, see [docs/api.md](api.md). For public rendering, see [docs/frontend.md](frontend.md).

## 1. Overview

- **Database name:** `thakali-inn-contact`
- **D1 database ID:** `62a811d5-4f4b-4268-9b3d-6ea35a08d7e1`
- **Binding in app code:** `env.DB`
- **Migration directory:** `migrations/*.sql`, 23 migrations
- **Database type:** Cloudflare D1 / SQLite
- **Shared by these Workers:**
  - `hotel-thakali-inn`
  - `thakali-inn-audit-archiver`
  - `thakali-inn-health-check`

Migrations are deliberately never applied from CI. They are applied manually against the `DB` binding for local and remote environments.

### Core tables

| Table | Purpose |
|---|---|
| `messages` | Public contact-form submissions |
| `content` | One generic ordered CMS table for hero, service, room, gallery, breakfast, amenity and menu content |
| `settings` | Key/value scalars, many containing JSON |
| `booking_requests` | Booking inquiry requests, not confirmed bookings |
| `page_views` | Privacy-aware page-view analytics |
| `admin_users` | Admin identity and Google Sign-In whitelist |
| `audit_log` | Append-only admin write audit trail |
| `permission_grants` | Expiring capability grants |
| `media_assets` | R2-backed photo/video upload metadata |

## 2. Migration history

| # | File | What it adds or changes | Tables touched | Seeds data? |
|---:|---|---|---|---|
| 1 | `migrations/0001_messages.sql` | `messages` table | `messages` | No |
| 2 | `migrations/0002_content.sql` | Generic `content` table and key/value `settings` table | `content`, `settings` | No |
| 3 | `migrations/0003_seed_content.sql` | Seeds original hero/service/room/gallery content and site settings | `content`, `settings` | Yes |
| 4 | `migrations/0004_seed_pages.sql` | Seeds breakfast and amenity page content | `content` | Yes |
| 5 | `migrations/0005_booking.sql` | `booking_requests` table | `booking_requests` | No |
| 6 | `migrations/0006_socials.sql` | Guarded update that fills real Instagram/Facebook URLs | `settings` | Yes |
| 7 | `migrations/0007_page_views.sql` | Initial `page_views` table and day index | `page_views` | No |
| 8 | `migrations/0008_cuisine_menu.sql` | Seeds full paid à la carte restaurant menu into `content` | `content` | Yes |
| 9 | `migrations/0009_amenity_icon_paid.sql` | Adds `content.icon` and `content.paid` columns | `content` | No |
| 10 | `migrations/0010_seed_amenities.sql` | Replaces placeholder amenity seed with full Booking.com facility list | `content` | Yes |
| 11 | `migrations/0011_fix_keema_naan_price.sql` | Fixes Keema Naan Chicken price from 70 to 170 | `content` | Yes |
| 12 | `migrations/0012_seed_rain_glass_settings.sql` | Seeds rain-glass day/night toggles, both `0` | `settings` | Yes |
| 13 | `migrations/0013_admin_users.sql` | Replaces shared admin password with `admin_users` accounts | `admin_users` | No |
| 14 | `migrations/0014_audit_log.sql` | Appends append-only `audit_log` table and indexes | `audit_log` | No |
| 15 | `migrations/0015_seed_admin_users.sql` | Seeds owner/developer/staff PBKDF2 temp-password accounts | `admin_users` | Yes |
| 16 | `migrations/0016_admin_users_google.sql` | Switches admin auth to Google Sign-In email whitelist; drops password columns | `admin_users` | Yes |
| 17 | `migrations/0017_settings_structured.sql` | Adds structured address, room-size and WhatsApp rows | `settings` | Yes |
| 18 | `migrations/0018_meals_and_good_rows.sql` | Adds `meals` and `good_rows`, rewrites composed `rooms_good_to_know` | `settings` | Yes |
| 19 | `migrations/0019_permission_grants.sql` | Adds `permission_grants` and live-grant index | `permission_grants` | No |
| 20 | `migrations/0020_page_views_visitor.sql` | Widens `page_views` with geography, device, visitor, IP and Kathmandu time | `page_views` | No |
| 21 | `migrations/0021_media_assets.sql` | Adds `media_assets` metadata table for R2 uploads | `media_assets` | No |
| 22 | `migrations/0022_merge_bar_sizes.sql` | Merges 122 bar rows into 46 multi-size drink rows | `content` | Yes |
| 23 | `migrations/0023_amenity_featured.sql` | Moves amenity highlights and touch glyphs into `content.extra` | `content` | Yes |

### Non-obvious migration notes

- **0002** deliberately uses one generic `content` table instead of separate tables for hero, service, room, gallery, breakfast and amenity collections. The primary key is `(section, slug)`, ordering is `position`, and section-specific data lives in `extra` JSON.
- **0006** only updates `settings.socials` if it still equals the empty-href seed from 0003. If staff edited socials before this migration ran, the staff edit is preserved.
- **0007** creates only the original `page_views` columns. Its header comment says the table is superseded by migration 0020, but the extra columns do not exist until 0020 is actually applied.
- **0008** transcribes the printed menu into 311 `content` rows. Printed multi-size or multi-portion lines are split into separate rows per price point. The suspicious Keema Naan Chicken price 70 is intentionally not fixed here; 0011 fixes it to 170 after manual verification.
- **0009** makes `icon` and `paid` available to every content section, but 0010 leaves amenity icons blank because icon asset files did not exist yet.
- **0010** is destructive to the old 12 placeholder amenity rows: it deletes all `section='amenity'` rows before inserting the real 68-row Booking.com-derived facility list.
- **0013 and 0015** moved admin auth from a shared password to individual accounts with temporary PBKDF2 password hashes. Plaintext passwords deliberately never touch committed migrations or command logs.
- **0016** is not re-runnable because `ALTER TABLE ADD COLUMN email` and the `DROP COLUMN` statements are unguarded. It also leaves the owner email `NULL`; the owner cannot sign in until an email is added later through `/admin/accounts`.
- **0018** changes visible copy: `rooms_good_to_know` changes “the airport” wording to “TIA terminal” / “Main entrance”.
- **0020** keeps 288 pre-existing `page_views` rows. Those rows remain valid but have empty geography, visitor, device, browser, IP and Kathmandu-time fields. `created_at` remains UTC and is unused.
- **0022** is destructive: it deletes all `section='menu_bar'` rows and re-inserts 46 merged drink rows. Its own comment says rollback is D1 Time Travel only, and a bookmark must be taken before applying to production.
- **0023** changes amenity curation from hardcoded arrays in `app/amenities/page.tsx` to `content.extra`, so staff can choose the highlights strip and little-touches symbols without a code deploy.

## 3. Tables

### 3.1 `messages`

Stores public contact-form submissions.

| Column | Type | Constraints / default |
|---|---:|---|
| `id` | INTEGER | PRIMARY KEY AUTOINCREMENT |
| `name` | TEXT | NOT NULL |
| `email` | TEXT | NOT NULL |
| `message` | TEXT | NOT NULL |
| `created_at` | TEXT | NOT NULL DEFAULT `(datetime('now'))` |

**Indexes / keys:** primary key only. No additional indexes.

**Relations:** none.

**Writes to it:** the public contact API route inserts submissions.

**Reads from it:** the admin messages inbox reads rows.

### 3.2 `content`

The single generic CMS/content table used for public sections and menu/amenity data.

| Column | Type | Constraints / default |
|---|---:|---|
| `section` | TEXT | NOT NULL, part of `PRIMARY KEY (section, slug)` |
| `slug` | TEXT | NOT NULL, part of `PRIMARY KEY (section, slug)` |
| `position` | INTEGER | NOT NULL DEFAULT `0` |
| `title` | TEXT | NOT NULL DEFAULT `''` |
| `tag` | TEXT | NOT NULL DEFAULT `''` |
| `body` | TEXT | NOT NULL DEFAULT `''` |
| `href` | TEXT | NOT NULL DEFAULT `''` |
| `image` | TEXT | NOT NULL DEFAULT `''` |
| `video` | TEXT | NOT NULL DEFAULT `''` |
| `extra` | TEXT | NOT NULL DEFAULT `'{}'` |
| `published` | INTEGER | NOT NULL DEFAULT `1` |
| `updated_at` | TEXT | NOT NULL DEFAULT `(datetime('now'))` |
| `icon` | TEXT | NOT NULL DEFAULT `''` — added by 0009 |
| `paid` | INTEGER | NOT NULL DEFAULT `0` — added by 0009 |

**Indexes / keys:**

- Primary key: `(section, slug)`
- `content_order ON content (section, position)`

**Relations:** no foreign keys. Media references are path strings such as `'/img/<key>'` or `/media/...`, not FK relations.

**Observed sections:** `hero`, `service`, `room`, `gallery`, `breakfast`, `amenity`, `menu_breakfast`, `menu_snacks`, `menu_mains`, `menu_bar`.

**Notable `extra` JSON shapes:**

- Room rows: `{count, meta, specs}`
- Breakfast rows: `{from, to}`
- Menu rows: `{"price": N}` or `{"price": N, "sizes": [{"label": "30ml", "price": N}, ...]}`
- Amenity rows: `{}`, `{"featured": 1}`, or `{"touch": "cup" | "fruit" | "wine" | "buffet" | "minibar" | "diet"}`

**Writes to it:** admin content editor, admin amenities editor, admin menu editor, admin photos-related metadata edits. All admin writes go through `auditedWrite()`.

**Reads from it:** public pages via `lib/content.ts section()`, `mediaReferences()`, admin editors via `section(name, includeHidden=true)`, and media bank references.

### 3.3 `settings`

Key/value scalars for the whole property.

| Column | Type | Constraints / default |
|---|---:|---|
| `key` | TEXT | PRIMARY KEY |
| `value` | TEXT | NOT NULL |

**Indexes / keys:** primary key on `key`.

**Relations:** none.

**Value formatting:** many values are JSON text and must be parsed; `lib/content.ts list()` and `lib/settings-schema.ts jsonList()` parse them. Some values are plain prose strings by design.

**Writes to it:** seed migrations use `INSERT OR IGNORE`; the admin settings server action only `UPDATE`s existing rows. Admin saves use `auditedWrite()`.

**Reads from it:** public layout/live payload, public contact/footer/booking pages, admin settings page, health checks.

### 3.4 `booking_requests`

Booking inquiry requests only, never confirmed bookings.

| Column | Type | Constraints / default |
|---|---:|---|
| `id` | INTEGER | PRIMARY KEY AUTOINCREMENT |
| `name` | TEXT | NOT NULL |
| `email` | TEXT | NOT NULL |
| `phone` | TEXT | NOT NULL DEFAULT `''` |
| `room` | TEXT | NOT NULL |
| `guests` | INTEGER | NOT NULL |
| `check_in` | TEXT | NOT NULL |
| `check_out` | TEXT | NOT NULL |
| `notes` | TEXT | NOT NULL DEFAULT `''` |
| `created_at` | TEXT | NOT NULL DEFAULT `(datetime('now'))` |

**Indexes / keys:** primary key only.

**Relations:** none.

**Date convention:** `check_in` and `check_out` are `YYYY-MM-DD` Kathmandu local dates, with no timezone or status column.

**Writes to it:** the public booking API route.

**Reads from it:** the admin booking-request inbox.

### 3.5 `page_views`

Privacy-aware page-view analytics.

Original columns created by 0007:

| Column | Type | Constraints / default |
|---|---:|---|
| `id` | INTEGER | PRIMARY KEY AUTOINCREMENT |
| `path` | TEXT | NOT NULL |
| `referrer` | TEXT | NOT NULL DEFAULT `''` |
| `day` | TEXT | NOT NULL |
| `created_at` | TEXT | NOT NULL DEFAULT `(datetime('now'))` |

Columns added by 0020:

| Column | Type | Constraints / default |
|---|---:|---|
| `country` | TEXT | NOT NULL DEFAULT `''` |
| `city` | TEXT | NOT NULL DEFAULT `''` |
| `region` | TEXT | NOT NULL DEFAULT `''` |
| `network` | TEXT | NOT NULL DEFAULT `''` |
| `device` | TEXT | NOT NULL DEFAULT `''` |
| `browser` | TEXT | NOT NULL DEFAULT `''` |
| `visitor` | TEXT | NOT NULL DEFAULT `''` |
| `ip` | TEXT | NOT NULL DEFAULT `''` |
| `at` | TEXT | NOT NULL DEFAULT `''` |

**Indexes / keys:**

- `idx_page_views_day ON page_views(day)` from 0007
- `idx_page_views_visitor ON page_views(visitor, id)` from 0020
- `idx_page_views_day_visitor ON page_views(day, visitor)` from 0020

**Conventions:**

- `day` is `YYYY-MM-DD` in Kathmandu local time, written by the route, not SQLite’s UTC `datetime('now')`.
- `referrer` stores only the referring host, not the full URL.
- `visitor` is a truncated hash of address + user agent, used for unique/return/journey analytics. It is explicitly not a privacy measure.
- `ip` is legally significant and never returned by list queries. It can only be revealed on demand with the `analytics.ip` capability, and each reveal writes an audit row.
- `at` is a Kathmandu wall-clock timestamp. `created_at` is UTC and was unused.

**Writes to it:** public `/api/view` route.

**Reads from it:** admin dashboard, analytics page, and `lib/analytics.ts` query helpers.

### 3.6 `admin_users`

Final auth model is Google Sign-In whitelist. Sometimes referred to in code comments as the “accounts” table / login whitelist.

| Column | Type | Constraints / default |
|---|---:|---|
| `id` | INTEGER | PRIMARY KEY AUTOINCREMENT |
| `username` | TEXT | NOT NULL UNIQUE |
| `role` | TEXT | NOT NULL |
| `created_at` | TEXT | NOT NULL DEFAULT `(datetime('now'))` |
| `email` | TEXT | nullable, added by 0016 |

Dropped by 0016: `password_hash` and `must_change_password`.

**Indexes / keys:**

- `UNIQUE(username)` from table creation
- `UNIQUE INDEX admin_users_email ON admin_users(email)` from 0016

**Roles:** `owner`, `developer`, `staff`.

**Relations:** `permission_grants.grantee` references `admin_users.username` logically, but there is no SQL foreign key.

**Writes to it:** admin accounts page adds/sets email addresses; 0015/0016 seed rows.

**Reads from it:** `lib/auth.ts requireSession()` re-reads the table on every admin request; the Google OAuth callback checks the verified email against this table.

### 3.7 `audit_log`

Append-only admin write audit.

| Column | Type | Constraints / default |
|---|---:|---|
| `id` | INTEGER | PRIMARY KEY AUTOINCREMENT |
| `created_at` | TEXT | NOT NULL DEFAULT `(datetime('now'))` |
| `actor` | TEXT | NOT NULL |
| `action` | TEXT | NOT NULL |
| `section` | TEXT | nullable |
| `slug` | TEXT | nullable |
| `before` | TEXT | nullable |
| `after` | TEXT | nullable |
| `archived_at` | TEXT | nullable |

**Indexes / keys:**

- `audit_log_created_at ON audit_log(created_at)`
- `audit_log_unarchived ON audit_log(archived_at) WHERE archived_at IS NULL`

**Relations:** none by SQL FK. `before` and `after` are JSON strings.

**Writes to it:** `lib/audit.ts auditedWrite()` inserts an audit row in the **same D1 batch** as the write it records. The only later update is `archived_at` set by `workers/audit-archiver` after copying the row to the WORM R2 bucket.

**Reads from it:** admin audit viewer, health-check audit write probe.

### 3.8 `permission_grants`

Temporary capability grants, usually 24 hours.

| Column | Type | Constraints / default |
|---|---:|---|
| `id` | INTEGER | PRIMARY KEY AUTOINCREMENT |
| `capability` | TEXT | NOT NULL |
| `grantee` | TEXT | NOT NULL — `admin_users.username` |
| `granted_by` | TEXT | NOT NULL |
| `granted_at` | TEXT | NOT NULL DEFAULT `(datetime('now'))` UTC |
| `expires_at` | TEXT | NOT NULL |
| `revoked_at` | TEXT | nullable |

**Indexes / keys:**

- `idx_grants_live ON permission_grants(grantee, capability, expires_at)`

**Relations:** logical `grantee` → `admin_users.username`; no SQL FK.

**Livenss rule:** a grant is live when `revoked_at IS NULL AND expires_at > datetime('now')`.

**Retention:** rows are never deleted; revocation only sets `revoked_at`. This preserves audit references.

**Writes to it:** developer grant and revoke flows. Grant/revoke statements are batched with audit rows via `auditedWrite()`.

**Reads from it:** `lib/permissions.ts can()`, `decisions()`, `liveGrants()`.

### 3.9 `media_assets`

Metadata for R2-backed photo/video uploads.

| Column | Type | Constraints / default |
|---|---:|---|
| `key` | TEXT | PRIMARY KEY |
| `kind` | TEXT | NOT NULL — app convention is `'photo'` or `'video'`; no SQL CHECK |
| `name` | TEXT | NOT NULL DEFAULT `''` |
| `mime` | TEXT | NOT NULL |
| `bytes` | INTEGER | NOT NULL |
| `width` | INTEGER | NOT NULL DEFAULT `0` |
| `height` | INTEGER | NOT NULL DEFAULT `0` |
| `thumb_key` | TEXT | NOT NULL DEFAULT `''` |
| `poster_key` | TEXT | NOT NULL DEFAULT `''` |
| `origin_url` | TEXT | NOT NULL DEFAULT `''` |
| `caption` | TEXT | NOT NULL DEFAULT `''` |
| `uploaded_by` | TEXT | NOT NULL |
| `uploaded_at` | TEXT | NOT NULL DEFAULT `(datetime('now'))` |
| `day` | TEXT | NOT NULL |

**Indexes / keys:**

- `media_assets_day ON media_assets(day, kind)`
- `media_assets_recent ON media_assets(uploaded_at DESC)`

**Relations:** `key` is the R2 object key; public URL is `'/img/' || key`. `thumb_key` and `poster_key` are also R2 object keys. `content.image` and `content.video` reference `/img/<key>` strings, not this table by FK.

**Writes to it:** admin photo/video upload route inserts a row after successful R2 object creation.

**Reads from it:** `lib/media-store.ts dailyCount()`, `bankStats()`, `bankItems()`.

## 4. Seeded content

### 4.1 Initial editorial seed — 0003

`migrations/0003_seed_content.sql` seeds 24 `content` rows:

| Section | Rows |
|---|---:|---|
| `hero` | 4 rows: arrival, rooms, breakfast, desk |
| `service` | 5 rows: rooms, breakfast, amenities, gallery, contact |
| `room` | 3 rows: deluxe-double, deluxe-king, family |
| `gallery` | 12 rows: signage, arrival, lobby, corridor, rooms, bedside, window, minibar, bathrooms, dining, buffet, breakfast |

It also inserts 13 initial settings keys:

| Key | Seed / purpose |
|---|---|
| `phone` | `+977-9840007925` |
| `email` | `hotelthakaliinn1@gmail.com` |
| `address` | `Sinamangal Kalimatidol, Kathmandu 44600` |
| `plus_code` | `M9X3+7J Kathmandu` |
| `lat` | `27.6981357` |
| `lng` | `85.3540451` |
| `booking_url` | Booking.com hotel URL |
| `maps_url` | Google Maps place URL |
| `socials` | JSON list, initially empty Instagram/Facebook hrefs |
| `rooms_shared` | Shared room amenities string |
| `rooms_size` | `Rooms start at about 42 m² (450 sq ft), bathroom included.` |
| `rooms_good_to_know` | JSON list of good-to-know lines |
| `arrival` | JSON matrix of arrival distances |

### 4.2 Breakfast and amenity page seed — 0004

Adds 15 `content` rows:

- `breakfast` section:
  - buffet — `extra` includes `{"from":"07:00","to":"10:00"}`
  - packed — `extra` includes `{"from":"00:00","to":"07:00"}`
  - dining
- `amenity` section: 12 placeholder amenity rows, including front-desk with the image `/media/amenities/front-desk.jpg`.

### 4.3 Socials — 0006

Guarded update replaces the empty 0003 socials with:

| Platform | URL |
|---|---|
| Instagram | `https://www.instagram.com/hotelthakaliin/` |
| Facebook | `https://www.facebook.com/profile.php?id=61583854952907` |

### 4.4 Paid cuisine menu — 0008

Migration 0008 seeds **311 à la carte restaurant menu rows** into `content`.

| Section | Count | Tags / groups |
|---|---:|---|
| `menu_breakfast` | 12 | Breakfast, Any Choice Sides |
| `menu_snacks` | 89 | Indian Veg Kebab/Snacks, Indian Non-Veg Kabab & Snacks, Burger, Sandwich, Salad, Soup, Starter — Veg, Starter — Non Veg, Noodles/Fried Rice |
| `menu_mains` | 88 | Indian Curry-Veg, Indian Curry-Non Veg, Sekuwa, Indian Rice, Indian Bread, Special Momo, Special Platter, Biryani, Roti, Curry, Special Thakali Set, Add On, Dessert |
| `menu_bar` | 122 | Nepali Tea, Fresh Juices, Imported Liquor, Domestic Liquor, Beer, Draught Beer, Wine, Red Bull, Shisha/Hukka, Cigarette |

Every printed price point was transcribed into `extra` as `{"price": N}`. Currency is implicit NPR/Rs.

Notable seeded details:

- Big Boss Breakfast is 495.
- Keema Naan Chicken was initially 70; 0011 corrected it to 170.
- Special Thakali Set rows include body notes about Thakali Dhindo Set +Rs 50.
- Imported wine bottle row lists Robertson Wine, J.P. Chenet, Jacob’s Creek, Gossip.
- Alu Paratha Set body says “20 mins, 2 pieces. Served with juju dhau and pickle.”
- `menu_bar` originally included not just drinks but shisha/hukka and cigarette rows.

### 4.5 Bar menu merge — 0022

Migration 0022 deletes and re-inserts the bar section as **46 multi-size drink rows**.

Example `extra` shape:

```json
{
  "price": 820,
  "sizes": [
    {"label": "30ml", "price": 820},
    {"label": "60ml", "price": 1550},
    {"label": "180ml", "price": 4550},
    {"label": "360ml", "price": 8550}
  ]
}
```

Non-sized items such as tea, Red Bull and shisha keep a single `{"price": N}`.

### 4.6 Amenity reseed — 0010

Migration 0010 replaces the 12 placeholder amenities with **68 facility rows** from Booking.com.

Booking.com grouping headings are stored in `content.tag`:

`Bathroom`, `Food & Drink`, `Business Facilities`, `Safety & security`, `Outdoors`, `Kitchen`, `Room amenities`, `Pets`, `Activities`, `Living Area`, `Media & Technology`, `Internet`, `Parking`, `Front Desk Services`, `Cleaning Services`, `General`, `Languages Spoken`.

`paid = 1` is used where Booking.com says “Additional charge”, “extra fee”, or implies off-site/on-request cost. `paid = 0` means free/included.

Notable amenity rows:

- `24-hour-front-desk` carries image `/media/amenities/front-desk.jpg` and body “Late arrivals are normal here.”
- `wifi` is free and available in all areas.
- Parking is free public on-site with no reservation.
- Pet row says pets allowed on request with no extra charges.
- Airport shuttle is paid.
- Languages seeded are English and Hindi.

### 4.7 Amenity highlighting — 0023

Migration 0023 moves `/amenities` highlights and little-touches configuration into `content.extra`.

Featured rows receive:

```json
{"featured": 1}
```

Featured slugs:

`wifi`, `24-hour-front-desk`, `airport-shuttle`, `main-restaurant`, `breakfast-in-room`, `daily-housekeeping`, `air-conditioning`, `baggage-storage`, `cctv-common-areas`, `private-bathroom`, `tea-coffee-maker`, `room-service`.

Touch rows receive:

| Slug | `extra.touch` |
|---|---|
| `coffee-house` | `cup` |
| `fruit` | `fruit` |
| `wine-champagne` | `wine` |
| `kid-friendly-buffet` | `buffet` |
| `minibar` | `minibar` |
| `special-diet-meals` | `diet` |

### 4.8 Admin users — 0015 and 0016

Migration 0015 seeds three accounts:

| Username | Role | 0016 email |
|---|---|---|
| `owner` | owner | `NULL` intentionally, to be added later via `/admin/accounts` |
| `developer` | developer | `sharmadivyesh20070727@gmail.com` |
| `staff` | staff | `hotelthakaliinn1@gmail.com` |

The 0015 password hashes were one-time temporary PBKDF2 hashes; 0016 dropped password authentication entirely.

## 5. Settings model

### 5.1 Storage model

`settings` is a flat key/value table. Values are always TEXT. Many values are JSON strings:

| Key | Shape |
|---|---|
| `socials` | array of `{"label": string, "href": string}` |
| `arrival` | array of `[place, string]` |
| `meals` | array of `{"meal", "style", "from", "to", "cost", "price"}` |
| `good_rows` | array of `{"text", "onRequest", "cost"}` |
| `rooms_good_to_know` | array of strings |

Other rows are prose strings by design, such as `address`, `rooms_size` and `rooms_shared`.

### 5.2 Structured and derived rows

Migrations 0012, 0017 and 0018 add the rows used by the settings console and public display:

| Key | Seed / meaning |
|---|---|
| `rain_glass_day` | `'0'` or `'1'` |
| `rain_glass_night` | `'0'` or `'1'` |
| `addr_tole` | `Sinamangal Kalimatidol` |
| `addr_ward` | optional numeric ward |
| `addr_city` | `Kathmandu` |
| `addr_district` | optional |
| `addr_postal` | `44600` |
| `rooms_size_value` | `42` |
| `rooms_size_unit` | `m2` |
| `rooms_size_bathroom` | `1` |
| `whatsapp` | optional separate number |
| `whatsapp_same` | `'1'` unless clearly `'0'` |
| `meals` | structured meal JSON |
| `good_rows` | structured good-to-know-row JSON |
| `rooms_good_to_know` | composed output of `meals` + `good_rows` + arrival distance lines |

### 5.3 Composable settings shape

`lib/settings-schema.ts composeAll()` returns keys exactly matching the rows consumed elsewhere:

`phone`, `whatsapp`, `whatsapp_same`, `email`, `booking_url`, `socials`, `maps_url`, `lat`, `lng`, `plus_code`, `address`, `addr_tole`, `addr_ward`, `addr_city`, `addr_district`, `addr_postal`, `arrival`, `rooms_shared`, `rooms_size`, `rooms_size_value`, `rooms_size_unit`, `rooms_size_bathroom`, `meals`, `good_rows`, `rooms_good_to_know`, `rain_glass_day`, `rain_glass_night`.

### 5.4 Validation

Validation is defined in `lib/settings-schema.ts` and shared by:

- the client settings console,
- the admin settings server action,
- `scripts/settings-check.mjs`.

Key validation rules:

- Country code is stored with a hyphen and digits, e.g. `+977-9840007925`.
- Local phone fields store digits only.
- Nepali postal codes must be exactly five digits.
- Plus code uses the OLC alphabet and shape `4-8 chars + 2-3 chars + optional Town`.
- URLs must be HTTPS.
- Amenity names and meal names come from allowed vocabularies.
- Lists are capped at 40 entries.
- The server action re-runs the same validation with `computeErrors()` before writing.

### 5.5 Settings form mapping

`app/admin/settings/page.tsx` loads current settings rows and renders `SettingsForm.tsx`.

The form:

- serializes all values into one hidden JSON input,
- submits to a server action,
- coerces and re-validates with the same schema library,
- writes settings and room-size changes in one audited D1 batch.

The email field is locked in the UI unless the current admin has the `settings.email` capability through role or temporary grant.

The settings save action only `UPDATE`s existing rows, never inserts missing keys.

## 6. Derived / analytics tables

### 6.1 Page views and visitor handling

The analytics model is split across two time fields:

| Field | Meaning |
|---|---|
| `day` | Kathmandu calendar date, used for daily counts |
| `at` | Kathmandu wall-clock timestamp, used for hour-of-day analysis |
| `created_at` | Legacy UTC timestamp, unused for analytics |

Geography, network, device, browser and visitor data arrive with migration 0020. Rows created before 0020 have empty values and are excluded where counting them would invent facts.

Visitor handling rules:

- `visitor` is a truncated hash of address + user agent.
- Returning visitor means appearing on more than one Kathmandu day.
- Two visits an hour apart do not count as a return.
- IP addresses are never selected by list queries.
- The only direct IP fetch is `visitorAddress()` in `lib/analytics.ts`, gated by `analytics.ip`.
- Raw IP reveal writes an audit row.
- The nightly health worker blanks `page_views.ip` older than one year, as promised by the privacy policy.

### 6.2 Audit log

`audit_log` is append-only.

- Each admin write inserts an audit row in the same `env.DB.batch()` as the write.
- Delete actions ending in `.delete` also send an email alert.
- The only allowed later mutation is `archived_at`, set by `workers/audit-archiver` after the row has been copied to the WORM R2 bucket `thakali-inn-audit-archive`.
- Rows are never deleted.

## 7. Querying conventions

### Intended readers

- Public content pages should use `lib/content.ts section()`.
- Public settings should use `lib/content.ts settings()`.
- Analytics should use `lib/analytics.ts`.
- Media accounting should use `lib/media-store.ts`.
- Permissions should use `lib/permissions.ts`.

### Prepared statements

- User-supplied values are bound with `?1` style parameters.
- Some internal limit integers are interpolated into SQL only where they are constants, never user input.

Examples:

- `permission_grants` grant/revoke statements are exported as prepared statements so callers can batch them with audit rows.
- `content` media references use one `UNION ALL` across `content.image`, `content.video` and `content.icon`.

### Batching

Write + audit atomicity is guaranteed by D1 batches:

- `lib/audit.ts auditedWrite()` inserts the data-changing statement and the audit-log insert in the same `env.DB.batch()`.
- `permission_grants` grant/revoke statements are used with `auditedWrite()` as well.

### Error handling

The library convention is:

| Result | Meaning |
|---|---|
| `null` | Query threw |
| `[]` | Legitimate empty answer |

Helpers such as `parseExtra()` and `list()` swallow malformed JSON to keep public pages up, but the admin editor guards make malformed UI-written `extra` unreachable.

## 8. Applying migrations

The D1 binding is `DB`, and migrations live in `migrations/*.sql`.

Manual application follows Wrangler’s D1 migration commands:

```sh
# apply all pending migrations to local D1
wrangler d1 migrations apply DB --local

# check local applied migrations
wrangler d1 migrations list DB --local

# apply all pending migrations to remote production D1
wrangler d1 migrations apply DB --remote

# check remote applied migrations
wrangler d1 migrations list DB --remote
```

Important operational rules from the source notes:

- CI never applies migrations.
- Local wrangler dev requires a migrated local D1.
- Before applying 0022 to production, take a D1 Time Travel bookmark.
- 0016 must never be blindly re-run because it is not re-runnable.
- Some migrations such as 0017, 0018, 0019, 0021 and 0023 are replay-safe; not all are.

## 9. Known issues / gotchas

- **0007 comment vs schema drift:** 0007’s header says `page_views` is superseded by 0020 and “now also holds” geography/device/visitor/IP columns, but those columns only exist after 0020 is applied.
- **0016 is not re-runnable:** it adds a column and drops columns without `IF EXISTS`/guards.
- **0022 is destructive:** it deletes all `menu_bar` rows before re-inserting. Rollback is D1 Time Travel only.
- **Owner may be locked out:** 0016 leaves the owner email `NULL`; the owner cannot sign in until an email is added via `/admin/accounts`.
- **Settings save never inserts:** if a settings key is missing, the admin save silently never persists it because the server action only updates existing rows.
- **`page_views.ip` is legally significant:** it is kept only for one year, never returned by list queries, and every reveal must be audit-logged.
- **`page_views.visitor` is not privacy:** it is a truncated hash used for analytics, while the raw IP sits in the same row.
- **No foreign keys:** `permission_grants.grantee`, `media_assets` references, and content/media references are logical, not enforced at SQL level.
- **`permission_grants.grantee` is username-based:** if `admin_users.username` changes, grants can dangle.
- **`media_assets.kind` has no SQL CHECK:** `'photo' | 'video'` is enforced by application rules, not the schema.
- **Rooms square footage changes:** old text says 450 sq ft, but 42 m² converts to 452 sq ft; after first settings save the display changes.
- **0018 changes public copy:** “the airport” becomes “TIA terminal” / “Main entrance”.
- **0022 title merge risk:** bar rows are merged by splitting on ` — ` in titles. Any differently intended use of that separator would merge incorrectly.
- **`content.extra` is JSON text:** all readers must parse it before use.
- **No indexes on `messages` or `booking_requests`:** admin/user queries rely on scans of small tables.
- **`bankStats()` only sums `media_assets`:** git-shipped `public/media` repo items contribute 0 bytes to the storage gauge.
- **Repo media is not deletable:** files shipped in `public/media` live in git and the assets binding, not R2.
- **A missing `permission_grants` table denies grantable capabilities:** the permission layer fails closed.
- **The live D1 API reported `num_tables` 0 while the file was 299,008 bytes:** the live D1 inventory cannot be used to verify table names; the schema is known from migrations and source code.
