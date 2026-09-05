"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useLive } from "./Live";
import WhatsAppMark from "./WhatsAppMark";
import { waHref } from "@/lib/site";

/* The three controls that have to exist on every page but belong to none of
   them: a way back, a way to reach a human now, and a way to book.
 *
 * One component rather than three, because they share every rule that matters —
 * mounted once in the root layout, never on /admin, and positioned against the
 * same --inset the dial uses. Three files would be three copies of that.
 *
 * The dial owns the bottom-right; these take the two corners it does not, so
 * nothing overlaps and the corner controls read as one system.
 */

const Arrow = () => (
  <svg
    width="17"
    height="17"
    viewBox="0 0 24 24"
    fill="none"
    aria-hidden="true"
  >
    <path
      d="M15 19l-7-7 7-7"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export default function FloatDock() {
  const pathname = usePathname();
  const router = useRouter();
  const live = useLive();

  /* A tool, not a guest page: the staff side gets none of this furniture. */
  if (pathname.startsWith("/admin")) return null;

  /* The number arrives with the live payload rather than from a second fetch —
     it is a settings row, and /api/live is already reading settings for the
     coordinates. Absent until that lands, and absent for good if staff clear
     the row, so the button has to be able to not exist. */
  const wa = live?.whatsapp ? waHref(live.whatsapp) : "";
  const home = pathname === "/";

  function back() {
    /* Only step back into history when we know the previous page was ours.
       Arriving from Google and pressing "back" would otherwise leave the site,
       which is not what an arrow inside the site can be allowed to mean. */
    const sameSite =
      typeof document !== "undefined" &&
      document.referrer.startsWith(window.location.origin);
    if (sameSite) router.back();
    else router.push("/");
  }

  return (
    <>
      {!home && (
        <button
          type="button"
          className="dock-back"
          onClick={back}
          aria-label="Go back"
        >
          <Arrow />
        </button>
      )}

      <div className="dock">
        {wa && (
          <a
            className="dock-wa"
            href={wa}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Message us on WhatsApp"
          >
            <WhatsAppMark />
          </a>
        )}
        {pathname !== "/book" && (
          <Link className="dock-book" href="/book">
            Book
          </Link>
        )}
      </div>
    </>
  );
}
