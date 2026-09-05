-- The photo bank: one row per file staff have uploaded.
--
-- Until now R2 held the only record of an upload, which meant the bucket could
-- answer "what is stored" but nothing could answer "who put it there, when, how
-- big, and is it a photo or a video". `content.image` held a path and nothing
-- else. Three things need those answers and none of them can ask R2 cheaply: the
-- daily upload cap (a COUNT, not a bucket scan), the storage gauge (a SUM), and
-- the bank screen itself.
--
-- `content` is deliberately untouched. `content.image` stays a plain
-- '/img/<key>' string, so every page that reads a photo today keeps working and
-- the seeded '/media/...' files in the repo stay valid choices. The bank is
-- additive: a row here describes an upload, it does not own the reference.

CREATE TABLE IF NOT EXISTS media_assets (
  key         TEXT PRIMARY KEY,           -- R2 object key; the public path is '/img/' || key
  kind        TEXT NOT NULL,              -- 'photo' | 'video'
  name        TEXT NOT NULL DEFAULT '',   -- the filename it arrived as, so it can be searched for
  mime        TEXT NOT NULL,
  bytes       INTEGER NOT NULL,
  width       INTEGER NOT NULL DEFAULT 0,
  height      INTEGER NOT NULL DEFAULT 0,
  -- 400px copy for the contact sheet. Without it the grid downloads forty
  -- full-size photos to draw forty thumbnails.
  thumb_key   TEXT NOT NULL DEFAULT '',
  -- A video's first frame, extracted in the browser at upload. It is what the
  -- gallery card shows before the clip plays, so the still and the clip cannot
  -- drift apart.
  poster_key  TEXT NOT NULL DEFAULT '',
  -- Where the untouched original lives (a Drive link, typed by whoever uploaded
  -- it). The site never fetches this; it is here so "where is the raw file"
  -- has an answer that is not someone's memory.
  origin_url  TEXT NOT NULL DEFAULT '',
  -- What the photo shows, in words. Not used by any public page today; it is
  -- collected deliberately as labelled data.
  caption     TEXT NOT NULL DEFAULT '',
  uploaded_by TEXT NOT NULL,
  uploaded_at TEXT NOT NULL DEFAULT (datetime('now')),
  -- Kathmandu YYYY-MM-DD, same convention as page_views.day. The cap resets on
  -- the hotel's midnight, not UTC's, because that is the day staff are living
  -- in. created_at above is UTC and is the audit trail, not the counter.
  day         TEXT NOT NULL
);

-- The cap query runs on every upload: COUNT WHERE day = ? AND kind = ?.
CREATE INDEX IF NOT EXISTS media_assets_day ON media_assets(day, kind);
-- The bank lists newest first.
CREATE INDEX IF NOT EXISTS media_assets_recent ON media_assets(uploaded_at DESC);
