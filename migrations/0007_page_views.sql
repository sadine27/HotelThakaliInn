-- One row per page a visitor actually looked at. Deliberately not analytics in
-- the tracking sense: no IP, no user-agent, no cookie, nothing that identifies
-- a person or follows them between visits. Two questions this answers and no
-- others — which pages get read, and where the reader came from.
--
-- `day` is the Kathmandu date, written by the route rather than derived here,
-- because SQLite's date('now') is UTC and would file a 1am Kathmandu view under
-- yesterday. Every count in the admin panel groups on this column.

-- SUPERSEDED by migration 0020 (September 2026): the owner asked for unique
-- visitors, countries and journeys, and none of those are expressible without
-- recording something per visitor. This table now also holds country, city,
-- network, device, browser, a per-visitor hash and the address itself. The
-- reasoning above is kept because it is the decision that was overturned, not
-- a mistake -- see /privacy for what replaced it.

CREATE TABLE IF NOT EXISTS page_views (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  path       TEXT    NOT NULL,
  -- The referring HOST only ("google.com"), never the full URL: the full URL is
  -- what carries a search query or someone's private page path, and the host is
  -- the whole of what we actually use.
  referrer   TEXT    NOT NULL DEFAULT '',
  day        TEXT    NOT NULL,   -- YYYY-MM-DD, Kathmandu local
  created_at TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- Every dashboard query is "views since <day>", so this is the only index the
-- table needs.
CREATE INDEX IF NOT EXISTS idx_page_views_day ON page_views(day);
