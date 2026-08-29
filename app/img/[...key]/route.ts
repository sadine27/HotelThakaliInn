import { env } from "cloudflare:workers";

/* `/img/`, not `/media/`. Static assets are matched before Worker code runs and
   `/media/*` already exists in dist/client, so a route there would never be
   reached. The two paths are therefore two different things on purpose:
   /media/* is a seeded photo in the repo, /img/* is one staff uploaded. */
export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ key: string[] }> }) {
  const { key } = await params;
  const object = await env.MEDIA.get(key.join("/"));
  if (!object) return new Response("Not found", { status: 404 });

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  /* Keys are UUIDs, so a replaced photo is a different key and this can never
     serve a stale image. That is the whole reason uploads are not named after
     the room they belong to — and it is also what keeps R2 reads near zero,
     because the CDN can hold every object forever. */
  headers.set("Cache-Control", "public, max-age=31536000, immutable");
  headers.set("ETag", object.httpEtag);
  return new Response(object.body, { headers });
}
