import ContactPanel from "@/components/ContactPanel";
import HotelSchema from "@/components/HotelSchema";
import { list, section, settings } from "@/lib/content";
import { directionsUrl, mapEmbedUrl, phoneHref, waHref } from "@/lib/site";

export const metadata = {
  title: "Contact | Hotel Thakali Inn",
  description:
    "Call, message or find Hotel Thakali Inn — Sinamangal Kalimatidol, Kathmandu, five minutes from the airport. The desk is staffed through the night.",
};

/* See app/rooms/page.tsx — the prerender pass runs in plain Node, where env.DB
   does not exist, and only reads this literal in the page file itself. */
export const dynamic = "force-dynamic";

export default async function Contact() {
  const [config, hero] = await Promise.all([settings(), section("hero")]);
  const phone = config.phone ?? "";
  /* An unset whatsapp row, or the "same as the front desk" switch, both mean
     the printed number — see composeAll() in lib/settings-schema.ts. */
  const whatsapp = (config.whatsapp_same === "0" && config.whatsapp) || phone;
  const plusCode = config.plus_code ?? "";

  const socials = list<{ label: string; href: string }>(config.socials);

  return (
    <>
      {/* Same block as the homepage. Two pages carry it because these are the
          two a search engine is most likely to land on for the hotel's name. */}
      <HotelSchema config={config} socials={socials} image={hero[0]?.image} />
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
          /* Empty when staff clear the number, and the WhatsApp channel then
             does not render at all — see channels() in ContactPanel. */
          waHref: whatsapp ? waHref(whatsapp) : "",
          mapEmbedUrl: mapEmbedUrl(config.lat ?? "", config.lng ?? ""),
          directionsUrl: directionsUrl(plusCode),
          socials,
          arrival: list<[string, string]>(config.arrival),
        }}
      />
    </>
  );
}
