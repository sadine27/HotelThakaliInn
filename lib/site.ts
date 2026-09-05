/* What is left here after the property's facts moved into D1: the deploy's own
   host, and the three URLs that are DERIVED from a stored fact rather than being
   one. Keeping these as functions is what stops a second, drifting copy of the
   phone number or the coordinates existing in the settings table — there is one
   stored primitive and one rule for turning it into a link.

   The facts themselves (phone, email, address, plus code, booking and maps links,
   socials) are rows in `settings`, edited by staff. See lib/content.ts. */

/* The one place the public host is written. metadataBase, the sitemap and robots
   all derive from it, so pointing the site at the real domain was a one-line edit
   here plus the `routes` entry in wrangler.jsonc. It is deploy configuration, not
   content — staff must not be able to edit the site's own address.

   No trailing slash: everything that consumes this appends a path that starts
   with one. */
export const SITE_URL = "https://hotelthakaliinn.com";

/* The one pitch, printed in four places (page metadata, the manifest, the
   JSON-LD, the footer). One string so it can't quietly fork into four. */
export const DESCRIPTION =
  "Quiet rooms and a hot Thakali breakfast, five minutes from Tribhuvan International Airport, Kathmandu.";

/* tel: wants no separators. Derived rather than stored twice so the dialled
   number can never drift from the printed one. */
export const phoneHref = (phone: string) => `tel:${phone.replace(/[^+\d]/g, "")}`;

/* wa.me wants digits only, no plus, and a country code that is always present —
   a bare local number opens WhatsApp on "invalid contact". The stored value is
   "+977-9840007925", so stripping is usually the whole job; the two guards are
   for the day someone edits the settings row to a local format. */
export const waHref = (phone: string) => {
  let digits = phone.replace(/\D/g, "");
  if (digits.startsWith("0")) digits = digits.slice(1);
  if (!digits.startsWith("977")) digits = `977${digits}`;
  return `https://wa.me/${digits}`;
};

/* One Gmail mailbox answers to several spellings, and the admin whitelist
   compares strings, so it has to know that: googlemail.com is an alias of
   gmail.com, a +tag is routing rather than identity, and a pasted address drags
   whitespace. An owner row typed "lsharma.banstola@gmail.com" was rejected for
   an evening because the Google ID token said "@googlemail.com" — same inbox,
   different string. Both sides of that comparison run through here: what the
   accounts form stores, and what the login callback looks up. */
export const normalizeEmail = (raw: string) => {
  const [local = "", domain = ""] = raw.trim().toLowerCase().split("@");
  const host = domain === "googlemail.com" ? "gmail.com" : domain;
  /* Gmail ignores dots too, but stripping them would rewrite the address shown
     in the accounts table into something nobody typed. Domain and +tag are
     enough for the mismatch that actually bites. */
  return `${host === "gmail.com" ? local.split("+")[0] : local}@${host}`;
};

/* Keyless embed — `output=embed` needs no Maps API key and no billing account.
   Pinned to the listing's exact coordinates, not to a name search, so the marker
   can't wander onto a similarly named place. */
export const mapEmbedUrl = (lat: string, lng: string) =>
  `https://maps.google.com/maps?q=${lat},${lng}&z=17&output=embed`;

export const directionsUrl = (plusCode: string) =>
  `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(plusCode)}`;

/* "in 23 hours" beats a UTC timestamp on a screen someone is reading to decide
   whether they still have time to do the thing. Used by the permission grants
   on /admin/accounts and /admin/settings.
 *
 * It lives here, with the other pure helpers, rather than beside the grants in
 * lib/permissions.ts — that file reaches for `cloudflare:workers` and so cannot
 * be loaded by scripts/settings-check.mjs under bare node. This is the half of
 * it worth pinning with a test: SQLite writes datetime('now') as UTC with no
 * zone marker, and Date.parse reads a bare "YYYY-MM-DD HH:MM:SS" as LOCAL time,
 * which in Kathmandu is 5h45m of silent error in the direction that shows
 * access as still live after it has ended.
 *
 * Rounded down, so a grant that says "1 hour left" has at least an hour left. */
export function timeLeft(expiresAt: string, now = new Date()): string {
  const end = Date.parse(expiresAt.replace(" ", "T") + "Z");
  const mins = Math.floor((end - now.getTime()) / 60000);
  if (!Number.isFinite(mins) || mins <= 0) return "expired";
  if (mins < 60) return `${mins} min left`;
  const hours = Math.floor(mins / 60);
  return `${hours} ${hours === 1 ? "hour" : "hours"} left`;
}
