/* Written as one string so the policy reads top to bottom.

   What each allowance is actually for — every one of these was traced to a real
   call site, so anything not listed here is something the site does not do:

   - script-src 'unsafe-inline': the App Router's own hydration bootstrap is an
     inline <script>, and components/HotelSchema.tsx emits inline JSON-LD. Next
     can swap both for a nonce, but only from middleware, which this Worker does
     not have. The policy still blocks every off-origin script, which is what an
     injection needs. No 'unsafe-eval': React's production build never calls it,
     and neither does the WebGL in components/LiquidBackground.tsx.
     ponytail: 'unsafe-inline', upgrade to a nonce if middleware ever lands.
   - style-src 'unsafe-inline': React writes style="" attributes, and
     components/Img.tsx sets one per photo to reproduce next/image's `fill`.
   - img-src data:: one inlined SVG in globals.css. No blob: — PhotoField's
     canvas.toBlob() result is uploaded, never rendered as a URL.
   - font-src 'self': next/font/google downloads the three faces at build time
     and serves them from /_next/static. Nothing is fetched from Google at run
     time, so fonts.gstatic.com does not belong here.
   - connect-src 'self': the only fetches from the browser are /api/live and
     /api/view. Open-Meteo is called from app/api/live/route.ts, on the server.
   - frame-src: the map in components/ContactPanel.tsx. maps.google.com is the
     src, www.google.com is where it redirects, and CSP checks both. */
const CSP = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "media-src 'self'",
  "font-src 'self'",
  "connect-src 'self'",
  "frame-src https://maps.google.com https://www.google.com",
  "upgrade-insecure-requests",
].join("; ");

/** @type {import('next').NextConfig} */
const nextConfig = {
  outputFileTracingRoot: import.meta.dirname,
  experimental: {
    /* Photo uploads are Server Actions, and the default body cap is 1 MB — a
       camera original blows through it and the browser reports it as
       ERR_CONNECTION_RESET, not as a rejection any code of ours can explain.
       components/PhotoField.tsx resizes to ~400 KB before sending, so this
       ceiling is only ever reached by something that skipped that; raising it
       to 3 MB is what lets the size check in app/admin/content/page.tsx be the
       thing that refuses, with the row left untouched. */
    serverActions: { bodySizeLimit: "3mb" },
  },

  /* Every page here is force-dynamic, so these come off the Worker, not off the
     assets binding — which is why they live in next.config and not in a
     `_headers` file. `_headers` only decorates static assets, and this site has
     almost none: it would have left every HTML document bare. */
  async headers() {
    return [
      {
        /* `/(.*)`, not `/:path*`. Stock Next matches the bare `/` with either,
           but vinext's matcher does not — `/:path*` silently skipped the home
           page and decorated every other route, which is the worst possible
           shape for this bug: the one page everybody lands on, uncovered, with
           a passing spot check everywhere else. Verified against
           vinext/dist/config/config-matchers.js matchHeaders(). */
        source: "/(.*)",
        headers: [
          { key: "Content-Security-Policy", value: CSP },
          /* One year, both hostnames. Not `preload` — that is a submission to a
             list baked into browser binaries, and getting off it takes months.
             The header alone protects every visitor after their first request. */
          {
            key: "Strict-Transport-Security",
            value: "max-age=31536000; includeSubDomains",
          },
          { key: "X-Content-Type-Options", value: "nosniff" },
          /* frame-ancestors above is the one browsers actually enforce; this is
             here for the older ones that only know the legacy header. */
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          /* The site asks for none of these. Naming them denies the request an
             injected script would otherwise be free to make. */
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
