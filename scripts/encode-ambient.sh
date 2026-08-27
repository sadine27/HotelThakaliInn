#!/usr/bin/env bash
# Regenerate public/media/ambient.mp4 from the camera master.
#
# The master is High 4:2:2 10-bit (yuv422p10le) at 47 Mbit/s, 134 MB, with its
# moov atom written last. Browsers decode 8-bit 4:2:0 only, and a trailing moov
# means nothing plays until the last byte lands — which is why the background
# was blank in some browsers and fine in others that had it cached.
#
# The master was shot vertically (it carries a rotation matrix, so it decodes as
# 1080x1920, not the 1920x1080 the container advertises). The backdrop is
# object-fit:cover behind a landscape page, which throws away about two thirds
# of a portrait frame's height — so crop to 16:9 here instead of encoding
# pixels nothing ever shows.
#
# The result is blurred and darkened by CSS, so 720p is well past enough.
#
#   ./scripts/encode-ambient.sh [path/to/master.MP4]

set -euo pipefail

SRC="${1:-public/media/RB6998.MP4}"
OUT="public/media/ambient.mp4"

[ -f "$SRC" ] || { echo "master not found: $SRC" >&2; exit 1; }

ffmpeg -hide_banner -y -i "$SRC" \
  -map 0:v:0 -an -dn -sn \
  -vf "crop=1080:608,scale=1280:720,fps=25" \
  -c:v libx264 -profile:v high -pix_fmt yuv420p \
  -preset slow -crf 28 -g 50 \
  -movflags +faststart \
  "$OUT"

echo "wrote $OUT ($(du -h "$OUT" | cut -f1))"
