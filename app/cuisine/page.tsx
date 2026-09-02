import Img from "@/components/Img";
import ServingStrip from "@/components/ServingStrip";
import MenuBook, { type MenuItem } from "@/components/MenuBook";
import { section, settings } from "@/lib/content";
import { DESCRIPTION } from "@/lib/site";

export const metadata = {
  title: "Cuisine | Hotel Thakali Inn",
  description:
    "A hot Thakali breakfast every morning, and the property's full à la carte menu — Thakali, Nepali, Indian and continental dishes, at Hotel Thakali Inn in Sinamangal, Kathmandu.",
};

/* See app/rooms/page.tsx — the prerender pass runs in plain Node, where env.DB
   does not exist, and only reads this literal in the page file itself. */
export const dynamic = "force-dynamic";

type Window = { from?: string; to?: string };

/* Flattens a content row into what MenuBook needs — just the price pulled out
   of `extra`, nothing else about the row's storage shape leaks past here. */
function toMenuItem(r: { slug: string; title: string; tag: string; body: string; extra: { price: number } }): MenuItem {
  return { slug: r.slug, title: r.title, tag: r.tag, body: r.body, price: r.extra.price };
}

export default async function Cuisine() {
  const [breakfastRows, menuBreakfast, menuSnacks, menuMains, menuBar, config] = await Promise.all([
    section<Window>("breakfast"),
    section<{ price: number }>("menu_breakfast"),
    section<{ price: number }>("menu_snacks"),
    section<{ price: number }>("menu_mains"),
    section<{ price: number }>("menu_bar"),
    settings(),
  ]);

  const items = [...menuBreakfast, ...menuSnacks, ...menuMains, ...menuBar].map(toMenuItem);

  return (
    <div className="bf-page">
      {breakfastRows.length > 0 && (
        <>
          <header className="bf-head">
            <p className="bf-eyebrow">Included Breakfast</p>
            <h1>A hot Thakali breakfast, before the first flight</h1>
          </header>

          <ul className="bf-list">
            {breakfastRows.map((r, i) => (
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
                      priority={i === 0}
                    />
                  </div>
                )}
                <div className="bf-copy">
                  {r.tag && <p className="bf-when">{r.tag}</p>}
                  <h2>{r.title}</h2>
                  <p className="bf-body">{r.body}</p>
                  {r.extra.from && r.extra.to && (
                    <ServingStrip from={r.extra.from} to={r.extra.to} />
                  )}
                </div>
              </li>
            ))}
          </ul>
        </>
      )}

      {items.length > 0 && (
        <MenuBook items={items} tagline={DESCRIPTION} address={config.address ?? ""} />
      )}
    </div>
  );
}
