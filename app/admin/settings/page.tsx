import { env } from "cloudflare:workers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getActor, requireSession } from "@/lib/auth";
import { auditedWrite } from "@/lib/audit";
import { settings, list } from "@/lib/content";
import AdminNotice from "@/components/AdminNotice";
import SubmitButton from "@/components/SubmitButton";

export const dynamic = "force-dynamic";

/* Which rows are JSON lists, so the form can say so instead of letting someone
   paste prose into a field a page will try to JSON.parse. */
const JSON_ROWS = new Set(["socials", "arrival", "rooms_good_to_know"]);

/* Stored as "1"/"0" rather than text. Checkboxes don't appear in FormData at
   all when unchecked, so these are handled as their own branch below rather
   than through the generic input/textarea loop. */
const BOOLEAN_ROWS = new Set(["rain_glass_day", "rain_glass_night"]);

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
  rain_glass_day: "Rain on glass — day",
  rain_glass_night: "Rain on glass — night",
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
  arrival: 'One per line, as "Place | distance".',
  socials: 'One per line, as "Label | https://…". Leave the link blank to hide one.',
  rooms_good_to_know: "One line per point.",
  rooms_shared: "Separated by · — this is one line of text, not a list.",
  lat: "Only change these with the map link. They place the pin.",
  lng: "Only change these with the map link. They place the pin.",
  /* The switch is a permission, not a trigger: RainGlass only draws when the
     live weather says rain or storm. Saying "droplets on the hero" without that
     made a switch that does nothing on a clear day look broken. */
  rain_glass_day: "Droplets on the homepage hero during the day — and only while it is actually raining in Kathmandu. Dry weather shows nothing either way.",
  rain_glass_night: "The same, for night, dawn and dusk. Changes take a couple of minutes to reach the site.",
};

/* Grouped for scanning, not alphabetical — thirteen fields in one flat list
   reads as a wall with no way to jump to "the phone number". Any key not
   listed here (there should be none) falls into its own "Other" group rather
   than silently vanishing. */
const GROUPS: { label: string; keys: string[] }[] = [
  { label: "Contact", keys: ["phone", "email", "booking_url", "socials"] },
  { label: "Location", keys: ["address", "maps_url", "lat", "lng", "plus_code", "arrival"] },
  { label: "Rooms", keys: ["rooms_shared", "rooms_size", "rooms_good_to_know"] },
  { label: "Effects", keys: ["rain_glass_day", "rain_glass_night"] },
];

export default async function Settings({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; err?: string }>;
}) {
  await requireSession();
  const config = await settings();
  const { ok, err } = await searchParams;

  /* The save action below redirects back here with a code; this turns the code
     into the popup's copy. No code, no popup. */
  let noticeTone: "ok" | "err" | undefined;
  let noticeMessage: string | undefined;
  if (err === "json") {
    noticeTone = "err";
    noticeMessage = "Nothing was saved — a value wouldn't parse as JSON.";
  } else if (ok === "partial") {
    noticeTone = "ok";
    noticeMessage = "Saved — fields with broken JSON were left as they were.";
  } else if (ok === "saved") {
    noticeTone = "ok";
    noticeMessage = "Saved — the site now shows the new details.";
  }
  /* JSON_ROWS keys are stored as JSON but shown here as one plain line per
   entry — staff type "Label | value", not braces and quotes. */
function displayValue(key: string, raw: string): string {
  if (key === "socials") {
    return list<{ label: string; href: string }>(raw)
      .map((s) => `${s.label} | ${s.href}`)
      .join("\n");
  }
  if (key === "arrival") {
    return list<[string, string]>(raw)
      .map(([place, distance]) => `${place} | ${distance}`)
      .join("\n");
  }
  if (key === "rooms_good_to_know") {
    return list<string>(raw).join("\n");
  }
  return raw;
}

const known = new Set(GROUPS.flatMap((g) => g.keys));
  const groups = [...GROUPS, { label: "Other", keys: Object.keys(config).filter((k) => !known.has(k)).sort() }];

  async function save(formData: FormData) {
    "use server";
    await requireSession();

    /* How many JSON rows the check below threw out, so the redirect can say
       whether the batch saved whole or left the broken rows standing. */
    let droppedJson = 0;

    const rows = [...formData.entries()]
      /* Only the keys we prefixed ourselves. A Server Action's FormData also
         carries the framework's own fields, and an UPDATE loop over all of them
         writes junk. Booleans are handled separately below — an unchecked
         checkbox never appears in FormData at all, so this loop can't see
         "off" for them. */
      .filter(([k]) => k.startsWith("s.") && !BOOLEAN_ROWS.has(k.slice(2)))
      .map(([k, v]) => [k.slice(2), String(v)] as const)
      /* JSON_ROWS keys arrive here as plain lines ("Label | value") from the
         structured textareas below, not JSON — this rebuilds the JSON the
         rest of the site (list()) still expects to read. */
      .map(([key, value]): readonly [string, string] => {
        if (key === "socials") {
          const parsed = value
            .split("\n")
            .map((l) => l.trim())
            .filter(Boolean)
            .map((line) => {
              const i = line.indexOf("|");
              const label = (i < 0 ? line : line.slice(0, i)).trim();
              const href = (i < 0 ? "" : line.slice(i + 1)).trim();
              return { label, href };
            });
          return [key, JSON.stringify(parsed)];
        }
        if (key === "arrival") {
          const parsed = value
            .split("\n")
            .map((l) => l.trim())
            .filter(Boolean)
            .map((line): [string, string] => {
              const i = line.indexOf("|");
              return i < 0 ? [line, ""] : [line.slice(0, i).trim(), line.slice(i + 1).trim()];
            });
          return [key, JSON.stringify(parsed)];
        }
        if (key === "rooms_good_to_know") {
          const parsed = value
            .split("\n")
            .map((l) => l.trim())
            .filter(Boolean);
          return [key, JSON.stringify(parsed)];
        }
        return [key, value];
      })
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
          droppedJson++;
          return false;
        }
      });

    for (const key of BOOLEAN_ROWS) rows.push([key, formData.has(`s.${key}`) ? "1" : "0"]);

    /* Nothing survived the JSON check — the whole save would be a no-op, and
       "Saved" would be a lie. Say what actually happened instead. */
    if (!rows.length) {
      redirect(droppedJson ? "/admin/settings?err=json" : "/admin/settings");
    }

    /* Resolved before the write, same reason as every other auditedWrite call
       site: a D1 batch can't feed one statement's output into another's
       bindings, so "before" has to come from its own SELECT first. */
    const keys = rows.map(([k]) => k);
    const placeholders = keys.map((_, i) => `?${i + 1}`).join(", ");
    const { results: existing } = await env.DB.prepare(
      `SELECT key, value FROM settings WHERE key IN (${placeholders})`,
    )
      .bind(...keys)
      .all<{ key: string; value: string }>();
    const before = Object.fromEntries(existing.map((r) => [r.key, r.value]));
    const after = Object.fromEntries(rows);

    /* UPDATE, never INSERT: the thirteen keys are a fixed vocabulary that pages
       read by name, so a new row would be a value nothing renders. */
    const stmt = env.DB.prepare("UPDATE settings SET value = ?2 WHERE key = ?1");
    await auditedWrite(
      rows.map(([k, v]) => stmt.bind(k, v)),
      {
        actor: await getActor(),
        action: "settings.update",
        before,
        after,
      },
    );
    /* Back to the form with the outcome in the URL; the popup reads it from
       there. */
    redirect(droppedJson ? "/admin/settings?ok=partial" : "/admin/settings?ok=saved");
  }

  return (
    <form className="adm-page" action={save}>
      <Link href="/admin" className="adm-back">
        ← Back
      </Link>
      <h1>Contact details &amp; property facts</h1>
      <p className="adm-sub">Saved straight to the live site</p>
      <AdminNotice tone={noticeTone} message={noticeMessage} />

      {groups.map(
        (group) =>
          group.keys.length > 0 && (
            <fieldset className="adm-fieldset" key={group.label}>
              <legend>{group.label}</legend>
              {group.keys.map((key) =>
                /* A checkbox is not a text field. Left in the shared markup it
                   inherited `.adm input { width: 100% }` and rendered as a
                   full-width stretched box with the label stranded above it —
                   no readable on/off state, which is what "the toggle doesn't
                   work" looked like. .adm-check is the wrapper the content
                   editor's checkboxes already use. */
                BOOLEAN_ROWS.has(key) ? (
                  <div className="adm-field" key={key}>
                    <label className="adm-check">
                      <input
                        type="checkbox"
                        id={`s.${key}`}
                        name={`s.${key}`}
                        defaultChecked={config[key] === "1"}
                      />
                      <span>{LABELS[key] ?? key.replace(/_/g, " ")}</span>
                    </label>
                    {HINTS[key] && <small>{HINTS[key]}</small>}
                  </div>
                ) : (
                <div className="adm-field" key={key}>
                  <label htmlFor={`s.${key}`}>{LABELS[key] ?? key.replace(/_/g, " ")}</label>
                  {LONG.has(key) ? (
                    <textarea
                      id={`s.${key}`}
                      name={`s.${key}`}
                      defaultValue={displayValue(key, config[key])}
                      rows={JSON_ROWS.has(key) ? 4 : 3}
                    />
                  ) : (
                    <input id={`s.${key}`} name={`s.${key}`} defaultValue={config[key]} />
                  )}
                  {HINTS[key] && <small>{HINTS[key]}</small>}
                </div>
                ),
              )}
            </fieldset>
          ),
      )}

      <SubmitButton type="submit" pendingText="Saving…">
        Save
      </SubmitButton>
    </form>
  );
}
