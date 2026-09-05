/* Who may do what, and how someone borrows a permission they do not have.
 *
 * Before this file, authorization was `requireSession()` and nothing else on
 * every page but two. That meant the front desk could delete a room, delete a
 * photo, and read the entire audit log — not because anyone decided it should,
 * but because "is there a session" was the only question being asked.
 *
 * Four things are dangerous enough to belong to the developer alone: changing
 * the address every enquiry is sent to, seeing a visitor's IP, deleting
 * anything permanently, and editing the account table (which IS the login
 * whitelist — see app/admin/auth/google/callback/route.ts). An owner gets any
 * of them by asking for it; the developer grants it and it expires by itself
 * 24 hours later. A switch someone has to remember to turn off is a switch
 * that stays on.
 *
 * Adding a fifth capability is one line in CAPABILITIES plus the call site that
 * checks it. Nothing else in here knows what the list contains. */

import { env } from "cloudflare:workers";

export const ROLES = ["owner", "developer", "staff"] as const;
export type Role = (typeof ROLES)[number];
export const isRole = (v: string): v is Role => (ROLES as readonly string[]).includes(v);

/* `holders` hold it outright. `grantable` can be lent it for a day. Anyone in
   neither list cannot have it at all, however it is asked for. */
type CapDef = {
  label: string;
  /* Shown to whoever is being asked to grant it, and to whoever is refused —
     "you can't do that" without saying what "that" costs is how people stop
     reading the message. */
  note: string;
  holders: Role[];
  grantable: Role[];
};

export const CAPABILITIES = {
  "settings.email": {
    label: "Change the contact email",
    note: "Every enquiry from the website is sent to this address, and the destination is pinned in the deploy configuration — changing the row without a matching deploy stops that mail arriving.",
    holders: ["developer"],
    grantable: ["owner"],
  },
  "analytics.ip": {
    label: "See visitor IP addresses",
    note: "Country, city and network are visible to everyone. The address itself is personal data, and every reveal is written to the audit log.",
    holders: ["developer"],
    grantable: ["owner"],
  },
  "content.delete": {
    label: "Delete things permanently",
    note: "Rooms, pages, photos and accounts. Deletions send an alert and cannot be undone from the admin.",
    holders: ["developer"],
    grantable: ["owner"],
  },
  "accounts.manage": {
    label: "Add or change admin accounts",
    note: "This table is the login whitelist — adding a row is what lets someone sign in at all.",
    holders: ["developer"],
    grantable: ["owner"],
  },
  "audit.read": {
    label: "Read the audit log",
    note: "Every change anyone has made, with who made it. Not something the front desk needs.",
    holders: ["developer", "owner"],
    grantable: [],
  },
} as const satisfies Record<string, CapDef>;

export type Capability = keyof typeof CAPABILITIES;
export const CAPABILITY_KEYS = Object.keys(CAPABILITIES) as Capability[];
/* Only the four an owner can actually ask for; audit.read is theirs already. */
export const GRANTABLE = CAPABILITY_KEYS.filter((c) => CAPABILITIES[c].grantable.length > 0);

/* One working day, and deliberately not configurable per grant: a field for it
   would be a field someone types 720 into. */
export const GRANT_HOURS = 24;

export type Actor = { username: string; role: string };
export type Decision = {
  allowed: boolean;
  /* Which door it came through, so the screen can say "granted by the
     developer, 23:41 left" rather than just going quiet and enabling a box. */
  via: "role" | "grant" | null;
  expiresAt: string | null;
  grantedBy: string | null;
};

const DENIED: Decision = { allowed: false, via: null, expiresAt: null, grantedBy: null };

/* Fails closed, twice over: a role in neither list never reaches the database,
   and a database that cannot answer (table missing because migration 0019 has
   not run, D1 unreachable) denies rather than throwing. A migration that has
   not run yet must lock doors, not open them. */
export async function can(who: Actor, cap: Capability): Promise<Decision> {
  const def: CapDef = CAPABILITIES[cap];
  if (!isRole(who.role)) return DENIED;
  if (def.holders.includes(who.role)) return { allowed: true, via: "role", expiresAt: null, grantedBy: null };
  if (!def.grantable.includes(who.role)) return DENIED;

  const row = await env.DB.prepare(
    "SELECT expires_at, granted_by FROM permission_grants WHERE grantee = ?1 AND capability = ?2 AND revoked_at IS NULL AND expires_at > datetime('now') ORDER BY expires_at DESC LIMIT 1",
  )
    .bind(who.username, cap)
    .first<{ expires_at: string; granted_by: string }>()
    .catch(() => null);

  return row
    ? { allowed: true, via: "grant", expiresAt: row.expires_at, grantedBy: row.granted_by }
    : DENIED;
}

/* Every capability at once, for a screen that draws the whole matrix. One round
   trip: the four grantable ones share a single query rather than four. */
export async function decisions(who: Actor): Promise<Record<Capability, Decision>> {
  const out = {} as Record<Capability, Decision>;
  const asks: Capability[] = [];
  for (const cap of CAPABILITY_KEYS) {
    const def: CapDef = CAPABILITIES[cap];
    if (!isRole(who.role)) out[cap] = DENIED;
    else if (def.holders.includes(who.role)) out[cap] = { allowed: true, via: "role", expiresAt: null, grantedBy: null };
    else if (!def.grantable.includes(who.role)) out[cap] = DENIED;
    else asks.push(cap);
  }
  if (!asks.length) return out;

  const { results } = await env.DB.prepare(
    "SELECT capability, expires_at, granted_by FROM permission_grants WHERE grantee = ?1 AND revoked_at IS NULL AND expires_at > datetime('now')",
  )
    .bind(who.username)
    .all<{ capability: string; expires_at: string; granted_by: string }>()
    .catch(() => ({ results: [] as { capability: string; expires_at: string; granted_by: string }[] }));

  const live = new Map(results.map((r) => [r.capability, r]));
  for (const cap of asks) {
    const row = live.get(cap);
    out[cap] = row
      ? { allowed: true, via: "grant", expiresAt: row.expires_at, grantedBy: row.granted_by }
      : DENIED;
  }
  return out;
}

export type Grant = {
  id: number;
  capability: string;
  grantee: string;
  granted_by: string;
  granted_at: string;
  expires_at: string;
};

/* What the developer's panel lists. Expired grants drop out on their own rather
   than needing a sweep — the row stays for the audit trail, the query stops
   returning it. */
export async function liveGrants(): Promise<Grant[]> {
  return env.DB.prepare(
    "SELECT id, capability, grantee, granted_by, granted_at, expires_at FROM permission_grants WHERE revoked_at IS NULL AND expires_at > datetime('now') ORDER BY expires_at",
  )
    .all<Grant>()
    .then((r) => r.results)
    .catch(() => []);
}

/* Statements rather than writes, so the caller puts them through auditedWrite
   and the grant and its audit row land in one D1 batch — a permission that was
   handed out without a record of who handed it out is the one kind of write
   that must never be possible. */
export const grantStatement = (cap: Capability, grantee: string, grantedBy: string) =>
  env.DB.prepare(
    "INSERT INTO permission_grants (capability, grantee, granted_by, expires_at) VALUES (?1, ?2, ?3, datetime('now', ?4))",
  ).bind(cap, grantee, grantedBy, `+${GRANT_HOURS} hours`);

export const revokeStatement = (id: number) =>
  env.DB.prepare(
    "UPDATE permission_grants SET revoked_at = datetime('now') WHERE id = ?1 AND revoked_at IS NULL",
  ).bind(id);

export const isCapability = (v: string): v is Capability => v in CAPABILITIES;

/* Re-exported from lib/site.ts, which is pure and therefore loadable by the
   check script under bare node — the UTC parsing inside it is the half of this
   module worth pinning with a test. Callers import it from here so they do not
   have to know that. */
export { timeLeft } from "./site";
