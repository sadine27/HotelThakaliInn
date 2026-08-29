import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

/* /breakfast and /amenities are deliberately absent: both still render `null`,
   and the site is live, so listing them here invites Google to index two blank
   pages and learn that this domain serves them. They go back in when they have
   something on them. The dial still links to them — its geometry derives from
   ITEMS.length, and reshaping the site's signature object for a few days is the
   more expensive of the two costs. */
const ROUTES = ["/", "/rooms", "/gallery", "/contact"];

export default function sitemap(): MetadataRoute.Sitemap {
  return ROUTES.map((route) => ({
    url: `${SITE_URL}${route}`,
    lastModified: new Date(),
  }));
}
