"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { Result } from "@/lib/checks";
import { PUBLIC_ROUTES, PAGE_MUST_CONTAIN } from "@/lib/public-routes";

/* The board, and the one check that cannot run on the server.
 *
 * Everything else is a server result handed in as a prop. "Do the public pages
 * still load" is fetched here, in the browser, because the worker fetching
 * itself is not the same request a guest makes: locally it answers from inside
 * the same isolate and got /privacy wrong, and in production it is a full
 * round-trip out to the edge and back for every route. A browser fetch is
 * exactly what a guest does, which is what the row claims to prove.
 *
 * The summary is computed from the merged list rather than the server's alone —
 * a red row under a heading that says everything passed is worse than no
 * heading at all. */

const PROBE: Omit<Result, "ok" | "detail" | "ms"> = {
  id: "pages",
  kind: "read",
  name: "Public pages",
  what: "every page a guest can open still loads, with its content in it",
  where: "app/",
};

async function probePages(): Promise<Pick<Result, "ok" | "detail" | "ms">> {
  const started = Date.now();
  const bad: string[] = [];
  for (const route of PUBLIC_ROUTES) {
    try {
      /* Cache-busted as well as no-store: a self-check that reads a stored
         answer is checking what the site used to do. */
      const res = await fetch(`${route}?selfcheck=${Date.now()}`, { cache: "no-store" });
      if (!res.ok) {
        bad.push(`${route} → ${res.status}`);
        continue;
      }
      const needle = PAGE_MUST_CONTAIN[route];
      if (needle && !(await res.text()).includes(needle)) {
        bad.push(`${route} loaded but has no “${needle}”`);
      }
    } catch (e) {
      bad.push(`${route} → ${String(e).slice(0, 80)}`);
    }
  }
  return {
    ok: bad.length === 0,
    detail: bad.length ? bad.join("; ") : `${PUBLIC_ROUTES.length} of ${PUBLIC_ROUTES.length} loading`,
    ms: Date.now() - started,
  };
}

export default function CheckBoard({ results, runFull }: { results: Result[]; runFull: boolean }) {
  const [pages, setPages] = useState<Result>({ ...PROBE, ok: null, detail: "opening every page…", ms: 0 });

  useEffect(() => {
    let live = true;
    probePages().then((r) => live && setPages({ ...PROBE, ...r }));
    return () => {
      live = false;
    };
  }, []);

  /* Third, where the server's own "pages" check used to sit, so the list reads
     in the same order it always did. */
  const all = [...results.slice(0, 3), pages, ...results.slice(3)];
  const failed = all.filter((r) => r.ok === false);
  const skipped = all.filter((r) => r.ok === null);
  const passed = all.filter((r) => r.ok === true);

  return (
    <>
      <div
        className="adm-chk-summary"
        data-state={failed.length ? "bad" : skipped.length ? "part" : "ok"}
        role="status"
      >
        <strong>
          {failed.length
            ? `${failed.length} ${failed.length === 1 ? "check has" : "checks have"} failed`
            : skipped.length
              ? `${passed.length} passed, ${skipped.length} not run`
              : `All ${passed.length} checks passed`}
        </strong>
        <span>
          {runFull
            ? "Everything was run, including a real test email."
            : "The checks that write something have not been run."}
        </span>
        {/* prefetch={false} on both: RUN EVERYTHING sends a real email, and
            Next prefetches a link the mouse merely passes over. */}
        <Link className="adm-btn adm-btn--go" href="/admin/check?full=1" prefetch={false}>
          Run everything
        </Link>
        <Link className="adm-btn" href="/admin/check" prefetch={false}>
          Re-run the safe ones
        </Link>
      </div>

      <fieldset className="adm-con-panel">
        <legend>Results</legend>
        <ul className="adm-chk-list">
          {all.map((r) => (
            <li key={r.id} data-state={r.ok === null ? "skip" : r.ok ? "ok" : "bad"}>
              <span className="adm-chk-lamp" aria-hidden="true" />
              <span className="adm-chk-name">
                {r.name}
                <em>{r.what}</em>
              </span>
              <span className="adm-chk-detail">
                {r.detail}
                {r.ok === false && <b>→ {r.where}</b>}
              </span>
              <span className="adm-chk-state">{r.ok === null ? "not run" : r.ok ? "pass" : "FAIL"}</span>
              <span className="adm-chk-ms">{r.ms ? `${r.ms} ms` : ""}</span>
            </li>
          ))}
        </ul>
      </fieldset>
    </>
  );
}
