-- Meals get their own facts, and "good to know" stops being three typed
-- sentences.
--
-- What was there: rooms_good_to_know held
--   ["Breakfast buffet, 7-10 am",
--    "Airport shuttle on request, paid",
--    "950 m from the airport, 1.1 km from its main entrance"]
-- Three commas, none of them a separator. The first line was the hotel's only
-- record of when breakfast is served; the second hid a charge inside prose; the
-- third was the arrival distances typed a second time, free to drift from the
-- `arrival` row they duplicate.
--
-- What is here now: `meals` and `good_rows` are the sources someone edits, and
-- rooms_good_to_know becomes their output -- composed by composeGoodToKnow() in
-- lib/settings-schema.ts, the same way `phone` and `address` are composed. Six
-- public components keep reading exactly the string[] they always have.
--
-- The UPDATE below writes that composed form immediately, so the database is
-- consistent with what the console will produce before anyone opens it. The one
-- visible change is the third line's wording: it is written from the arrival
-- rows now, so it names the places as they are stored ("TIA terminal") rather
-- than as someone once phrased them ("the airport").
--
-- INSERT OR IGNORE, not INSERT: the settings save action only ever UPDATEs, so
-- a key that is missing here is a key that silently never persists -- but
-- re-running the migration must not overwrite real edits either.

INSERT OR IGNORE INTO settings (key, value) VALUES
  ('meals', '[{"meal":"Breakfast","style":"Buffet","from":"07:00","to":"10:00","cost":"included","price":""}]'),
  ('good_rows', '[{"text":"Airport shuttle","onRequest":true,"cost":"paid"}]');

UPDATE settings
   SET value = '["Breakfast buffet, 7–10 am","Airport shuttle on request, paid","950 m from TIA terminal, 1.1 km from Main entrance"]'
 WHERE key = 'rooms_good_to_know';
