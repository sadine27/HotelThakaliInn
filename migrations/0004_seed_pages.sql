-- The two pages that have rendered `null` since the site was built. Same table
-- and same shape as every other section, so they get the admin editor for free.
--
-- Every fact below already exists as verified copy elsewhere in the seed: the
-- breakfast window is rooms_good_to_know's "Breakfast buffet, 7–10 am", the
-- in-room list is the rooms_shared string, and the distances are the `arrival`
-- rows. Nothing here is invented — if a fact is not in 0003, it is not here.
--
-- `extra` on breakfast carries {"from":"HH:MM","to":"HH:MM"} for the rows that
-- are time-anchored, in 24h Kathmandu local time. The serving strip compares
-- them against the live clock, so a staff member changing the window in the
-- admin changes what the page says is happening right now.

INSERT INTO content (section, slug, position, title, tag, body, image, extra) VALUES
  ('breakfast', 'buffet',  0, 'The buffet', '7:00 – 10:00',
   'A hot Thakali breakfast laid out every morning in the dining room, with eggs cooked to order, toast, fresh fruit and juice alongside.',
   '/media/breakfast/buffet.jpg', '{"from":"07:00","to":"10:00"}'),
  -- No photo of a packed box exists, so this row carries the buffet''s fruit
  -- platter and says as much. A picture captioned as the thing it is not is the
  -- one kind of dishonesty a hotel page cannot afford.
  ('breakfast', 'packed',  1, 'Packed for early flights', 'Before 7:00',
   'Ask the front desk the night before and breakfast is boxed and waiting when you leave.',
   '/media/breakfast/fruit.jpg', '{"from":"00:00","to":"07:00"}'),
  ('breakfast', 'dining',  2, 'The dining room', '',
   'On the ground floor, a minute from the lobby.',
   '/media/breakfast/dining.jpg', '{}');

-- Mostly facts, mostly without photos. The first eight are the rooms_shared
-- string split into its parts; the last four are the `arrival` settings rows.
INSERT INTO content (section, slug, position, title, tag, body, image, extra) VALUES
  ('amenity', 'air-conditioning', 0, 'Air conditioning',   'Every room',        '', '', '{}'),
  ('amenity', 'wifi',             1, 'Free WiFi',          'Whole property',    '', '', '{}'),
  ('amenity', 'bathroom',         2, 'Private bathroom',   'Every room',        '', '', '{}'),
  ('amenity', 'tv',               3, 'Flat-screen TV',     'Every room',        '', '', '{}'),
  ('amenity', 'tea',              4, 'Tea & coffee maker', 'Every room',        '', '', '{}'),
  ('amenity', 'minibar',          5, 'Minibar',            'Every room',        '', '', '{}'),
  ('amenity', 'desk',             6, 'Desk',               'Every room',        '', '', '{}'),
  ('amenity', 'soundproofing',    7, 'Soundproofing',      'Every room',        '', '', '{}'),
  ('amenity', 'front-desk',       8, 'Front desk',         'Through the night', 'Late arrivals are normal here.', '/media/amenities/front-desk.jpg', '{}'),
  ('amenity', 'shuttle',          9, 'Airport shuttle',    'On request, paid',  '', '', '{}'),
  ('amenity', 'terminal',        10, 'TIA terminal',       '950 m',             '', '', '{}'),
  ('amenity', 'entrance',        11, 'Airport main entrance', '1.1 km',         '', '', '{}');
