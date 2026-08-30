import type { MetadataRoute } from "next";
import { DESCRIPTION } from "@/lib/site";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Hotel Thakali Inn",
    short_name: "Thakali Inn",
    description: DESCRIPTION,
    start_url: "/",
    background_color: "#ECE4D2",
    theme_color: "#344E41",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml" }],
  };
}
