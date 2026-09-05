/* Where an uploaded photo or clip actually lands.
 *
 * A Route Handler and not a Server Action, deliberately. next.config.mjs caps
 * action bodies at 3 MB — already raised once from 1 MB for exactly this reason
 * — and anything over it is killed at the transport, which reaches the browser
 * as ERR_CONNECTION_RESET rather than as any refusal this code could word. A
 * 25 MB clip would hit that every time. A route handler has no such ceiling, so
 * the size check below is the thing that refuses, and it can say why.
 *
 * Every refusal is a sentence, not a status code. This screen is used by
 * front-desk staff; "415 Unsupported Media Type" tells them nothing about the
 * file in their hand.
 *
 * Under /admin rather than /api, and that is not cosmetic: the session cookie
 * is set with Path=/admin so it is never sent on a guest request, which means
 * an upload posted to /api/... arrives with no cookie at all and is refused as
 * signed-out. Same rule as every Server Action here — an admin write lives
 * under /admin or it does not see the session.
 */
import { env } from "cloudflare:workers";
import { peekSession } from "@/lib/auth";
import { auditedWrite } from "@/lib/audit";
import { kathmanduDay } from "@/lib/live";
import { CAPS, CAP_RESET, MAX_BYTES, formatBytes, sniff, type Kind } from "@/lib/media";
import { dailyCount } from "@/lib/media-store";

export const dynamic = "force-dynamic";

const no = (refusal: string, status = 400) =>
  Response.json({ ok: false, refusal }, { status });

/* The browser sends the resized photo plus its thumbnail (and, for a clip, the
   frame it pulled off the front) in one request, so one upload is one row and
   there is no half-stored state to clean up if the tab closes mid-way.
   ponytail: formData() buffers the whole body, so a 25 MB clip costs ~50 MB of
   the Worker's 128 MB. Switch the clip path to streaming request.body into R2
   if the ceiling ever rises. */
export async function POST(request: Request) {
  const session = await peekSession();
  if (!session) return no("Your sign-in has expired. Open the admin again and retry.", 401);

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return no("The upload did not arrive complete. Check the connection and try again.");
  }

  const file = form.get("file");
  if (!(file instanceof File) || !file.size) return no("No file arrived with that upload.");

  const head = new Uint8Array(await file.slice(0, 16).arrayBuffer());
  const seen = sniff(head, form.get("name")?.toString() || file.name || "");
  if ("refusal" in seen) return no(seen.refusal);
  const kind: Kind = seen.kind;

  if (file.size > MAX_BYTES[kind]) {
    return no(
      kind === "video"
        ? `That clip is ${formatBytes(file.size)}. The limit is ${formatBytes(MAX_BYTES.video)} — trim it to a few seconds, or export it at 720p, and it will fit.`
        : `That photo is ${formatBytes(file.size)} after resizing, which is over the ${formatBytes(MAX_BYTES.photo)} limit. Try a different file.`,
    );
  }

  /* Counted before anything is written, so a refused upload leaves nothing
     behind in the bucket to sweep up later. */
  const used = await dailyCount(kind);
  if (used >= CAPS[kind]) {
    return no(
      `That is ${CAPS[kind]} ${kind === "video" ? "clips" : "photos"} today, which is the daily limit. It resets at ${CAP_RESET}.`,
      429,
    );
  }

  /* The uploaded filename is never the key: it is attacker-controlled, it can
     collide, and it can carry a path. It is kept as a label only. */
  const key = `${crypto.randomUUID()}.${seen.ext}`;
  const written: string[] = [];

  try {
    await env.MEDIA.put(key, file.stream(), { httpMetadata: { contentType: seen.mime } });
    written.push(key);

    /* The small copy the contact sheet draws, and — for a clip — the frame the
       gallery card shows. Both are made in the browser; neither is required,
       because a bank that refuses the whole upload over a missing thumbnail is
       worse than a bank with one ugly row. */
    const thumb = await putExtra(form.get("thumb"), "thumb", written);
    const poster = await putExtra(form.get("poster"), "poster", written);
    /* The gauge sums this column, so it has to be everything this upload put in
       the bucket. Counting only the main file understates the bank by a
       thumbnail apiece — small individually, and a whole photo's worth every
       ten. */
    const stored = file.size + thumb.size + poster.size;

    const num = (name: string) => Math.max(0, Math.round(Number(form.get(name)) || 0));
    const label = (form.get("name")?.toString() || file.name || "photo").slice(0, 120);

    const write = env.DB.prepare(
      `INSERT INTO media_assets
         (key, kind, name, mime, bytes, width, height, thumb_key, poster_key, uploaded_by, day)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)`,
    ).bind(
      key,
      kind,
      label,
      seen.mime,
      stored,
      num("width"),
      num("height"),
      thumb.key,
      poster.key,
      session.username,
      kathmanduDay(),
    );

    await auditedWrite(write, {
      actor: session.username,
      action: "media.upload",
      section: "media",
      slug: key,
      after: { name: label, kind, bytes: stored },
    });

    return Response.json({
      ok: true,
      item: {
        path: `/img/${key}`,
        thumb: thumb.key ? `/img/${thumb.key}` : `/img/${key}`,
        name: label,
        bytes: stored,
        kind,
      },
      /* So the counter on screen moves without a page reload. */
      left: CAPS[kind] - used - 1,
    });
  } catch (e) {
    /* An object in the bucket with no row pointing at it is invisible to the
       gauge and to the bank screen, which is the one kind of orphan nothing
       else here sweeps. Undo before answering. */
    await Promise.all(written.map((k) => env.MEDIA.delete(k).catch(() => {})));
    console.error("[media] upload failed", e);
    return no("The upload could not be saved. Nothing was stored — please try again.", 500);
  }
}

/* Thumbnails and posters are always WebP made by a canvas, so they get no magic
   check of their own: they never carry a filename, are never served as anything
   but an image, and a corrupt one costs a broken thumbnail, not a hole. */
async function putExtra(value: FormDataEntryValue | null, label: string, written: string[]) {
  if (!(value instanceof File) || !value.size || value.size > MAX_BYTES.photo) {
    return { key: "", size: 0 };
  }
  const key = `${crypto.randomUUID()}-${label}.webp`;
  await env.MEDIA.put(key, value.stream(), { httpMetadata: { contentType: "image/webp" } });
  written.push(key);
  return { key, size: value.size };
}
