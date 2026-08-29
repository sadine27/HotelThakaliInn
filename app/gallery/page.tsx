import GalleryWall from "@/components/GalleryWall";
import { section } from "@/lib/content";

export const metadata = {
  title: "Gallery | Hotel Thakali Inn",
  description:
    "Photographs of the rooms, the dining room and the front desk at Hotel Thakali Inn, Sinamangal, Kathmandu. No stock pictures — this is the building you arrive at.",
};

/* See app/rooms/page.tsx — the prerender pass runs in plain Node, where env.DB
   does not exist, and only reads this literal in the page file itself. */
export const dynamic = "force-dynamic";

export default async function Gallery() {
  const rows = await section("gallery");

  /* The wall's own arithmetic assumes there is something to window over, and its
     six columns index modulo the list length. */
  if (!rows.length) return null;

  return (
    <GalleryWall
      panels={rows.map((r) => ({
        slug: r.slug,
        title: r.title,
        tag: r.tag,
        blurb: r.body,
        image: r.image,
        video: r.video,
      }))}
    />
  );
}
