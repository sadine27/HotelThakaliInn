/* Redrawn from assets/LOGO-COLOR CODE_page-0001.jpg: a pagoda roof over a
   TH monogram — green H, olive T nested inside it. Vector so it stays crisp
   in the dial puck and carries no white JPEG box. */
export default function LogoMark({
  size = 48,
  green = "#344E41",
  olive = "#6B705C",
  title,
}: {
  size?: number;
  green?: string;
  olive?: string;
  title?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
    >
      {title ? <title>{title}</title> : null}
      {/* roof */}
      <path
        d="M13 34 L50 6 L87 34"
        fill="none"
        stroke={green}
        strokeWidth="7.5"
        strokeLinecap="butt"
        strokeLinejoin="miter"
      />
      {/* T — crossbar and stem */}
      <rect x="24" y="32.5" width="52" height="4.8" fill={olive} />
      <rect x="45.5" y="37.3" width="9" height="22" fill={olive} />
      {/* H — legs and crossbar */}
      <rect x="24" y="38.5" width="9" height="57" fill={green} />
      <rect x="67" y="38.5" width="9" height="57" fill={green} />
      <rect x="33" y="64" width="34" height="8" fill={green} />
    </svg>
  );
}
