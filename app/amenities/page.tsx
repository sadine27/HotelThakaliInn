import Img from "@/components/Img";
import { section } from "@/lib/content";

export const metadata = {
  title: "Amenities | Hotel Thakali Inn",
  description:
    "What every room at Hotel Thakali Inn has, and what the property offers — Sinamangal, Kathmandu, five minutes from Tribhuvan International Airport.",
};

/* See app/rooms/page.tsx — the prerender pass runs in plain Node, where env.DB
   does not exist, and only reads this literal in the page file itself. */
export const dynamic = "force-dynamic";

export default async function Amenities() {
  const rows = await section("amenity");
  if (!rows.length) return null;

  return (
    <div className="am-page">
      <header className="am-head">
        <p className="am-eyebrow">Amenities · Sinamangal</p>
        <h1>What every room has, and what is just outside the door</h1>
      </header>

      {/* One grid rather than two ("in the room" / "on the property"). The rows
          are one section in D1, ordered by `position`, and the two groups are
          not a column — splitting them here would mean guessing from the tag
          text, and a staff edit that reworded "Every room" would silently move
          a card into the wrong half. Order is the editor's to set. */}
      <ul className="am-grid">
        {rows.map((r, i) => (
          <li
            className="am-card"
            key={r.slug}
            data-shot={r.image ? "" : undefined}
            style={{ animationDelay: `${100 + i * 40}ms` }}
          >
            {r.image && (
              <div className="am-shot">
                <Img
                  src={r.image}
                  alt={r.title}
                  fill
                  sizes="(max-width: 900px) 100vw, 33vw"
                />
              </div>
            )}
            {r.tag && <p className="am-tag">{r.tag}</p>}
            <h2 className="am-title">{r.title}</h2>
            {r.body && <p className="am-body">{r.body}</p>}
          </li>
        ))}
      </ul>
    </div>
  );
}
