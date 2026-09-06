import MenuBook, { type MenuItem, type Size } from "@/components/MenuBook";
import { section, settings } from "@/lib/content";
import { DESCRIPTION } from "@/lib/site";

export const metadata = {
  title: "Cuisine | Hotel Thakali Inn",
  description:
    "The full à la carte menu at Hotel Thakali Inn — Thakali, Nepali, Indian and continental dishes, in Sinamangal, Kathmandu.",
};

/* See app/rooms/page.tsx — the prerender pass runs in plain Node, where env.DB
   does not exist, and only reads this literal in the page file itself. */
export const dynamic = "force-dynamic";

type MenuExtra = { price: number; sizes?: Size[] };

/* Flattens a content row into what MenuBook needs — just the price and, for a
   drink sold in several pours, its sizes; nothing else about the row's storage
   shape leaks past here. */
function toMenuItem(r: { slug: string; title: string; tag: string; body: string; extra: MenuExtra }): MenuItem {
  return { slug: r.slug, title: r.title, tag: r.tag, body: r.body, price: r.extra.price, sizes: r.extra.sizes };
}

export default async function Cuisine() {
  const [menuBreakfast, menuSnacks, menuMains, menuBar, config] = await Promise.all([
    section<MenuExtra>("menu_breakfast"),
    section<MenuExtra>("menu_snacks"),
    section<MenuExtra>("menu_mains"),
    section<MenuExtra>("menu_bar"),
    settings(),
  ]);

  const items = [...menuBreakfast, ...menuSnacks, ...menuMains, ...menuBar].map(toMenuItem);

  return (
    <div className="bf-page cuisine-page">
      {items.length > 0 ? (
        <MenuBook items={items} tagline={DESCRIPTION} address={config.address ?? ""} />
      ) : (
        <div className="stop">
          <h1 className="stop-line">The menu isn&rsquo;t listed right now.</h1>
          <p>Call us and we&rsquo;ll tell you what&rsquo;s on today.</p>
        </div>
      )}
    </div>
  );
}
