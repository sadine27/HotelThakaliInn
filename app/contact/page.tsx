import ContactPanel from "@/components/ContactPanel";
import { list, settings } from "@/lib/content";
import { directionsUrl, mapEmbedUrl, phoneHref } from "@/lib/site";

export const metadata = { title: "Contact | Hotel Thakali Inn" };

/* See app/rooms/page.tsx — the prerender pass runs in plain Node, where env.DB
   does not exist, and only reads this literal in the page file itself. */
export const dynamic = "force-dynamic";

export default async function Contact() {
  const config = await settings();
  const phone = config.phone ?? "";
  const plusCode = config.plus_code ?? "";

  return (
    <ContactPanel
      info={{
        phone,
        email: config.email ?? "",
        address: config.address ?? "",
        plusCode,
        bookingUrl: config.booking_url ?? "",
        mapsUrl: config.maps_url ?? "",
        /* Derived here rather than stored, so a corrected phone number or a moved
           pin can only be edited in one place. */
        phoneHref: phoneHref(phone),
        mapEmbedUrl: mapEmbedUrl(config.lat ?? "", config.lng ?? ""),
        directionsUrl: directionsUrl(plusCode),
        socials: list<{ label: string; href: string }>(config.socials),
        arrival: list<[string, string]>(config.arrival),
      }}
    />
  );
}
