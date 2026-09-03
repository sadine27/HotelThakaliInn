/* One hand-drawn glyph per amenity category (see components/Glyph.tsx for the
   same reasoning — an icon package would outweigh the app). Each returns its
   own primitives rather than a single path, because a bell or a paw does not
   reduce to one stroke. Falls back to a plain dot for a category with no
   glyph defined yet, rather than rendering nothing. */
const CATEGORY_ICONS: Record<string, string> = {
  Bathroom: "bathroom",
  "Food & Drink": "food",
  "Business Facilities": "business",
  "Safety & security": "safety",
  Outdoors: "outdoors",
  Kitchen: "kitchen",
  "Room amenities": "bed",
  Pets: "pets",
  Activities: "activities",
  "Living Area": "sofa",
  "Media & Technology": "media",
  Internet: "wifi",
  Parking: "parking",
  "Front Desk Services": "bell",
  "Cleaning Services": "sparkle",
  General: "info",
  "Languages Spoken": "globe",
};

export default function AmenityGlyph({ category, size = 20 }: { category: string; size?: number }) {
  const name = CATEGORY_ICONS[category];
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
    case "bathroom":
      return (
        <svg {...props}>
          <path d="M12 2c4 5 6 8.5 6 11.5a6 6 0 1 1-12 0C6 10.5 8 7 12 2z" />
        </svg>
      );
    case "food":
      return (
        <svg {...props}>
          <circle cx="9" cy="12" r="6" />
          <path d="M17 3l4 4-8 8-2-2z" />
        </svg>
      );
    case "business":
      return (
        <svg {...props}>
          <rect x="4" y="8" width="16" height="10" rx="2" />
          <path d="M8 8V6a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
        </svg>
      );
    case "safety":
      return (
        <svg {...props}>
          <path d="M12 2l8 3v6c0 5-3.5 8.5-8 11-4.5-2.5-8-6-8-11V5l8-3z" />
        </svg>
      );
    case "outdoors":
      return (
        <svg {...props}>
          <path d="M12 3l5 8H7l5-8z" />
          <path d="M12 9l6 10H6l6-10z" />
          <path d="M12 19v3" />
        </svg>
      );
    case "kitchen":
      return (
        <svg {...props}>
          <path d="M5 10h14v6a4 4 0 0 1-4 4H9a4 4 0 0 1-4-4v-6z" />
          <path d="M3 10h18" />
          <path d="M8 10V7a4 4 0 0 1 8 0v3" />
        </svg>
      );
    case "bed":
      return (
        <svg {...props}>
          <path d="M3 18v-6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v6" />
          <path d="M3 18v2M21 18v2" />
          <path d="M3 12V8a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
        </svg>
      );
    case "pets":
      return (
        <svg {...props}>
          <circle cx="8" cy="8" r="1.5" fill="currentColor" stroke="none" />
          <circle cx="12" cy="6" r="1.5" fill="currentColor" stroke="none" />
          <circle cx="16" cy="8" r="1.5" fill="currentColor" stroke="none" />
          <path d="M12 12c-3 0-5 2-5 4.5S9 21 12 21s5-1.5 5-4.5S15 12 12 12z" />
        </svg>
      );
    case "activities":
      return (
        <svg {...props}>
          <circle cx="12" cy="12" r="9" />
          <path d="M14.5 9.5L16 8l-1.5 4.5L10 14l1.5-4.5z" />
        </svg>
      );
    case "sofa":
      return (
        <svg {...props}>
          <path d="M5 12V8a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v4" />
          <path d="M3 12h18v5a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-5z" />
          <path d="M5 18v2M19 18v2" />
        </svg>
      );
    case "media":
      return (
        <svg {...props}>
          <rect x="3" y="4" width="18" height="12" rx="1" />
          <path d="M8 20h8M12 16v4" />
        </svg>
      );
    case "wifi":
      return (
        <svg {...props}>
          <path d="M5 12a10 10 0 0 1 14 0" />
          <path d="M8 15a6 6 0 0 1 8 0" />
          <circle cx="12" cy="19" r="1" fill="currentColor" stroke="none" />
        </svg>
      );
    case "parking":
      return (
        <svg {...props}>
          <circle cx="12" cy="12" r="9" />
          <path d="M9 7v10M9 7h4a3 3 0 0 1 0 6H9" />
        </svg>
      );
    case "bell":
      return (
        <svg {...props}>
          <path d="M4 17h16" />
          <path d="M6 17a6 6 0 0 1 12 0" />
          <path d="M12 7v3" />
          <circle cx="12" cy="6" r="1.3" fill="currentColor" stroke="none" />
        </svg>
      );
    case "sparkle":
      return (
        <svg {...props}>
          <path d="M12 3l1.2 3.8L17 8l-3.8 1.2L12 13l-1.2-3.8L7 8l3.8-1.2L12 3z" />
          <path d="M5 15l.6 1.9L7.5 17l-1.9.6L5 19.5l-.6-1.9L2.5 17l1.9-.6L5 15z" />
        </svg>
      );
    case "globe":
      return (
        <svg {...props}>
          <circle cx="12" cy="12" r="9" />
          <path d="M3 12h18" />
          <path d="M12 3a14 14 0 0 1 0 18" />
          <path d="M12 3a14 14 0 0 0 0 18" />
        </svg>
      );
    case "info":
    default:
      return (
        <svg {...props}>
          <circle cx="12" cy="12" r="9" />
          <path d="M12 11v5" />
          <circle cx="12" cy="8" r="0.6" fill="currentColor" stroke="none" />
        </svg>
      );
  }
}
