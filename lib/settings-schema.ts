/* The rules for every fact in the `settings` table: what shape it has to be, how
 * to tidy what someone pasted, and how the structured parts a person edits turn
 * back into the one string the public site reads.
 *
 * Imported by BOTH sides of /admin/settings — the client console for its live
 * lamps and previews, and the server action for the authoritative re-check
 * before anything is written. That is the whole point of the file existing.
 * Written twice, the two copies drift, and the panel starts saying VALID to
 * something the server then refuses; written once, they cannot.
 *
 * Pure by construction — no `cloudflare:workers`, no React, no DB, and no
 * imports at all. That is what lets a "use client" file import it (see the note
 * at the top of lib/content.ts for the same rule pointing the other way), and
 * what lets scripts/settings-check.mjs run it under bare `node`.
 *
 * A note on why any of this exists, because it reads as a lot of machinery for
 * thirteen rows: a blank box asks a question, and the person filling it in has
 * to guess the answer. Do I type the +977? Is it "950m" or "950 m"? The whole
 * file is that guess, removed — a country code you pick can't be left off, an
 * amenity you tick can't be forgotten, a link checked against its own host
 * can't be half-pasted. */

/* ── Vocabularies ─────────────────────────────────────────────────────────── */

/* Not the full ITU list. These are the countries this hotel's guests actually
   call from — Nepal first because it is the answer nine times in ten, then the
   subcontinent and the Gulf (where most of Nepal's outbound work sits), then
   the long-haul markets. A shorter list is a faster pick; add to it when a real
   number needs one. */
export const COUNTRY_CODES: { code: string; name: string }[] = [
  { code: "+977", name: "Nepal" },
  { code: "+91", name: "India" },
  { code: "+880", name: "Bangladesh" },
  { code: "+94", name: "Sri Lanka" },
  { code: "+975", name: "Bhutan" },
  { code: "+971", name: "United Arab Emirates" },
  { code: "+974", name: "Qatar" },
  { code: "+966", name: "Saudi Arabia" },
  { code: "+965", name: "Kuwait" },
  { code: "+1", name: "United States / Canada" },
  { code: "+44", name: "United Kingdom" },
  { code: "+61", name: "Australia" },
  { code: "+64", name: "New Zealand" },
  { code: "+86", name: "China" },
  { code: "+81", name: "Japan" },
  { code: "+82", name: "South Korea" },
  { code: "+65", name: "Singapore" },
  { code: "+60", name: "Malaysia" },
  { code: "+66", name: "Thailand" },
  { code: "+49", name: "Germany" },
  { code: "+33", name: "France" },
  { code: "+39", name: "Italy" },
  { code: "+34", name: "Spain" },
  { code: "+31", name: "Netherlands" },
  { code: "+7", name: "Russia" },
];

/* Booking.com's in-room vocabulary, near enough. Ticking from a list is the
   whole fix for "they might miss one" — nobody recalls thirty amenities from an
   empty textarea, and the eight currently listed are visibly a person's memory
   rather than the room's contents. */
export const AMENITIES: string[] = [
  "Air conditioning",
  "Free WiFi",
  "Private bathroom",
  "Flat-screen TV",
  "Tea/coffee maker",
  "Minibar",
  "Desk",
  "Soundproofing",
  "Safe",
  "Wardrobe",
  "Balcony",
  "Mountain view",
  "City view",
  "Hairdryer",
  "Toiletries",
  "Towels",
  "Linen",
  "Slippers",
  "Bathrobe",
  "Shower",
  "Bathtub",
  "Hot water",
  "Heating",
  "Room service",
  "Daily housekeeping",
  "Iron",
  "Telephone",
  "Power backup",
  "Mosquito net",
  "Non-smoking",
];

/* `label` is the stored value AND the key SiteFooter's icon map is keyed by, so
   it has to come from a locked select rather than a text box. A hand-typed
   "instagram" used to store fine and then silently render as the word instead of
   the glyph — unreachable now, because the label is never typed.

   `hosts` is what the row's link is checked against, so an Instagram row cannot
   hold a Facebook URL. Matched on the registrable suffix, so a www./m./l. prefix
   passes and a lookalike like evilinstagram.com does not.

   A list rather than a single host, because most of these genuinely answer to
   several: a phone's share sheet hands out youtu.be for YouTube and g.page or
   maps.app.goo.gl for a Google Business profile, and pasting the link the phone
   actually gave you has to work. (The one-host version of this list failed its
   own placeholder in scripts/settings-check.mjs, which is what caught it.) */
export const SOCIAL_PLATFORMS: { label: string; hosts: string[]; placeholder: string }[] = [
  { label: "Instagram", hosts: ["instagram.com"], placeholder: "https://www.instagram.com/yourhotel/" },
  { label: "Facebook", hosts: ["facebook.com", "fb.com", "fb.me"], placeholder: "https://www.facebook.com/yourhotel" },
  { label: "WhatsApp", hosts: ["wa.me", "whatsapp.com"], placeholder: "https://wa.me/9779840007925" },
  { label: "TikTok", hosts: ["tiktok.com"], placeholder: "https://www.tiktok.com/@yourhotel" },
  { label: "YouTube", hosts: ["youtube.com", "youtu.be"], placeholder: "https://www.youtube.com/@yourhotel" },
  { label: "X", hosts: ["x.com", "twitter.com"], placeholder: "https://x.com/yourhotel" },
  { label: "LinkedIn", hosts: ["linkedin.com"], placeholder: "https://www.linkedin.com/company/yourhotel" },
  {
    label: "TripAdvisor",
    hosts: ["tripadvisor.com", "tripadvisor.in", "tripadvisor.co.uk"],
    placeholder: "https://www.tripadvisor.com/Hotel_Review-g293890",
  },
  {
    label: "Booking.com",
    hosts: ["booking.com"],
    placeholder: "https://www.booking.com/hotel/np/thakali-inn.html",
  },
  {
    label: "Google Business",
    hosts: ["g.page", "google.com", "maps.app.goo.gl", "goo.gl"],
    placeholder: "https://g.page/yourhotel",
  },
];

/* The hosts a Google Maps place link can arrive on: the full desktop URL, or
   the shortened one the phone's share sheet produces. */
export const MAPS_HOSTS = ["google.com", "maps.app.goo.gl", "goo.gl"];
export const BOOKING_HOSTS = ["booking.com"];

/* Two of the four rows on the live site are not distances at all ("Front desk |
   Through the night"). Forcing a number on those would be worse than the
   textarea this replaces, so a row is either a measured distance or a plain
   note, and the person picks which. */
export const ARRIVAL_UNITS: string[] = ["m", "km", "min walk", "min drive"];

export const ROOM_SIZE_UNITS = ["m2", "sqft"] as const;
export type RoomSizeUnit = (typeof ROOM_SIZE_UNITS)[number];

/* ── Normalisers ──────────────────────────────────────────────────────────────
   Run before validation, always. A pasted value drags whitespace and a phone
   copied off a website arrives full of brackets and dashes; rejecting those
   teaches someone to fight the form, fixing them silently is the job. */

/* Trim, and collapse runs of inner whitespace — including the newlines a paste
   out of a PDF brings with it. */
export const tidy = (v: string): string => v.trim().replace(/\s+/g, " ");

/* A phone field holds digits and nothing else. "+977 (984) 000-7925" and
   "9840007925" both land on the same ten characters. */
export const digitsOnly = (v: string): string => v.replace(/\D/g, "");

/* Trim and lowercase, and deliberately no more. lib/site.ts's normalizeEmail
   also folds googlemail→gmail and strips +tags, which is right for deciding
   whether two strings are the same *person* (the admin whitelist) and wrong
   here: this address is displayed on the site and receives the enquiry mail, so
   rewriting a legitimate "bookings+web@hotel.com" into a different mailbox is a
   silent misdelivery. Same-looking job, opposite requirement. */
export const tidyEmail = (v: string): string => v.trim().toLowerCase();

/* Deliberately only trims. Stripping a trailing slash would rewrite links that
   are already correct — the live Instagram row ends in one — and a URL is not
   ours to reformat. */
export const tidyUrl = (v: string): string => v.trim();

/* The code itself is case-insensitive and conventionally upper ("M9X3+7J"), but
   the town that can follow it is a place name and not ours to shout. Upper-
   casing the lot turned the live row into "M9X3+7J KATHMANDU", which the
   contact page prints. */
export const tidyPlusCode = (v: string): string => {
  const clean = tidy(v);
  const gap = clean.indexOf(" ");
  return gap < 0 ? clean.toUpperCase() : clean.slice(0, gap).toUpperCase() + clean.slice(gap);
};

/* ── Validators ───────────────────────────────────────────────────────────────
   Each returns null when the value is fine, or a sentence saying what to do
   about it. Not "Invalid input" — the person reading it has to be able to act
   on it without asking anyone. */

export function checkRequired(v: string, what: string): string | null {
  return v.trim() ? null : `${what} can't be empty.`;
}

/* E.164 caps a full international number at 15 digits, and nothing real is
   under 4. The country code is its own control precisely so it cannot be
   forgotten: a Nepali number saved bare is tapped by a guest in India and dials
   an Indian number instead. */
export function checkPhone(cc: string, local: string): string | null {
  if (!cc) return "Pick a country code.";
  if (!COUNTRY_CODES.some((c) => c.code === cc)) return "That country code isn't one of the listed ones.";
  const digits = digitsOnly(local);
  if (!digits) return "Enter the number, digits only — no country code, it's the box on the left.";
  if (digits.startsWith("0")) return "Drop the leading 0 — the country code replaces it.";
  const total = digitsOnly(cc).length + digits.length;
  if (total < 8) return `That's only ${total} digits including the country code. A real number has at least 8.`;
  if (total > 15) return `That's ${total} digits including the country code. The maximum any number can have is 15.`;
  return null;
}

export function checkEmail(v: string): string | null {
  const clean = tidyEmail(v);
  if (!clean || clean.endsWith("@")) return "Enter an address, like frontdesk@hotelthakaliinn.com.";
  /* Same shape the accounts page and the Google login whitelist compare on, so
     an address that saves here is an address those two agree about. */
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(clean)) return "That doesn't look like an email address — it needs one @ and a dot after it.";
  return null;
}

/* `hosts` pins a link to the service it claims to be from. Suffix-matched rather
   than compared whole, so www.instagram.com and instagram.com both pass; matched
   on a dot boundary rather than by substring, so evilinstagram.com does not. */
export function checkUrl(v: string, hosts?: string[], what = "link"): string | null {
  const clean = tidyUrl(v);
  if (!clean) return `Paste the ${what}.`;
  let url: URL;
  try {
    url = new URL(clean);
  } catch {
    return "That isn't a complete link. It has to start with https:// — copy the whole thing from the address bar.";
  }
  if (url.protocol !== "https:")
    return "The link has to start with https:// — copy the whole thing from the address bar.";
  if (hosts?.length) {
    const h = url.hostname.toLowerCase();
    if (!hosts.some((host) => h === host || h.endsWith(`.${host}`)))
      return `That's a ${url.hostname} link, but this row is for ${what}.`;
  }
  return null;
}

/* Seven decimals is roughly a centimetre. More than that is a paste artefact,
   and the value is shown in a fixed-width box that longer numbers overflow. */
function checkCoord(v: string, limit: number, what: string): string | null {
  const clean = tidy(v);
  if (!clean) return `${what} is missing — paste the Google Maps link above and it fills in.`;
  if (!/^-?\d{1,3}(\.\d{1,7})?$/.test(clean)) return `${what} has to be a plain number, like 27.6981357.`;
  const n = Number(clean);
  if (!Number.isFinite(n) || Math.abs(n) > limit) return `${what} has to be between -${limit} and ${limit}.`;
  return null;
}

export const checkLat = (v: string) => checkCoord(v, 90, "Latitude");
export const checkLng = (v: string) => checkCoord(v, 180, "Longitude");

/* Open Location Code: a 20-character alphabet, four to eight characters, a
   plus, then two or three more — optionally followed by the town it is relative
   to ("M9X3+7J Kathmandu"). */
const OLC = "[23456789CFGHJMPQRVWX]";

export function checkPlusCode(v: string): string | null {
  const clean = tidyPlusCode(v);
  if (!clean) return "Open Google Maps, tap the hotel's name, and copy the code that looks like M9X3+7J.";
  if (!new RegExp(`^${OLC}{4,8}\\+${OLC}{2,3}( .+)?$`).test(clean))
    return "That isn't a plus code. It looks like M9X3+7J, optionally followed by the town.";
  return null;
}

export function checkPostal(v: string): string | null {
  const clean = digitsOnly(v);
  if (!clean) return "Kathmandu is 44600.";
  if (clean.length !== 5) return `A Nepali postal code is 5 digits — that's ${clean.length}.`;
  return null;
}

export function checkArrivalValue(kind: "distance" | "note", value: string): string | null {
  const clean = tidy(value);
  if (!clean) return kind === "distance" ? "Enter how far it is." : "Enter what to say about it.";
  if (kind === "distance" && !/^\d+(\.\d+)?$/.test(clean)) return "A distance is just the number — the unit is the box beside it.";
  return null;
}

export function checkRoomSize(v: string): string | null {
  const clean = tidy(v);
  if (!clean) return "Enter the size of the smallest room.";
  if (!/^\d+(\.\d+)?$/.test(clean)) return "Just the number — pick the unit beside it.";
  if (Number(clean) <= 0) return "A room can't be 0 across.";
  return null;
}

/* ── Extractors ───────────────────────────────────────────────────────────── */

export type Coords = { lat: string; lng: string; from: "pin" | "view" };

/* A Google Maps place URL carries the position twice, and the two are not the
   same point. `@27.6954876,85.2756856,12z` is where the *map was scrolled to*
   when the link was copied; `!3d27.6981357!4d85.3540451` is the pin itself.
   On the live link those are 8km apart. Taking the wrong one moves the contact
   map, and with it the weather and air readings, which read their coordinates
   out of these same two rows — so the pin wins, and the caller is told which
   one it got. */
export function coordsFromMapsUrl(url: string): Coords | null {
  const pin = url.match(/!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/);
  if (pin) return { lat: pin[1], lng: pin[2], from: "pin" };
  const view = url.match(/@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/);
  if (view) return { lat: view[1], lng: view[2], from: "view" };
  return null;
}

/* ── Composers: parts → the string the public site already reads ───────────── */

/* Six components read `phone` and `address` off the settings row as plain
   strings. Composing rather than restructuring is what keeps this whole change
   invisible to them — and it is what makes the console's preview honest, since
   what it shows is literally the value about to be stored. */

export const composePhone = (cc: string, local: string): string =>
  `${cc}-${digitsOnly(local)}`;

export type AddressParts = {
  tole: string;
  ward: string;
  city: string;
  district: string;
  postal: string;
};

/* Built by joining only the parts that are filled, so leaving the optional ward
   and district blank cannot leave a stray comma behind — the failure mode of
   every template that interpolates first and tidies after. */
export function composeAddress(p: AddressParts): string {
  const head = [tidy(p.tole), tidy(p.ward) && `Ward ${digitsOnly(p.ward)}`, tidy(p.district)].filter(Boolean);
  const tail = [tidy(p.city), digitsOnly(p.postal)].filter(Boolean).join(" ");
  return [...head, tail].filter(Boolean).join(", ");
}

export const composeAmenities = (picked: string[], custom: string[]): string =>
  [...picked, ...custom.map(tidy).filter(Boolean)].join(" · ");

const SQFT_PER_M2 = 10.7639104;

/* Both figures from one number, so the metric and imperial halves can never
   disagree. The live row currently says "42 m² (450 sq ft)" — 42 m² is 452,
   which is the kind of drift two hand-typed numbers always end in. */
export function composeRoomSize(value: string, unit: RoomSizeUnit, bathroom: boolean): string {
  const n = Number(tidy(value));
  if (!Number.isFinite(n) || n <= 0) return "";
  const round = (x: number) => String(Math.round(x));
  const both =
    unit === "m2"
      ? `${tidy(value)} m² (${round(n * SQFT_PER_M2)} sq ft)`
      : `${tidy(value)} sq ft (${round(n / SQFT_PER_M2)} m²)`;
  return `Rooms start at about ${both}${bathroom ? ", bathroom included" : ""}.`;
}

export type ArrivalRow = { place: string; kind: "distance" | "note"; value: string; unit: string };

/* ContactPanel finds the airport row by matching /terminal|airport|tia/i on the
   place and prints the value verbatim, so the stored shape stays exactly the
   [place, string] pair it has always been. */
export const composeArrival = (rows: ArrivalRow[]): [string, string][] =>
  rows
    .filter((r) => tidy(r.place))
    .map((r) => [tidy(r.place), r.kind === "distance" ? `${tidy(r.value)} ${r.unit}` : tidy(r.value)]);

/* ── Parsers: the stored string → parts ───────────────────────────────────────
   Only for the rows that round-trip losslessly. A row that can be derived is a
   row that can drift out of sync with what it was derived from, so these three
   get no database column of their own. Address and room size are prose and do
   not round-trip — those keep real rows. */

/* Longest prefix wins, or "+977…" resolves to "+97" and every Nepali number
   loses a digit the first time someone opens the page. */
export function parsePhone(stored: string): { cc: string; local: string } {
  const raw = stored.trim();
  const match = [...COUNTRY_CODES]
    .sort((a, b) => b.code.length - a.code.length)
    .find((c) => raw.startsWith(c.code));
  if (!match) return { cc: COUNTRY_CODES[0].code, local: digitsOnly(raw) };
  return { cc: match.code, local: digitsOnly(raw.slice(match.code.length)) };
}

export function parseAmenities(stored: string): { picked: string[]; custom: string[] } {
  const parts = stored
    .split("·")
    .map(tidy)
    .filter(Boolean);
  const known = new Set(AMENITIES);
  return {
    picked: parts.filter((p) => known.has(p)),
    custom: parts.filter((p) => !known.has(p)),
  };
}

/* "950 m" is a distance, "Through the night" is a note. Anything that is a bare
   number followed by one of the known units becomes an editable number+unit
   pair; everything else stays the sentence it already was. */
export function parseArrival(rows: [string, string][]): ArrivalRow[] {
  return rows.map(([place, text]) => {
    const m = tidy(text).match(new RegExp(`^(\\d+(?:\\.\\d+)?)\\s+(${ARRIVAL_UNITS.join("|")})$`, "i"));
    return m
      ? { place, kind: "distance" as const, value: m[1], unit: m[2].toLowerCase() }
      : { place, kind: "note" as const, value: tidy(text), unit: ARRIVAL_UNITS[0] };
  });
}

/* ── The whole form, as one value ─────────────────────────────────────────────
   Everything /admin/settings edits, in the shape the console holds it and the
   shape the server action rebuilds from the POST. Both sides then run the same
   two functions over it — computeErrors to decide whether it may be saved, and
   composeAll to turn it into settings rows. That is what stops the client's
   idea of "valid" and the server's from ever drifting apart, and it is what
   lets scripts/settings-check.mjs exercise the real decision rather than a
   re-implementation of it. */

export type Social = { label: string; href: string };

export type FormValues = {
  phoneCc: string;
  phoneLocal: string;
  waSame: boolean;
  waCc: string;
  waLocal: string;
  email: string;
  bookingUrl: string;
  socials: Social[];
  mapsUrl: string;
  lat: string;
  lng: string;
  plusCode: string;
  addr: AddressParts;
  arrival: ArrivalRow[];
  amenPicked: string[];
  amenCustom: string[];
  sizeValue: string;
  sizeUnit: RoomSizeUnit;
  sizeBathroom: boolean;
  good: string[];
  rainDay: boolean;
  rainNight: boolean;
};

/* Same contract as lib/content.ts's list(): a malformed row falls back rather
   than throwing. Duplicated here in three lines instead of imported, because
   lib/content.ts reaches for `cloudflare:workers` and this file has to stay
   loadable from a browser bundle and from bare node. */
function jsonList<T>(value: string | undefined): T[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
}

const on = (v: string | undefined) => v === "1";

export function toFormValues(config: Record<string, string>): FormValues {
  const phone = parsePhone(config.phone ?? "");
  /* An empty `whatsapp` row means "same as the front desk", which is what it
     held before this screen could tell the two apart — so the pair below is
     seeded from the main number and the tick starts on. */
  const waSame = (config.whatsapp_same ?? "1") !== "0" || !config.whatsapp;
  const wa = parsePhone(config.whatsapp || config.phone || "");
  const amen = parseAmenities(config.rooms_shared ?? "");
  return {
    phoneCc: phone.cc,
    phoneLocal: phone.local,
    waSame,
    waCc: wa.cc,
    waLocal: wa.local,
    email: config.email ?? "",
    bookingUrl: config.booking_url ?? "",
    socials: jsonList<Social>(config.socials).filter((s) => s && typeof s.label === "string"),
    mapsUrl: config.maps_url ?? "",
    lat: config.lat ?? "",
    lng: config.lng ?? "",
    plusCode: config.plus_code ?? "",
    addr: {
      tole: config.addr_tole ?? "",
      ward: config.addr_ward ?? "",
      city: config.addr_city ?? "",
      district: config.addr_district ?? "",
      postal: config.addr_postal ?? "",
    },
    arrival: parseArrival(jsonList<[string, string]>(config.arrival)),
    amenPicked: amen.picked,
    amenCustom: amen.custom,
    sizeValue: config.rooms_size_value ?? "",
    sizeUnit: config.rooms_size_unit === "sqft" ? "sqft" : "m2",
    sizeBathroom: on(config.rooms_size_bathroom),
    good: jsonList<string>(config.rooms_good_to_know),
    rainDay: on(config.rain_glass_day),
    rainNight: on(config.rain_glass_night),
  };
}

/* ── The shape guard ──────────────────────────────────────────────────────────
   The console posts its whole FormValues as one JSON field, which means what
   arrives at the server action is an arbitrary object from the network, not the
   type it is labelled with. computeErrors() below walks arrays and reads
   properties; handed `{socials: "x"}` it would throw inside a Server Action,
   which surfaces as a blank error page rather than a refusal.

   So every field is coerced to its own type before anything else looks at it,
   and the lists are capped — nothing here has a legitimate reason to carry
   forty entries, and a JSON array does not have to be polite. Unknown keys are
   dropped simply by never being read. */

const str = (x: unknown): string => (typeof x === "string" ? x : "");
const bool = (x: unknown): boolean => x === true;
const arr = (x: unknown): unknown[] => (Array.isArray(x) ? x : []);
const obj = (x: unknown): Record<string, unknown> =>
  x && typeof x === "object" ? (x as Record<string, unknown>) : {};

/* Long enough for any real hotel, short enough that a crafted payload cannot
   turn one save into a megabyte of settings rows. */
const CAP = 40;

export function sanitizeFormValues(raw: unknown): FormValues {
  const r = obj(raw);
  const a = obj(r.addr);
  return {
    phoneCc: str(r.phoneCc),
    phoneLocal: str(r.phoneLocal),
    waSame: bool(r.waSame),
    waCc: str(r.waCc),
    waLocal: str(r.waLocal),
    email: str(r.email),
    bookingUrl: str(r.bookingUrl),
    socials: arr(r.socials)
      .slice(0, CAP)
      .map((s) => ({ label: str(obj(s).label), href: str(obj(s).href) })),
    mapsUrl: str(r.mapsUrl),
    lat: str(r.lat),
    lng: str(r.lng),
    plusCode: str(r.plusCode),
    addr: {
      tole: str(a.tole),
      ward: str(a.ward),
      city: str(a.city),
      district: str(a.district),
      postal: str(a.postal),
    },
    arrival: arr(r.arrival)
      .slice(0, CAP)
      .map((x) => {
        const o = obj(x);
        const unit = str(o.unit);
        return {
          place: str(o.place),
          kind: o.kind === "note" ? ("note" as const) : ("distance" as const),
          value: str(o.value),
          unit: ARRIVAL_UNITS.includes(unit) ? unit : ARRIVAL_UNITS[0],
        };
      }),
    /* Only names the catalogue actually offers. A ticked box cannot be anything
       else, so anything else arrived by hand. */
    amenPicked: arr(r.amenPicked)
      .map(str)
      .filter((x) => AMENITIES.includes(x)),
    amenCustom: arr(r.amenCustom).slice(0, CAP).map(str),
    sizeValue: str(r.sizeValue),
    sizeUnit: r.sizeUnit === "sqft" ? "sqft" : "m2",
    sizeBathroom: bool(r.sizeBathroom),
    good: arr(r.good).slice(0, CAP).map(str),
    rainDay: bool(r.rainDay),
    rainNight: bool(r.rainNight),
  };
}

/* Keyed by the DOM id of the control at fault, so the error summary can link
   straight to it and the field can find its own message without a second
   mapping to keep in step. */
export type Errors = Record<string, string>;

export function computeErrors(v: FormValues): Errors {
  const e: Errors = {};
  const set = (id: string, msg: string | null) => {
    if (msg) e[id] = msg;
  };

  set("phone", checkPhone(v.phoneCc, v.phoneLocal));
  if (!v.waSame) set("whatsapp", checkPhone(v.waCc, v.waLocal));
  set("email", checkEmail(v.email));
  set("booking_url", checkUrl(v.bookingUrl, BOOKING_HOSTS, "Booking.com"));

  v.socials.forEach((s, i) => {
    const platform = SOCIAL_PLATFORMS.find((p) => p.label === s.label);
    if (!platform) {
      e[`social-${i}`] = "Pick which platform this link is for.";
      return;
    }
    set(`social-${i}`, checkUrl(s.href, platform.hosts, platform.label));
  });

  set("maps_url", checkUrl(v.mapsUrl, MAPS_HOSTS, "Google Maps"));
  set("lat", checkLat(v.lat));
  set("lng", checkLng(v.lng));
  set("plus_code", checkPlusCode(v.plusCode));

  set("addr_tole", checkRequired(v.addr.tole, "The street or tole"));
  set("addr_city", checkRequired(v.addr.city, "The city"));
  set("addr_postal", checkPostal(v.addr.postal));
  /* Optional, but if someone types one it has to be a number — "Ward nine"
     would render as "Ward " once the digits are stripped out of it. */
  if (tidy(v.addr.ward) && !/^\d{1,3}$/.test(tidy(v.addr.ward)))
    e.addr_ward = "A ward is a number, like 9.";

  v.arrival.forEach((r, i) => {
    if (!tidy(r.place)) e[`arrival-${i}`] = "Name the place this row is about.";
    else set(`arrival-${i}`, checkArrivalValue(r.kind, r.value));
  });

  set("rooms_size_value", checkRoomSize(v.sizeValue));

  v.good.forEach((g, i) => {
    if (!tidy(g)) e[`good-${i}`] = "Write the point, or remove the row.";
  });

  /* An amenity list nobody has ticked anything in would blank the line on
     /rooms rather than shortening it. */
  if (!v.amenPicked.length && !v.amenCustom.filter((c) => tidy(c)).length)
    e.amenities = "Tick at least one thing every room has.";
  v.amenCustom.forEach((c, i) => {
    if (!tidy(c)) e[`amen-${i}`] = "Write the amenity, or remove it.";
  });

  return e;
}

/* Every settings row this screen owns, built from the parts. The four derived
   ones (phone, address, rooms_shared, rooms_size) come out byte-identical to
   what is on the live site today when nothing has been edited, which is what
   keeps the six public components that read them untouched by all of this. */
export function composeAll(v: FormValues): Record<string, string> {
  const phone = composePhone(v.phoneCc, v.phoneLocal);
  return {
    phone,
    whatsapp: v.waSame ? phone : composePhone(v.waCc, v.waLocal),
    whatsapp_same: v.waSame ? "1" : "0",
    email: tidyEmail(v.email),
    booking_url: tidyUrl(v.bookingUrl),
    socials: JSON.stringify(
      v.socials.filter((s) => tidyUrl(s.href)).map((s) => ({ label: s.label, href: tidyUrl(s.href) })),
    ),
    maps_url: tidyUrl(v.mapsUrl),
    lat: tidy(v.lat),
    lng: tidy(v.lng),
    plus_code: tidyPlusCode(v.plusCode),
    address: composeAddress(v.addr),
    addr_tole: tidy(v.addr.tole),
    addr_ward: digitsOnly(v.addr.ward),
    addr_city: tidy(v.addr.city),
    addr_district: tidy(v.addr.district),
    addr_postal: digitsOnly(v.addr.postal),
    arrival: JSON.stringify(composeArrival(v.arrival)),
    rooms_shared: composeAmenities(v.amenPicked, v.amenCustom),
    rooms_size: composeRoomSize(v.sizeValue, v.sizeUnit, v.sizeBathroom),
    rooms_size_value: tidy(v.sizeValue),
    rooms_size_unit: v.sizeUnit,
    rooms_size_bathroom: v.sizeBathroom ? "1" : "0",
    rooms_good_to_know: JSON.stringify(v.good.map(tidy).filter(Boolean)),
    rain_glass_day: v.rainDay ? "1" : "0",
    rain_glass_night: v.rainNight ? "1" : "0",
  };
}

/* ── The email lock ───────────────────────────────────────────────────────────
   wrangler.jsonc pins allowed_destination_addresses to one address so a bug in
   the public contact endpoint can never turn the hotel's domain into an open
   relay. That means changing this row without a matching deploy silently stops
   every enquiry notification — a failure nobody notices until a booking is
   already lost. So the row is editable, but not by whoever is on the front desk
   this evening. Checked here and enforced again in the server action; the
   client-side lock is only the part you can see. */
export const canEditEmail = (role: string): boolean => role === "owner" || role === "developer";
