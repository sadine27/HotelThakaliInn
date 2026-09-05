-- What a page view records, widened from "which page, from where, what day".
--
-- The five columns before this could not answer a single question the owner
-- actually asked: how many DIFFERENT people came, whether anyone came back,
-- which countries they were in, what path they walked through the site. Those
-- were never hidden behind a setting — they had never been written down. A
-- refresh counted twice and there was no way to know.
--
-- Added as nullable columns on the existing table rather than a second one:
-- every row is still one page view, and a join would buy nothing but a join.
-- The 288 rows already here keep their counts and simply have no geography.
--
-- `visitor` is a truncated hash of the address and the user agent. It is not a
-- privacy measure -- the address is stored in the next column along -- it is
-- what makes "unique views", "came back", and "Home then Rooms then Contact"
-- expressible at all.
--
-- `ip` is the one field with legal weight. It is kept, and blanked after a
-- year by the nightly health worker; the country, the counts and the journeys
-- outlive it. /privacy says so in as many words, and only the developer (or an
-- owner holding a 24-hour grant) can reveal one -- every reveal writes an audit
-- row naming who looked.
--
-- `at` is the Kathmandu wall-clock timestamp. `created_at` is UTC and was read
-- by nothing; hour-of-day is a question about the hotel's day, not London's.

ALTER TABLE page_views ADD COLUMN country TEXT NOT NULL DEFAULT '';
ALTER TABLE page_views ADD COLUMN city    TEXT NOT NULL DEFAULT '';
ALTER TABLE page_views ADD COLUMN region  TEXT NOT NULL DEFAULT '';
ALTER TABLE page_views ADD COLUMN network TEXT NOT NULL DEFAULT '';
ALTER TABLE page_views ADD COLUMN device  TEXT NOT NULL DEFAULT '';
ALTER TABLE page_views ADD COLUMN browser TEXT NOT NULL DEFAULT '';
ALTER TABLE page_views ADD COLUMN visitor TEXT NOT NULL DEFAULT '';
ALTER TABLE page_views ADD COLUMN ip      TEXT NOT NULL DEFAULT '';
ALTER TABLE page_views ADD COLUMN at      TEXT NOT NULL DEFAULT '';

-- One visitor's journey, in order: the only query shape that reads a single
-- person's rows, and the one that would otherwise scan the whole table.
CREATE INDEX IF NOT EXISTS idx_page_views_visitor ON page_views(visitor, id);

-- Country and unique-visitor counts are always asked over a date window; the
-- day index alone made those scan every row in it.
CREATE INDEX IF NOT EXISTS idx_page_views_day_visitor ON page_views(day, visitor);
