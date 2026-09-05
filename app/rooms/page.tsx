import { Suspense } from "react";
import RoomsCarousel, { type Room } from "@/components/RoomsCarousel";
import { list, section, settings } from "@/lib/content";
import { composeSizePair } from "@/lib/settings-schema";

export const metadata = {
  title: "Rooms | Hotel Thakali Inn",
  description:
    "Single, double and family rooms in Sinamangal, Kathmandu, five minutes from Tribhuvan International Airport. Hot water, quiet nights, and a desk that is staffed through them.",
};

/* Not a preference — a correctness requirement. vinext's prerender pass runs in
   plain Node, where `env.DB` does not exist, and it only sees this literal in the
   page file itself: a re-export or a layout is invisible to it. Without it the
   build either fails or freezes the rooms into a static asset that staff edits
   can never reach. Every D1-reading page needs its own copy. */
export const dynamic = "force-dynamic";

/* What travels in `extra` for this section. Ordered, room-only, never queried on
   its own — so it is JSON in one column rather than two child tables. */
type RoomExtra = {
  count: string;
  meta: string[];
  specs: [string, string][];
  /* Just the number; the unit is one hotel-wide setting, so two cards can never
     be quoted in different units. Absent until someone has actually measured
     that room — a blank is honest, an invented figure is not. */
  sizeValue?: string;
};

export default async function Rooms() {
  const [rows, config] = await Promise.all([section<RoomExtra>("room"), settings()]);

  /* Column names are generic because one table serves six sections; the carousel
     reads in the vocabulary of a room. Renaming here keeps `room.capacity` at the
     point of use instead of an unexplained `item.tag`. */
  const unit = config.rooms_size_unit === "sqft" ? "sqft" : "m2";
  const rooms: Room[] = rows.map((r) => ({
    slug: r.slug,
    name: r.title,
    capacity: r.tag,
    blurb: r.body,
    image: r.image,
    count: r.extra.count,
    meta: r.extra.meta,
    specs: r.extra.specs,
    size: composeSizePair(r.extra.sizeValue ?? "", unit),
  }));

  /* The fan indexes into this list from the first render. An empty table is a
     seed that never ran, not a state worth drawing — but a blank page with no
     explanation is worse than a short line if staff ever unpublish every row. */
  if (!rooms.length) {
    return (
      <div className="stop">
        <h1 className="stop-line">Rooms aren&rsquo;t listed right now.</h1>
        <p>Call us and we&rsquo;ll help you book directly.</p>
      </div>
    );
  }

  return (
    /* The carousel reads ?room= to decide whether the detail is open, and
       useSearchParams without a boundary opts the whole route out of static
       rendering — a build error, not a warning. The fan already gates its own
       first paint on `mounted`, so there is nothing useful to show as a fallback. */
    <Suspense fallback={null}>
      <RoomsCarousel
        rooms={rooms}
        shared={config.rooms_shared ?? ""}
        size={config.rooms_size ?? ""}
        goodToKnow={list<string>(config.rooms_good_to_know)}
        bookingUrl={config.booking_url ?? ""}
      />
    </Suspense>
  );
}
