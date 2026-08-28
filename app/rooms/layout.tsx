/* The route's ground, here rather than on .room-page: .room-page is inside the
   Suspense boundary in page.tsx (RoomsCarousel reads useSearchParams), so it is
   absent from the prerendered HTML — and it fades in from opacity 0. Either way
   body's #1f271f shows through, which is the dark second before the page lands.
   A server-rendered wrapper is painted with the first byte and never animates. */
export default function RoomsLayout({ children }: { children: React.ReactNode }) {
  return <div className="room-ground">{children}</div>;
}
