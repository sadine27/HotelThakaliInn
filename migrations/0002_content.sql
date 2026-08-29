-- One table for every ordered list of cards on the site — hero slides, service
-- cards, rooms, gallery panels, and the two pages still to be built. They are all
-- the same shape (title, tag, prose, image, link, a few extras), so six tables
-- would mean six near-identical admin forms to hold about thirty-five rows.
--
-- `extra` carries the per-section oddities as JSON: rooms put {count, meta, specs}
-- there. Those are ordered, room-only, never queried and never joined — always
-- read whole with their parent — so a child table would buy nothing.
CREATE TABLE IF NOT EXISTS content (
  section    TEXT    NOT NULL,              -- hero | service | room | gallery | breakfast | amenity
  slug       TEXT    NOT NULL,
  position   INTEGER NOT NULL DEFAULT 0,
  title      TEXT    NOT NULL DEFAULT '',
  tag        TEXT    NOT NULL DEFAULT '',
  body       TEXT    NOT NULL DEFAULT '',
  href       TEXT    NOT NULL DEFAULT '',
  -- Stored, not derived from the slug. The gallery used to build its media paths
  -- out of the slug; once staff can rename a slug, that silently orphans the file.
  image      TEXT    NOT NULL DEFAULT '',
  video      TEXT    NOT NULL DEFAULT '',
  extra      TEXT    NOT NULL DEFAULT '{}',
  published  INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT    NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (section, slug)
);

CREATE INDEX IF NOT EXISTS content_order ON content (section, position);

-- Scalars: the contact details, and the sentences that are true of the whole
-- property rather than of one card. Values that are lists are JSON.
CREATE TABLE IF NOT EXISTS settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
