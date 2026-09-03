import AmenityGlyph from "@/components/AmenityGlyph";
import { list, section, settings } from "@/lib/content";

export const metadata = {
  title: "Amenities | Hotel Thakali Inn",
  description:
    "What every room at Hotel Thakali Inn has, and what the property offers — Sinamangal, Kathmandu, five minutes from Tribhuvan International Airport.",
};

/* See app/rooms/page.tsx — the prerender pass runs in plain Node, where
   env.DB does not exist, and only reads this literal in the page file
   itself. */
export const dynamic = "force-dynamic";

export default async function Amenities() {
  const [rows, config] = await Promise.all([section("amenity"), settings()]);
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

  /* Four facts already sitting in settings/content, said plainly instead of
     as a stat-card grid — the arrival table exists so a guest can get the
     airport distance without doing the subtraction themselves. */
  const arrival = list<[string, string]>(config.arrival);
  const distance = arrival.find(([label]) => label === "TIA terminal")?.[1];
  const frontDesk = arrival.find(([label]) => label === "Front desk")?.[1];
  const restaurant = rows.find((r) => r.slug === "main-restaurant")?.body;
  const highlights = [
    distance && `${distance} from Tribhuvan International Airport`,
    frontDesk && `Front desk staffed ${frontDesk.toLowerCase()}`,
    "Free WiFi in every room",
    restaurant && restaurant.split(".")[0],
  ].filter((f): f is string => Boolean(f));

  return (
    <div className="am-page">
      <header className="am-head">
        <p className="am-eyebrow">Amenities · Sinamangal</p>
        <h1>What every room has, and what is just outside the door</h1>
      </header>

      {highlights.length > 0 && (
        <ul className="am-highlights">
          {highlights.map((h) => (
            <li key={h}>{h}</li>
          ))}
        </ul>
      )}

      {groups.map((group, gi) => (
        <section className="am-group" key={group.tag || `untagged-${gi}`}>
          {group.tag && (
            <div className="am-group-head">
              <AmenityGlyph category={group.tag} />
              <h2>{group.tag}</h2>
            </div>
          )}

          <ul className="am-grid">
            {group.items.map(({ row: r, n }) => (
              <li
                className="am-card"
                key={r.slug}
                /* Capped: the stagger reads as one wave down the page at a
                   dozen cards and as a page that will not finish loading at
                   sixty-eight. */
                style={{ animationDelay: `${100 + Math.min(n, 24) * 30}ms` }}
              >
                <AmenityGlyph category={group.tag} size={22} />
                <h3 className="am-title">{r.title}</h3>
                {r.paid === 1 ? (
                  <span className="am-paid">Additional charge</span>
                ) : (
                  r.body && <p className="am-body">{r.body}</p>
                )}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
