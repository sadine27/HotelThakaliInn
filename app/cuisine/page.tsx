import MenuBook, { type MenuItem } from "@/components/MenuBook";
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

/* Flattens a content row into what MenuBook needs — just the price pulled out
   of `extra`, nothing else about the row's storage shape leaks past here. */
function toMenuItem(r: { slug: string; title: string; tag: string; body: string; extra: { price: number } }): MenuItem {
  return { slug: r.slug, title: r.title, tag: r.tag, body: r.body, price: r.extra.price };
}

export default async function Cuisine() {
  const [menuBreakfast, menuSnacks, menuMains, menuBar, config] = await Promise.all([
    section<{ price: number }>("menu_breakfast"),
    section<{ price: number }>("menu_snacks"),
    section<{ price: number }>("menu_mains"),
    section<{ price: number }>("menu_bar"),
    settings(),
  ]);

  const items = [...menuBreakfast, ...menuSnacks, ...menuMains, ...menuBar].map(toMenuItem);

  return (
    <div className="bf-page cuisine-page">
      {items.length > 0 && (
        <MenuBook items={items} tagline={DESCRIPTION} address={config.address ?? ""} />
      )}
    </div>
  );
}
