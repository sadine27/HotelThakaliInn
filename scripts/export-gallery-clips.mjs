/* One-off: cut the twelve gallery panel loops from the camera originals.
 *
 * The sources live in assets/, outside public/. They are 1080x1920 portrait
 * (stored 1920x1080 with rotation=90 in the container, so ffmpeg autorotates
 * on transcode), 50fps, 60-135MB each. This writes silent panel loops at
 * 1080x1920 / 25fps into public/media/gallery/, plus a poster frame for each.
 *
 * WIDTH is the source's own width on purpose. An open stripe is about half the
 * viewport - ~960 CSS px on a 1920 screen, full height - and object-fit:cover
 * scales by max(960/W, 1080/H). At the 720 these were first cut to that is a
 * 1.33x UPSCALE, which is what made the open panel look soft; at 1080 it is a
 * 0.89x downscale instead. 1080 is also the ceiling: the camera has no more to
 * give, so exporting wider would only invent pixels.
 *
 * Each loop is a ping-pong: the 5s window forward, then the same window
 * reversed, so playback turns around instead of cutting. A plain 5s loop
 * snapped visibly on restart, because the gimbal has drifted by the end and
 * the last frame does not match the first. Ping-pong makes every panel
 * seamless at any loop count, at ~2x the duration and file size.
 *
 * `start` is not a guess. For every candidate clip the steadiest 5s window was
 * found by sampling frame-to-frame luma difference at 8fps
 * (tblend=all_mode=difference -> signalstats YAVG) and taking the minimum
 * rolling 40-frame mean. Handheld gimbal footage drifts; this picks the part
 * that sits still. `motion` below is that window's score, kept as a record.
 *
 * A low motion score alone is not enough: RB6994 (#134) scored well but its
 * calmest window is where the camera has already panned off the dining room
 * onto reception. Check what the window actually shows, not just how still
 * it is.
 *
 * One caveat worth keeping: RB6964 (#104) is the only clip of the 144 with
 * no rotation side data - it is genuinely landscape, and mixing it into a
 * portrait row breaks the panel grid. Check rotation before swapping a pick.
 *
 * The second six were added when the gallery became a windowed carousel; six
 * panels behind a six-wide window cannot rotate. Three picks were rejected on
 * the way and are recorded so nobody re-tries them:
 *   - RB6908 (tea tray) and RB6989 (front entrance) score 62.2 and 61.1. The
 *     worst window that ever shipped is dining at 44.6, so both are out.
 *   - RB6870 and RB6910 score well (18.3, 24.6) but their calm windows show a
 *     bathroom and a second double bed - duplicates of panels 09 and 05. This
 *     is the RB6994 trap again: score first, then LOOK at the window.
 * Two panels have no window to search: RB6987 and RB6908 are 5.28s, barely
 * over LEN, so start is forced to 0.
 *
 * Needs ffmpeg on PATH (winget install Gyan.FFmpeg), or set FFMPEG=<path>.
 * Run once:  node scripts/export-gallery-clips.mjs
 * The outputs are what ship; this file exists to record how they were made.
 */

import { execFileSync } from "node:child_process";
import { mkdir, stat } from "node:fs/promises";

const FFMPEG = process.env.FFMPEG ?? "ffmpeg";
const SRC = "assets/Hotel Thakali Inn Reels n photos/CLIP";
const OUT = "public/media/gallery";
const LEN = 5;
/* 50fps buys nothing for a muted background loop and costs ~2x bitrate */
const FPS = 25;
/* native; see the note above before lowering it */
const WIDTH = 1080;

/* clip = position in the CLIP folder, kept so a pick can be traced back to the
   contact sheets. start/motion come from the window search described above. */
const PANELS = [
  { slug: "signage",   file: "RB6987", clip: 127, start: 0.00, motion: 37.6 }, // street sign, from below
  { slug: "arrival",   file: "RB7004", clip: 144, start: 1.12, motion: 25.5 }, // reception desk
  { slug: "lobby",     file: "RB6992", clip: 132, start: 0.00, motion: 20.9 }, // waiting area, red floor
  { slug: "corridor",  file: "RB6862", clip: 2,   start: 0.00, motion: 30.2 }, // room door standing open
  { slug: "rooms",     file: "RB6904", clip: 44,  start: 2.88, motion: 7.9 },  // king bed, headboard lamps
  { slug: "bedside",   file: "RB6915", clip: 55,  start: 7.88, motion: 17.4 }, // twin beds, print, lamp
  { slug: "window",    file: "RB6906", clip: 46,  start: 1.12, motion: 23.2 }, // curtains, two armchairs
  { slug: "minibar",   file: "RB6875", clip: 15,  start: 2.25, motion: 35.2 }, // stocked fridge, door open
  { slug: "bathrooms", file: "RB6919", clip: 59,  start: 1.00, motion: 12.3 }, // twin vanity, mirror wall
  { slug: "dining",    file: "RB6996", clip: 136, start: 0.00, motion: 44.6 }, // dining hall, laid tables
  { slug: "buffet",    file: "RB6945", clip: 85,  start: 2.88, motion: 28.8 }, // chafing dishes, wicker chairs
  { slug: "breakfast", file: "RB6970", clip: 110, start: 0.25, motion: 24.7 }, // plated Thakali breakfast
];

await mkdir(OUT, { recursive: true });

for (const p of PANELS) {
  const src = `${SRC}/${p.file}.MP4`;

  /* fps before split so the frame count is exact and the trims below are
     predictable. The reversed half drops its first and last frame: without
     that, the turnaround frame and the loop-point frame each play twice and
     the motion visibly hitches at both ends. */
  const frames = LEN * FPS;
  const pingpong =
    `[0:v]scale=${WIDTH}:-2,fps=${FPS},split[a][b];` +
    `[b]reverse,trim=start_frame=1:end_frame=${frames - 1},setpts=PTS-STARTPTS[r];` +
    `[a][r]concat=n=2:v=1[v]`;

  execFileSync(FFMPEG, [
    "-v", "error", "-y",
    /* both trims are INPUT options: as an output option -t would cap the
       finished ping-pong at LEN and silently throw the reversed half away. */
    "-ss", String(p.start), "-t", String(LEN), "-i", src,
    "-an",
    "-filter_complex", pingpong, "-map", "[v]",
    "-c:v", "libx264", "-profile:v", "high", "-preset", "slow", "-crf", "26",
    "-pix_fmt", "yuv420p", "-movflags", "+faststart",
    `${OUT}/${p.slug}.mp4`,
  ]);

  /* Poster is pulled from inside the same window, not frame 0 - the first
     frame of a moving shot is the one most likely to be mid-blur. */
  execFileSync(FFMPEG, [
    "-v", "error", "-y",
    "-ss", String(p.start + LEN / 2), "-i", src, "-frames:v", "1",
    "-vf", `scale=${WIDTH}:-2`, "-q:v", "3",
    `${OUT}/${p.slug}.jpg`,
  ]);

  const mp4 = await stat(`${OUT}/${p.slug}.mp4`);
  const jpg = await stat(`${OUT}/${p.slug}.jpg`);
  console.log(
    `${p.slug.padEnd(10)} ${p.file} #${String(p.clip).padStart(3)} ` +
    `@${p.start}s  mp4 ${(mp4.size / 1024).toFixed(0)}KB  poster ${(jpg.size / 1024).toFixed(0)}KB`
  );
}
