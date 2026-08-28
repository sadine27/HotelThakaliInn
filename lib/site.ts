/* Every outward-facing fact about the property, in one place. These strings are
   the ones a guest acts on — a wrong digit here is a call that doesn't connect —
   so they live together rather than scattered across the components that render
   them. Source of truth is information.txt at the repo root; keep the two in step.
   BOOKING_URL in particular had already been copy-pasted into two carousels
   before this file existed. */

export const PHONE = "+977-9840007925";
/* tel: wants no separators. Derived rather than written twice so the dialled
   number can never drift from the printed one. */
export const PHONE_HREF = `tel:${PHONE.replace(/[^+\d]/g, "")}`;

export const EMAIL = "hotelthakaliinn1@gmail.com";

export const ADDRESS = "Sinamangal Kalimatidol, Kathmandu 44600";
export const PLUS_CODE = "M9X3+7J Kathmandu";

export const BOOKING_URL = "https://www.booking.com/hotel/np/thakali-inn.html";

/* The full share link — it carries the place id, so it lands on the real listing
   with its reviews rather than on a name search. */
export const MAPS_URL =
  "https://www.google.com/maps/place/Hotel+Thakali+Inn/@27.6954876,85.2756856,12z/data=!4m13!1m2!2m1!1shotel+thakali+inn!3m9!1s0x39eb19749df3068b:0x50b43cb19e3883bd!5m2!4m1!1i2!8m2!3d27.6981357!4d85.3540451";

/* Keyless embed — `output=embed` needs no Maps API key and no billing account.
   Pinned to the listing's exact coordinates (from the share link above), not to a
   name search, so the marker can't wander onto a similarly named place. */
export const MAP_EMBED_URL =
  "https://maps.google.com/maps?q=27.6981357,85.3540451&z=17&output=embed";

export const DIRECTIONS_URL =
  "https://www.google.com/maps/dir/?api=1&destination=" +
  encodeURIComponent(PLUS_CODE);

/* Accounts aren't set up yet. Entries with an empty href are filtered out at
   render, so adding one later is a single line and nothing renders until then. */
export const SOCIALS: { label: string; href: string }[] = [
  { label: "Instagram", href: "" },
  { label: "Facebook", href: "" },
];
