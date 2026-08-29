import { SITE_URL } from "@/lib/site";

/* The machine-readable version of the facts already printed on the contact page.
 *
 * Schema.org/Hotel, as a JSON-LD block. This is what lets Google show the phone
 * number, the address and the map pin beside the result instead of a bare blue
 * link, and what tells it that hotelthakaliinn.com and the Google Business
 * Profile are the same property rather than two.
 *
 * A server component taking `settings` as a prop rather than reading D1 itself:
 * both pages that render it already fetch that row set, so this costs no extra
 * query and — more importantly — cannot drag a binding into a page that has not
 * declared itself dynamic.
 *
 * Deliberately absent: aggregateRating, priceRange, starRating. Every one of
 * them is a number we would be inventing, and a structured-data claim that the
 * page does not back up is the one kind of SEO that gets a site penalised.
 */
export default function HotelSchema({
  config,
  socials,
}: {
  config: Record<string, string>;
  socials: { label: string; href: string }[];
}) {
  const phone = config.phone ?? "";
  const lat = config.lat;
  const lng = config.lng;

  const schema = {
    "@context": "https://schema.org",
    "@type": "Hotel",
    "@id": `${SITE_URL}/#hotel`,
    name: "Hotel Thakali Inn",
    url: SITE_URL,
    /* The site's own opengraph card, which is generated from the real hero
       photo — one image, already built, already cached. */
    image: `${SITE_URL}/opengraph-image`,
    description:
      "Quiet rooms and a hot Thakali breakfast, five minutes from Tribhuvan International Airport, Kathmandu.",
    address: {
      "@type": "PostalAddress",
      streetAddress: config.address ?? "",
      addressLocality: "Kathmandu",
      postalCode: "44600",
      addressCountry: "NP",
    },
    ...(lat && lng
      ? {
          geo: {
            "@type": "GeoCoordinates",
            latitude: Number(lat),
            longitude: Number(lng),
          },
        }
      : {}),
    ...(phone ? { telephone: phone } : {}),
    ...(config.email ? { email: config.email } : {}),
    /* sameAs is how a search engine knows these accounts are this hotel. The
       Booking.com listing belongs in it for the same reason the socials do —
       it is another page about the same property, not a competitor. */
    sameAs: [
      ...socials.filter((s) => s.href).map((s) => s.href),
      config.maps_url,
      config.booking_url,
    ].filter(Boolean),
  };

  return (
    <script
      type="application/ld+json"
      /* Every value here is a settings row, which staff can edit — so a stray
         "</script>" in an address would otherwise end this tag early and drop
         the rest of the JSON into the page as markup. Escaping the one
         character that can do that costs nothing and closes it for good. */
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(schema).replace(/</g, "\u003c"),
      }}
    />
  );
}
