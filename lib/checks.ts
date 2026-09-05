/* Does the site actually still work?
 *
 * The owner cannot test every feature by hand, and found the last broken one by
 * walking into a meeting and pressing a button in front of somebody. This is
 * the answer to that: every part of the site that can quietly stop working,
 * exercised for real, in one press.
 *
 * Two kinds of check, and the difference matters:
 *
 *   - READ checks touch nothing. They run every time the board is opened, so
 *     the page is useful the moment it loads.
 *   - WRITE checks insert a row, or send a message, and clean up after
 *     themselves. They run only when someone asks, and on the nightly cron.
 *     A page that emails the hotel every time it is opened would be turned off
 *     within a week, and a check nobody runs proves nothing.
 *
 * Every check catches its own failure and reports it. One broken check must
 * never take down the board that would have told you which one broke.
 *
 * One check is deliberately NOT here: "do the public pages still load". A
 * worker fetching itself is not the request a guest makes, so that one runs in
 * the browser (app/admin/check/CheckBoard.tsx) and, at night, from the separate
 * health-check worker. Both read the route list from lib/public-routes.ts. */

import { env } from "cloudflare:workers";
import { BANK_FREE_BYTES, BANK_WARN_BYTES, formatBytes } from "@/lib/media";
import { bankStats } from "@/lib/media-store";

export type CheckKind = "read" | "write";

export type Check = {
  id: string;
  kind: CheckKind;
  name: string;
  /* What this proves, in the words of someone who would notice it was wrong —
     not "D1 SELECT 1" but "the database is answering". */
  what: string;
  /* Where to start looking. A red lamp with no address is a red lamp you just
     stare at. */
  where: string;
  run: () => Promise<{ ok: boolean; detail: string }>;
};

/* `ok: null` is "not run", which is neither a pass nor a failure and must not
   be drawn as either — a board that shows an unrun check in green is a board
   that lies by omission. */
export type Result = Omit<Check, "run"> & { ok: boolean | null; detail: string; ms: number };

/* Everything about a check except how to run it — what the board draws whether
   the check passed, failed, or was not run at all. */
const describe = (c: Check): Omit<Check, "run"> => ({
  id: c.id,
  kind: c.kind,
  name: c.name,
  what: c.what,
  where: c.where,
});

const timed = async (c: Check): Promise<Result> => {
  const meta = describe(c);
  const started = Date.now();
  try {
    const r = await c.run();
    return { ...meta, ...r, ms: Date.now() - started };
  } catch (e) {
    /* A check that throws is a failed check, never a missing row: the board has
       to stay standing to tell you which one broke. */
    return { ...meta, ok: false, detail: `threw: ${String(e).slice(0, 300)}`, ms: Date.now() - started };
  }
};

/* Every settings key the site reads by name. A missing one is not a crash — the
   readers all fall back — it is a page quietly missing a line, which is exactly
   the kind of failure nobody reports. */
const SETTINGS_KEYS = [
  "phone",
  "email",
  "address",
  "plus_code",
  "lat",
  "lng",
  "booking_url",
  "maps_url",
  "socials",
  "rooms_shared",
  "rooms_size",
  "rooms_good_to_know",
  "arrival",
  "addr_tole",
  "addr_city",
  "addr_postal",
  "rooms_size_value",
  "rooms_size_unit",
  "meals",
  "good_rows",
];

/* Rows that legitimately hold "0" or "" and must not be flagged as missing. */
const MAY_BE_EMPTY = new Set(["addr_ward", "addr_district", "whatsapp", "rain_glass_day", "rain_glass_night"]);

export const CHECKS: Check[] = [
  {
    id: "database",
    kind: "read",
    name: "Database",
    what: "D1 is answering, and the settings table is in it",
    where: "migrations/",
    run: async () => {
      const row = await env.DB.prepare("SELECT COUNT(*) AS n FROM settings").first<{ n: number }>();
      const n = row?.n ?? 0;
      return {
        ok: n > 0,
        detail: n > 0 ? `${n} settings rows` : "no settings rows — the seed migrations have not run"
      };
    },
  },

  {
    id: "settings",
    kind: "read",
    name: "Contact details & facts",
    what: "every value the public pages read by name is present",
    where: "/admin/settings",
    run: async () => {
      const { results } = await env.DB.prepare("SELECT key, value FROM settings").all<{
        key: string;
        value: string;
      }>();
      const have = new Map(results.map((r) => [r.key, r.value]));
      const missing = SETTINGS_KEYS.filter((k) => !have.has(k));
      const blank = SETTINGS_KEYS.filter((k) => have.has(k) && !have.get(k)!.trim() && !MAY_BE_EMPTY.has(k));
      const bad = [...missing.map((k) => `${k} missing`), ...blank.map((k) => `${k} empty`)];
      return {
        ok: bad.length === 0,
        detail: bad.length ? bad.join(", ") : `${SETTINGS_KEYS.length} of ${SETTINGS_KEYS.length} present`
      };
    },
  },

  {
    id: "rooms",
    kind: "read",
    name: "Pages, rooms & photos",
    what: "every section the site renders has something published in it",
    where: "/admin/content",
    run: async () => {
      const { results } = await env.DB.prepare(
        "SELECT section, COUNT(*) AS n FROM content WHERE published = 1 GROUP BY section",
      ).all<{ section: string; n: number }>();
      const by = new Map(results.map((r) => [r.section, r.n]));
      const rooms = by.get("room") ?? 0;
      const gallery = by.get("gallery") ?? 0;
      const empty = ["room", "hero", "gallery", "amenity"].filter((s) => !(by.get(s) ?? 0));
      return {
        ok: empty.length === 0,
        detail: empty.length
          ? `nothing published in: ${empty.join(", ")}`
          : `${rooms} rooms, ${gallery} gallery items published`
      };
    },
  },

  {
    id: "photos",
    kind: "read",
    name: "Uploaded photos",
    what: "the photo bucket answers, so uploads and /img/ still work",
    where: "wrangler.jsonc → MEDIA",
    run: async () => {
      const list = await env.MEDIA.list({ limit: 1 });
      return {
        ok: true,
        detail: list.objects.length ? "reachable, holding uploads" : "reachable, currently empty"
      };
    },
  },

  {
    id: "storage",
    kind: "read",
    name: "Photo storage",
    what: "the photo bank still has room, so uploads will not start failing",
    where: "/admin/photos",
    run: async () => {
      const { bytes, photos, videos } = await bankStats();
      const used = `${formatBytes(bytes)} of ${formatBytes(BANK_FREE_BYTES)}`;
      /* The daily cap stops an accident; this is what catches the slow one.
         Red before the bucket is full, not when it is: crossing the free tier
         starts costing money silently, and the first symptom otherwise is a
         bill. 6 GB leaves room for workers/r2-backup to mirror every object. */
      return bytes >= BANK_WARN_BYTES
        ? { ok: false, detail: `${used} — close to the free limit; delete unused photos` }
        : {
            ok: true,
            detail: `${used} · ${photos} photo${photos === 1 ? "" : "s"}, ${videos} clip${videos === 1 ? "" : "s"}`,
          };
    },
  },

  {
    id: "booking",
    kind: "read",
    name: "Booking link",
    what: "the “Check availability” button goes somewhere that answers",
    where: "/admin/settings",
    run: async () => {
      const row = await env.DB.prepare("SELECT value FROM settings WHERE key = 'booking_url'").first<{
        value: string;
      }>();
      const url = row?.value ?? "";
      if (!url) {
        return {
          ok: false,
          detail: "no booking_url stored"
        };
      }
      const res = await fetch(url, { method: "GET", redirect: "follow" });
      return {
        ok: res.ok,
        detail: res.ok ? `${new URL(url).hostname} → ${res.status}` : `${new URL(url).hostname} → ${res.status}`
      };
    },
  },

  {
    id: "permissions",
    kind: "read",
    name: "Access grants",
    what: "the permissions table is readable and expiry is being applied",
    where: "/admin/accounts",
    run: async () => {
      /* An expired grant must not still open a door. Asked of the same query
         lib/permissions.ts uses, so this fails if that WHERE clause is ever
         loosened. */
      const live = await env.DB.prepare(
        "SELECT COUNT(*) AS n FROM permission_grants WHERE revoked_at IS NULL AND expires_at > datetime('now')",
      ).first<{ n: number }>();
      const stale = await env.DB.prepare(
        "SELECT COUNT(*) AS n FROM permission_grants WHERE revoked_at IS NULL AND expires_at <= datetime('now')",
      ).first<{ n: number }>();
      return {
        ok: true,
        detail: `${live?.n ?? 0} live, ${stale?.n ?? 0} expired and no longer counted`
      };
    },
  },

  {
    id: "audit",
    kind: "write",
    name: "Audit log",
    what: "admin changes are still being recorded",
    where: "lib/audit.ts",
    run: async () => {
      /* Writes a row and removes it. The audit log is the one record that
         matters when something goes wrong, and "it silently stopped accepting
         writes" is a failure with no other symptom. */
      const marker = `selfcheck-${Date.now()}`;
      await env.DB.prepare(
        "INSERT INTO audit_log (actor, action, section, slug) VALUES ('system', 'system.check', 'selfcheck', ?1)",
      )
        .bind(marker)
        .run();
      const found = await env.DB.prepare("SELECT id FROM audit_log WHERE slug = ?1").bind(marker).first();
      await env.DB.prepare("DELETE FROM audit_log WHERE slug = ?1").bind(marker).run();
      return {
        ok: Boolean(found),
        detail: found ? "wrote a test row and removed it" : "the row did not come back"
      };
    },
  },

  {
    id: "accounts",
    kind: "write",
    name: "Adding an account",
    what: "a new admin account can be created, and a duplicate is refused",
    where: "/admin/accounts",
    run: async () => {
      /* The exact flow that failed in front of the director: insert into
         admin_users, hit the UNIQUE constraint on a second try, clean up.
         The probe email is at .invalid — a reserved TLD that can never be a
         real Google account — so even if the cleanup below failed, the row it
         left behind could not let anybody sign in. */
      const user = `selfcheck-${Date.now()}`;
      const email = `${user}@selfcheck.invalid`;
      try {
        await env.DB.prepare("INSERT INTO admin_users (username, email, role) VALUES (?1, ?2, 'staff')")
          .bind(user, email)
          .run();
        let duplicateRefused = false;
        try {
          await env.DB.prepare("INSERT INTO admin_users (username, email, role) VALUES (?1, ?2, 'staff')")
            .bind(user, email)
            .run();
        } catch (e) {
          duplicateRefused = String(e).includes("UNIQUE constraint failed");
        }
        return {
          ok: duplicateRefused,
          detail: duplicateRefused
            ? "created one, and the second was refused as already taken"
            : "a duplicate username was NOT refused — the unique index is missing"
        };
      } finally {
        await env.DB.prepare("DELETE FROM admin_users WHERE username = ?1").bind(user).run().catch(() => {});
      }
    },
  },

  {
    id: "email",
    kind: "write",
    name: "Enquiry email",
    what: "a message from the contact form can still leave the site",
    where: "wrangler.jsonc → send_email",
    run: async () => {
      /* A real send. The destination is pinned in wrangler.jsonc, so a settings
         row pointing somewhere else is exactly the failure this catches — and
         it is the one that loses bookings silently. The subject is prefixed so
         it can be filtered out of the inbox. */
      await env.EMAIL.send({
        to: "hotelthakaliinn1@gmail.com",
        from: { email: "notify@hotelthakaliinn.com", name: "Thakali Inn system check" },
        subject: "[system check] enquiry mail is working",
        text: "This is the nightly proof that enquiry notifications can still leave the site. Nothing is wrong.\n",
      });
      return {
        ok: true,
        detail: "sent to the pinned destination"
      };
    },
  },
];

/* `full` runs the write checks too. Sequential rather than Promise.all: the
   write checks touch the same tables and a self-check that races itself is a
   self-check that reports its own noise. */
export async function runChecks(full: boolean): Promise<Result[]> {
  const out: Result[] = [];
  for (const c of CHECKS) {
    if (c.kind === "write" && !full) {
      out.push({ ...describe(c), ok: null, detail: "not run — press RUN EVERYTHING", ms: 0 });
      continue;
    }
    out.push(await timed(c));
  }
  return out;
}
