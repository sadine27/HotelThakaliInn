-- The structured halves of four facts that used to be typed as prose, plus the
-- separate WhatsApp number.
--
-- Why these ten and not more: /admin/settings now edits parts and COMPOSES the
-- string each public page reads, so `phone`, `address`, `rooms_shared` and
-- `rooms_size` keep their exact current values and every reader is untouched.
-- A part only earns a row of its own when it cannot be parsed back out of that
-- composed string — `phone` and `rooms_shared` can (a country code is a known
-- prefix, an amenity list splits on the separator), so they get nothing here.
-- A row that can be derived is a row that can drift out of sync with what it
-- was derived from.
--
-- Address and room size are prose and genuinely do not round-trip, so they get
-- real columns. Seeded from the values live on the site today, so this migration
-- changes nothing a guest can see.
--
-- INSERT OR IGNORE, not INSERT: `key` is the primary key, and a migration that
-- cannot be re-run against a database that already has the row is a migration
-- that fails the first time anyone replays the folder.

-- Sinamangal Kalimatidol, Kathmandu 44600 — split. Ward and district are blank
-- because the live address does not carry them; the form leaves them optional
-- and omits them from the composed line rather than leaving a stray comma.
INSERT OR IGNORE INTO settings (key, value) VALUES ('addr_tole',     'Sinamangal Kalimatidol');
INSERT OR IGNORE INTO settings (key, value) VALUES ('addr_ward',     '');
INSERT OR IGNORE INTO settings (key, value) VALUES ('addr_city',     'Kathmandu');
INSERT OR IGNORE INTO settings (key, value) VALUES ('addr_district', '');
INSERT OR IGNORE INTO settings (key, value) VALUES ('addr_postal',   '44600');

-- "Rooms start at about 42 m² (450 sq ft), bathroom included."
-- Note 450: 42 m² is 452 sq ft. Two hand-typed figures had already drifted apart,
-- which is the entire argument for storing one number and converting the other.
-- The composed string will read 452 from the first save onward.
INSERT OR IGNORE INTO settings (key, value) VALUES ('rooms_size_value',    '42');
INSERT OR IGNORE INTO settings (key, value) VALUES ('rooms_size_unit',     'm2');
INSERT OR IGNORE INTO settings (key, value) VALUES ('rooms_size_bathroom', '1');

-- The WhatsApp button used to derive its number from `phone` by stripping it.
-- It still does while whatsapp_same is '1' — which it is, so nothing changes on
-- deploy — but the hotel can now point WhatsApp at a different handset without
-- also changing the number printed on every page.
INSERT OR IGNORE INTO settings (key, value) VALUES ('whatsapp',      '');
INSERT OR IGNORE INTO settings (key, value) VALUES ('whatsapp_same', '1');
