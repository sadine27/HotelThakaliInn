import { Suspense } from "react";
import RoomsCarousel from "@/components/RoomsCarousel";

export const metadata = { title: "Rooms | Hotel Thakali Inn" };

export default function Rooms() {
  /* The carousel reads ?room= to decide whether the detail is open, and
     useSearchParams without a boundary opts the whole route out of static
     rendering — a build error, not a warning. The fan already gates its own
     first paint on `mounted`, so there is nothing useful to show as a fallback. */
  return (
    <Suspense fallback={null}>
      <RoomsCarousel />
    </Suspense>
  );
}
