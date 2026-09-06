-- Which amenities the /amenities page shows off used to be two arrays of slugs
-- compiled into app/amenities/page.tsx. Changing the twelve-item highlights
-- strip, or one of the six "thoughtful touches", meant a code change and a
-- deploy — for a decision that is the front desk's, not the developer's.
--
-- They move into `extra`, which every content row already carries and which
-- lib/content.ts already parses. No new column, no new table: `featured` marks
-- a row for the highlights strip, `touch` names which of the six hand-drawn
-- TouchGlyph symbols draws it in the touches row. Order in both strips follows
-- `position`, the same number that orders the page's main list, so there is
-- one ordering idea on the screen rather than two.
--
-- These eighteen slugs are exactly what the two arrays held, so the page
-- renders byte-identical the moment this lands. Every one was verified present
-- in the 0010 seed before this was written.

UPDATE content SET extra = '{"featured":1}' WHERE section = 'amenity' AND slug IN (
  'wifi', '24-hour-front-desk', 'airport-shuttle', 'main-restaurant',
  'breakfast-in-room', 'daily-housekeeping', 'air-conditioning', 'baggage-storage',
  'cctv-common-areas', 'private-bathroom', 'tea-coffee-maker', 'room-service'
);

-- No slug is in both lists, so these do not overwrite the twelve above.
UPDATE content SET extra = '{"touch":"cup"}'     WHERE section = 'amenity' AND slug = 'coffee-house';
UPDATE content SET extra = '{"touch":"fruit"}'   WHERE section = 'amenity' AND slug = 'fruit';
UPDATE content SET extra = '{"touch":"wine"}'    WHERE section = 'amenity' AND slug = 'wine-champagne';
UPDATE content SET extra = '{"touch":"buffet"}'  WHERE section = 'amenity' AND slug = 'kid-friendly-buffet';
UPDATE content SET extra = '{"touch":"minibar"}' WHERE section = 'amenity' AND slug = 'minibar';
UPDATE content SET extra = '{"touch":"diet"}'    WHERE section = 'amenity' AND slug = 'special-diet-meals';
