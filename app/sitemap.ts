import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

/* Every public page, in the order the dial lists them. /amenities was held
   out of this file while it still rendered `null` — listing a blank page
   teaches Google that this domain serves blank pages; it was built on
   2026-08-30 and belongs here now. /breakfast is a redirect to /cuisine
   (2026-09-02), so /cuisine is what's listed.

   /admin is not a route this file has to think about: robots.ts disallows it,
   and it is behind a session anyway. */
const ROUTES = ["/", "/rooms", "/cuisine", "/amenities", "/gallery", "/contact", "/book"];

export default function sitemap(): MetadataRoute.Sitemap {
  return ROUTES.map((route) => ({
    url: `${SITE_URL}${route}`,
    lastModified: new Date(),
  }));
}
