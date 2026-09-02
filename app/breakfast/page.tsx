import { redirect } from "next/navigation";

/* Breakfast is now one section of /cuisine, alongside the paid à la carte
   menu. Kept as a redirect rather than deleted — old links (search results,
   bookmarks) still point here. */
export default function Breakfast() {
  redirect("/cuisine");
}
