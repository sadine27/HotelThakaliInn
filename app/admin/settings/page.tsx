import { env } from "cloudflare:workers";
import Link from "next/link";
import { requireSession } from "@/lib/auth";
import { settings } from "@/lib/content";

export const dynamic = "force-dynamic";

/* Which rows are JSON lists, so the form can say so instead of letting someone
   paste prose into a field a page will try to JSON.parse. */
const JSON_ROWS = new Set(["socials", "arrival", "rooms_good_to_know"]);

/* Long values get a textarea; everything else is one line. */
const LONG = new Set(["address", "maps_url", "rooms_shared", "rooms_size", ...JSON_ROWS]);

/* The keys are column names. "lng" and "plus_code" mean nothing to whoever is on
   the front desk, and a settings screen that needs explaining is a settings
   screen nobody touches. */
const LABELS: Record<string, string> = {
  address: "Address",
  arrival: "Arrival distances",
  booking_url: "Booking.com link",
  email: "Email address",
  lat: "Latitude",
  lng: "Longitude",
  maps_url: "Google Maps link",
  phone: "Phone number",
  plus_code: "Google Plus Code",
  rooms_good_to_know: "Rooms — good to know",
  rooms_shared: "What every room has",
  rooms_size: "Room size",
  socials: "Social links",
};

const HINTS: Record<string, string> = {
  /* Not a nicety. wrangler.jsonc pins allowed_destination_addresses to one
     address so a bug in the public contact endpoint can never turn the hotel's
     domain into an open relay — which means changing this row without a matching
     deploy silently stops the notification mail. The row still drives who the
     site *shows*, so it is editable; it just cannot be edited alone. */
  email: "Shown on the site, and where enquiries are sent. Changing it needs a matching change in wrangler.jsonc, or the notification email stops arriving.",
  arrival: 'Pairs of ["place", "distance"].',
  socials: 'Pairs of {"label", "href"}. Leave href empty to hide one.',
  rooms_good_to_know: "One line per point.",
  rooms_shared: "Separated by · — this is one line of text, not a list.",
  lat: "Only change these with the map link. They place the pin.",
  lng: "Only change these with the map link. They place the pin.",
};

export default async function Settings() {
  await requireSession();
  const config = await settings();
  const keys = Object.keys(config).sort();

  async function save(formData: FormData) {
    "use server";
    await requireSession();

    const rows = [...formData.entries()]
      /* Only the keys we prefixed ourselves. A Server Action's FormData also
         carries the framework's own fields, and an UPDATE loop over all of them
         writes junk. */
      .filter(([k]) => k.startsWith("s."))
      .map(([k, v]) => [k.slice(2), String(v)] as const)
      /* A broken JSON row would blank a whole section of the public site, so a
         value that will not parse is dropped from the batch and the old one
         stands. lib/content.ts's list() already falls back rather than throwing,
         but a silently empty section is a bad way to learn you typed it wrong.
         This has to be part of the same expression that builds the batch —
         validating in a separate loop reads fine and writes the bad value
         anyway. */
      .filter(([key, value]) => {
        if (!JSON_ROWS.has(key)) return true;
        try {
          JSON.parse(value);
          return true;
        } catch {
          return false;
        }
      });

    if (!rows.length) return;

    /* UPDATE, never INSERT: the thirteen keys are a fixed vocabulary that pages
       read by name, so a new row would be a value nothing renders. */
    const stmt = env.DB.prepare("UPDATE settings SET value = ?2 WHERE key = ?1");
    await env.DB.batch(rows.map(([k, v]) => stmt.bind(k, v)));
  }

  return (
    <form className="adm-page" action={save}>
      <Link href="/admin" className="adm-back">
        ← Back
      </Link>
      <h1>Contact details &amp; property facts</h1>
      <p className="adm-sub">Saved straight to the live site</p>

      {keys.map((key) => (
        <div className="adm-field" key={key}>
          <label htmlFor={`s.${key}`}>{LABELS[key] ?? key.replace(/_/g, " ")}</label>
          {LONG.has(key) ? (
            <textarea id={`s.${key}`} name={`s.${key}`} defaultValue={config[key]} rows={3} />
          ) : (
            <input id={`s.${key}`} name={`s.${key}`} defaultValue={config[key]} />
          )}
          {HINTS[key] && <small>{HINTS[key]}</small>}
          {JSON_ROWS.has(key) && (
            <small>Keep the brackets and quotes. If they are wrong, this row is left as it was.</small>
          )}
        </div>
      ))}

      <button type="submit">Save</button>
    </form>
  );
}
