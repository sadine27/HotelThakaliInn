"use client";

import Link from "next/link";

/* Every page here is force-dynamic and reads D1, so "the database blinked" is
   the failure this actually catches. Before it existed that was a raw 500 with
   a stack trace shape; now it is a sentence and a retry.

   Deliberately reads nothing. Offering the hotel's phone number would be the
   kind thing to do, but the number lives in the `settings` table — the same D1
   that just failed — and hardcoding a copy here means two numbers to change
   when it moves. `reset()` re-runs the render, which is the right first move
   for a transient bind failure anyway. */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="stop">
      <p className="stop-code stop-code--bad">Error</p>
      <h1 className="stop-line">Something on our side did not load.</h1>
      <div className="stop-actions">
        <button className="stop-back" type="button" onClick={reset}>
          Try again
        </button>
        <Link className="stop-back stop-back--quiet" href="/">
          Back to the front desk
        </Link>
      </div>
      {/* The digest is the only part of the error a guest may safely see, and
          it is the one part worth quoting if they tell us about it. The message
          itself can carry query text or a binding name, so it stays server-side
          in the Worker log. */}
      {error.digest && <p className="stop-digest">Reference {error.digest}</p>}
    </div>
  );
}
