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

/* tel: wants no separators. Derived rather than stored twice so the dialled
   number can never drift from the printed one. */
export const phoneHref = (phone: string) => `tel:${phone.replace(/[^+\d]/g, "")}`;

/* Keyless embed — `output=embed` needs no Maps API key and no billing account.
   Pinned to the listing's exact coordinates, not to a name search, so the marker
   can't wander onto a similarly named place. */
export const mapEmbedUrl = (lat: string, lng: string) =>
  `https://maps.google.com/maps?q=${lat},${lng}&z=17&output=embed`;

export const directionsUrl = (plusCode: string) =>
  `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(plusCode)}`;
