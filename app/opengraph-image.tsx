import { ImageResponse } from "next/og";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/* Same palette as app/icon.svg — cream ground, forest mark — so the social
   card and the browser tab read as the same brand. */
export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "#ECE4D2",
        }}
      >
        <svg width="160" height="160" viewBox="0 0 100 100">
          <path
            d="M13 34 L50 6 L87 34"
            fill="none"
            stroke="#344E41"
            strokeWidth="7.5"
            strokeLinecap="butt"
            strokeLinejoin="miter"
          />
          <rect x="24" y="32.5" width="52" height="4.8" fill="#6B705C" />
          <rect x="45.5" y="37.3" width="9" height="22" fill="#6B705C" />
          <rect x="24" y="38.5" width="9" height="57" fill="#344E41" />
          <rect x="67" y="38.5" width="9" height="57" fill="#344E41" />
          <rect x="33" y="64" width="34" height="8" fill="#344E41" />
        </svg>
        <div
          style={{
            marginTop: 32,
            fontSize: 56,
            fontWeight: 700,
            color: "#344E41",
          }}
        >
          Hotel Thakali Inn
        </div>
        <div style={{ marginTop: 12, fontSize: 28, color: "#6B705C" }}>
          Sinamangal, Kathmandu
        </div>
      </div>
    ),
    { ...size },
  );
}
