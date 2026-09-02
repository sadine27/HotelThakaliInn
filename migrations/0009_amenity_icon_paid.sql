-- Two columns every section gets for free, so amenities can carry a small icon
-- (uploaded, same as a photo, into the same MEDIA bucket) and a paid/free flag
-- without a per-section table. Unused by every other section today.

ALTER TABLE content ADD COLUMN icon TEXT NOT NULL DEFAULT '';
ALTER TABLE content ADD COLUMN paid INTEGER NOT NULL DEFAULT 0;
