import HeroCarousel from "@/components/HeroCarousel";
import HotelSchema from "@/components/HotelSchema";
import { list, section, settings } from "@/lib/content";

/* See app/rooms/page.tsx — the prerender pass runs in plain Node, where env.DB
   does not exist, and only reads this literal in the page file itself. */
export const dynamic = "force-dynamic";

/* Opening the door writes ?inside into the address, which is a second URL over
   identical content. One canonical says which of the two is the page. */
export const metadata = { alternates: { canonical: "/" } };

export default async function Home() {
  /* Three reads, one round trip each, single-digit ms. The services ring is
     behind the hero rather than on another route, so its cards have to come with
     this page — fetching them when Explore is clicked would put a spinner in the
     middle of the site's signature moment. */
  const [slides, cards, config] = await Promise.all([
    section("hero"),
    section("service"),
    settings(),
  ]);

  if (!slides.length) return null;

  return (
    <>
      {/* The property's facts, machine-readable, on the two pages that already
          hold them in memory. Rendered here rather than in the layout so no
          page inherits a D1 read it did not ask for. */}
      <HotelSchema config={config} socials={list(config.socials)} />
      <HeroCarousel
        slides={slides.map((s) => ({
          title: s.title,
          line: s.body,
          src: s.image,
        }))}
        cards={cards.map((c) => ({
          title: c.title,
          tag: c.tag,
          description: c.body,
          href: c.href,
          image: c.image,
        }))}
        bookingUrl={config.booking_url ?? ""}
        mapsUrl={config.maps_url ?? ""}
      />
    </>
  );
}
