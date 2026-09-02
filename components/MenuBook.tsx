"use client";

import { useMemo, useState } from "react";
import Img from "@/components/Img";
import LogoMark from "@/components/LogoMark";

export type MenuItem = { slug: string; title: string; tag: string; body: string; price: number };

/* Curated grouping of the printed menu's ~27 category headings into a book-
   sized set of tabs — hand-picked to match reference.png's spine (a handful
   of tabs, not one per section and not one per printed tag). Purely a display
   concern: the underlying `content` rows and their `tag` values are untouched. */
const TABS: { id: string; label: string; tags: string[] }[] = [
  { id: "breakfast", label: "Breakfast", tags: ["Breakfast", "Any Choice Sides"] },
  { id: "soups-salads", label: "Soups & Salads", tags: ["Soup", "Salad"] },
  {
    id: "starters-snacks",
    label: "Starters & Snacks",
    tags: [
      "Indian Veg Kebab/Snacks",
      "Indian Non-Veg Kabab & Snacks",
      "Starter — Veg",
      "Starter — Non Veg",
      "Burger",
      "Sandwich",
      "Noodles/Fried Rice",
    ],
  },
  {
    id: "thakali-nepali",
    label: "Thakali & Nepali Specials",
    tags: ["Special Thakali Set", "Sekuwa", "Special Momo", "Curry", "Roti", "Add On"],
  },
  {
    id: "indian",
    label: "Indian Cuisine",
    tags: [
      "Indian Curry-Veg",
      "Indian Curry-Non Veg",
      "Indian Rice",
      "Indian Bread",
      "Biryani",
      "Special Platter",
    ],
  },
  { id: "desserts", label: "Desserts", tags: ["Dessert"] },
  { id: "beverages", label: "Beverages", tags: ["Nepali Tea", "Fresh Juices", "Red Bull"] },
  {
    id: "bar",
    label: "Bar & Spirits",
    tags: ["Imported Liquor", "Domestic Liquor", "Beer", "Draught Beer", "Wine", "Shisha/Hukka", "Cigarette"],
  },
];

export default function MenuBook({
  items,
  tagline,
  address,
}: {
  items: MenuItem[];
  tagline: string;
  address: string;
}) {
  const [activeTab, setActiveTab] = useState<string | null>(null);

  const byTag = useMemo(() => {
    const map = new Map<string, MenuItem[]>();
    for (const item of items) {
      const list = map.get(item.tag);
      if (list) list.push(item);
      else map.set(item.tag, [item]);
    }
    return map;
  }, [items]);

  const activeTabDef = TABS.find((t) => t.id === activeTab) ?? null;

  return (
    <section className="book">
      <div className="book-spine">
        <button
          type="button"
          className="book-brand"
          onClick={() => setActiveTab(null)}
          aria-label="Menu cover"
        >
          <LogoMark size={30} green="#e8e5da" olive="#a59663" />
        </button>
        <nav className="book-tabs" aria-label="Menu categories">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              className="book-tab"
              data-active={tab.id === activeTab || undefined}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      <div className="book-page">
        {activeTabDef ? (
          <div className="book-category" key={activeTabDef.id}>
            <header className="book-category-head">
              <h2>{activeTabDef.label}</h2>
            </header>
            {activeTabDef.tags
              .filter((tag) => byTag.has(tag))
              .map((tag) => (
                <div className="book-group" key={tag}>
                  <p className="book-group-tag">{tag}</p>
                  <ul className="book-items">
                    {byTag.get(tag)!.map((item) => (
                      <li className="book-item" key={item.slug}>
                        <div className="book-item-row">
                          <h3>{item.title}</h3>
                          <span className="book-item-price">Rs. {item.price}</span>
                        </div>
                        {item.body && <p className="book-item-body">{item.body}</p>}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
          </div>
        ) : (
          <div className="book-cover">
            <LogoMark size={44} green="#2c2419" olive="#6b5a3a" />
            <p className="book-cover-name">Hotel Thakali Inn</p>
            <h2 className="book-cover-title">Menu</h2>
            <div className="book-cover-sketch">
              <Img
                src="/media/menu/hotel-sketch.png"
                alt="Hotel Thakali Inn, illustrated"
                fill
                sizes="(max-width: 900px) 60vw, 320px"
              />
            </div>
            {tagline && <p className="book-cover-tagline">{tagline}</p>}
            {address && <p className="book-cover-address">{address}</p>}
          </div>
        )}
      </div>
    </section>
  );
}
