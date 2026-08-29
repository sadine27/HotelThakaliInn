"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

/* Tells the site it was read. One POST per page, no cookie, no id, no library.
 *
 * Mounted in the root layout beside the dial: the whole point is that every page
 * counts, and a page that forgot to include a counter is a page that looks
 * unvisited. Renders nothing.
 */
export default function ViewBeacon() {
  const pathname = usePathname();
  /* React 18 mounts effects twice in development. Without this the first page of
     every dev session is counted two or three times and nobody remembers why. */
  const sent = useRef("");

  useEffect(() => {
    if (!pathname || pathname.startsWith("/admin") || sent.current === pathname) return;
    sent.current = pathname;

    /* keepalive so the request survives the guest clicking straight through to
       the next page — without it the last page anyone reads never counts. */
    fetch("/api/view", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: pathname, referrer: document.referrer }),
      keepalive: true,
    }).catch(() => {
      /* Offline, blocked by an extension, or the route is down. A count is the
         least important thing on this page; it fails in silence. */
    });
  }, [pathname]);

  return null;
}
