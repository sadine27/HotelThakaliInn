"use client";

import { useState } from "react";
import type { Size } from "@/lib/menu";

/* The price editor for one menu item.
 *
 * One line is one price. Leave the line's name empty and the item has a single
 * price; name the lines and they become the pours it is sold in. That is one
 * control rather than a single-price mode and a sizes mode with a switch
 * between them, and it is the same rule composeMenuExtra() applies on the
 * server when it reads these fields back.
 *
 * The names come from a <datalist> the page renders once. An id per row would
 * be forty copies of the same id on the bar tab — the bug this admin already
 * had once, on the photo picker. */

export default function PriceRows({
  defaultValue,
  sizes,
}: {
  defaultValue: Size[];
  sizes: boolean;
}) {
  const [rows, setRows] = useState(
    defaultValue.map((s) => ({ label: s.label, price: String(s.price) })),
  );

  const set = (i: number, patch: Partial<{ label: string; price: string }>) =>
    setRows(rows.map((r, n) => (n === i ? { ...r, ...patch } : r)));

  /* The bar is the only place one thing is sold in several pours. A momo has a
     price, and an "Add a size" button beside it is an invitation to give a
     pancake a 30ml measure — which is exactly what happened. Posting no
     size_label at all is what composeMenuExtra already reads as a single
     price, so the server needs no second rule for this. */
  if (!sizes) {
    return (
      <div className="adm-con-field">
        <label>Price</label>
        <div className="adm-con-row">
          <span className="adm-price-cur">Rs.</span>
          <input
            name="size_price"
            className="adm-price-amt"
            type="number"
            min="0"
            step="1"
            required
            aria-label="Price"
            value={rows[0].price}
            onChange={(e) => set(0, { price: e.target.value })}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="adm-con-field adm-con-wide">
      <span className="adm-con-legend">Price</span>
      <div className="adm-con-rows">
        {rows.map((r, i) => (
          /* Keyed by index, which is safe only because the inputs are
             controlled from this state — React reuses the box and the value
             follows the array. */
          <div className="adm-con-row" key={i}>
            <input
              name="size_label"
              className="adm-con-flex"
              list="adm-size-names"
              placeholder={rows.length === 1 ? "Sold in one size — leave empty" : "30ml"}
              aria-label={`Size ${i + 1}`}
              value={r.label}
              onChange={(e) => set(i, { label: e.target.value })}
            />
            <span className="adm-price-cur">Rs.</span>
            <input
              name="size_price"
              className="adm-price-amt"
              type="number"
              min="0"
              step="1"
              required
              aria-label={`Price for size ${i + 1}`}
              value={r.price}
              onChange={(e) => set(i, { price: e.target.value })}
            />
            {rows.length > 1 && (
              <button
                type="button"
                className="adm-btn adm-btn--x"
                aria-label={`Remove ${r.label || `size ${i + 1}`}`}
                onClick={() => setRows(rows.filter((_, n) => n !== i))}
              >
                ×
              </button>
            )}
          </div>
        ))}
      </div>
      <div className="adm-price-add">
        <button
          type="button"
          className="adm-btn adm-btn--sm"
          onClick={() => setRows([...rows, { label: "", price: "" }])}
        >
          Add a size
        </button>
        <small>
          One line per pour or container this is sold in — 30ml, 60ml, a can, a bottle. The
          Cuisine page lists them side by side under the one name.
        </small>
      </div>
    </div>
  );
}
