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

  /* `tag` is the category heading, and rows sharing one are already adjacent
     because they are ordered by `position` — so grouping is one pass with no
     sort and no lookup table, and the order stays entirely the editor's to set.
     A row whose tag is blank opens its own unheaded group rather than being
     filed under whichever category happened to precede it. */
  const groups: { tag: string; items: { row: (typeof rows)[number]; n: number }[] }[] = [];
  rows.forEach((row, n) => {
    const last = groups.at(-1);
    if (last && last.tag === row.tag && row.tag) last.items.push({ row, n });
    else groups.push({ tag: row.tag, items: [{ row, n }] });
  });

  return (
    <div className="am-page">
      <header className="am-head">
        <p className="am-eyebrow">Amenities · Sinamangal</p>
        <h1>What every room has, and what is just outside the door</h1>
      </header>

      {groups.map((group, gi) => (
        <section className="am-group" key={group.tag || `untagged-${gi}`}>
          {group.tag && <h2 className="am-group-head">{group.tag}</h2>}

          <ul className="am-grid">
            {group.items.map(({ row: r, n }) => (
              <li
                className="am-card"
                key={r.slug}
                data-shot={r.image ? "" : undefined}
                /* Capped: the stagger reads as one wave down the page at a
                   dozen cards and as a page that will not finish loading at
                   sixty-eight. */
                style={{ animationDelay: `${100 + Math.min(n, 24) * 30}ms` }}
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
                {/* Decorative: the title beside it already says the same thing,
                    so an alt would only make a screen reader say it twice. */}
                {r.icon && (
                  <Img src={r.icon} alt="" width={28} height={28} className="am-icon" />
                )}
                <h3 className="am-title">{r.title}</h3>
                {r.paid === 1 && <p className="am-paid">Additional charge</p>}
                {r.body && <p className="am-body">{r.body}</p>}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
