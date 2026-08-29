import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

/* Every public page, in the order the dial lists them. /breakfast and
   /amenities were held out of this file while they still rendered `null` —
   listing a blank page teaches Google that this domain serves blank pages.
   Both were built on 2026-08-30 and belong here now.

   /admin is not a route this file has to think about: robots.ts disallows it,
   and it is behind a session anyway. */
const ROUTES = ["/", "/rooms", "/breakfast", "/amenities", "/gallery", "/contact", "/book"];

export default function sitemap(): MetadataRoute.Sitemap {
  return ROUTES.map((route) => ({
    url: `${SITE_URL}${route}`,
    lastModified: new Date(),
  }));
}
