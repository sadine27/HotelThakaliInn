import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Hotel Thakali Inn",
    short_name: "Thakali Inn",
    description: "Quiet rooms and a hot Thakali breakfast, five minutes from Tribhuvan International Airport, Kathmandu.",
    start_url: "/",
    background_color: "#ECE4D2",
    theme_color: "#344E41",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml" }],
  };
}
