import { headers } from "next/headers";
import { requireSession } from "@/lib/auth";
import { runChecks } from "@/lib/checks";
import CheckBoard from "./CheckBoard";

export const dynamic = "force-dynamic";

/* The board. Open it before you walk into a meeting.
 *
 * The read-only checks run on load, so the page is useful the moment it
 * appears. The three that write something — a test audit row, a test account,
 * a real email — wait for RUN EVERYTHING, because a page that mails the hotel
 * every time it is opened gets turned off inside a week.
 *
 * Everyone signed in can see this. Nothing on it is a secret, and the person
 * most likely to notice something is broken is whoever is on the desk. */

export default async function SystemCheck({
  searchParams,
}: {
  searchParams: Promise<{ full?: string }>;
}) {
  await requireSession();
  const { full } = await searchParams;

  /* Same guard as the analytics reveal, for the same reason: Next prefetches
     links, and RUN EVERYTHING sends a real email. A prefetched full run would
     mail the hotel because somebody's mouse passed over a button. */
  const h = await headers();
  const isPrefetch = h.get("Next-Router-Prefetch") === "1";
  const runFull = full === "1" && !isPrefetch;

  const results = await runChecks(runFull);

  return (
    <div className="adm-page adm-con">
      <h1>System check</h1>
      <p className="adm-sub">
        Everything that can quietly stop working, tried for real. Nothing here reads a status
        page — each row below actually did the thing it describes.
      </p>

      <CheckBoard results={results} runFull={runFull} />

      <p className="adm-con-hint">
        These same checks run by themselves every night at 4am Kathmandu time. Nothing arrives in
        the inbox unless one of them fails — silence is the good outcome.
      </p>
    </div>
  );
}
