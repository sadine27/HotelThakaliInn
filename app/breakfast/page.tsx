import Img from "@/components/Img";
import ServingStrip from "@/components/ServingStrip";
import { section } from "@/lib/content";

export const metadata = { title: "Breakfast | Hotel Thakali Inn" };

/* See app/rooms/page.tsx — the prerender pass runs in plain Node, where env.DB
   does not exist, and only reads this literal in the page file itself. */
export const dynamic = "force-dynamic";

/* The serving window, when a row has one. `dining` is a place rather than a
   sitting, so it carries neither and simply gets no live line. */
type Window = { from?: string; to?: string };

export default async function Breakfast() {
  const rows = await section<Window>("breakfast");
  /* An empty table is a seed that never ran, not a state worth drawing. Same
     call as the rooms page. */
  if (!rows.length) return null;

  return (
    <div className="bf-page">
      <header className="bf-head">
        <p className="bf-eyebrow">Breakfast</p>
        <h1>A hot Thakali breakfast, before the first flight</h1>
      </header>

      <ul className="bf-list">
        {rows.map((r, i) => (
          <li
            className="bf-item"
            key={r.slug}
            style={{ animationDelay: `${120 + i * 90}ms` }}
          >
            {r.image && (
              <div className="bf-shot">
                <Img
                  src={r.image}
                  alt={r.title}
                  fill
                  sizes="(max-width: 900px) 100vw, 42vw"
                  /* Only the first one is above the fold on a laptop. */
                  priority={i === 0}
                />
              </div>
            )}
            <div className="bf-copy">
              {r.tag && <p className="bf-when">{r.tag}</p>}
              <h2>{r.title}</h2>
              <p className="bf-body">{r.body}</p>
              {/* Reads the same Kathmandu clock the rest of the site runs on, so
                  a guest landing at 03:00 is told when breakfast starts rather
                  than being left to do the arithmetic. Renders nothing until
                  /api/live answers, and nothing at all if it never does — the
                  window above is stated as a plain fact either way. */}
              {r.extra.from && r.extra.to && (
                <ServingStrip from={r.extra.from} to={r.extra.to} />
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
