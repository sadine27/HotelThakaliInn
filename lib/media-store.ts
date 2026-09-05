/* Reading the bank: the counter, the gauge, and the contact sheet.
 *
 * Split from lib/media.ts because this half needs a D1 binding and that half
 * has to load in the browser. The rules live there; the numbers live here.
 */
import { env } from "cloudflare:workers";
import { mediaReferences } from "@/lib/content";
import { kathmanduDay } from "@/lib/live";
import type { Kind } from "@/lib/media";

export type BankItem = {
  /* What goes into content.image — the whole point of the picker. */
  path: string;
  /* The R2 key, or "" for a photo that ships with the site. */
  key: string;
  kind: Kind;
  name: string;
  bytes: number;
  width: number;
  height: number;
  /* Small copy for the grid; falls back to the photo itself when there is
     none, which is the case for every repo file. */
  thumb: string;
  poster: string;
  originUrl: string;
  caption: string;
  uploadedBy: string;
  uploadedAt: string;
  /* Shipped in the repo rather than uploaded, so it is choosable but not
     deletable — the file is in git, not in the bucket. */
  repo: boolean;
  usedBy: { section: string; slug: string }[];
};

type Row = {
  key: string;
  kind: string;
  name: string;
  bytes: number;
  width: number;
  height: number;
  thumb_key: string;
  poster_key: string;
  origin_url: string;
  caption: string;
  uploaded_by: string;
  uploaded_at: string;
};

/* How many of this kind have gone up since Kathmandu midnight. A COUNT on an
   indexed column, not an R2 listing: the bucket knows what exists, not what
   arrived today, and asking it would cost a full scan on every upload.
   Same day convention as page_views.day. */
export async function dailyCount(kind: Kind): Promise<number> {
  const row = await env.DB.prepare(
    "SELECT COUNT(*) AS n FROM media_assets WHERE day = ?1 AND kind = ?2",
  )
    .bind(kathmanduDay(), kind)
    .first<{ n: number }>();
  return row?.n ?? 0;
}

/* The gauge. Summing a column beats listing the bucket for the same reason as
   above, and it stays one round trip however large the bank gets. Thumbnails
   and posters are counted too — they are real objects paying real rent. */
export async function bankStats(): Promise<{ bytes: number; photos: number; videos: number }> {
  const row = await env.DB.prepare(
    `SELECT COALESCE(SUM(bytes), 0) AS bytes,
            COALESCE(SUM(kind = 'photo'), 0) AS photos,
            COALESCE(SUM(kind = 'video'), 0) AS videos
       FROM media_assets`,
  ).first<{ bytes: number; photos: number; videos: number }>();
  return { bytes: row?.bytes ?? 0, photos: row?.photos ?? 0, videos: row?.videos ?? 0 };
}

/* Everything choosable, newest upload first, with the repo's own photos after
   them.
 *
 * The seeded /media/ files are not in media_assets and deliberately never will
 * be — they are files in git, they cost nothing (the assets binding serves
 * them, not R2), and backfilling them would mean inventing byte counts for the
 * gauge that do not represent anything billable. But they ARE the photos the
 * site currently uses, so a picker that omitted them would make "choose the
 * photo this card already has" impossible. They come straight out of the
 * content table instead, which is the only place that knows about them. */
export async function bankItems(): Promise<BankItem[]> {
  const [refs, { results }] = await Promise.all([
    mediaReferences(),
    env.DB.prepare(
      `SELECT key, kind, name, bytes, width, height, thumb_key, poster_key,
              origin_url, caption, uploaded_by, uploaded_at
         FROM media_assets ORDER BY uploaded_at DESC`,
    ).all<Row>(),
  ]);

  const uploaded: BankItem[] = results.map((r) => {
    const path = `/img/${r.key}`;
    return {
      path,
      key: r.key,
      kind: r.kind === "video" ? "video" : "photo",
      name: r.name,
      bytes: r.bytes,
      width: r.width,
      height: r.height,
      thumb: r.thumb_key ? `/img/${r.thumb_key}` : r.poster_key ? `/img/${r.poster_key}` : path,
      poster: r.poster_key ? `/img/${r.poster_key}` : "",
      originUrl: r.origin_url,
      caption: r.caption,
      uploadedBy: r.uploaded_by,
      uploadedAt: r.uploaded_at,
      repo: false,
      usedBy: refs.get(path) ?? [],
    };
  });

  const known = new Set(uploaded.map((u) => u.path));
  const repo: BankItem[] = [...refs.keys()]
    .filter((p) => p.startsWith("/media/") && !known.has(p))
    .sort()
    .map((path) => ({
      path,
      key: "",
      kind: /\.(mp4|mov|webm)$/i.test(path) ? ("video" as const) : ("photo" as const),
      name: path.split("/").pop() ?? path,
      bytes: 0,
      width: 0,
      height: 0,
      thumb: path,
      poster: "",
      originUrl: "",
      caption: "",
      uploadedBy: "",
      uploadedAt: "",
      repo: true,
      usedBy: refs.get(path) ?? [],
    }));

  return [...uploaded, ...repo];
}
