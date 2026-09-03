/* Six glyphs for the food & drink extras strip — same reasoning and stroke
   convention as components/Glyph.tsx and components/AmenityGlyph.tsx, kept in
   its own file because these six items (cup, fruit, wine, buffet, minibar,
   diet) don't belong to any amenity category the rest of the page uses. */
export type TouchName = "cup" | "fruit" | "wine" | "buffet" | "minibar" | "diet";

export default function TouchGlyph({ name, size = 20 }: { name: TouchName; size?: number }) {
  const props = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    "aria-hidden": true as const,
    stroke: "currentColor",
    strokeWidth: 1.6,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };

  switch (name) {
    case "cup":
      return (
        <svg {...props}>
          <path d="M5 8h11v6a5 5 0 0 1-5 5H10a5 5 0 0 1-5-5V8z" />
          <path d="M16 9h1.5a2.5 2.5 0 0 1 0 5H16" />
          <path d="M8 5c0-1 1-1 1-2M12 5c0-1 1-1 1-2" />
        </svg>
      );
    case "fruit":
      return (
        <svg {...props}>
          <path d="M12 9a5 5 0 1 1 0 10 5 5 0 0 1 0-10z" />
          <path d="M9.5 9c-1-1.5-1-3 0-4.5" />
          <path d="M12 9V7c0-1 .5-2 2-2.5" />
        </svg>
      );
    case "wine":
      return (
        <svg {...props}>
          <path d="M7 3h10c0 5-2 8-5 8s-5-3-5-8z" />
          <path d="M12 11v7M9 21h6" />
        </svg>
      );
    case "buffet":
      return (
        <svg {...props}>
          <circle cx="12" cy="12" r="9" />
          <path d="M9 10h.01M15 10h.01" />
          <path d="M8.5 14a4 4 0 0 0 7 0" />
        </svg>
      );
    case "minibar":
      return (
        <svg {...props}>
          <path d="M9 2h6v4l1.5 2.5A3 3 0 0 1 17 12v8a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1v-8a3 3 0 0 1 .5-3.5L9 6V2z" />
          <path d="M9 6h6" />
        </svg>
      );
    case "diet":
      return (
        <svg {...props}>
          <path d="M20 4C10 4 4 10 4 20c10 0 16-6 16-16z" />
          <path d="M9 15c3-3 6-4 9-9" />
        </svg>
      );
  }
}
