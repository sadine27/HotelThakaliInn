import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";
import { PUBLIC_ROUTES } from "@/lib/public-routes";

/* Every public page, in the order the dial lists them. /amenities was held
   out of this file while it still rendered `null` — listing a blank page
   teaches Google that this domain serves blank pages; it was built on
   2026-08-30 and belongs here now. /breakfast is a redirect to /cuisine
   (2026-09-02), so /cuisine is what's listed.

   The list itself lives in lib/public-routes.ts, shared with the system check
   that opens every one of these pages — a page that is checked but not listed,
   or listed but not checked, is how one of them goes quiet unnoticed.

   /admin is not a route this file has to think about: robots.ts disallows it,
   and it is behind a session anyway. */

export default function sitemap(): MetadataRoute.Sitemap {
  return PUBLIC_ROUTES.map((route) => ({
    url: `${SITE_URL}${route}`,
    lastModified: new Date(),
  }));
}
