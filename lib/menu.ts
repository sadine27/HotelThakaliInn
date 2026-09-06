/* What a menu row's `extra` column holds, and the one place that reads or
 * writes it.
 *
 * Migration 0008 gave every printed price point its own row, so a spirit sold
 * in four pours was four rows — 'Glenfiddich (12yrs) — 30ml' through '— 360ml'
 * — each with its own slug. That is right for the page and wrong for whoever
 * has to change a price: four rows to find, four slugs to get right, and
 * nothing tying them together except a naming convention. Migration 0022 folded
 * them into one row per drink holding its pours.
 *
 * `price` stays and is not redundant: it is the first (smallest) pour, and it
 * is what every reader written before `sizes` existed still shows. Deleting it
 * would mean finding every one of them first.
 *
 * No cloudflare import here on purpose — the browser-side editor, the public
 * page and scripts/menu-check.mjs all need these rules, and a rule that only
 * runs on the server is a rule the form can disagree with. */

export type Size = { label: string; price: number };
export type MenuExtra = { price: number; sizes?: Size[] };

/* The pours and containers the printed menu actually uses, offered as a
   <datalist> rather than a <select> — the bar can sell something in a size
   nobody thought of, and a dropdown that cannot say "half portion" is a
   dropdown somebody works around by mistyping a title. */
export const SIZE_NAMES = [
  "30ml",
  "60ml",
  "180ml",
  "360ml",
  "Can 550ml",
  "Bottle 650ml",
  "Glass 500ml",
  "Jar 1500ml",
  "Per Glass",
  "Per Bottle",
  "Half",
  "Full",
  "Stick",
  "Packet",
];

/* The editor's starting rows. A row with one price and no name is the same
   thing as an item with no sizes, which is what lets the editor be one control
   instead of a single-price mode and a sizes mode with a switch between. */
export function sizeRows(extra: Partial<MenuExtra> | undefined): Size[] {
  if (extra?.sizes?.length) return extra.sizes;
  return [{ label: "", price: Number(extra?.price ?? 0) }];
}

/* The reverse, applied to what the form posted. Returns the object to store, or
   the reason it cannot be — the caller turns that into the popup's words.
   Every rule here is enforced on the server; the browser only decides how many
   boxes to draw. */
export function composeMenuExtra(
  labels: string[],
  prices: string[],
): { extra: MenuExtra } | { error: "price" | "label" | "duplicate" } {
  const sizes: Size[] = [];
  for (const [i, raw] of prices.entries()) {
    /* A blank price is a row somebody added and did not fill in, not a zero —
       dropping it silently is what lets "Add a size" be undoable by ignoring
       it, with no second button to press. */
    if (raw.trim() === "") continue;
    const price = Number(raw);
    if (!Number.isFinite(price) || price < 0) return { error: "price" };
    sizes.push({ label: (labels[i] ?? "").trim(), price });
  }
  if (sizes.length === 0) return { error: "price" };
  if (sizes.length === 1 && !sizes[0].label) return { extra: { price: sizes[0].price } };
  /* Past one row the name is what tells the pours apart on the page, so an
     unnamed one would render as a bare number against nothing. */
  if (sizes.some((s) => !s.label)) return { error: "label" };
  if (new Set(sizes.map((s) => s.label.toLowerCase())).size !== sizes.length) {
    return { error: "duplicate" };
  }
  return { extra: { price: sizes[0].price, sizes } };
}
