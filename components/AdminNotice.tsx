"use client";

/* The popup that says a save landed (or did not). The server actions that
   write admin data finish by redirecting back to the same page with an ok/err
   code in the URL; this renders the matching message while that code is there,
   then strips the code so a refresh or a second identical save starts clean.

   Rendered only when a code is present, so each save mounts a fresh copy — no
   timer or dismissed state survives from one save to the next. */
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function AdminNotice({
  tone,
  message,
}: {
  tone?: "ok" | "err";
  message?: string;
}) {
  const router = useRouter();
  const [closing, setClosing] = useState(false);

  const finish = useCallback(() => {
    setClosing(true);
    const url = new URL(window.location.href);
    const hadCode = url.searchParams.has("ok") || url.searchParams.has("err");
    url.searchParams.delete("ok");
    url.searchParams.delete("err");
    if (hadCode) {
      router.replace(`${url.pathname}${url.search ? `?${url.search}` : ""}`, {
        scroll: false,
      });
    }
  }, [router]);

  /* Auto-dismiss. Errors stay up longer than successes — a failure usually
     needs reading, a success only needs acknowledging. */
  useEffect(() => {
    if (!tone) return;
    const ms = tone === "err" ? 6000 : 4000;
    const timer = window.setTimeout(finish, ms);
    return () => window.clearTimeout(timer);
  }, [tone, message, finish]);

  if (!tone || !message || closing) return null;
  const err = tone === "err";

  return (
    <div className="adm-notice" data-tone={tone} role={err ? "alert" : "status"}>
      <span className="adm-notice-mark" aria-hidden="true">
        {err ? "!" : "✓"}
      </span>
      <p className="adm-notice-msg">{message}</p>
      <button type="button" className="adm-notice-close" aria-label="Dismiss" onClick={finish}>
        ×
      </button>
    </div>
  );
}
