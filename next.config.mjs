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
};

export default nextConfig;
