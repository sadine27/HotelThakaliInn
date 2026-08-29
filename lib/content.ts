import { env } from "cloudflare:workers";

/* The read side of the `content` table. Every page that renders a list of cards
   goes through `section()`; nothing else in the app talks to D1 directly.

   Server-only by construction — `cloudflare:workers` does not resolve in a client
   bundle — so importing this from a "use client" file fails at build rather than
   at 2am. */

export type Item<E = Record<string, never>> = {
  slug: string;
  title: string;
  tag: string;
  body: string;
  href: string;
  image: string;
  video: string;
  extra: E;
  /* Only ever anything but 1 when section() was called with includeHidden — the
     admin editor needs it to draw the "Show on the site" checkbox. Public pages
     never see a 0 here, because the query already filtered those out. */
  published: number;
};

/* `extra` is JSON in the column and is parsed here, so no caller has to remember
   which of the ten fields is secretly a string.

   `includeHidden` is for the admin editor only. Without it the "Show on the
   site" checkbox is a one-way door: unticking a row drops it from this query,
   so it vanishes from the editor too and there is no way to tick it back. Every
   public page calls this with one argument and is unaffected. */
export async function section<E = Record<string, never>>(
  name: string,
  includeHidden = false,
): Promise<Item<E>[]> {
  const { results } = await env.DB.prepare(
    "SELECT slug, title, tag, body, href, image, video, extra, published FROM content WHERE section = ?1 AND (published = 1 OR ?2 = 1) ORDER BY position",
  )
    .bind(name, includeHidden ? 1 : 0)
    .all<Omit<Item, "extra"> & { extra: string; published: number }>();
  return results.map((r) => ({ ...r, extra: JSON.parse(r.extra) as E }));
}

/* Thirteen rows. Reading them all is one round trip; reading them one key at a
   time is thirteen, and every page wants at least three. */
export async function settings(): Promise<Record<string, string>> {
  const { results } = await env.DB.prepare("SELECT key, value FROM settings").all<{
    key: string;
    value: string;
  }>();
  return Object.fromEntries(results.map((r) => [r.key, r.value]));
}

/* Settings values that are lists are stored as JSON strings. A missing or
   malformed row falls back rather than taking the page down with it — staff can
   edit these, and a page that 500s is worse than one missing a line. */
export function list<T>(value: string | undefined, fallback: T[] = []): T[] {
  if (!value) return fallback;
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? (parsed as T[]) : fallback;
  } catch {
    return fallback;
  }
}
