-- Replaces the 12 sparse placeholder amenity rows with the real facility list
-- transcribed from Hotel Thakali Inn's Booking.com listing (assets/aminities
-- screenshots, 2026-09-02): "Facilities of Hotel Thakali Inn" and
-- "Restaurants" pages. `tag` carries the category heading Booking.com groups
-- each item under (the same "grouping heading in `tag`" pattern the cuisine
-- menu already uses) so the admin and, later, the public page can group by
-- it. `paid` is set wherever Booking.com marked an item "Additional charge",
-- "extra fee", or off-site/on-request with a cost implied. `icon` is left
-- blank throughout — no icon files exist to seed; staff upload them via the
-- new admin field one at a time, same as photos.
--
-- The one existing photo (front-desk.jpg) is carried over onto its nearest
-- equivalent, 24-hour-front-desk.

DELETE FROM content WHERE section = 'amenity';

INSERT INTO content (section, slug, position, title, tag, body, image, paid) VALUES
  -- Bathroom
  ('amenity', 'toilet-paper',        0, 'Toilet paper',        'Bathroom', '', '', 0),
  ('amenity', 'towels',              1, 'Towels',               'Bathroom', '', '', 0),
  ('amenity', 'towels-sheets-fee',   2, 'Towels/sheets',        'Bathroom', 'Extra fee for additional sets.', '', 1),
  ('amenity', 'slippers',            3, 'Slippers',             'Bathroom', '', '', 0),
  ('amenity', 'private-bathroom',    4, 'Private bathroom',     'Bathroom', '', '', 0),
  ('amenity', 'toilet',              5, 'Toilet',               'Bathroom', '', '', 0),
  ('amenity', 'free-toiletries',     6, 'Free toiletries',      'Bathroom', '', '', 0),
  ('amenity', 'shower',              7, 'Shower',               'Bathroom', '', '', 0),

  -- Food & Drink
  ('amenity', 'coffee-house',        10, 'Coffee house on site', 'Food & Drink', '', '', 0),
  ('amenity', 'fruit',               11, 'Fruit',                'Food & Drink', 'Additional charge.', '', 1),
  ('amenity', 'wine-champagne',      12, 'Wine/Champagne',       'Food & Drink', 'Additional charge.', '', 1),
  ('amenity', 'kid-friendly-buffet', 13, 'Kid-friendly buffet',  'Food & Drink', '', '', 0),
  ('amenity', 'kids-meals',          14, "Kids' meals",          'Food & Drink', 'Additional charge.', '', 1),
  ('amenity', 'special-diet-meals',  15, 'Special diet meals',   'Food & Drink', 'On request.', '', 0),
  ('amenity', 'breakfast-in-room',   16, 'Breakfast in the room','Food & Drink', '', '', 0),
  ('amenity', 'bar',                 17, 'Bar',                  'Food & Drink', 'Additional charge.', '', 1),
  ('amenity', 'minibar',             18, 'Minibar',              'Food & Drink', '', '', 0),
  ('amenity', 'main-restaurant',     19, 'Main Restaurant',      'Food & Drink', 'Cuisine: American, Chinese, Indian, Nepalese, European. Open for breakfast and brunch. Family-friendly, traditional and modern ambience. Halal dietary option available.', '', 0),
  ('amenity', 'tea-coffee-maker',    20, 'Tea/Coffee maker',     'Food & Drink', '', '', 0),

  -- Business Facilities
  ('amenity', 'fax-photocopying',    30, 'Fax/Photocopying',     'Business Facilities', '', '', 0),
  ('amenity', 'meeting-banquet',     31, 'Meeting/Banquet facilities', 'Business Facilities', 'Additional charge.', '', 1),

  -- Safety & security
  ('amenity', 'fire-extinguishers',  40, 'Fire extinguishers',   'Safety & security', '', '', 0),
  ('amenity', 'cctv-outside',        41, 'CCTV outside property','Safety & security', '', '', 0),
  ('amenity', 'cctv-common-areas',   42, 'CCTV in common areas', 'Safety & security', '', '', 0),
  ('amenity', 'smoke-alarms',        43, 'Smoke alarms',         'Safety & security', '', '', 0),
  ('amenity', 'security-alarm',      44, 'Security alarm',       'Safety & security', '', '', 0),
  ('amenity', 'security-24h',        45, '24-hour security',     'Safety & security', '', '', 0),

  -- Outdoors
  ('amenity', 'outdoor-furniture',   50, 'Outdoor furniture',    'Outdoors', '', '', 0),

  -- Kitchen
  ('amenity', 'dining-table',        60, 'Dining table',         'Kitchen', '', '', 0),
  ('amenity', 'electric-kettle',     61, 'Electric kettle',      'Kitchen', '', '', 0),
  ('amenity', 'microwave',           62, 'Microwave',            'Kitchen', '', '', 0),

  -- Room amenities
  ('amenity', 'clothes-rack',        70, 'Clothes rack',         'Room amenities', '', '', 0),

  -- Pets
  ('amenity', 'pets',                80, 'Pets',                 'Pets', 'Allowed on request. No extra charges.', '', 0),

  -- Activities
  ('amenity', 'themed-dinners',      90, 'Themed dinners',       'Activities', 'Additional charge.', '', 1),
  ('amenity', 'cycling',             91, 'Cycling',              'Activities', 'Off-site.', '', 0),
  ('amenity', 'hiking',              92, 'Hiking',               'Activities', 'Off-site. Additional charge.', '', 1),
  ('amenity', 'golf-course',         93, 'Golf course', 'Activities', 'Within 2 miles. Additional charge.', '', 1),

  -- Living Area
  ('amenity', 'dining-area',         100, 'Dining area',          'Living Area', '', '', 0),
  ('amenity', 'desk',                101, 'Desk',                 'Living Area', '', '', 0),

  -- Media & Technology
  ('amenity', 'flat-screen-tv',      110, 'Flat-screen TV',       'Media & Technology', '', '', 0),

  -- Internet
  ('amenity', 'wifi',                120, 'WiFi', 'Internet', 'Available in all areas. Free of charge.', '', 0),

  -- Parking
  ('amenity', 'parking',             130, 'Parking', 'Parking', 'Free public parking on site. Reservation not needed.', '', 0),

  -- Front Desk Services
  ('amenity', 'invoice-provided',    140, 'Invoice provided',    'Front Desk Services', '', '', 0),
  ('amenity', 'lockers',             141, 'Lockers',              'Front Desk Services', '', '', 0),
  ('amenity', 'private-checkinout',  142, 'Private check-in/out', 'Front Desk Services', '', '', 0),
  ('amenity', 'concierge',           143, 'Concierge',            'Front Desk Services', '', '', 0),
  ('amenity', 'baggage-storage',     144, 'Baggage storage',      'Front Desk Services', '', '', 0),
  ('amenity', 'express-checkinout',  145, 'Express check-in/out', 'Front Desk Services', '', '', 0),
  ('amenity', '24-hour-front-desk',  146, '24-hour front desk',   'Front Desk Services', 'Late arrivals are normal here.', '/media/amenities/front-desk.jpg', 0),

  -- Cleaning Services
  ('amenity', 'daily-housekeeping',  150, 'Daily housekeeping',   'Cleaning Services', '', '', 0),
  ('amenity', 'suit-press',          151, 'Suit press',           'Cleaning Services', 'Additional charge.', '', 1),
  ('amenity', 'ironing-service',     152, 'Ironing service',      'Cleaning Services', 'Additional charge.', '', 1),
  ('amenity', 'dry-cleaning',        153, 'Dry cleaning',         'Cleaning Services', 'Additional charge.', '', 1),
  ('amenity', 'laundry',             154, 'Laundry',              'Cleaning Services', 'Additional charge.', '', 1),

  -- General
  ('amenity', 'airport-shuttle',     160, 'Airport shuttle',      'General', 'Additional charge.', '', 1),
  ('amenity', 'designated-smoking-area', 161, 'Designated smoking area', 'General', '', '', 0),
  ('amenity', 'air-conditioning',    162, 'Air conditioning',     'General', '', '', 0),
  ('amenity', 'smoke-free-property', 163, 'Smoke-free property',  'General', '', '', 0),
  ('amenity', 'hypoallergenic-room', 164, 'Hypoallergenic room available', 'General', '', '', 0),
  ('amenity', 'wake-up-service',     165, 'Wake-up service',      'General', '', '', 0),
  ('amenity', 'heating',             166, 'Heating',              'General', '', '', 0),
  ('amenity', 'soundproof-rooms',    167, 'Soundproof rooms',     'General', '', '', 0),
  ('amenity', 'fan',                 168, 'Fan',                  'General', '', '', 0),
  ('amenity', 'family-rooms',        169, 'Family rooms',         'General', '', '', 0),
  ('amenity', 'non-smoking-rooms',   170, 'Non-smoking rooms',    'General', '', '', 0),
  ('amenity', 'room-service',        171, 'Room service',         'General', '', '', 0),

  -- Languages Spoken
  ('amenity', 'lang-english',        180, 'English', 'Languages Spoken', '', '', 0),
  ('amenity', 'lang-hindi',          181, 'Hindi',   'Languages Spoken', '', '', 0);
