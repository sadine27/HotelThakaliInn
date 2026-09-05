/* One glyph per social platform the settings console offers, drawn at
   currentColor — same reasoning as WhatsAppMark: one small file, whatever
   mounts it decides the colour. They share a file rather than having ten,
   because the two places that need them (the footer, and the console's live
   preview) always want the whole set.
 *
 * Hand-drawn rather than an icon package, matching Glyph.tsx and
 * AmenityGlyph.tsx: ten paths is smaller than a dependency, and this way the
 * stroke weight matches the rest of the site's line work instead of arriving
 * with someone else's.
 *
 * Keyed by MARKS below on the platform's exact label — the same string
 * SOCIAL_PLATFORMS stores in the settings row. That is why the console makes
 * the label a locked select rather than a text box: a hand-typed "instagram"
 * used to save fine and then silently render as the word instead of the mark. */

import WhatsAppMark from "./WhatsAppMark";

type MarkProps = { size?: number };

/* Every outline glyph below shares these, so the set reads as one hand. */
const stroke = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.6,
  strokeLinecap: "round",
  strokeLinejoin: "round",
} as const;

function Frame({ size = 15, children }: MarkProps & { children: React.ReactNode }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      {children}
    </svg>
  );
}

export function InstagramMark({ size = 15 }: MarkProps) {
  return (
    <Frame size={size}>
      <rect x="2" y="2" width="20" height="20" rx="5" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="17.5" cy="6.5" r="1.1" fill="currentColor" />
    </Frame>
  );
}

export function FacebookMark({ size = 15 }: MarkProps) {
  return (
    <Frame size={size}>
      <path
        d="M15 3h-2a5 5 0 0 0-5 5v3H6v4h2v6h4v-6h3l1-4h-4V8a1 1 0 0 1 1-1h3z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </Frame>
  );
}

/* The note, its head, and the flag that hooks off the stem. */
export function TikTokMark({ size = 15 }: MarkProps) {
  return (
    <Frame size={size}>
      <path d="M13.8 3.2v10.6a3.6 3.6 0 1 1-3.6-3.6" {...stroke} />
      <path d="M13.8 3.2c.35 2.35 2.05 4.05 4.4 4.3" {...stroke} />
    </Frame>
  );
}

export function YouTubeMark({ size = 15 }: MarkProps) {
  return (
    <Frame size={size}>
      <rect x="2.5" y="5.5" width="19" height="13" rx="4" {...stroke} />
      <path d="M10.4 9.4 15.6 12l-5.2 2.6z" {...stroke} />
    </Frame>
  );
}

/* The mark really is just the letter. */
export function XMark({ size = 15 }: MarkProps) {
  return (
    <Frame size={size}>
      <path d="M4 3.8 20 20.2" {...stroke} />
      <path d="M20 3.8 4 20.2" {...stroke} />
    </Frame>
  );
}

export function LinkedInMark({ size = 15 }: MarkProps) {
  return (
    <Frame size={size}>
      <rect x="3" y="3" width="18" height="18" rx="2.5" {...stroke} />
      <circle cx="7.6" cy="7.6" r="1" fill="currentColor" />
      <path d="M7.6 10.6v6.4" {...stroke} />
      <path d="M11.6 17v-6.4" {...stroke} />
      <path d="M11.6 13.6a2.6 2.6 0 0 1 5.2 0V17" {...stroke} />
    </Frame>
  );
}

/* The owl. Two round eyes in a wide head is the whole recognisable part. */
export function TripAdvisorMark({ size = 15 }: MarkProps) {
  return (
    <Frame size={size}>
      <path d="M2.6 12.4a4.6 4.6 0 0 1 4.6-4.6h9.6a4.6 4.6 0 0 1 0 9.2H7.2a4.6 4.6 0 0 1-4.6-4.6z" {...stroke} />
      <circle cx="7.4" cy="12.4" r="1.5" fill="currentColor" />
      <circle cx="16.6" cy="12.4" r="1.5" fill="currentColor" />
      <path d="M8.8 6.6c2-1.1 4.4-1.1 6.4 0" {...stroke} />
    </Frame>
  );
}

/* Booking.com's B, with its full stop. */
export function BookingMark({ size = 15 }: MarkProps) {
  return (
    <Frame size={size}>
      <rect x="3" y="3" width="18" height="18" rx="4" {...stroke} />
      <path d="M8.6 6.8h2.9a2.5 2.5 0 0 1 0 5H8.6z" {...stroke} />
      <path d="M8.6 11.8h3.4a2.7 2.7 0 0 1 0 5.4H8.6z" {...stroke} />
      <circle cx="16.9" cy="16.4" r="1" fill="currentColor" />
    </Frame>
  );
}

/* A Business Profile link opens a pin on the map, so a pin is what it is. */
export function GoogleBusinessMark({ size = 15 }: MarkProps) {
  return (
    <Frame size={size}>
      <path d="M12 21.2s6.6-5.9 6.6-10.4a6.6 6.6 0 1 0-13.2 0C5.4 15.3 12 21.2 12 21.2z" {...stroke} />
      <circle cx="12" cy="10.6" r="2.5" {...stroke} />
    </Frame>
  );
}

/* Keyed by the platform label stored in the `socials` settings row. Anything
   not in here falls back to its own label as text, which is a legible last
   resort rather than a blank button. */
/* Values are explicitly optional: a label with no glyph is a real, expected
   case (an older stored row), so the lookup has to be checkable rather than
   pretending every string is a key. */
export const MARKS: Record<string, ((props: MarkProps) => React.JSX.Element) | undefined> = {
  Instagram: InstagramMark,
  Facebook: FacebookMark,
  WhatsApp: WhatsAppMark,
  TikTok: TikTokMark,
  YouTube: YouTubeMark,
  X: XMark,
  LinkedIn: LinkedInMark,
  TripAdvisor: TripAdvisorMark,
  "Booking.com": BookingMark,
  "Google Business": GoogleBusinessMark,
};
