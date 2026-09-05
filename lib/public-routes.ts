/* Every page a guest can open, and one phrase each that proves it rendered
 * rather than merely answered.
 *
 * Its own file, with no imports, because three very different things need the
 * same list and none of them can import each other's module: the browser probe
 * on /admin/check (a client component, so nothing touching
 * `cloudflare:workers`), the nightly health-check worker (a separate worker
 * entirely), and app/sitemap.ts.
 *
 * A 200 only proves the worker replied. The phrase proves the page actually
 * got its data — a room list that fails to read D1 still returns 200, with
 * nothing in it. */

export const PUBLIC_ROUTES = [
  "/",
  "/rooms",
  "/cuisine",
  "/amenities",
  "/gallery",
  "/contact",
  "/book",
  "/privacy",
];

/* Chosen to be content the page can only have if its data read worked, not
   chrome that is in the layout on every page. */
export const PAGE_MUST_CONTAIN: Record<string, string> = {
  "/rooms": "Deluxe",
  "/contact": "Sinamangal",
  "/cuisine": "Breakfast",
  "/privacy": "Privacy",
};
