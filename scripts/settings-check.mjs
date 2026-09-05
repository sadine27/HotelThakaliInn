/* One runnable check for /admin/settings' rules: `node scripts/settings-check.mjs`.
   Node strips the types off lib/settings-schema.ts natively — no framework, no deps.

   Everything pinned here is something that, if it broke, would change the LIVE
   site silently. Six public components read the strings these composers build,
   and two of them (the contact map, and the weather/AQI strip, which reads its
   coordinates from the same rows) would just quietly point somewhere else. */

import assert from "node:assert/strict";
import {
  ARRIVAL_UNITS,
  AMENITIES,
  BOOKING_HOSTS,
  COUNTRY_CODES,
  MAPS_HOSTS,
  SOCIAL_PLATFORMS,
  checkArrivalValue,
  checkEmail,
  checkLat,
  checkLng,
  checkPhone,
  checkPlusCode,
  checkPostal,
  checkRoomSize,
  checkUrl,
  tidyPlusCode,
  composeAddress,
  composeAmenities,
  composeArrival,
  composePhone,
  composeRoomSize,
  coordsFromMapsUrl,
  parseAmenities,
  parseArrival,
  parsePhone,
  canEditEmail,
  composeAll,
  computeErrors,
  sanitizeFormValues,
  toFormValues,
} from "../lib/settings-schema.ts";
import { phoneHref, waHref } from "../lib/site.ts";

/* ── The pin, not the viewport ───────────────────────────────────────────────
   The live maps_url row. It carries the position TWICE and the two are 8km
   apart: @27.6954876,85.2756856 is where the map happened to be scrolled when
   the link was copied, !3d27.6981357!4d85.3540451 is the hotel. Taking the
   wrong one moves the contact map, the weather and the air reading. */
const LIVE_MAPS_URL =
  "https://www.google.com/maps/place/Hotel+Thakali+Inn/@27.6954876,85.2756856,12z/data=!4m13!1m2!2m1!1shotel+thakali+inn!3m9!1s0x39eb19749df3068b:0x50b43cb19e3883bd!5m2!4m1!1i2!8m2!3d27.6981357!4d85.3540451";

assert.deepEqual(coordsFromMapsUrl(LIVE_MAPS_URL), {
  lat: "27.6981357",
  lng: "85.3540451",
  from: "pin",
});

/* A link with only a viewport still yields something usable, and says so. */
assert.deepEqual(coordsFromMapsUrl("https://www.google.com/maps/@27.7,85.3,12z"), {
  lat: "27.7",
  lng: "85.3",
  from: "view",
});
assert.equal(coordsFromMapsUrl("https://maps.app.goo.gl/abc123"), null); // shortened: no pin in it

/* Negative coordinates must survive the regex — the minus sign is the half a
   naive \d+ pattern eats. */
assert.deepEqual(coordsFromMapsUrl("https://maps.google.com/x!3d-33.8688!4d151.2093"), {
  lat: "-33.8688",
  lng: "151.2093",
  from: "pin",
});

/* ── Phone: the whole reason the prefix is its own control ───────────────── */

assert.equal(composePhone("+977", "9840007925"), "+977-9840007925");
assert.equal(composePhone("+977", "984 000 7925"), "+977-9840007925"); // pasted spacing
assert.deepEqual(parsePhone("+977-9840007925"), { cc: "+977", local: "9840007925" });

/* Longest prefix wins. "+97" is in the list as no country, but "+9" would match
   a naive startsWith scan of an unsorted list and eat a digit off every Nepali
   number the first time someone opened the page. */
assert.deepEqual(parsePhone("+9779840007925"), { cc: "+977", local: "9840007925" });
assert.deepEqual(parsePhone("+919876543210"), { cc: "+91", local: "9876543210" });

/* The derived links six components build off the composed string. */
assert.equal(waHref(composePhone("+977", "9840007925")), "https://wa.me/9779840007925");
assert.equal(phoneHref(composePhone("+977", "9840007925")), "tel:+9779840007925");

assert.equal(checkPhone("+977", "9840007925"), null);
assert.match(checkPhone("", "9840007925"), /country code/i);
assert.match(checkPhone("+977", "9840"), /at least 8/); // too short to be a real line
assert.match(checkPhone("+977", "09840007925"), /leading 0/); // local-format habit
assert.match(checkPhone("+977", "98400079259840007925"), /maximum/); // over E.164's 15
assert.match(checkPhone("+999", "9840007925"), /listed/); // not a code we offer

/* ── Address: no stray comma when the optional parts are blank ───────────── */

const LIVE_ADDRESS = {
  tole: "Sinamangal Kalimatidol",
  ward: "",
  city: "Kathmandu",
  district: "",
  postal: "44600",
};
/* Byte-identical to the row on the live site today — nothing moves on deploy. */
assert.equal(composeAddress(LIVE_ADDRESS), "Sinamangal Kalimatidol, Kathmandu 44600");

assert.equal(
  composeAddress({ ...LIVE_ADDRESS, ward: "9", district: "Kathmandu" }),
  "Sinamangal Kalimatidol, Ward 9, Kathmandu, Kathmandu 44600",
);
assert.equal(composeAddress({ tole: "", ward: "", city: "Kathmandu", district: "", postal: "" }), "Kathmandu");
assert.equal(composeAddress({ tole: "", ward: "", city: "", district: "", postal: "" }), "");

assert.equal(checkPostal("44600"), null);
assert.match(checkPostal("446"), /5 digits/);
assert.equal(checkPostal("44 600"), null); // spacing is tidied, not rejected

/* ── Amenities: ticking a list, and round-tripping the customs ───────────── */

const LIVE_AMENITIES =
  "Air conditioning · Free WiFi · Private bathroom · Flat-screen TV · Tea/coffee maker · Minibar · Desk · Soundproofing";
const parsed = parseAmenities(LIVE_AMENITIES);
/* Every one of the eight already on the live site is in the catalogue, so
   nobody opens the page to find their own data flagged as "custom". */
assert.deepEqual(parsed.custom, []);
assert.equal(parsed.picked.length, 8);
assert.equal(composeAmenities(parsed.picked, parsed.custom), LIVE_AMENITIES);

const withCustom = parseAmenities("Free WiFi · Prayer mat on request · Desk");
assert.deepEqual(withCustom.picked, ["Free WiFi", "Desk"]);
assert.deepEqual(withCustom.custom, ["Prayer mat on request"]);
assert.equal(
  composeAmenities(withCustom.picked, withCustom.custom),
  "Free WiFi · Desk · Prayer mat on request",
);

/* ── Room size: one number, two units, no drift ──────────────────────────── */

assert.equal(composeRoomSize("42", "m2", true), "Rooms start at about 42 m² (452 sq ft), bathroom included.");
assert.equal(composeRoomSize("42", "m2", false), "Rooms start at about 42 m² (452 sq ft).");
assert.equal(composeRoomSize("450", "sqft", true), "Rooms start at about 450 sq ft (42 m²), bathroom included.");
assert.equal(composeRoomSize("", "m2", true), "");
assert.match(checkRoomSize("42 m2"), /Just the number/); // the unit is its own control
assert.equal(checkRoomSize("42"), null);

/* ── Arrival: distances stay numbers, notes stay sentences ───────────────── */

const LIVE_ARRIVAL = [
  ["TIA terminal", "950 m"],
  ["Main entrance", "1.1 km"],
  ["Front desk", "Through the night"],
  ["Airport shuttle", "On request, paid"],
];
const rows = parseArrival(LIVE_ARRIVAL);
assert.deepEqual(rows[0], { place: "TIA terminal", kind: "distance", value: "950", unit: "m" });
assert.deepEqual(rows[1], { place: "Main entrance", kind: "distance", value: "1.1", unit: "km" });
assert.equal(rows[2].kind, "note"); // "Through the night" is not a distance
assert.equal(rows[3].kind, "note");
/* Round-trips byte-identical, so ContactPanel's /terminal|airport|tia/i lookup
   and the "950 m from the airport" line keep reading what they read today. */
assert.deepEqual(composeArrival(rows), LIVE_ARRIVAL);

assert.match(checkArrivalValue("distance", "950 m"), /just the number/i);
assert.equal(checkArrivalValue("distance", "950"), null);
assert.equal(checkArrivalValue("note", "Through the night"), null);
assert.match(checkArrivalValue("note", "   "), /what to say/i);

/* ── Links: pinned to the service they claim to be from ──────────────────── */

assert.equal(checkUrl("https://www.booking.com/hotel/np/thakali-inn.html", BOOKING_HOSTS), null);
assert.equal(checkUrl("https://www.instagram.com/hotelthakaliin/", ["instagram.com"]), null);
/* The live Facebook row is a profile.php?id=… link — a query string must pass. */
assert.equal(
  checkUrl("https://www.facebook.com/profile.php?id=61583854952907", ["facebook.com"]),
  null,
);
/* Both the desktop maps URL and the phone share sheet's short link. */
assert.equal(checkUrl(LIVE_MAPS_URL, MAPS_HOSTS, "Google Maps"), null);
assert.equal(checkUrl("https://maps.app.goo.gl/abc123", MAPS_HOSTS, "Google Maps"), null);
/* No scheme at all — the shape someone gets by copying the visible text of a
   link rather than the link. URL() throws, and the message says so. */
assert.match(checkUrl("www.booking.com/hotel/np", BOOKING_HOSTS), /complete link/i);
/* A typo'd scheme still PARSES ("htps:" is a legal scheme), so it falls through
   to the https check rather than the unparseable one. Both messages are right;
   this pins which one a mistyped paste actually gets. */
assert.match(checkUrl("htps://bookng.com/x", BOOKING_HOSTS), /https/);
assert.match(checkUrl("http://www.booking.com/x", BOOKING_HOSTS), /https/);
assert.match(
  checkUrl("https://www.facebook.com/x", ["instagram.com"], "Instagram"),
  /this row is for Instagram/,
);
/* Dot-boundary matched, not substring-matched: a lookalike host must not pass. */
assert.match(checkUrl("https://evilinstagram.com/x", ["instagram.com"], "Instagram"), /this row is for/);
assert.match(checkUrl("", BOOKING_HOSTS), /Paste/);

/* ── Coordinates, plus code, email ───────────────────────────────────────── */

assert.equal(checkLat("27.6981357"), null);
assert.equal(checkLng("85.3540451"), null);
assert.match(checkLat("91"), /between/);
assert.match(checkLng("181"), /between/);
assert.equal(checkLat("-33.8688"), null);
assert.match(checkLat("27.69813571234"), /plain number/); // paste artefact, overflows the box
assert.match(checkLat("north"), /plain number/);

assert.equal(checkPlusCode("M9X3+7J Kathmandu"), null);
assert.equal(checkPlusCode("m9x3+7j kathmandu"), null); // the code is uppercased before checking
/* Only the code. The town after it is a place name, and uppercasing the whole
   string rewrote the live row into "M9X3+7J KATHMANDU" — which /contact prints. */
assert.equal(tidyPlusCode("m9x3+7j Kathmandu"), "M9X3+7J Kathmandu");
assert.equal(tidyPlusCode("  m9x3+7j  "), "M9X3+7J");
assert.match(checkPlusCode("M9X3 7J"), /looks like M9X3\+7J/); // no plus
assert.match(checkPlusCode("MAX3+7J"), /looks like/); // A is not in the OLC alphabet

assert.equal(checkEmail("hotelthakaliinn1@gmail.com"), null);
assert.equal(checkEmail("  HotelThakaliInn1@Gmail.com "), null); // tidied, not rejected
/* NOT folded to a different mailbox — this address receives mail, so a +tag is
   routing the hotel chose, unlike the whitelist's identity comparison. */
assert.equal(checkEmail("bookings+web@hotel.com"), null);
assert.match(checkEmail("not-an-email"), /@/);
assert.match(checkEmail(""), /Enter an address/);

/* ── The email lock is a role check, not a disabled attribute ────────────── */

assert.equal(canEditEmail("owner"), true);
assert.equal(canEditEmail("developer"), true);
assert.equal(canEditEmail("staff"), false);
assert.equal(canEditEmail(""), false);

/* ── Vocabularies are internally consistent ──────────────────────────────── */

/* A duplicate country code makes two <option>s with the same value, and the
   select silently shows the wrong country for a stored number. */
assert.equal(new Set(COUNTRY_CODES.map((c) => c.code)).size, COUNTRY_CODES.length);
assert.equal(new Set(AMENITIES).size, AMENITIES.length);
/* SOCIAL_PLATFORMS labels are the keys SiteFooter's icon map is keyed by, so a
   duplicate would mean one platform's icon shadowing another's. */
assert.equal(new Set(SOCIAL_PLATFORMS.map((p) => p.label)).size, SOCIAL_PLATFORMS.length);
/* Every platform's own placeholder must pass its own host check — otherwise the
   example shown in the empty field is one the field would reject. */
for (const p of SOCIAL_PLATFORMS) {
  assert.equal(
    checkUrl(p.placeholder, p.hosts, p.label),
    null,
    `placeholder fails its own host check: ${p.label}`,
  );
  assert.ok(p.hosts.length > 0, `no hosts for ${p.label}`);
}
/* parseArrival builds its regex out of ARRIVAL_UNITS; a unit containing a regex
   metacharacter would compile into something that matches the wrong things. */
for (const u of ARRIVAL_UNITS) assert.match(u, /^[a-z ]+$/);

/* ── The live database, end to end ────────────────────────────────────────────
   Every settings row as it stands on hotelthakaliinn.com right now, plus the
   ten migration 0017 adds. Two things have to be true of it, and they are the
   two that would actually hurt:

   1. It is already valid. If the new rules rejected the data that is on the
      site, the first person to open the console would be met with a wall of red
      over values nobody had touched — and would learn to distrust the lamps.
   2. It composes back to itself. Six public components read these strings; a
      composer that "improves" one of them changes the live site on the next
      save without anyone asking for it. */

const LIVE_CONFIG = {
  phone: "+977-9840007925",
  email: "hotelthakaliinn1@gmail.com",
  booking_url: "https://www.booking.com/hotel/np/thakali-inn.html",
  socials: JSON.stringify([
    { label: "Instagram", href: "https://www.instagram.com/hotelthakaliin/" },
    { label: "Facebook", href: "https://www.facebook.com/profile.php?id=61583854952907" },
  ]),
  address: "Sinamangal Kalimatidol, Kathmandu 44600",
  maps_url: LIVE_MAPS_URL,
  lat: "27.6981357",
  lng: "85.3540451",
  plus_code: "M9X3+7J Kathmandu",
  arrival: JSON.stringify(LIVE_ARRIVAL),
  rooms_shared: LIVE_AMENITIES,
  rooms_size: "Rooms start at about 42 m² (450 sq ft), bathroom included.",
  rooms_good_to_know: JSON.stringify([
    "Breakfast buffet, 7–10 am",
    "Airport shuttle on request, paid",
    "950 m from the airport, 1.1 km from its main entrance",
  ]),
  rain_glass_day: "0",
  rain_glass_night: "0",
  // migration 0017
  addr_tole: "Sinamangal Kalimatidol",
  addr_ward: "",
  addr_city: "Kathmandu",
  addr_district: "",
  addr_postal: "44600",
  rooms_size_value: "42",
  rooms_size_unit: "m2",
  rooms_size_bathroom: "1",
  whatsapp: "",
  whatsapp_same: "1",
};

const live = toFormValues(LIVE_CONFIG);

assert.deepEqual(computeErrors(live), {}, "the live settings must already be valid");

const composed = composeAll(live);
for (const key of [
  "phone",
  "email",
  "booking_url",
  "socials",
  "address",
  "maps_url",
  "lat",
  "lng",
  "plus_code",
  "arrival",
  "rooms_shared",
  "rooms_good_to_know",
  "rain_glass_day",
  "rain_glass_night",
]) {
  assert.equal(composed[key], LIVE_CONFIG[key], `composing changed the live ${key} row`);
}

/* The one deliberate exception, and the reason the field became a number: the
   stored line says 450 sq ft, but 42 m² is 452. Two hand-typed figures had
   already drifted, and only one of them can now be typed at all. */
assert.equal(composed.rooms_size, "Rooms start at about 42 m² (452 sq ft), bathroom included.");
assert.notEqual(composed.rooms_size, LIVE_CONFIG.rooms_size);

/* The switch is on, so WhatsApp is the printed number — which is exactly what
   waHref(live.phone) produced before the two rows could differ. */
assert.equal(composed.whatsapp, composed.phone);
assert.equal(composed.whatsapp_same, "1");
assert.equal(waHref(composed.whatsapp), "https://wa.me/9779840007925");

/* Untick "same as", and the two part company without disturbing the printed
   number. */
const split = composeAll({ ...live, waSame: false, waCc: "+977", waLocal: "9812345678" });
assert.equal(split.phone, "+977-9840007925");
assert.equal(split.whatsapp, "+977-9812345678");
assert.equal(split.whatsapp_same, "0");

/* Every amenity round-trips through the console untouched. */
assert.deepEqual(live.amenPicked.length, 8);
assert.equal(composed.rooms_shared, LIVE_AMENITIES);

/* ── computeErrors actually catches the things it exists for ─────────────── */

const bad = computeErrors({
  ...live,
  phoneLocal: "",
  bookingUrl: "https://example.com/x",
  socials: [{ label: "Instagram", href: "https://www.facebook.com/x" }],
  addr: { ...live.addr, city: "", postal: "4" },
  amenPicked: [],
  amenCustom: [],
});
assert.ok(bad.phone && bad.booking_url && bad["social-0"] && bad.addr_city && bad.addr_postal);
assert.ok(bad.amenities, "an empty amenity list would blank the line on /rooms");

/* A ward is optional, but a ward that is not a number would render as "Ward "
   once the digits were stripped out of it. */
assert.ok(computeErrors({ ...live, addr: { ...live.addr, ward: "nine" } }).addr_ward);
assert.deepEqual(computeErrors({ ...live, addr: { ...live.addr, ward: "9" } }), {});

/* ── The shape guard ──────────────────────────────────────────────────────────
   The console posts its whole state as one JSON field, so what reaches the
   server action is an arbitrary object off the network. computeErrors walks
   arrays; handed a string where it expects one it would throw inside a Server
   Action, which surfaces as a blank error page instead of a refusal. */

for (const hostile of [
  null,
  "not an object",
  42,
  [],
  { socials: "x", arrival: 7, good: null, addr: "nope", amenPicked: "all" },
  { socials: [null, 3, { label: 5 }], arrival: [{ kind: "sideways", unit: "furlongs" }] },
]) {
  const safe = sanitizeFormValues(hostile);
  assert.doesNotThrow(() => computeErrors(safe), `computeErrors threw on ${JSON.stringify(hostile)}`);
  assert.ok(Array.isArray(safe.socials) && Array.isArray(safe.arrival) && Array.isArray(safe.good));
  assert.doesNotThrow(() => composeAll(safe));
}

/* An unknown arrival kind or unit falls back rather than reaching the regex
   parseArrival builds, and an amenity that is not in the catalogue could only
   have arrived by hand. */
const coerced = sanitizeFormValues({
  arrival: [{ place: "x", kind: "sideways", value: "1", unit: "furlongs" }],
  amenPicked: ["Free WiFi", "Helicopter"],
});
assert.equal(coerced.arrival[0].kind, "distance");
assert.equal(coerced.arrival[0].unit, ARRIVAL_UNITS[0]);
assert.deepEqual(coerced.amenPicked, ["Free WiFi"]);

/* Lists are capped, so one save cannot become a megabyte of settings rows. */
const flood = sanitizeFormValues({ good: Array.from({ length: 500 }, (_, i) => `p${i}`) });
assert.ok(flood.good.length <= 40, "list cap not applied");

/* A round trip through the sanitiser must not disturb a legitimate save — it
   is on the path of every real one. */
assert.deepEqual(sanitizeFormValues(JSON.parse(JSON.stringify(live))), live);

console.log("settings-check: all assertions passed");
