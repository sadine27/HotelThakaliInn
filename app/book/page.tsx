import { Suspense } from "react";
import BookingForm from "@/components/BookingForm";
import { section, settings } from "@/lib/content";

export const metadata = { title: "Request a room | Hotel Thakali Inn" };

/* See app/rooms/page.tsx — the prerender pass runs in plain Node, where env.DB
   does not exist, and only reads this literal in the page file itself. */
export const dynamic = "force-dynamic";

export default async function Book() {
  const [rooms, config] = await Promise.all([section<{ count: string }>("room"), settings()]);
  if (!rooms.length) return null;
  return (
    /* The form reads ?room= to preselect, and useSearchParams without a boundary
       opts the whole route out of static rendering. Same reason as
       app/rooms/page.tsx. */
    <Suspense fallback={null}>
      <BookingForm
        rooms={rooms.map((r) => ({ slug: r.slug, name: r.title, capacity: r.tag }))}
        bookingUrl={config.booking_url ?? ""}
        phone={config.phone ?? ""}
      />
    </Suspense>
  );
}
