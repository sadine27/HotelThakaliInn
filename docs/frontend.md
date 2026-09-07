# Frontend and public experience

Part of the Hotel Thakali Inn documentation — see [../README.md](../README.md) for the chapter index.

## Overview

The public site is a Next.js 15 App Router application running on Cloudflare Workers through the **vinext** build path, with React 19, RSC/server components, Vite and Cloudflare bindings.

Rendering model:

- Public pages are **`force-dynamic`** and read D1 through `section()` / `settings()` from `@/lib/content`.
- The build's static prerender pass has no `env.DB`, so every D1-reading page carries its own literal `export const dynamic = "force-dynamic"`; forgetting it can stale the page or break the build.
- Data fetching happens in server components/pages. Presentational components receive plain props and do not query D1, fetch, or authenticate.
- Client components begin with `"use client"`. Static server components such as `HotelSchema`, `AmenityGlyph`, and `LogoMark` do not.
- Root layout mounts the shared public chrome once: `LiveProvider`, `DialNav`, `FloatDock`, `SiteFooter`, `ViewBeacon`.
- Public view state uses several deliberate mechanisms:
  - URL state for the hero door (`/?inside`) and room detail (`/rooms?room=<slug>`).
  - `localStorage` only for remembering the last opened room (`ti_room`), wrapped in `try/catch`.
  - React context for the shared `/api/live` payload.
  - `data-*` attributes on `<html>`/elements for CSS-driven state such as `data-dial-open`, `data-footer-visible`, `data-daypart`, `data-sky`, `data-open`, `data-state`, `data-dir`, and `data-liquid`.
- Admin pages are server-rendered and guard themselves. `app/admin/layout.tsx` deliberately contains no auth guard because Next.js layouts do not protect Server Actions; each admin page/action calls `requireSession()` at write time. See [docs/admin.md](admin.md).

Fonts are loaded via `next/font/google` in `app/layout.tsx`: Manrope as `--font-sans`, JetBrains Mono as `--font-mono`, and Fraunces as `--font-serif`.

## Public pages

### `/` — `app/page.tsx`

- **What is on the page:** home hero slides, ambient video layer, live Kathmandu readout, services cards behind the “beyond” door, booking/maps CTAs, and `HotelSchema` JSON-LD.
- **Content source:** `section('hero')`, `section('service')`, and `settings()` are loaded in parallel from D1.
- **Components composed:** `HeroCarousel`, `HotelSchema`, `ServicesCarousel` through `HeroCarousel`, plus `LiveProvider`/`LiveLine`/`LiveNote`, `RainGlass`, and global `DialNav`/`FloatDock`/`SiteFooter` from the root layout.
- **Notes:** returns `null` when there are no hero rows. Canonical is `/` because opening the door writes `?inside`.

### `/amenities` — `app/amenities/page.tsx`

- **What is on the page:** amenity catalog with six experience cards, featured highlights grid, thoughtful touches strip, and the complete grouped amenity list.
- **Content source:** `section<AmenityExtra>('amenity')` and `settings()` from D1. Rows are grouped by `tag` while preserving `position` order; a blank tag becomes its own unheaded group.
- **Components composed:** `AmenityGlyph`, `TouchGlyph`, `Img`, and shared chrome.
- **Notes:** row flags come from typed JSON in `extra`: `extra.featured`, `extra.touch`, and `r.paid`. Some experience photos are hardcoded under `/media/gallery`.

### `/book` — `app/book/page.tsx`

- **What is on the page:** direct booking request form; no card and no deposit.
- **Content source:** room section rows and `settings()` from D1. Room capacity is read from `r.tag`; count is read from `r.extra.count`.
- **Components composed:** `BookingForm`, wrapped in `Suspense` because the form uses `useSearchParams`.
- **Notes:** preselects a room with `?room=<slug>`. If no rooms exist, the page returns `null`.

### `/breakfast` — `app/breakfast/page.tsx`

- **What is on the page:** legacy redirect.
- **Content source:** none.
- **Components composed:** none.
- **Notes:** redirects to `/cuisine`; breakfast content is now a section of the cuisine menu.

### `/contact` — `app/contact/page.tsx`

- **What is on the page:** contact details, live Kathmandu clock line, Google Maps embed, WhatsApp, Booking.com, direct request CTA, social links, arrival distances, plus-code copy, message form, and `HotelSchema`.
- **Content source:** `settings()` and `section('hero')` from D1. Derived helpers: `phoneHref`, `waHref`, `mapEmbedUrl`, and `directionsUrl`.
- **Components composed:** `ContactPanel`, `HotelSchema`, shared chrome.
- **Notes:** WhatsApp falls back to the main phone unless `whatsapp_same='0'`.

### `/cuisine` — `app/cuisine/page.tsx`

- **What is on the page:** full à la carte menu as a tabbed leather-bound book.
- **Content source:** `menu_breakfast`, `menu_snacks`, `menu_mains`, and `menu_bar` sections plus `settings()`.
- **Components composed:** `MenuBook`.
- **Notes:** uses `MenuItem` and `Size` types. Shows a stop message if there are no items.

### Public/admin error boundary — `app/error.tsx`

- **What is on the page:** client error boundary for D1/RSC failures.
- **Content source:** no D1 reads.
- **Components composed:** custom stop-state markup.
- **Notes:** logs the error in `useEffect`; reset button retries render. On `/admin` it shows raw `error.message` and “Back to admin panel”; public guests see only the digest when present.

### `/gallery` — `app/gallery/page.tsx`

- **What is on the page:** photo/video gallery accordion wall.
- **Content source:** `section('gallery')` from D1.
- **Components composed:** `GalleryWall`.
- **Notes:** returns `null` when empty. Maps `slug`/`title`/`tag`/`body`/`image`/`video` into `GalleryWall` panels.

### Root layout — `app/layout.tsx`

- **What is on the page:** HTML shell, fonts, `LiveProvider`, main content container, footer, navigation dial, floating dock, and view beacon.
- **Content source:** `SITE_URL`/description from `lib/site.ts`; fonts via `next/font/google`.
- **Components composed:** `LiveProvider`, `DialNav`, `FloatDock`, `SiteFooter`, `ViewBeacon`.
- **Notes:** `LiveProvider` stamps `data-daypart`/`data-sky` on `<html>`. `ViewBeacon` skips `/admin`.

### PWA manifest — `app/manifest.ts`

- **What is on the page:** web app manifest.
- **Content source:** static constants.
- **Notes:** name `Hotel Thakali Inn`, short name `Thakali Inn`, start URL `/`, background `#ECE4D2`, theme `#344E41`, icon `/icon.svg`.

### 404 — `app/not-found.tsx`

- **What is on the page:** 404, one-line copy, back link.
- **Content source:** static copy.
- **Components composed:** shared root layout dial/dock/footer.
- **Notes:** no extra navigation because the layout provides it.

### OpenGraph image — `app/opengraph-image.tsx`

- **What is on the page:** generated social share card.
- **Content source:** static SVG/brand glyph.
- **Notes:** `next/og` `ImageResponse`, 1200×630 PNG; cream `#ECE4D2`, forest `#344E41`, subtitle `Sinamangal, Kathmandu`.

### `/privacy` — `app/privacy/page.tsx`

- **What is on the page:** EU/UK GDPR and Nepal Individual Privacy Act disclosure.
- **Content source:** email from `settings()` with fallback `hotelthakaliinn1@gmail.com`.
- **Components composed:** legal `.legal-*` prose; shared chrome.
- **Notes:** describes view data collected, one-year IP deletion, audit-log records for IP reveals, and contact deletion.

### `/robots.txt` — `app/robots.ts`

- **What is on the page:** robots rules and sitemap URL.
- **Content source:** static rules.
- **Notes:** allows `/`, disallows `/admin`, points to `${SITE_URL}/sitemap.xml`.

### `/rooms` — `app/rooms/page.tsx`

- **What is on the page:** 3D room fan carousel with slide-out room detail panel.
- **Content source:** room section rows and `settings()` from D1. Converts `r.tag` to capacity; reads `r.extra.count`, `r.extra.meta`, `r.extra.specs`, and `r.extra.sizeValue`. Uses `composeSizePair` and `rooms_size_unit`.
- **Components composed:** `RoomsCarousel` in `Suspense`; `LiquidBackground` when detail opens.
- **Notes:** empty room list shows stop message. `app/rooms/layout.tsx` renders `.room-ground` so the server paints the background before `.room-page` fades from opacity 0.

### `/sitemap.xml` — `app/sitemap.ts`

- **What is on the page:** sitemap for all public routes.
- **Content source:** `PUBLIC_ROUTES` from `lib/public-routes.ts`.
- **Notes:** maps each route to `${SITE_URL}${route}` with `lastModified` today. Shared with the system route checker.

## Component reference

Every file in `components/` is listed here. Admin-specific workflows are documented further in [docs/admin.md](admin.md).

| File | Components / exports | Purpose | Props |
|---|---|---|---|
| `components/AdminNav.tsx` | `AdminNav` | Admin sidebar linking to dashboard, requests, enquiries, content, menu, amenities, photos, settings, check, audit, accounts. Managers-only links are filtered by role. | `role: string \| null` |
| `components/AdminNotice.tsx` | `AdminNotice` | Success/error popup after admin server-action redirects with `?ok=` / `?err=`; strips params and auto-dismisses. | `tone?: 'ok' \| 'err'`, `message?: string` |
| `components/AmenityGlyph.tsx` | `AmenityGlyph` | Hand-drawn amenity category SVG glyph with fallback. | `category?: string`, `icon?: string`, `size?: number` |
| `components/BankBoard.tsx` | `BankBoard` | Admin photo/video bank contact sheet with tabs, search/filter, gauge, upload field, metadata side panel, and guarded delete. | `items: BankItem[]`, `canDelete: boolean`, `leftToday: number`, `bytes: number`, `saveDetails`, `removeItem` |
| `components/BookingForm.tsx` | `BookingForm` | Public direct booking request form posting JSON to `/api/booking`; honeypot and date constraints. | `rooms: RoomOption[]`, `bookingUrl: string`, `phone: string` |
| `components/ContactPanel.tsx` | `ContactPanel` | Contact page main panel: channels, live clock, arrival strip, map, plus-code copy, message form. | `info: ContactInfo` |
| `components/DialNav.tsx` | `DialNav` | Public radial menu dial with six destinations, keyboard/focus support, and view-transition navigation. | none |
| `components/FloatDock.tsx` | `FloatDock` | Fixed guest controls: back, WhatsApp, Book. | none |
| `components/GalleryWall.tsx` | `GalleryWall`, `Panel` | Six-column rotating gallery accordion wall with active video playback. | `panels: Panel[]` |
| `components/Glyph.tsx` | `Glyph`, `GlyphName` | Four small inline SVG icons: `phone`, `mail`, `external`, `pin`. | `name: GlyphName`, `size?: number` |
| `components/HeroCarousel.tsx` | `HeroCarousel`, `Slide` | Homepage hero with ambient video, rotating slides, door view, and CTAs. | `slides: Slide[]`, `cards: ServiceCardData[]`, `bookingUrl: string`, `mapsUrl: string` |
| `components/HotelSchema.tsx` | `HotelSchema` | Schema.org/Hotel JSON-LD for SEO. | `config: Record<string,string>`, `socials: {label,href}[]`, `image?: string` |
| `components/Img.tsx` | `Img` | Routes content images to `next/image` or plain `<img>` for `/img/` R2 paths. | `ImageProps & { src: string }` |
| `components/LiquidBackground.tsx` | `LiquidBackground` | WebGL animated liquid/shiny ground behind room detail. | `speed?: number` |
| `components/Live.tsx` | `LiveProvider`, `useLive`, `LiveLine`, `LiveNote`, `useClock` | Shared `/api/live` fetch/context, daypart/sky HTML attributes, live clock/temp/AQI line, prose note. | provider: `children`; hook: none |
| `components/LogoMark.tsx` | `LogoMark` | SVG pagoda/TH monogram logo. | `size?: number`, `green?: string`, `olive?: string`, `title?: string` |
| `components/MediaUpload.tsx` | `MediaUpload` | Admin photo uploader with browser resize to 1600px WebP + 400px thumb, sequential upload, daily quota. | `leftToday: number` |
| `components/MenuBook.tsx` | `MenuBook` | Public tabbed book menu with cover, grouped menu items, size/price rows. | `items: MenuItem[]`, `tagline: string`, `address: string` |
| `components/PhotoPicker.tsx` | `PhotoPicker` | Admin media picker replacing free-text image/video paths with a lazy `<dialog>` thumb grid. | `name`, `label`, `kind`, `items`, `defaultValue`, `hint?` |
| `components/PriceRows.tsx` | `PriceRows` | Admin menu price editor for single price or multiple `size_label`/`size_price` rows. | `defaultValue: Size[]`, `sizes: boolean` |
| `components/RainGlass.tsx` | `RainGlass` | Weather-gated full-pane canvas “rain on glass” effect. | none |
| `components/RoomsCarousel.tsx` | `RoomsCarousel`, `RoomCard` | 3D bounded room fan with keyboard/pointer navigation, detail side panel, URL deep links, localStorage room memory. | `rooms: Room[]`, `shared: string`, `size: string`, `goodToKnow: string[]`, `bookingUrl: string` |
| `components/ServicesCarousel.tsx` | `ServicesCarousel`, `ServiceCard` | 3D service-card ring with autoplay, fly-in entrance, pointer tilt/sway, and mobile fallback. | `open: boolean`, `cards: ServiceCardData[]` |
| `components/SiteFooter.tsx` | `SiteFooter` | Global footer with logo, contact/social lines, description, copyright, and footer-visibility observer. | none |
| `components/SocialMarks.tsx` | `InstagramMark`, `FacebookMark`, `TikTokMark`, `YouTubeMark`, `XMark`, `LinkedInMark`, `TripAdvisorMark`, `BookingMark`, `GoogleBusinessMark`, `MARKS` | Inline SVG platform glyphs and registry keyed by exact settings labels. | each mark: `size?: number` |
| `components/SubmitButton.tsx` | `SubmitButton` | Submit button that disables and relabels while a form action is pending. | `children: ReactNode`, `pendingText: string`, plus button attributes |
| `components/TouchGlyph.tsx` | `TouchGlyph` | Six food-and-drink icons: `cup`, `fruit`, `wine`, `buffet`, `minibar`, `diet`. | `name: TouchName`, `size?: number` |
| `components/ViewBeacon.tsx` | `ViewBeacon` | Sends one anonymous `POST /api/view` per public pathname; renders nothing. | none |
| `components/WhatsAppMark.tsx` | `WhatsAppMark` | WhatsApp brand glyph. | `size?: number` |

### Carousels

#### `HeroCarousel` + `ServicesCarousel`

`HeroCarousel` owns the homepage hero, ambient video, slide rotation, and the door into the “beyond” services ring. It receives `slides`, service `cards`, `bookingUrl`, and `mapsUrl`. It auto-advances every `DWELL=2100ms`, pauses on hover or while `?inside` is open, and supports previous/next arrows, tick buttons, keyboard arrows, and touch swipe using the `DRAG` threshold from `@/lib/carousel`.

The door is implemented as URL state instead of a React-modal:

- Opening/Closing sets `?inside` via `window.history.pushState`/`replaceState`/`back`.
- Router navigation is deliberately avoided because `/` is force-dynamic and would refetch the same D1 rows.
- Escape and browser Back close the door.
- Canonical is `/`.

`ServicesCarousel` renders a cylinder ring of service cards. It uses framer-motion for `rotateY` with `step=360/total` and a spring `{ stiffness:55, damping:16 }`. Entrance variants are deterministic noise-based fly-ins. The variants intentionally omit opacity and `y` so they do not force `transform-style:flat` or create scrollable overflow. Pointer tilt/sway is disabled under reduced motion. Mobile fallback activates below `width < 820px`.

#### `RoomsCarousel`

Renders a bounded 3D fan rather than a closed ring. `STEP=58` degrees, and the turn is not modulo-based. It supports arrow buttons, drag, `ArrowUp`/`ArrowDown`, `Escape`, pointer sway, and direct `?room=<slug>` deep links.

Opening a room sets URL state and localStorage `ti_room`. Closing a room normally uses `router.back()`, but a direct deep-link close pushes `/rooms` instead of leaving the site.

Wrap-around uses paired CSS transitions and JS timers:

- `WRAP_OUT=300`
- `WRAP_HOLD=60`
- `WRAP_IN=460` is intentionally unused but must remain because `app/globals.css` references it.

The detail side panel re-mounts per active index with `initial { opacity:0, y:8 }` to `animate { opacity:1, y:0 }`. `LiquidBackground` mounts only while detail is open.

### Gallery wall

`GalleryWall` renders `VISIBLE=6` flex columns over a longer panel list. Constants:

- `DWELL=5000`
- `SWAP=1150`
- `STAGGER=90`

Opening/hover is pointer-type aware: real mouse hover opens a stripe; touch uses click. Only the active slot plays video; videos use `preload="none"`, `muted`, `loop`, `playsInline`. The outgoing wall layer uses the poster image rather than video to avoid holding decoders alive during swap.

Reduced motion clears overlays and disables the idle timer. Under reduced motion, clicking a paused/closed stripe means “play now” rather than “close,” so content remains reachable.

### Dial navigation

`DialNav` draws a 520×520 SVG fan with six destinations: `/`, `/rooms`, `/cuisine`, `/amenities`, `/gallery`, `/contact`.

Key constants:

- `C=260`
- `R_ARC=128`
- `R_LABEL=150`
- `SWEEP_FROM=180`
- `SLOT=18.5`
- `GAP=3.5`

Opening is hover/focus/keyboard driven; the puck opens but does not toggle because hover may already have opened it. Tapping the empty dial floor closes.

View transitions are progressive:

- Only plain left click with no modifier keys.
- Requires `document.startViewTransition`.
- Disabled under `useReducedMotion()`.
- Otherwise falls back to a normal `Link` navigation.

Scroll-to-close sets `data-dial-instant` for 50ms to snap transitions and avoid dropped frames. `data-dial-open` is set on `documentElement`, allowing global CSS to react.

### Glass and liquid backgrounds

#### `LiquidBackground`

WebGL fragment shader with three domain-warping passes, height-field edge/gloss, and a `time` uniform. It is mounted only while the room detail panel is open and only when reduced motion is not active. The canvas is sized at `clientWidth/clientHeight * min(devicePixelRatio, 1.5)` and observed by `ResizeObserver`.

Performance details:

- Pauses while the tab is hidden and resumes with an accumulated time offset.
- Does not call `loseContext` in cleanup because a force-lost context cannot be recycled on the same DOM node and breaks React StrictMode double-mounts.
- If WebGL context creation fails, CSS radial gradients remain as the visual fallback.
- Color palette is neutralised to charcoal tones with a desaturated sage whisper and brass ridge glint.

#### `RainGlass`

A 2D canvas effect drawn only when `/api/live` reports `rainGlass` and the current sky is `rain` or `storm`. Clear/cloudy/snow days clear the canvas and return. It runs a single `requestAnimationFrame` loop, with droplet population capped at roughly `round(min(180, max(40, width*height/9000)))`.

Pre-reduced-motion behaviour:

- The rAF loop is disabled and leaves a static frame.
- Storm lightning runs only when sky is `storm` and reduced motion is off.
- Lightning is scheduled every 20–60s for a 700ms two-peak flash.

Performance note: droplet merging is O(n²), described as acceptable only while the drop count stays near ~110; the hard seed cap is 180.

### Menu book

`MenuBook` receives flattened menu items (`MenuItem[]`) from four D1 sections. It renders:

- A cover with `/media/menu/hotel-sketch.png`.
- A spine with a brand/cover button and hand-picked tabs.
- A page showing either the cover or grouped category content.

Tabs are curated groups of printed-menu tags rather than a one-to-one mapping. The active tab is `null` for the cover. Groups are in-memory grouped by `tag`.

`Size`/price behaviour is shape-critical:

- Single-price items use `extra.price`/`price`.
- Multi-size drinks use `extra.sizes`, read by `Size`.
- The smallest `price` remains as a fallback for older readers.
- Migration `0022` folded the original per-volume bar rows into multi-size drinks with `sizes`.

### Contact panel

`ContactPanel` receives the derived `ContactInfo` object from the contact page and builds channels ordered by usefulness:

1. WhatsApp when `waHref` exists.
2. Phone.
3. Email.
4. Booking.com.
5. Direct “Request a room” link to `/book`.
6. Google Maps.

It renders the live Kathmandu clock/temp/AQI line, plus a desk-status sentence by daypart. It includes a message form to `/api/contact`, a honeypot `con-trap`, a four-state submit pattern, copyable plus code, and an embedded Google Map.

### Booking form

`BookingForm` posts JSON to `/api/booking`. It is the no-payment direct request form.

Key details:

- Honeypot input `con-trap` named `note_ref`, `tabIndex=-1`, `autocomplete="off"`, `aria-hidden`.
- Dates use `Intl.DateTimeFormat('en-CA', { timeZone: TZ })`.
- `check_in` min is today in Kathmandu time.
- `check_out` min is the day after the selected check-in, or today when check-in is empty.
- `?room=<slug>` maps through `room.slug`, while the `<select>` values use room names.
- Success message includes the hotel phone number.
- Booking.com link is a quiet secondary option.

### Media upload

`MediaUpload` queues camera files, asks for a human-readable label per file, then uploads sequentially. Constants:

- `MAX_EDGE = 1600`
- `THUMB_EDGE = 400`
- `QUALITY = 0.82`

Pipeline per file:

1. Decode with `createImageBitmap(file, { imageOrientation: 'from-image' })`.
2. Render full image and 400px thumbnail to canvas.
3. Encode both as `image/webp`.
4. `POST` full image, thumb, human `name`, original `filename`, `width`, and `height` to `/admin/photos/upload`.
5. Update remaining quota from `left`.
6. `router.refresh()` after the batch so the server-rendered bank updates.

Uploads are serialized deliberately because the server reads/writes the daily counter per request, and parallel uploads would race it. Client-side resizing is a courtesy for the connection, not a security boundary.

### Photo picker

`PhotoPicker` writes a selected bank path to a hidden input with the supplied `name`, so existing `formData.get(name)` flows remain unchanged. It uses a native `<dialog>` for Escape/backdrop/focus containment. Its contents are built lazily on first open to avoid eagerly rendering ~2000 `<img>` tags across 68 amenity rows.

### Price rows

`PriceRows` supports two modes:

- Single price: one required `size_price` input.
- Multi-size: repeated `size_label` and `size_price` rows with remove/add.

Repeated field names are assembled server-side by `composeMenuExtra()`. A size-label `<datalist id="adm-size-names">` avoids duplicate HTML ids.

### Schema markup

`HotelSchema` emits `Schema.org/Hotel` JSON-LD from `settings()` already available as props. It reads `config.phone`, `lat`, `lng`, address fields, `email`, `maps_url`, and `booking_url`. It deliberately omits `aggregateRating`, `priceRange`, and `starRating`. It escapes `<` to `\u003c` in the JSON-LD.

### Footer

`SiteFooter`:

- Returns `null` on `/admin`.
- Reads `/api/live` via `useLive()` for `socials`, `address`, `phone`, and `email`.
- Uses `LogoMark` with `green '#9fbcac'` and `olive '#c9985a'`.
- Renders the hardcoded line `Sinamangal, Kathmandu — five minutes from the airport.` and `DESCRIPTION` from `@/lib/site`.
- Uses `IntersectionObserver` at threshold `0.01` to toggle `document.documentElement.dataset.footerVisible`, preventing fixed dial/dock UI from drawing over footer text.

### Social marks and glyphs

All glyphs are inline SVG and avoid an icon package. The convention is `currentColor`, 24×24 viewBox, stroke width `1.6`, round caps/joins unless specified. `MARKS` in `SocialMarks.tsx` maps exact settings labels to components:

`Instagram`, `Facebook`, `WhatsApp`, `TikTok`, `YouTube`, `X`, `LinkedIn`, `TripAdvisor`, `Booking.com`, `Google Business`.

Unknown labels fall back to plain text rather than a blank button. `WhatsAppMark` uses `fill="currentColor"`; the rest of the marks use stroke.

## Motion and dynamic UI

| Effect | Where | Technique | Trigger | Performance / reduced-motion behaviour |
|---|---|---|---|---|
| Hero slide rotation and cross-fade | `components/HeroCarousel.tsx` | CSS data-state/`in`/`out`/`idle` plus inline `--dir` custom property | Auto every `2100ms`; arrows; ticks; keyboard arrows; touch swipe with `DRAG` threshold | Pauses on hover and while door is open; no component-level reduced-motion special case described in notes |
| Hero door open/close | `components/HeroCarousel.tsx` | URL `?inside`, two layers gated by data attributes, native history | “Explore” gate, Escape, browser Back | Avoids router refetch of force-dynamic `/`; native history gives cheap Back behaviour |
| Ambient hero video | `components/HeroCarousel.tsx` | Silent `<video autoplay muted loop playsinline preload="auto">`; `/media/ambient.mp4` | Page load on `/` | Regenerate via `scripts/encode-ambient.sh`; encoded 8-bit 4:2:0, audio stripped, faststart |
| Gallery accordion wall | `components/GalleryWall.tsx` | CSS flex columns, inline animation duration/delay, `data-dir` | Pointer hover/focus/click, arrows, keyboard, idle timer `5000ms`, Escape | Reduced motion clears overlays and disables idle timer |
| Active gallery video play/pause | `components/GalleryWall.tsx` | `refs.play/pause` orchestration; only active slot plays | Opening stripe/window shift/pause button | Videos use `preload="none"`; `play()` rejections swallowed |
| Liquid WebGL ground | `components/LiquidBackground.tsx` | Fragment shader, domain warping, `time` uniform, parent `data-liquid` fade-in | Mounted while room detail is open | Pauses on hidden tab; not mounted under reduced motion; DPR capped at 1.5; no `loseContext` |
| Rain on glass | `components/RainGlass.tsx` | 2D canvas + rAF; droplet gradients, trails, merges, occasional lightning | `live.rainGlass && sky === 'rain' || sky === 'storm'` | Reduced motion draws a static frame; merge is O(n²); droplet range 40–180; storm lightning disabled under reduced motion |
| Services ring rotation | `components/ServicesCarousel.tsx` | framer-motion `rotateY`, spring `{ stiffness:55, damping:16 }` | Arrows, horizontal drag, Arrow keys, autoplay `2100ms` | Reduced motion sets duration 0; autoplay disabled under reduced/mobile; turn unbounded to avoid long unwinding |
| Services fly-in entrance | `components/ServicesCarousel.tsx` | framer-motion `Variants` with deterministic noise, `flyIn`/`landed` | `open` flips from `false` to `true` | No opacity or `y` animation; preserves `backface-visibility` and avoids scrollbars |
| Services pointer tilt/sway | `components/ServicesCarousel.tsx` | Two `useSpring`s: `rotateX` tilt and `rotateY` sway | Pointer move/leave | Disabled under reduced motion |
| Rooms fan rotation | `components/RoomsCarousel.tsx` | framer-motion `rotateX` spring, bounded turn | Arrows, drag, ArrowUp/Down, URL `?room=` | Reduced motion/snap uses duration 0; bounded arc, not a closed ring |
| Rooms pointer sway | `components/RoomsCarousel.tsx` | `useMotionValue` + `useSpring`; `rotateY` aware of pointer position | Pointer move/leave over stage | Disabled under reduced motion or when detail is open |
| Rooms wrap-around dip/fade | `components/RoomsCarousel.tsx` | Three-phase timer: `WRAP_OUT=300`, `WRAP_HOLD=60`, then recovery | Attempting to step before first / after last room | Reduced motion directly snaps with no wrap |
| Room detail enter | `components/RoomsCarousel.tsx` | Motion div keyed by active index, `opacity`/`y` | Each turn re-mounts the panel | Reduced motion sets duration 0; panel uses `aria-live="polite"` |
| Room page fade-in | `/rooms` route | CSS animation from opacity 0 on `.room-page` | Client render after Suspense | `.room-ground` is server-rendered to avoid background flash |
| Dial open/close and view-transition nav | `components/DialNav.tsx` | CSS transitions; `document.startViewTransition` | Hover/focus/keyboard, plain left click, scroll close | `useReducedMotion()` disables view transitions; `data-dial-instant` snaps for 50ms after scroll-close |
| Footer visibility of fixed UI | `components/SiteFooter.tsx` | `IntersectionObserver` toggling `html[data-footer-visible]` | Footer entering/leaving viewport | Observer disconnected on cleanup; cheap attribute toggle avoids fixed dial/dock overlapping footer |
| Live daypart/sky palette shift | `components/Live.tsx` | No JS animation; sets `data-daypart`/`data-sky` on `<html>` | Successful `/api/live` fetch; effect only | CSS changes; attributes deleted on cleanup and when `skyKey` missing |
| Admin control press/transition | Admin UI in `app/globals.css` | CSS transitions `120ms`/`90ms`; `:active translateY(1px)` | Pointer active/pending on admin controls | Reduced motion shortens to `0.01ms` and removes press; brightness `0.9` dimming was not found in the source |

## Images

`components/Img.tsx` is the single frontend image routing point:

- **`/img/*` paths** are R2-backed uploads and render as a plain `<img>`.
  - `loading="eager"` when `priority`, otherwise `lazy`.
  - `decoding="async"`.
  - `sizes` passes through.
  - For `fill`, it re-implements `objectFit`, `position`, `inset`, `width`, and `height` so existing `globals.css` rules written for `next/image` continue to work.
  - R2-backed images are served as-is; `next/image` cannot fetch R2 because `/_next/image` reaches the `ASSETS` binding, not R2.
  - The uploader pre-resizes to 1600px max, so “as-is” does not mean original multi-megabyte camera files.
- **All other paths** — seeded `public/media` images, menu art, etc. — go through `next/image`.
  - Quality is explicitly set to `90` instead of `next/image` default `75`; `75` looked soft next to the uncompressed gallery imagery.
  - Example measured result: 635 KB → 40 KB at 640w.

Known frontend `sizes` attributes:

| Component | `sizes` |
|---|---|
| Hero slides | `(max-width: 900px) 70vw, 45vw` |
| Amenity experience photos | `(max-width: 900px) 45vw, 16vw` |
| Room cards | `(max-width: 900px) 88vw, 46vw` |
| Service cards | `(max-width: 820px) 90vw, 740px` |
| Menu book cover | `(max-width: 900px) 85vw, 460px` |

Video behaviour:

- Gallery clips are silent 9.9s ping-pong loops with no controls, `muted`, `loop`, `playsInline`, and `preload="none"`.
- Only the active gallery slot plays. Video posters are stored on rows; slugs are not used to derive media paths so admin slug renames do not orphan media.
- `#t=0.5` is used for video thumbnails without a poster because frame 0 can fade from black.
- Hero ambient video is `preload="auto"`.

The media pipeline is split between frontend rendering and operations:

- Upload/compression pipeline: [docs/operations.md](operations.md) and component notes in `MediaUpload.tsx`.
- R2/ASSETS/Cloudflare serving details: [docs/cloudflare.md](cloudflare.md).
- Generated gallery clips and ambient video scripts: `scripts/export-gallery-clips.mjs`, `scripts/encode-ambient.sh`.

## Design rationale (verified)

The following reasoning was cross-checked against the shipped source. Only `SHIPPED` and `PARTIAL` claims are presented here; `PARTIAL` means the source landed part of the decision but not all of it.

### Palette, surfaces and contrast

- **SHIPPED** — `--green` keeps `#344e41` as the brand source value in `app/globals.css`. The old ink green is the reference brand colour, and the dark ground derives from it.
- **SHIPPED** — the white-glow aesthetic is gone: no references to `--nu-light` or `rgba(255,255,255,0.95)` remain. The white glow was the most disliked visual element.
- **SHIPPED** — `--sage` and `--brass` tokens exist alongside `--green`. Sage provides text-level accents on dark ground; brass carries warmth and Nepali material memory.
- **SHIPPED** — the landing ground is dark with `--bg: #0d1210` and warm cream ink. The dark state is a cinematic inversion, not a blue-black.
- **SHIPPED** — foreground text is retuned to clear 4.5:1 against `#0d1210`; the old dark-green-on-near-black text was unreadable.
- **SHIPPED** — `--green` was reworked into a dark-ground-safe value, so one token can serve text/button/border roles instead of requiring many manual fixes.
- **SHIPPED** — the surviving white glow shadows were removed, including:
  - `inset -7px -7px 18px rgba(255, 255, 255, 0.14)`
  - `-4px -4px 10px var(--nu-light)`
  - `inset -3px -3px 7px var(--nu-light)`
  - the warm-paper card shadow containing `inset 1px 1px 0 rgba(255, 253, 247, 0.75)`
- **SHIPPED** — `.hero-frame` no longer has a bright white full-perimeter halo; it uses dark-ground elevation instead.
- **SHIPPED** — `.live` and `.live-note` were rebuilt as dark translucent surfaces with a hairline rim and cream text; the duplicate end-of-file rules were merged into the earlier definitions.
- **SHIPPED** — old rgba ink colour literals were replaced with palette tokens for `room-blurb`, `room-know`, `con-address`, `con-sent`, `room-group p`, `con-blurb`, and `room-shared`.
- **SHIPPED** — dark translucent photo scrims stayed dark rather than being inverted to light. The old `rgba(43,50,48,0.4)` scrim literal is gone.
- **SHIPPED** — remaining `rgba(52,78,65,...)` literals are confined to shadow/scrim contexts; text and borders use dark-ground values.
- **SHIPPED** — the `/rooms` and `/contact` passes target zero contrast failures: body text clears 4.5:1 and large text clears 3:1.
- **SHIPPED** — `@property` initial values for `--bg`, `--surface`, and `--card` are aligned with the updated `:root` values, preventing daypart transitions from interpolating stale light values.
- **SHIPPED** — `--alert` was retuned to remain an error colour against the new dark ground.

### Hero and live readout

- **SHIPPED** — `.hero-copy` is sized with `width: min(100%, calc(84vh + 118px))`.
- **SHIPPED** — hero-copy children that derive dimensions from `vh` use card-scoped `100%`/`min(100%, ...)` patterns.
- **SHIPPED** — hero clipping was fixed structurally, not by shrinking fonts, adding `text-overflow: ellipsis`, or setting `overflow: visible`.
- **SHIPPED** — `.hero-frame` and `.hero-copy` remain the same matched footprint, mirrored across the centre channel.
- **SHIPPED** — `.hero-copy` uses `grid-template-columns: minmax(0, 1fr)` so its single implicit column can shrink below child min-content width.
- **SHIPPED** — `.live` no longer uses `white-space: nowrap`; the readout can wrap. `.live-time` keeps `font-variant-numeric: tabular-nums` so minute flips do not shift the row.
- **SHIPPED** — `.live-fact::before` separators were kept from appearing orphaned at the start of wrapped lines; the redundant mobile-only flex-wrap override was removed and the stale no-wrap comment updated.
- **SHIPPED** — ambient video brightness uses the clamped form `brightness(max(0.5, calc(...)))`, so daypart and weather dimming cannot crush the video to invisible.
- **SHIPPED** — ambient video blur was raised above the old fixed `2.5px` so it reads as cinematic depth of field rather than noise.
- **SHIPPED** — ambient-brightness dayparts were rebalanced so night remains cinematic rather than the dimmest state.
- **PARTIAL** — the old documented `.ambient-video` filter string `blur(2.5px) brightness(calc(var(--ambient-bright) * var(--sky-dim, 1))) saturate(calc(1.08 * var(--sky-sat, 1)))` no longer appears verbatim, but the video rule and the sky/daypart variables remain.
- **SHIPPED** — `:root[data-dial-open]` and `data-dial-open` remain wired so the dial is legible on the dark ground in both states rather than inverting its palette.

### Booking form

- **SHIPPED** — booking fields are darker wells with high-contrast cream text, not the old `rgba(255,255,255,0.5)` grey blocks.
- **SHIPPED** — select and date controls use `appearance: none`; the select chevron is drawn instead of the OS arrow.
- **PARTIAL** — the date calendar-picker-indicator selector is present, but the exact `filter: invert(1)` declaration that would tint the native glyph cream was not found.
- **SHIPPED** — `.bk-send` uses the brass/sage design-token grounding rather than the previous low-contrast dark-green treatment.
- **SHIPPED** — `.bk-ota` is a quiet secondary link style under the primary CTA.
- **SHIPPED** — field widths are grouped into paired date, room/guests, and name/email rows rather than arbitrary half/full widths.
- **SHIPPED** — the lede “We reply by email to confirm. Nothing is charged here.” is present in the booking copy.
- **SHIPPED** — placeholder styling is customised so placeholders, labels, and helper text clear 4.5:1 against fields.
- **SHIPPED** — `:focus-visible` and outline rules remain; focus rings are not removed on dark fields.

### Carousels, galleries and rooms

- **SHIPPED** — `LiquidBackground` clears to the dark ground colour equivalent to `#0b100e`, not the old cream `#E4E2DC`.
- **SHIPPED** — the shader palette is neutralised to charcoal tones with the desaturated sage whisper `vec3(0.431, 0.506, 0.478)`; the olive-drab wash is gone.
- **SHIPPED** — `.room-view::before` uses `filter: blur(56px) saturate(0.22) brightness(0.8)` and `opacity: 0.055`, keeping the room photo as a subtle depth cue.
- **SHIPPED** — `.gal-tint` uses deep green `#12231a` at opacity `0.5`; non-open gallery columns over an open gallery use opacity `0.7`.
- **SHIPPED** — dial tokens were quieted to `--dial-active: #6f9480`, `--dial-label-on: #e8e5da`, and lower idle/track opacities.
- **SHIPPED** — dial open shadow depth is reduced to `--dial-shadow-a: 0.3`.
- **SHIPPED** — the dial well’s hard disc/ring was replaced by a borderless radial gradient that fades to transparent.
- **SHIPPED** — `DialNav` uses thinner strokes: `strokeWidth={open ? 14 : 9}` and `strokeWidth={open ? 22 : 14}`.
- **SHIPPED** — rooms background radial gradients were rebuilt from khaki/cream blobs to subtle sage, brass, and charcoal tints.
- **SHIPPED** — carousel tick background is `rgba(232,229,218,0.22)`.
- **SHIPPED** — disabled send button background is `rgba(169,173,161,0.3)`.
- **PARTIAL** — `.hero-cta` has ink text and `:hover` brass with the `rgba(201, 152, 90, 0.45)` shadow ring, but the exact dark-well background `rgba(19, 26, 22, 0.8)` was not found.
- **SHIPPED** — `.room-book` uses brass text and the brass-tinted border `rgba(201, 152, 90, 0.35)`.
- **PARTIAL** — the two-track `.am-card[data-shot]` layout is gone and `overflow:hidden` is present; the exact `padding:0` rule on that selector is no longer present.
- **PARTIAL** — `aspect-ratio: 4 / 3` exists in CSS, but no `.am-shot` selector was found to confirm it applies to that image.
- **SHIPPED** — the mobile rule that re-expanded `.am-card[data-shot]` to `grid-column: 1 / -1` is removed.
- **SHIPPED** — LiquidBackground’s brass gloss uses `pow(smoothstep(0.78, 0.99, pattern), 4.0) * 0.11`.
- **SHIPPED** — the floating back button is hidden when a room detail page is open via `body:has(.room-page[data-open]) .dock-back`.
- **SHIPPED** — `.gal-head` has `padding-left: 46px` so the gallery heading clears the corner dock button.
- **PARTIAL** — `.am-head`/`.bf-head` shared block uses `max-width: 640px` instead of `22ch`, and `.am-head` keeps its `760px` override. `align-items: start` is present, but the exact amenity grid template was not found.

### Admin visual language and dashboard

- **SHIPPED** — the admin panel stays inside a deliberate black/white/grey “tool” island without shadows or site theme tokens.
- **SHIPPED** — admin controls use the dual transition: `120ms ease` for background/border/colour and `90ms ease` for transform/filter.
- **SHIPPED** — admin reduced-motion override shortens transitions to `0.01ms` and removes the `translateY(1px)` press.
- **PARTIAL** — `translateY(1px)` and `:active` are present, but the exact `filter: brightness(0.9)` value was not found.
- **SHIPPED** — `.adm-page` width is roughly 1100px and admin card/field/tile density was tightened.
- **SHIPPED** — `AdminNav` is mounted from `app/admin/layout.tsx`, gates Accounts by role, and handles active-section state.
- **SHIPPED** — the dashboard tiles use count-first hierarchy with the number as the loudest element, label beneath, and quiet description below.
- **SHIPPED** — dashboard 30-day sparkline and Delta values are slope-aware, with green/red direction colouring.
- **SHIPPED** — contact/settings, pages/rooms/photos, booking requests, and enquiries tiles are count-driven; count failures are caught so the tile renders without its number.
- **SHIPPED** — content editor section labels use a `TITLES` map so staff see human names instead of raw section keys.
- **SHIPPED** — advanced content fields are wrapped in a collapsed `<details>` labelled `Advanced`.
- **SHIPPED** — room `extra` is edited as structured guests/meta/specs fields and rebuilt server-side.
- **PARTIAL** — structured row editing for socials and arrival landed in `SettingsForm`; `rooms_good_to_know` appears in schema/checks/public-room code but is not edited in the settings form.
- **PARTIAL** — plain-language labels landed for many admin columns, but the expected “Photo path” label is absent.

### Considered and not built

These were explicitly proposed in design briefs but are **not shipped**:

- A dark-ground elevation hairline rim in `rgba(255,255,255,0.06-0.10)`.
- `--olive: #a9ada1` as a neutral grey-green token.
- Exact night palette `--bg:#0b100e`, `--surface:#121916`, `--ink:#e8e5da`, and `--card:#171f1b`.
- RainGlass droplet-body, lens-shadow, wet-light-catch, wet-trail, and falling-streak alpha tuning values from the later brief.
- `.hero-cta` dark-well exact background `rgba(19, 26, 22, 0.8)`.
- A plain `Price (Rs.)` numeric input replacing menu JSON extras.
- Content-editor search/sort/pagination pushed into SQL with `LIKE`, `ORDER BY`, and `LIMIT-OFFSET`.
- Extracting admin CSS out of `app/globals.css` into a separate imported stylesheet.
- `/terms` page and footer Terms link.
- A `website-benchmark-report.md` with weighted competitor scoring.

## Known issues / gotchas

| Area | Gotcha / caveat |
|---|---|
| Public rendering | Every D1 page must keep its own `force-dynamic` literal; the prerender pass has no `env.DB`. |
| Public error boundary | `app/error.tsx` deliberately reads no D1. `error.digest` only exists for server-rendered errors, not client RSC fetch failures. `/admin` detection is pathname-based. |
| Room/user state | Direct `/rooms` navigation does not re-apply the remembered `ti_room`; only a `?room=` query change does. |
| Rooms carousel | The fan is bounded and `STEP=58` is tuned for three rooms; it cannot be reused for arbitrary `n` without redesign. |
| Rooms wrap | `WRAP_IN=460` is intentionally unused but must stay because `app/globals.css` comments reference it. |
| Rooms privacy | `localStorage` is wrapped in `try/catch` for private-mode browsers. |
| Rooms availability copy | Room counts are room-type counts, not live availability. No live rates appear anywhere in the carousel. |
| Rooms tour | `.room-tour` is a placeholder reading “3D tour · coming soon” and is intentionally empty until a real tour exists. |
| Services carousel | Returns `null` when cards are empty to avoid a `NaN` rotation. Turn is unbounded and can grow indefinitely while open. |
| Services entrance | Fly-in variants omit opacity and `y` because they would break `backface-visibility` or create scrollbars. |
| Hero door | Uses native history instead of router navigation because `/` is force-dynamic. The autoplay/keydown effects intentionally have no dependency arrays and re-create each render. |
| Hero media | `/media/ambient.mp4` is hardcoded; it must be regenerated with `scripts/encode-ambient.sh`. Slides without `src` show a numbered tinted placeholder. |
| Gallery copy | “Twelve stops” is hardcoded in `GalleryWall` and will be wrong if the panel list changes. |
| Gallery length | With `panels.length <= 6`, rotation is disabled: no arrows, timer, or keyboard stepping. |
| Gallery keys | Panel slugs can collide between media and copy subtrees; the `media-`/`copy-` key namespaces prevent this. |
| Gallery media | Video `play()` rejections are intentionally swallowed. Reduced motion turns the idle timer off. |
| Dial | SVG arcs themselves are not focusable; keyboard access relies on hidden links. The clickable open band is roughly viewBox radial distance `106..168`. |
| Dial filter | The SVG shadow filter must use `userSpaceOnUse`, or the `GALLERY` 3.9-unit arc clips its 14-unit stroke. |
| Dial scroll | Scroll-to-close sets `data-dial-instant` for 50ms to snap transitions. |
| FloatDock | Back uses `document.referrer`; direct or external visitors fall back to `/` rather than browser back. Book is hidden on `/book`, dock is hidden on `/admin`. |
| Footer | `SiteFooter` returns `null` on `/admin`; hooks still run first for hook-order stability. |
| Live | `useLive()` remains `null` forever if `/api/live` fails. Fetch/HTTP errors are swallowed and last-known data remains. |
| Live attributes | `data-daypart`/`data-sky` are applied in effects and deleted on cleanup; `data-sky` is removed when `skyKey` is missing. |
| Live copy | Daypart `NOTE` strings are hardcoded in `Live.tsx` and should move to settings only when an editor exists. |
| Booking form | `?room=` is a slug, but the `<select>` values are room titles; it matches via `room.slug` and defaults to `rooms[0].name`. |
| Booking dates | `check_out` min becomes the day after the selected check-in; if no check-in, it uses today in Kathmandu time. |
| Forms | Both booking and contact use the duplicated `con-trap` honeypot. Four-state submits cast JSON as `{ ok?: boolean; error?: string }`. |
| Contact | Copy-plus-code silently does nothing when `navigator.clipboard` is unavailable. |
| Image routing | `Img` treats `/img/` as R2 as-is; quality cannot be changed there. `next/image` cannot fetch R2. |
| Image quality | `quality=90` is fixed in `Img`; `next/image` default `75` looked soft. |
| Liquid background | Does not call `loseContext` because that breaks React StrictMode double-mounts. Initial canvas may appear transparent before the first frame sets `data-liquid`. |
| RainGlass | Merge logic is O(n²); the hard seed cap is 180. A comment mentions clear-sky condensation, but the code path clears/returns on any non-rain/non-storm sky. |
| MediaUpload | Queue is keyed by original file name, so two different files with the same name in one batch collide. Uploads are sequential to avoid racing the daily counter. |
| PhotoPicker | The thumbnail grid is built lazily on first open; an unopened picker has no grid in the DOM. |
| PriceRows | Repeated `size_price`/`size_label` names require `composeMenuExtra()` server-side assembly. Single-price mode uses `rows[0].price`; an empty `defaultValue` would render an empty required input. |
| Admin auth | `AdminNav`’s managers flag is not the authorization boundary; pages still guard themselves. |
| AdminNotice | Auto-dismisses after 6s for errors and 4s for success; no persisted dismissed state. |
| BankBoard | Repo-shipped media cannot be renamed or deleted. Deletion is blocked when media is used by rows, and `canDelete` is false outside the developer/owner-24h permission. |
| ViewBeacon | No retry, no visible failure, and no cookie. The `sent` ref never resets, so returning to the same pathname is not double-counted. |

For the CSS token architecture, palette definitions, typography tokens, breakpoints, and accessibility rules, see the appended section **“The design system (`app/globals.css`)”** later in this file.

## The design system (`app/globals.css`)

### Architecture

`app/globals.css` is the single global stylesheet for the whole Hotel Thakali Inn
application: public marketing/booking pages, the dial navigation, public page
systems, and the entire staff admin UI all live in this one file. It is imported
globally in the Next.js/Cloudflare Workers app, not loaded as CSS modules.

The stylesheet is organised as a sequence of comment-banner sections with
box-drawing separators. The documented order is roughly:

1. brand/effect tokens and registered custom properties
2. Kathmandu daypart palette rules
3. dial and notch geometry
4. home hero, gate/beyond overlay, hero carousel
5. services and rooms 3D carousels
6. dock, footer, room detail, gallery, contact
7. public booking, breakfast, cuisine, amenities
8. generic admin skin, console/settings skin, admin pages
9. analytics, system check, photo bank

State is passed into CSS through attribute hooks such as `[data-open]`,
`[data-state]`, `[data-dir]`, `[data-dial-open]`, `[data-dial-instant]`,
`[data-footer-visible]`, `[data-liquid]`, `[data-daypart]`, `[data-sky]`,
`[data-serving]`, `[data-past]`, `[data-tone]`, `[data-trend]`, `[data-on]`,
`[aria-current]`, `[aria-pressed]`, and `[aria-selected]`.

Class naming is route/component-prefixed: `.hero-*`, `.room-*`, `.gal-*`,
`.con-*`, `.dock-*`, `.site-footer-*`, `.bf-*`, `.bk-*`, `.book-*`, `.am-*`,
`.stop-*`, `.legal`, `.adm-*`, `.adm-con-*`, `.adm-an-*`, `.adm-chk-*`, and
`.adm-bank-*`.

The notes identify the file in extracted chunks at offsets `#0`, `#52000`,
`#104000`, `#156000`, and `#208000`. Several chunks begin or end mid-rule, so
the extracted boundaries are not complete stylesheet sections.

---

### Custom properties

#### Colour and brass/material tokens

| Token | Value | What it controls |
|---|---|---|
| `--green` | `#344e41` | Brand green for headings, accents, chevrons, serif headings, active tick, live/timeline accents; daypart-aware in later notes |
| `--green-ink` | `#1c2a22` | Dark green ink variant; stable text-on-brass colour |
| `--olive` | `#b8b7a8` | Workhorse muted text: paragraphs, blurbs, eyebrows, live chip text |
| `--olive-tertiary` | `#8d9184` | Tertiary olive text |
| `--sage` | `#a8b8a5` | Lit sage accent; default focus-visible outline colour |
| `--brass` | `#a59663` | Warm metal/action accent used for CTAs, Book links, icons, route dashes |
| `--alert` | `#d9715a` | Fired-clay error colour for failed forms/errors on dark ground |
| `--bg` | `#182015` / registered initial `#0d1210` | Dark cinematic green-tinted page ground |
| `--surface` | `#202c24` / registered initial `#131a16` | Raised panel/button material |
| `--card` | `#1b2921` / registered initial `#17201b` | Floating hero photo/copy card material; warmer than `--surface` |
| `--ink` | `#e8e6d9` | Main light ink |
| `--border` | `#41483f` | Standard hairline border |

Recurring brass/material literals are intentionally mixed with tokens:

| Literal | Where/use |
|---|---|
| `rgba(201,152,90,*)` | Brass edges, halos, borders, route dashes, hover glows |
| `#d9ab6d` | Booking send hover brass |
| `#f2eee4` | Legacy cream used by gate/literal focus/cream gallery text |
| `#344e41` | Literal matte green used by the gate button |
| `#2a7a2a` | Admin green ok/on tone |
| `#b00020` | Admin clay red off/error/past tone |
| `#1c7a3e` | Console live/good green |
| `#8a6100` | Console warning amber |

#### Surfaces and glass

| Token/class | Value | Purpose |
|---|---|---|
| `--glass-bg` | `rgba(19,26,22,0.8)` | Dark glass background for floating hero CTAs and the dock |
| `--glass-bg-hover` | `rgba(19,26,22,0.88)` | Hover state of `--glass-bg` |
| `--nu-dark` | `rgba(0,0,0,0.5)` | Deep dark shadow colour used inside elevation stacks |
| `--nu-raised` | `inset 0 1px 0 rgba(255,255,255,0.06), 0 12px 32px rgba(0,0,0,0.5)` | Raised neumorphic elevation: top hairline light + dark shadow |
| `--nu-pressed` | `inset 0 3px 12px rgba(0,0,0,0.55), inset 0 -1px 0 rgba(255,255,255,0.04)` | Pressed elevation for active arrows/buttons |
| `--dial-track` | `rgba(232,229,218,0.07)` → open `0.09` | Dial track fill; brighter against open well floor |
| `--dial-idle` | `rgba(232,229,218,0.24)` → open `0.32` | Idle dial segment alpha |
| `--dial-hover` | `rgba(232,229,218,0.46)` → open `0.6` | Hovered dial segment alpha |
| `--dial-active` | `#6f9480` | Active dial segment colour |
| `--dial-label` | `rgba(232,229,218,0.5)` → open `0.6` | Collapsed dial label colour |
| `--dial-label-on` | `#e8e5da` | Lit label colour when a dial segment is active |
| `--dial-shadow` | `#000000` | Dial drop shadow colour |
| `--dial-shadow-a` | `0.22` → open `0.3` | Dial shadow alpha |
| `--con-face` | `#f4f5f6` | Console raised face |
| `--con-sunk` | `#e6e8ea` | Console recessed fill/well |
| `--con-rule` | `#b8bcc0` | Console border/rule |
| `--con-edge` | `#8b9196` | Console stronger edge |
| `--con-ink` | `#16191c` | Console primary ink |
| `--con-dim` | `#5a6169` | Console dim/muted text |
| `--con-lit` | `#1c7a3e` | Console positive/busy accent |
| `--con-bad` | `#b00020` | Console failure accent |
| `--con-warn` | `#8a6100` | Console warning accent |

#### Kathmandu sky grading variables

Set on `:root[data-sky=...]`; `clear` intentionally has no block. When the
live weather route is unreachable, no attribute is stamped and the video plays
at full brightness with no wash.

| Sky | `--sky-dim` | `--sky-sat` | `--sky-wash` |
|---|---:|---:|---|
| cloudy | `.85` | `.85` | — |
| fog | `.98` | `.45` | `rgba(203,209,207,0.32)` |
| rain | `.62` | `.62` | `rgba(30,45,70,0.28)` |
| snow | `.9` | `.78` | `rgba(231,237,240,0.3)` |
| storm | `.4` | `.6` | `rgba(15,22,35,0.42)` |
| clear/default | absent | absent | absent |

#### Typography scale and font families

| Token/class | Value/fallback | Role |
|---|---|---|
| `--font-mono` | consumed as inherited variable, `monospace` fallback | Labels, eyebrows, dates, prices, numeric HUD, route/code text |
| `--font-serif` | consumed as inherited variable, `serif` fallback | Large editorial headings, menu book body names |
| `--con-mono` | `ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace` | Admin mono stack |

Recurring typographic roles:

| Role | Size/weight/tracking | Example selectors |
|---|---|---|
| Micro console label | 9–10px uppercase, wide tracking | `.con-form label > span`, `.adm-con field labels`, `.con-code`, `.con-socials a` |
| Mono eyebrow/HUD | 10–11px uppercase, `0.14em`–`0.34em` tracking | `.hero-eyebrow`, `.hero-count`, `.room-meta li`, `.am-paid`, `.con-eyebrow` |
| Small body | 12.5–14px | `.site-footer` text, `.con-form input`, `.adm-an-ip` |
| Standard body | 14–16px | `.con-form input`, `.con-address`, `.room-specs dd`, `.site-footer-col h2` |
| Large serif display | `clamp()` up to ~40–54px | `.con-side h1`, `.room-view-head h2`, `.stop-line`, `.am-group-head h2` |
| Admin KPI number | 30px 700 tabular-nums | `.adm-figure-n` |

#### Spacing and geometry tokens

| Token | Value | Purpose |
|---|---|---|
| `--inset` | `92px` | Dial inset from viewport corner; cards bottom-align to this line |
| `--notch-open` | `232px` | Open well radius; clears dial reach through CONTACT label tip |
| `--notch` | `1px`; registered, inherited, `<length>` | Live radius driving hero-copy mask hole and dial rim; 1px floor prevents degenerate mask gradient |
| `--pivot` | `calc(var(--inset) - var(--pad-x))` | Position of hero notch/dial pivot |
| `--gutter` | `62px` at `max-width:900px` | Reserves seam space for the stacked hero gate |
| `--pad` | `clamp(28px, 5vw, 56px)` | Cuisine book page padding |
| `--sheet` | `6px`; `3px` under 900px | Cuisine book page-edge thickness |
| `--card-h`, `--card-w` | context-dependent | Carousel card height/width geometry |
| `--ring-n` | `5` | Services ring facet count |
| `--ring-step` | `72deg` services; `58deg` rooms | Angular step per 3D facet |
| `--ring-spread` | `1` | Ring spread invariant; not to be changed lightly |
| `--ring-radius` | `calc(card-w/2/tan(180/5))` services; `calc(h/2/tan(step/2))` rooms | 3D ring/fan radius |
| `--travel` | `46px` | Hero slide travel distance |
| `--swap` | `1.05s` | Hero slide transition duration |
| `--dir` | `1` / `-1` | Hero slide direction |
| `--gal-pad` | `clamp(20px, 2.4vw, 44px)` | Gallery page edge padding |
| `--gal-dial` | `calc(var(--inset) + 150px)` | Right gutter reserved for gallery caption under dial |
| `--gal-slide` | `0.82s cubic-bezier(0.19,1,0.22,1)` | Gallery column grow/collapse timing |

#### Radii

| Radius | Example selectors |
|---|---|
| `0` / square corners | `.adm-con` fields, buttons, panels |
| `2px` | generic `.adm` inputs/buttons, `.adm-thumb`, `.adm-messages` |
| `4px` | `.adm-login` |
| `14px` | `.con-form input`, `.con-form textarea` |
| `18px` | `.con-channel` |
| `20px` | `.room-tour`, `.room-facts`, `.con-map`, `.con-write`, mobile `.hero-copy` |
| `30px` | `.svc-card` |
| `40px` / `24px` | cuisine book corners desktop/mobile |
| `999px` | pills: `.hero-cta`, `.gate-btn`, `.dock-book`, `.room-more`, `.room-back`, `.con-send`, `.bk-send`, `.am-cta`, `.stop-back` |
| `50%` circles | `.dock-back`, `.dock-wa`, `.dial-puck`, social buttons |

#### Shadows

| Token/literal | Value | Used by |
|---|---|---|
| `--nu-raised` | `inset 0 1px 0 rgba(255,255,255,0.06), 0 12px 32px rgba(0,0,0,0.5)` | Raised public cards, CTAs |
| `--nu-pressed` | `inset 0 3px 12px rgba(0,0,0,0.55), inset 0 -1px 0 rgba(255,255,255,0.04)` | Active pressed controls |
| `--nu-dark` | `rgba(0,0,0,0.5)` | Internal dark shadow colour |
| Glass card shadow | `0 8px 30px rgba(0,0,0,0.42), inset 0 1px 0 rgba(255,255,255,0.06)` | `.room-tour`, `.room-facts`, `.con-map`, `.con-write` |
| Dock shadow | `0 8px 24px rgba(0,0,0,0.35)` | Floating dock buttons |
| Booking send hover shadow | `0 12px 30px rgba(0,0,0,0.45), 0 0 0 1px rgba(201,152,90,0.14)` | `.dock-book:hover` |
| Room open leaf shadow | `0 30px 90px rgba(43,50,48,0.42)` | `.hero[data-open] .leaf-l/.leaf-r` |
| Dial puck shadow | `0 12px 24px rgba(17,24,20,0.22)` | `.dial-puck` |

#### Z-index scale

The stylesheet does not define z-index custom properties; layer numbers are
hard-coded per area.

| Layer | Z-index | Notes |
|---|---|---|
| `.ambient-video` | `0` | Fixed full-viewport video backdrop |
| `.ambient-video::before` | `1` | Sky wash above video scrim |
| `.ambient-fx`, `.rain-glass` | `2` | Weather/night/rain overlay layer |
| `.hero` | `1` | Sticky homepage hero |
| `.leaf::after` | `2` | Leaf face shading |
| `.gate` | `3` | Seam open button |
| `.beyond` | `0` | Fixed overlay after hero opens; sits under hero layer while closed |
| `.site-footer` | `5` | In-flow footer curtain over sticky hero |
| `.liquid-bg` | `-2` | WebGL room-detail background |
| `.room-view::before` | `-1` | Blurred room-photo wash behind room-detail glass |
| `.room-view` | `4` | Room detail overlay inside `.room-page` |
| Gallery layers | `2`–`5` | `.gal-hit` 2; `.gal-out`/`.gal-copy`/`.gal-page::after` 3; `.gal-head` 4; `.gal-nav`/`.gal-pause` 5 |
| `.dock-back`, `.dock` | `45` | Fixed top-left back and bottom-left dock |
| `.dial-layer` | `50` | Full-viewport fixed dial layer |
| `.adm-nav` | `10` | Sticky admin navigation bar |
| `.adm-notice` | `50` | Fixed admin save/error toast |
| `.adm-con-bar` | `5` | Sticky admin action bar |

#### Motion durations and easings

| Token / duration | Value | Used where |
|---|---|---|
| `--ease` | `cubic-bezier(0.34, 0.9, 0.28, 1)` | Standard springy settle |
| `--swing` | `cubic-bezier(0.62, 0.02, 0.2, 1)` | Heavy-start, long-settle opening/closing |
| `--gal-slide` | `0.82s cubic-bezier(0.19,1,0.22,1)` | Gallery flex-grow accordion |
| `--swap` | `1.05s` | Hero slide crossfade/translate |
| Hero leaf open/close | `1.9s var(--swing)` | Two-leaf page opening |
| Notch interpolation | `0.5s var(--ease)` | `--notch` transition on `<html>` |
| Daypart palette interpolation | `1.4s` | Registered colour properties on `<html>`; currently inert |
| Live-in | `0.6s var(--ease)` | `.live`, `.live-note` |
| Live pulse | `3.4s` usual, `1.6s` rain/storm | `.live-dot` |
| Room enter/rise | `720ms` / `760ms var(--ease)` | Rooms and other page entrances |
| Room stage wrap fade | `300ms var(--swing)` out / `460ms var(--ease)` in | `.room-stage` |
| Room grid expansion | `640ms var(--ease)` | `.room-page[data-open]` |
| Room liquid background | `26s var(--ease)` infinite alternate | `.room-view background` |
| Dial ring | `0.55s var(--ease)` | `.dial-ring` |
| Footer/dock fade | `0.25s ease` | `[data-footer-visible]` |
| View transition | `320ms var(--ease)` | Cross-document root snapshots |
| Cuisine leaf turn | `680ms var(--swing)` | `.book-cover`, `.book-category` |
| Weather fog | `26s linear infinite alternate` | `.ambient-fx::after` fog |
| Weather snow | `9s linear infinite` | `.ambient-fx::after` snow |
| Weather cloud | `22s linear infinite alternate` | `.ambient-fx::after` clouds |
| Night twinkle | `7s ease-in-out infinite alternate` | `.ambient-fx::before` at night |
| Admin notice-in | `200ms ease` | `.adm-notice` |
| Admin press feedback | `120ms` colour / `90ms` transform-filter | Generic admin controls |

---

### Utility and component classes

#### Public global/layout and hero

| Classes | Purpose |
|---|---|
| `.ambient-video`, `.ambient-video video`, `.ambient-video::after` | Fixed cinematic video backdrop with blur/saturation scrim |
| `.hero`, `.leaf`, `.leaf-l`, `.leaf-r`, `.leaf::before`, `.leaf::after` | Two-leaf page-opening hero; cut-edge thickness and face shading |
| `.hero[data-open]` | Opened hero state; hands off pointer events after leaf swing |
| `.hero-frame`, `.hero-copy`, `.hero-copy::after` | Partner photo/copy cards; copy mask hole and lit rim |
| `.hero-ph` | First-paint dark placeholder to prevent bright flash |
| `.hero-eyebrow`, `.live`, `.live-fact`, `.live-time`, `.live-note`, `.live-dot` | Brand/live Kathmandu readout |
| `.hero-deck`, `.hero-rail`, `.hero-arrow`, `.hero-tick`, `.hero-count` | Hero carousel text deck, arrows, progress ticks, counter |
| `.hero-cta`, `.gate`, `.gate-btn`, `.beyond` | Booking CTAs, seam open button, opened beyond overlay |
| `.hero-shot`, `.hero-text` and `[data-state=idle/out/in]` | Hero slide states for photo/text crossfade |

#### Dial navigation

| Classes | Purpose |
|---|---|
| `.dial-layer` | Full-viewport fixed mouse-inert layer; fades with footer |
| `.dial-anchor`, `.dial-anchor::before` | Zero-size bottom-right anchor and soft recessed well floor |
| `.dial-field` | Invisible hover bridge between puck and arcs |
| `.dial-svg`, `.dial-ring`, `.dial-arc` | SVG canvas, rotating ring, stroked arc hit targets |
| `.dial-seg` | Per-segment group; pointer target |
| `.dial-spoke` | Keyboard-focusable link layer; mouse-inert |
| `.dial-puck` | Centre open/close button |
| `:root[data-dial-open]`, `[data-dial-instant]` | Open state and scroll-triggered instant close state |

#### Services and rooms carousels

| Classes | Purpose |
|---|---|
| `.svc-carousel`, `.room-page` | Geometry roots for 3D carousels and rooms route |
| `.svc-stage`, `.room-stage` | Shared long-lens 3D stage; different touch-action |
| `.svc-dolly`, `.room-dolly`, `.svc-ring`, `.svc-face`, `.room-fan`, `.room-face` | Independent preserve-3d transform layers |
| `.svc-back`, `.svc-card`, `.svc-well`, `.svc-content` | Card chrome, photo well, content visibility |
| `.svc-card:not([data-active])`, `.room-card:not([data-active])` | Recede or hide non-front facets |
| `.svc-arrow`, `.room-arrow` | Chevron controls |
| `.room-carousel`, `.room-panel`, `.room-card`, `.room-detail`, `.room-meta`, `.room-shared`, `.room-count` | Rooms route column, panel, facts, shared amenities |
| `.room-page[data-open]`, `.room-view`, `.room-view-head`, `.room-view-body`, `.liquid-bg`, `.room-tour`, `.room-facts`, `.room-specs`, `.room-group`, `.room-know`, `.room-size`, `.room-more`, `.room-back` | Full-screen room detail expansion and glass panel content |

#### Dock, footer, gallery, contact

| Classes | Purpose |
|---|---|
| `.dock-back`, `.dock`, `.dock-wa`, `.dock-book` | Fixed top-left back button and bottom-left WhatsApp/Book dock |
| `[data-footer-visible]` | Fades dock/dial when footer scrolls into view |
| `.site-footer`, `.site-footer-grid`, `.site-footer-col`, `.site-footer-brand`, `.site-footer-line`, `.site-footer-socials`, `.site-footer-social-btn`, `.site-footer-bar` | Closing footer curtain, contact lines, socials, copyright bar |
| `.gal-page`, `.gal-stage`, `.gal-col`, `.gal-media`, `.gal-out`, `.gal-tint`, `.gal-veil`, `.gal-hit`, `.gal-label`, `.gal-copy`, `.gal-meta`, `.gal-title`, `.gal-blurb`, `.gal-head`, `.gal-hint`, `.gal-nav`, `.gal-pause`, `.gal-sr` | Six-column gallery accordion wall, captions, controls, live-region |
| `.con-page`, `.con-side`, `.con-main`, `.con-eyebrow`, `.con-address`, `.con-blurb` | Contact split layout and intro |
| `.con-channels`, `.con-channel`, `.con-channel-icon`, `.con-channel-text`, `.con-channel-label`, `.con-channel-value` | Two-up neumorphic phone/email/WhatsApp channel cards |
| `.con-socials`, `.con-arrival`, `.con-map`, `.con-write`, `.con-code`, `.con-directions` | Social strip, arrival spec-sheet, blurred map, form card, map actions |
| `.con-form`, `.con-form input`, `.con-form textarea`, `.con-trap`, `.con-send`, `.con-error`, `.con-sent` | Contact form fields, honeypot, send button, result messages |
| `.con-now-clock`, `.con-now-where`, `.con-now-desk`, `.con-channel--primary`, `.con-route`, `.con-route-dot`, `.con-route-leg-line` | Live Kathmandu clock, primary channel, hotel-to-airport route strip |

#### Public page systems

| Classes | Purpose |
|---|---|
| `.bk-*` | Booking-request card/form, brass send pill, OTA link, success/error states |
| `.bf-*` | Breakfast page, live serving pill `.bf-now[data-serving]`, alternate rows |
| `.book-*` | `/cuisine` leather book: `.book-cover`, `.book-category`, tabs, paper edges |
| `.am-*` | Amenities callout/checklist/group cards, experience rail, touches row, paid markers |
| `.stop-*` | Shared not-found/error dead-end pages, `.stop-back`, `.stop-back--quiet` |
| `.legal`, `.legal-foot` | Privacy/legal prose page |

#### Generic admin skin

| Classes | Purpose |
|---|---|
| `.adm`, `.adm-login`, `.adm-google-btn`, `.adm-page`, `.adm-nav` | Plain admin ground, login card, Google button, centred page, sticky nav |
| `.adm-tiles`, `.adm-tile`, `.adm-tabs`, `.adm-toolbar`, `.adm-search`, `.adm-sort`, `.adm-count`, `.adm-pager`, `.adm-audit-table` | Dashboard tiles, content tabs, search/sort/pagination, audit table |
| `.adm-messages`, `.adm-meta`, `.adm-from`, `.adm-body`, `.adm-signout`, `.adm-error`, `.adm-empty` | Enquiries/requests inbox, message content, signout, feedback states |

#### Console/settings skin

| Classes | Purpose |
|---|---|
| `.adm-con-grid`, `.adm-con-wide`, `.adm-con-pair`, `.adm-con-row` | Console-only field grids, phone pairs, repeatable rows |
| `.adm .adm-btn`, `.adm-btn--go`, `.adm-btn--sm`, `.adm-btn--x`, `.adm-btn--bad` | Console button base and destructuring variants |
| `.adm-con-lamp`, `.adm-con-err`, `.adm-con-hint`, `.adm-con-readout` | Validation lamps, errors, hints, live composition previews |
| `.adm-acct`, `.adm-matrix`, `.adm-con-choice`, `.adm-con-pick`, `.adm-con-pick-btn`, `.adm-con-pick-on` | Accounts cards, permission matrix, segmented choices, platform pool |
| `.adm-con-ticks`, `.adm-con-tick`, `.adm-con-chip`, `.adm-thumb--glyph` | Amenity tick grid, chips, glyph placeholder |
| `.adm-con-help`, `.adm-con-lock`, `.adm-con-warn`, `.adm-con-split`, `.adm-con-preview`, `.adm-con-marks`, `.adm-con-mark`, `.adm-con-map`, `.adm-con-summary`, `.adm-con-bar` | Settings inline help, locked email state, live preview pane, error summary, sticky save bar |

#### Row/photo/menu admin CSS

| Classes | Purpose |
|---|---|
| `.adm-row`, `.adm-summary`, `.adm-thumb`, `.adm-item`, `.adm-item-bar`, `.adm-item-danger`, `.adm-item-locked` | Native `<details>` row editor, thumbnail, save bar, staged delete |
| `.adm-pick-row`, `.adm-pick-shot`, `.adm-pick-modal`, `.adm-pick-cap`, `.adm-pick-none` | Photo bank picker, real `<dialog>`, caption overlay |
| `.adm-group-head`, `.adm-price-amt`, `.adm-price-cur`, `.adm-price-add`, `.adm-notice` | Menu section headings, fixed 7rem price column, save toast |

#### Dashboard, analytics, check, photo bank CSS

| Classes | Purpose |
|---|---|
| `.adm-stats`, `.adm-figures`, `.adm-figure-n`, `.adm-figure-l`, `.adm-figure-s`, `.adm-delta--up/down/flat`, `.adm-spark`, `.adm-lists` | Dashboard reader-statistics figures, deltas, sparklines, rank lists |
| `.adm-an-windows`, `.adm-an-chart`, `.adm-an-line`, `.adm-an-area`, `.adm-an-grid`, `.adm-an-dot`, `.adm-an-bars`, `.adm-an-strip`, `.adm-an-strip--week`, `.adm-an-cell`, `.adm-an-table`, `.adm-an-ip`, `.adm-an-journey` | Analytics detail windows, hand-drawn SVG chart, heat strips, tables, IP reveal, journeys |
| `.adm-chk-summary`, `.adm-chk-list`, `.adm-chk-lamp`, `.adm-chk-detail` | System-check board, lamps, verdicts, timings |
| `.adm-bank`, `.adm-bank-grid`, `.adm-bank-cell`, `.adm-bank-flag`, `.adm-bank-kind`, `.adm-bank-gauge`, `.adm-bank-upload`, `.adm-bank-queue`, `.adm-bank-play`, `.adm-bank-where`, `.adm-bank-big`, `.adm-bank-danger`, `.adm-bank-confirm` | Photo bank contact sheet, quota gauge, upload queue, video marker, facts panel, danger delete |

---

### CSS-driven motion

| Animation/transition | Trigger | Technique and details |
|---|---|---|
| `hero open/close` two-leaf spread | `[data-open]` on `.hero` | Two sticky leaf halves rotate around outer edges by `±108deg`; `1.9s var(--swing)`; gate fades and returns |
| Mobile hero leaf open/close | `[data-open]` at `≤900px` | `rotateX(104deg)` / `rotateX(-104deg)` on stacked leaves |
| Dial notch interpolation | `[data-dial-open]` on `<html>` | Registered `--notch` transitions `1px → 232px` over `0.5s var(--ease)`; drives hero-copy mask and rim |
| Daypart light change | `[data-daypart]` changes | Registered `--bg`, `--surface`, `--card` interpolate over `1.4s`; all palette blocks are currently empty |
| `live-in` | `.live`/`.live-note` arrival | Fades opacity `0→1`, `0.6s var(--ease)` |
| `live-pulse` | While live chip visible | Opacity pulses `0.35→1→0.35` over `3.4s`; rain/storm uses `1.6s` |
| `room-enter` | Rooms route mount | Page-wide fade; defined earlier, referenced later |
| `room-rise` | Rooms/contact/amenity/breakfast entrance | Fade plus `translateY(12px) → 0`; `760ms var(--ease)`; staggering via delay |
| Hero slide crossfade/translate | `[data-state=idle/out/in]` | Photo and text move opposite directions with `--travel` and `--dir`; `var(--swap)` |
| Services ring rotation/card dimming | Framer Motion writes `.svc-ring` transform | Five-facet cylinder at `--ring-step:72deg`; inactive facets dim with brightness/saturation |
| Rooms fan overflow wrap | Framer Motion writes `.room-fan` rotateX | `--ring-step:58deg`; stage crossfades at ends; `300ms var(--swing)` out, `460ms var(--ease)` in |
| `room-liquid` | `.room-view` present | Four radial gradients drift on background-position over `26s var(--ease)` infinite alternate; stops once WebGL canvas draws |
| `gal-out` | Gallery window changes | Outgoing stripe drifts/scales/fades while new stripes crossfade underneath |
| `gal-rise` | Gallery stripe opens/current | Caption rises `12px` and fades in; `420ms var(--ease) 260ms both` |
| Dial open/close ring | Open/close; `[data-dial-instant]` disables | `.dial-ring` transitions transform and stroke-width `0.55s var(--ease)` |
| Floating dock/footer fade | `[data-footer-visible]` | Dock/dial fade to `opacity:0; pointer-events:none` over `0.25s ease` |
| Room detail expansion | `.room-page[data-open]` | Real grid track transitions `640ms var(--ease)`; panel padding included |
| Room liquid background takeover | `.room-view[data-liquid]` | CSS animation removed and `.liquid-bg` fades in over `500ms var(--ease)` |
| `leaf-turn`, `leaf-turn-top`, `leaf-shade` | `MenuBook` remounts `.book-category` by tab key | Book cover/category rotates like a leaf, desktop `rotateY`, mobile `rotateX`; `680ms var(--swing)` |
| `fx-twinkle` | `:root[data-daypart=night]` | Night sky layer opacity pulses over `7s ease-in-out infinite alternate` |
| `fx-snow`, `fx-fog`, `fx-cloud` | `:root[data-sky=snow/fog/cloudy]` | Tile-sized background-position loops: snow `9s`; fog `26s alternate`; clouds `22s alternate` |
| Page/view transition | Navigation | Root snapshots `320ms var(--ease)`; `.dial-layer` has `view-transition-name: dial` |
| `adm-notice-in` | Admin toast appended after write | Opacity/translate `6px` over `200ms ease` |
| `bf-pulse` | `.bf-now[data-serving]` | Serving dot pulses opacity `0.35` at `2.4s ease-in-out` |
| Hover/press lifts | Hover/active on CTAs, buttons, dock, channels, arrows, stop-back | Box-shadow/transform transitions using `--nu-raised`/`--nu-pressed`; console uses bevel inversion and brightness dips |

---

### Responsive behaviour

Breakpoints are viewport-based media queries. No container queries are recorded.
The stylesheet also distinguishes pointer/touch behaviour with `touch-action`,
hover-only hints, and pointer-events layering.

| Breakpoint | What changes |
|---|---|
| `max-width:1160px` | Upper dial-scale bound; between 721px and 1160px the whole dial scales with `100vw / 1160px`, while `.dial-anchor::before` counter-scales |
| `max-width:900px` | Hero becomes stacked rows; gate rides the horizontal seam; room page becomes single-column; room detail stacks; gallery accordion becomes vertical; contact page becomes one scrollable column; cuisine book cover sits over paper with `rotateX` page turn; breakfast/amenity cards stack |
| `max-width:860px` | Admin system-check rows rearrange; photo bank becomes single-column with statically stacked side panel |
| `max-width:768px` | Dashboard stats/list columns collapse to one column |
| `max-width:720px` | Dock/dial use phone layout: dial anchor scales to `0.62`, dock controls shrink; contact route becomes portrait orientation |
| `max-width:640px` | Footer becomes single-column; analytics top-list columns adjust |
| `max-width:560px` | Contact channels and form become one column; booking form collapses |

Touch vs pointer handling:

| Context | Behaviour |
|---|---|
| `.hero` at `≤900px` | `touch-action: pan-y` so vertical scrolling works over hero |
| `.svc-stage` | `touch-action: pan-y` over horizontal service ring |
| `.room-stage` | `touch-action: pan-x` so drag logic commits against browser vertical gestures |
| `.gal-hit`, `.gal-nav` | `touch-action: manipulation` for whole-column/directional controls |
| Dial | `.dial-layer` is `pointer-events:none`; `.dial-arc`, `.dial-seg`, `.dial-puck` opt back in; `.dial-spoke` stays keyboard-focusable but mouse-inert |
| Gallery captions/labels | `pointer-events:none` so column hit target owns the gesture |
| Desktop room cards | Cursor grab on room cards; arrow/pointer navigation supported |
| `[data-footer-visible]` | `pointer-events:none !important` overrides inline dial hit-area pointer events |

---

### Accessibility

#### Focus and interaction

- Global keyboard focus uses `:where(a, button):focus-visible`:
  `outline: 2px solid var(--sage); outline-offset: 4px; border-radius: 999px`.
- Form fields get explicit focus because the global ring only covers `a`/`button`:
  `.con-form :focus-visible` uses `outline: 2px solid var(--green); offset: 2px`.
- Admin controls use `outline: 2px solid #0060df; outline-offset: 2px`.
- Gallery hit areas use cream inset focus rings:
  `.gal-hit:focus-visible`, `.gal-nav:focus-visible`, `.gal-pause:focus-visible`.
- Console radio/checkbox cards use `:has(input:focus-visible)` to draw a focus ring
  while keeping the real input visible and keyboard accessible.
- The 404/error `.stop-back` does not use `all:unset` because that would erase its
  focus ring; each button property is reset explicitly.

#### Contrast and non-colour state encoding

- Admin lamps use a dot plus a word: `.adm-con-lamp` states are `data-state=ok`,
  `data-state=bad`, `data-state=req`, or visually hidden when off. Colour is never
  the only signal.
- Disabled/loading controls change colour, not opacity, so they remain legible.
- Gallery accessible cream `#f2eee4` against video veils was tuned to roughly
  `13:1` and `11:1` for text, and around `5.4:1` for non-text controls.
- Admin warning/error colours are paired with wording changes, e.g. account seen
  state, IP reveal warning colour and label, and bank quota `warn`/`bad` states.

#### Reduced motion

- The policy is consistently “cut, not shortened”: `prefers-reduced-motion` sets
  `animation: none` and `transition-duration: 0.01ms` rather than speeding up.
- Weather layers are special-cased: under reduced motion they are set to
  `opacity: 0`, because a frozen rain/snow frame would read as a bug.
- The CSS liquid background is hidden under reduced motion; `RainGlass.tsx` draws
  one static frame.
- Book leaf turn is removed and the leaf’s `::after` shading layer is
  `display: none` so the leaf lands flat.
- The gallery component also reads `useReducedMotion()` so pointer-pass traffic does
  not autoplay video; deliberate click still works.
- Daypart/sky colour remains applied under reduced motion because it is
  information, not motion.

#### Color scheme

- No `prefers-color-scheme` block is recorded. The public site is deliberately
  dark and cinematic, and admin is a neutral light console. The old daypart
  mechanism is present but intentionally neutralised in CSS.

#### Screen reader and semantics

- `.sr-only` and `.gal-sr` provide visually hidden text/live-region announcements.
- Admin rows rely on native `<details>/<summary>` and the photo bank on native
  `<dialog>`, so browser focus, Escape, and backdrop behaviour are preserved.
- Admin analytics chart hover points use native SVG `<title>` tooltips; no JS
  charting library is used.
- Admin choice/radio cards keep the real radio visible and focusable; `:has()` is
  used only as an enhancement.
- `.dial-spoke` is keyboard-focusable even though it is mouse-inert.
- The photo-bank file input is visually hidden with a 1px clip technique, and the
  visible upload button is its `<label>`.

---

### Gotchas in the stylesheet

| Area | Gotcha |
|---|---|
| Daypart | The four daypart palette blocks are intentionally **empty**, so the palette never changes after first paint; `Live.tsx` still stamps `data-daypart`. |
| Ambient video | `--ambient-bright` was removed; brightness floor is inlined as `max(0.5, calc(0.85 * var(--sky-dim,1)))`. |
| Dial source order | `:root[data-dial-open]` must stay after every daypart rule; it wins only by equal-specificity source order. |
| Dial notch | Keep `--notch` at `1px` floor. Mask feather is `99.6%–100%` deliberately; the rim sits at `--notch + 1px`. |
| Dial pivot | `--pivot = calc(var(--inset) - var(--pad-x))`; changing page padding or dial inset without preserving that relation drifts the notch. |
| Hero card height | `aspect-ratio` can make cards shorter than content; `max-height` does not restore clipped content; `min-height` is required. Past ~2:1 viewports the 84vh width cap produces the “ponytail” drift. |
| 3D layers | One transform per preserve-3d layer is mandatory. Do not add `opacity`, `filter`, or `overflow` to `.svc-*`/`.room-*` layer elements. |
| Rooms facet hiding | `.room-card` uses `visibility`, not `opacity`, to hide non-front facets; opacity below 1 forces `transform-style: flat`. |
| Rooms fan sign | The sign of `.room-face` `rotateX` is load-bearing; it must flip with `RoomsCarousel`’s animate `rotateX`, or ArrowDown fetches the wrong card. |
| Wrap timings | `.room-stage` transitions (`300ms var(--swing)` out, `460ms var(--ease)` in) must stay in sync with `WRAP_OUT`/`WRAP_IN` in `RoomsCarousel.tsx`. |
| Touch action | `.svc-stage` uses `pan-y`; `.room-stage` uses `pan-x`. Swapping them changes whether the browser claims the guest drag. |
| Hero pointer handoff | The opened `.hero` pointer-events transition is delayed `0s 1.15s` so it stops eating clicks meant for `.beyond`; it must still exceed the leaf swing. |
| Layout constants | `--inset` 92px, `--notch-open` 232px, hero deck 22vh/max 15.5rem, and card min-height constraints commute into viewport math. |
| Backdrop filter | `.beyond` and other glass surfaces need both `backdrop-filter` and `-webkit-backdrop-filter` kept in sync. |
| Extracted boundaries | The notes identify chunks that are truncated mid-comment/mid-rule, e.g. `.room-page` media query and `.am-callout`; do not treat `@media` as complete. |
| Keyframes across sections | Later chunks reference `room-enter` and `room-rise`, which are defined earlier in `globals.css`; reordering or tree-shaking is unsafe. |
| Gallery columns | `.gal-col` transitions the individual `flex-grow` property, not the `flex` shorthand, because the shorthand does not interpolate. |
| Gallery width | Gallery uses `width:100%`, not `100vw`, because `100vw` includes the scrollbar gutter and creates horizontal overflow. |
| Liquid background | `.liquid-bg` is `position:fixed` inside `.room-view` because `.room-view` is the scroll container when open; this works only because `.room-page` is `min-height:100svh`. |
| Footer pointer events | `[data-footer-visible] .dial-layer * { pointer-events:none !important }` exists to beat inline pointer-events on dial hit targets. |
| Dial counter-scaling | Between 721px and 1160px, `.dial-anchor::before` is counter-scaled with `calc(1160px / 100vw)` so the well floor does not shrink twice. |
| Mobile hero gutter | `--gutter:62px` is required to reserve seam space for the gate button; removing it causes overlap. `.hero-deck:8.5rem` was chosen because 7rem clipped two-line headlines. |
| Room open row | `.room-page[data-open]` pins grid rows to `100svh` because squeezed `0fr` content can wrap one word per line and raise a page scrollbar. |
| Gallery JS/CSS timing | `.gal-copy` delay and `.gal-out` duration/delay are partly owned by the gallery component; changing timings in CSS alone can go stale. |
| `:has()` dependency | `body:has(.room-page[data-open])` and `.gal-stage:has([data-open])` rely on `:has()`; unsupported browsers simply don’t get those enhancements. |
| Weather reduced motion | Under reduced motion, weather pseudo-elements must be `opacity:0`, not merely `animation:none`; otherwise frozen rain/snow is displayed. |
| Contact honeypot | `.con-trap` is `display:none`, not off-screen. Off-screen honeypots were autofilled by password managers and silent success reached nobody. |
| Admin input width | Base `.adm input { width:100% }` silently widens radios/selects/time inputs; fixes use `width:auto`, `flex:0 0 auto`, and fixed `ch` widths. |
| Admin button hover | Base `.adm button:hover` paints buttons black; custom gradients need equal-or-higher specificity such as `.adm .adm-con-pick-btn:hover:not(:disabled)`. |
| Destructive button width | Do not put a worded destructive label on `.adm-btn--x`; use `.adm-btn--bad`. A real bug wrapped “Delete this photo” four letters per line. |
| Contact form reserve | `.con-write`’s margin-right is coupled to `--notch-open`; it is removed at `≤900px` where the page scrolls. |
| Select width | `select { width:auto }` can expand to the widest option, e.g. “United Arab Emirates” blew out the country-code field; fixed widths are required. |
| Clear sky fallback | `clear` has no `[data-sky=clear]` rule and must not gain one; absence of any sky attribute is the intended clear fallback. |
| Book clip-path | `.book-tab[data-active]` uses `clip-path`, so lift shadows must be `drop-shadow`, not `box-shadow`. |
| Book grain layer | `.book-page::before` is z-index `1` above content and intentionally paints grain over text; edit with care. |
| Booking selects | Date/select chevrons use data URIs and `appearance:none`; the native calendar icon is inverted for dark fields. |
| Mobile dock clearance | `.bf-page`/`.am-page` top padding clears the 26px+42px back button, and bottom padding clears the fixed dock row. |
| Live weather failure | If the live weather route fails, no `data-sky` is stamped; the video plays at full brightness and no tint, documented as intended. |
| Analytics heat strip | Do not put labels inside `.adm-an-cell` bars; the grid row `1fr auto` keeps labels outside bars, otherwise busy days produce dark text on dark green. |
| Contact route dashes | `.con-route-leg-line` uses a repeating gradient dash, not `border-dashed`, because border dashes respace themselves at every width. |
| Dead-end button colour | `.stop-back` is brass, not `--green`, because `--green` changes with daypart while `--green-ink` is stable. |
| Photo bank specificity | Base `.adm button` forces custom buttons to use `.adm .adm-bank-cell` / `.adm .adm-bank-kind` overrides; hover needs `:not(:disabled)` to clear `(0,2,1)`. |
| Photo bank grid | `.adm-bank-grid` uses `auto-fill`, not `auto-fit`, so a three-photo bank shows three normal thumbnails rather than three full-width panoramas. |
| File input | The bank file input is hidden with a 1px clip-rect technique and the `<label>` is the real upload button because a file input cannot be restyled and its native “No file chosen” text lies after upload. |
| Video cells | `.adm-bank-cell video` has `pointer-events:none`, so the native SVG `<title>` tooltip pattern used by chart dots cannot be reused for videos; they get `.adm-bank-play`. |
| Admin literals | Admin literal greys and colours such as `#333`, `#555`, `#777`, `#ccc`, `#eee`, `#999`, and `#456654` are intentional and should not be casually tokenised. |
| ARIA/data hooks | Admin analytics and bank styles key off `[aria-current='true']`, `[aria-selected='true']`, `[aria-pressed='true']`, `[data-state='...']`; JSX must keep matching these. |
| Earlier class dependencies | Later chunks reference earlier classes like `.bf-item`, `.book-cover`, `.am-experience-card`, and `.bk-send`; deleting earlier rules breaks later chunks. |
| Admin IP reveal | `.adm-an-ip` is coloured warning amber because it is personal data; the CSS expects it to be revealed only behind an `.adm-an-reveal` affordance. |
