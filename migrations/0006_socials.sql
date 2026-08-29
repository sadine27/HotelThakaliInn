-- The two accounts the hotel actually posts from. They were seeded in 0003 with
-- empty hrefs so the settings form would show the rows; this fills them in.
--
-- UPDATE rather than INSERT: 0003 already created the row, and the JSON list
-- format is the one ContactPanel reads. Guarded on the value still being the
-- empty seed, so a staff edit made before this migration ran is never
-- overwritten by it.
--
-- The Instagram URL is stored without the utm_* query string the app's share
-- sheet appends. Those parameters describe the copy of the link, not the
-- account, and storing them means every visitor is tagged as arriving from
-- whoever first pasted it.
UPDATE settings
SET value = '[{"label":"Instagram","href":"https://www.instagram.com/hotelthakaliin/"},{"label":"Facebook","href":"https://www.facebook.com/profile.php?id=61583854952907"}]'
WHERE key = 'socials'
  AND value = '[{"label":"Instagram","href":""},{"label":"Facebook","href":""}]';
