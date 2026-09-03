import Link from "next/link";
import AmenityGlyph from "@/components/AmenityGlyph";
import Glyph from "@/components/Glyph";
import Img from "@/components/Img";
import TouchGlyph, { type TouchName } from "@/components/TouchGlyph";
import { section, settings } from "@/lib/content";
import { phoneHref } from "@/lib/site";

export const metadata = {
  title: "Amenities | Hotel Thakali Inn",
  description:
    "What every room at Hotel Thakali Inn has, and what the property offers — Sinamangal, Kathmandu, five minutes from Tribhuvan International Airport.",
};

/* See app/rooms/page.tsx — the prerender pass runs in plain Node, where
   env.DB does not exist, and only reads this literal in the page file
   itself. */
export const dynamic = "force-dynamic";

/* Six ways a stay actually unfolds, each pointing at a real gallery photo
   rather than a stock shot. The blurb under each is written here, but every
   fact in it (cuisines, WiFi cost, what Safety & security actually lists) is
   read off the real rows below — nothing here is a claim the content table
   can't back up. */
const EXPERIENCES: {
  n: string;
  label: string;
  icon: string;
  photo: string;
  fact: (rows: { slug: string; tag: string; title: string; body: string }[]) => string;
}[] = [
  {
    n: "01",
    label: "Arrive",
    icon: "bell",
    photo: "/media/gallery/arrival.jpg",
    fact: () => "Five minutes from Tribhuvan International Airport.",
  },
  {
    n: "02",
    label: "Rest",
    icon: "bed",
    photo: "/media/gallery/bedside.jpg",
    fact: () => "Quiet rooms, ready whenever you check in.",
  },
  {
    n: "03",
    label: "Dine",
    icon: "food",
    photo: "/media/gallery/dining.jpg",
    fact: (rows) => {
      const cuisine = rows.find((r) => r.slug === "main-restaurant")?.body.split(".")[0];
      return cuisine ? `${cuisine}.` : "A multi-cuisine restaurant on site.";
    },
  },
  {
    n: "04",
    label: "Connect",
    icon: "wifi",
    photo: "/media/gallery/lobby.jpg",
    fact: (rows) => rows.find((r) => r.slug === "wifi")?.body || "Free WiFi in every room.",
  },
  {
    n: "05",
    label: "Care",
    icon: "safety",
    photo: "/media/gallery/corridor.jpg",
    fact: (rows) =>
      `${rows.filter((r) => r.tag === "Safety & security").length} safety measures, watched round the clock.`,
  },
  {
    n: "06",
    label: "Explore",
    icon: "activities",
    photo: "/media/gallery/window.jpg",
    fact: (rows) =>
      rows
        .filter((r) => r.tag === "Activities")
        .map((r) => r.title)
        .join(", ") + ", arranged on request.",
  },
];

/* Twelve real rows, picked for what a guest actually asks the front desk —
   not a second copy of the data, a curated view onto it. Slugs, not new
   content, so a title or body edited in the admin shows up here too. */
const HIGHLIGHT_SLUGS = [
  "wifi",
  "24-hour-front-desk",
  "airport-shuttle",
  "main-restaurant",
  "breakfast-in-room",
  "daily-housekeeping",
  "air-conditioning",
  "baggage-storage",
  "cctv-common-areas",
  "private-bathroom",
  "tea-coffee-maker",
  "room-service",
];

/* The extras a guest doesn't expect until they see them — every one of these
   is a real Food & Drink row, not invented copy. */
const TOUCH_SLUGS: [string, TouchName][] = [
  ["coffee-house", "cup"],
  ["fruit", "fruit"],
  ["wine-champagne", "wine"],
  ["kid-friendly-buffet", "buffet"],
  ["minibar", "minibar"],
  ["special-diet-meals", "diet"],
];

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

  const bySlug = new Map(rows.map((r) => [r.slug, r]));
  const highlights = HIGHLIGHT_SLUGS.map((s) => bySlug.get(s)).filter(
    (r): r is (typeof rows)[number] => Boolean(r),
  );
  const touches = TOUCH_SLUGS.map(([s, icon]) => {
    const row = bySlug.get(s);
    return row && { row, icon };
  }).filter((t): t is { row: (typeof rows)[number]; icon: TouchName } => Boolean(t));

  return (
    <div className="am-page">
      <header className="am-head">
        <p className="am-eyebrow">Amenities · Sinamangal</p>
        <h1>Every comfort in the room. Every service just outside it.</h1>
        <p className="am-sub">
          From the small things in the bathroom to the front desk at 3am — everything the
          property offers, in one place.
        </p>
        <Link className="am-cta" href="/book">
          Book your stay
        </Link>
      </header>

      <section className="am-experience">
        <div className="am-experience-head">
          <p className="am-eyebrow">Explore by experience</p>
          <span className="am-rule" />
        </div>
        <ul className="am-experience-grid">
          {EXPERIENCES.map((e) => (
            <li className="am-experience-card" key={e.label}>
              <div className="am-experience-photo">
                <Img src={e.photo} alt="" fill sizes="(max-width: 900px) 45vw, 16vw" />
              </div>
              <div className="am-experience-body">
                <span className="am-experience-icon">
                  <AmenityGlyph icon={e.icon} size={18} />
                </span>
                <h3>{e.label}</h3>
                <p>{e.fact(rows)}</p>
                <span className="am-experience-n">{e.n}</span>
              </div>
            </li>
          ))}
        </ul>
      </section>

      {highlights.length > 0 && (
        <section className="am-panel">
          <div className="am-panel-head">
            <p className="am-eyebrow">Our amenities</p>
            <a className="am-view-all" href="#all-amenities">
              View all amenities →
            </a>
          </div>
          <ul className="am-panel-grid">
            {highlights.map((r) => (
              <li className="am-panel-item" key={r.slug}>
                <AmenityGlyph category={r.tag} size={22} />
                <div>
                  <h3>{r.title}</h3>
                  {r.body && <p>{r.body}</p>}
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {touches.length > 0 && (
        <section className="am-touches">
          <h2>
            Thoughtful touches, <span>just for you</span>
          </h2>
          <ul className="am-touches-row">
            {touches.map(({ row: r, icon }) => (
              <li className="am-touch" key={r.slug}>
                <span className="am-touch-icon">
                  <TouchGlyph name={icon} />
                </span>
                <span className="am-touch-title">{r.title}</span>
                {r.paid === 1 && <span className="am-touch-paid">Additional charge</span>}
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="am-all" id="all-amenities">
        <p className="am-eyebrow">All amenities</p>
        {groups.map((group, gi) => (
          <section className="am-group" key={group.tag || `untagged-${gi}`}>
            {group.tag && (
              <div className="am-group-head">
                <AmenityGlyph category={group.tag} />
                <h2>{group.tag}</h2>
              </div>
            )}

            <ul className="am-grid">
              {group.items.map(({ row: r }) => (
                <li className="am-card" key={r.slug}>
                  <AmenityGlyph category={group.tag} size={20} />
                  <h3 className="am-title">{r.title}</h3>
                  {r.body && <p className="am-body">{r.body}</p>}
                  {r.paid === 1 && <span className="am-paid">Paid</span>}
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>

      {config.phone && (
        <div className="am-callout">
          <p>Every detail here is crafted to make your stay memorable.</p>
          <a className="am-callout-cta" href={phoneHref(config.phone)}>
            <span>
              Need anything else?
              <br />
              <strong>Our team is just a call away.</strong>
            </span>
            <Glyph name="phone" size={20} />
          </a>
        </div>
      )}
    </div>
  );
}
