-- The bar list was 122 rows for 46 drinks. Every spirit was seeded four
-- times — 'Glenfiddich (12yrs) — 30ml', '— 60ml', '— 180ml', '— 360ml' — one row
-- per pour, because 0008 turned every printed price point into its own row so
-- that price stayed a plain number. On the page that reads correctly. In the
-- editor it means changing one drink's prices is four rows to find, and adding
-- a bottle is four rows to type, each with a slug you have to get right.
--
-- So a drink becomes one row holding its pours:
--
--   extra = {"price": 700, "sizes": [{"label": "30ml", "price": 700}, ...]}
--
-- `price` stays, holding the first (smallest) pour, so every reader that predates
-- this migration keeps working — MenuBook reads `sizes` when it is there and the
-- single price when it is not, which is still the case for tea, Red Bull and
-- shisha, none of which are sold in sizes.
--
-- The split is on ' — ' in the title, which is how 0008 wrote every one of them,
-- and it is not only volumes: 'Black'/'Milk', 'Per Glass'/'Per Bottle',
-- 'Can 550ml'/'Bottle 650ml', 'Stick'/'Packet' all merge the same way. The merged
-- row keeps the stem's slug ('glenfiddich-12yrs-30ml' minus '-30ml'), so nothing
-- that linked to a drink has to be found and fixed.
--
-- Generated from the live table, not from 0008, so any price edited since the
-- seed is the price carried across. Rollback is D1 Time Travel; take a bookmark
-- before applying this to production.

DELETE FROM content WHERE section = 'menu_bar';

INSERT INTO content (section, slug, position, title, tag, body, href, image, video, icon, extra, published, paid, updated_at) VALUES
('menu_bar', 'tea-black-milk', 0, 'Tea (Black/Milk)', 'Nepali Tea', '', '', '', '', '', '{"price":50,"sizes":[{"label":"Black","price":50},{"label":"Milk","price":80}]}', 1, 0, datetime('now')),
('menu_bar', 'nepali-masala-tea-black-milk', 1, 'Nepali Masala Tea (Black/Milk)', 'Nepali Tea', '', '', '', '', '', '{"price":55,"sizes":[{"label":"Black","price":55},{"label":"Milk","price":90}]}', 1, 0, datetime('now')),
('menu_bar', 'coffee-black-milk', 2, 'Coffee (Black/Milk)', 'Nepali Tea', '', '', '', '', '', '{"price":80,"sizes":[{"label":"Black","price":80},{"label":"Milk","price":100}]}', 1, 0, datetime('now')),
('menu_bar', 'green-tea', 3, 'Green Tea', 'Nepali Tea', '', '', '', '', '', '{"price":95}', 1, 0, datetime('now')),
('menu_bar', 'hot-lemon-lemon-tea', 4, 'Hot Lemon/Lemon Tea', 'Nepali Tea', '', '', '', '', '', '{"price":80}', 1, 0, datetime('now')),
('menu_bar', 'hot-lemon-with-honey-ginger', 5, 'Hot Lemon with Honey & Ginger', 'Nepali Tea', '', '', '', '', '', '{"price":210}', 1, 0, datetime('now')),
('menu_bar', 'hot-lemon-with-honey-or-ginger-single', 6, 'Hot Lemon with Honey or Ginger (single)', 'Nepali Tea', '', '', '', '', '', '{"price":150}', 1, 0, datetime('now')),
('menu_bar', 'seasonal-mixed-fruits', 7, 'Seasonal/Mixed Fruits', 'Fresh Juices', '', '', '', '', '', '{"price":340,"sizes":[{"label":"Seasonal","price":340},{"label":"Mixed Fruits","price":380}]}', 1, 0, datetime('now')),
('menu_bar', 'real-juice-per-glass-bottle', 8, 'Real Juice (Per Glass/Bottle)', 'Fresh Juices', '', '', '', '', '', '{"price":230,"sizes":[{"label":"Per Glass","price":230},{"label":"Per Bottle","price":570}]}', 1, 0, datetime('now')),
('menu_bar', 'glenfiddich-12yrs', 9, 'Glenfiddich (12yrs)', 'Imported Liquor', '', '', '', '', '', '{"price":820,"sizes":[{"label":"30ml","price":820},{"label":"60ml","price":1550},{"label":"180ml","price":4550},{"label":"360ml","price":8550}]}', 1, 0, datetime('now')),
('menu_bar', 'gold-label-whisky', 10, 'Gold Label (Whisky)', 'Imported Liquor', '', '', '', '', '', '{"price":750,"sizes":[{"label":"30ml","price":750},{"label":"60ml","price":1450},{"label":"180ml","price":4150},{"label":"360ml","price":7950}]}', 1, 0, datetime('now')),
('menu_bar', 'double-black-label', 11, 'Double Black Label', 'Imported Liquor', '', '', '', '', '', '{"price":730,"sizes":[{"label":"30ml","price":730},{"label":"60ml","price":1390},{"label":"180ml","price":3990},{"label":"360ml","price":7500}]}', 1, 0, datetime('now')),
('menu_bar', 'chivas-regal-12yrs', 12, 'Chivas Regal (12yrs)', 'Imported Liquor', '', '', '', '', '', '{"price":620,"sizes":[{"label":"30ml","price":620},{"label":"60ml","price":1180},{"label":"180ml","price":3390},{"label":"360ml","price":6450}]}', 1, 0, datetime('now')),
('menu_bar', 'black-label', 13, 'Black Label', 'Imported Liquor', '', '', '', '', '', '{"price":580,"sizes":[{"label":"30ml","price":580},{"label":"60ml","price":1110},{"label":"180ml","price":3210},{"label":"360ml","price":5950}]}', 1, 0, datetime('now')),
('menu_bar', 'jack-daniels', 14, 'Jack Daniels', 'Imported Liquor', '', '', '', '', '', '{"price":540,"sizes":[{"label":"30ml","price":540},{"label":"60ml","price":1020},{"label":"180ml","price":2950},{"label":"360ml","price":5550}]}', 1, 0, datetime('now')),
('menu_bar', 'red-label', 15, 'Red Label', 'Imported Liquor', '', '', '', '', '', '{"price":510,"sizes":[{"label":"30ml","price":510},{"label":"60ml","price":950},{"label":"180ml","price":2790},{"label":"360ml","price":5290}]}', 1, 0, datetime('now')),
('menu_bar', 'jameson-irish-whisky', 16, 'Jameson (Irish Whisky)', 'Imported Liquor', '', '', '', '', '', '{"price":495,"sizes":[{"label":"30ml","price":495},{"label":"60ml","price":970},{"label":"180ml","price":2820},{"label":"360ml","price":5250}]}', 1, 0, datetime('now')),
('menu_bar', 'absolut-vodka', 17, 'Absolut Vodka', 'Imported Liquor', '', '', '', '', '', '{"price":450,"sizes":[{"label":"30ml","price":450},{"label":"60ml","price":850},{"label":"180ml","price":2450},{"label":"360ml","price":4650}]}', 1, 0, datetime('now')),
('menu_bar', 'vat-69', 18, 'VAT 69', 'Imported Liquor', '', '', '', '', '', '{"price":450,"sizes":[{"label":"30ml","price":450},{"label":"60ml","price":850},{"label":"180ml","price":2450},{"label":"360ml","price":4650}]}', 1, 0, datetime('now')),
('menu_bar', 'od-chimney-black', 19, 'OD Chimney (Black)', 'Domestic Liquor', '', '', '', '', '', '{"price":310,"sizes":[{"label":"30ml","price":310},{"label":"60ml","price":575},{"label":"180ml","price":1595},{"label":"360ml","price":2950}]}', 1, 0, datetime('now')),
('menu_bar', 'spiced-khukuri-rum', 20, 'Spiced Khukuri Rum', 'Domestic Liquor', '', '', '', '', '', '{"price":290,"sizes":[{"label":"30ml","price":290},{"label":"60ml","price":580},{"label":"180ml","price":1550},{"label":"360ml","price":3090}]}', 1, 0, datetime('now')),
('menu_bar', 'od-reserve-yellow', 21, 'OD Reserve (Yellow)', 'Domestic Liquor', '', '', '', '', '', '{"price":275,"sizes":[{"label":"30ml","price":275},{"label":"60ml","price":525},{"label":"180ml","price":1450},{"label":"360ml","price":2750}]}', 1, 0, datetime('now')),
('menu_bar', 'signature-rare', 22, 'Signature Rare', 'Domestic Liquor', '', '', '', '', '', '{"price":230,"sizes":[{"label":"30ml","price":230},{"label":"60ml","price":430},{"label":"180ml","price":1220},{"label":"360ml","price":2310}]}', 1, 0, datetime('now')),
('menu_bar', 'signature-premier', 23, 'Signature Premier', 'Domestic Liquor', '', '', '', '', '', '{"price":220,"sizes":[{"label":"30ml","price":220},{"label":"60ml","price":410},{"label":"180ml","price":1150},{"label":"360ml","price":2190}]}', 1, 0, datetime('now')),
('menu_bar', '8848-vodka', 24, '8848 Vodka', 'Domestic Liquor', '', '', '', '', '', '{"price":195,"sizes":[{"label":"30ml","price":195},{"label":"60ml","price":350},{"label":"180ml","price":995},{"label":"360ml","price":1890}]}', 1, 0, datetime('now')),
('menu_bar', 'ruslan-vodka', 25, 'Ruslan Vodka', 'Domestic Liquor', '', '', '', '', '', '{"price":180,"sizes":[{"label":"30ml","price":180},{"label":"60ml","price":340},{"label":"180ml","price":950},{"label":"360ml","price":1790}]}', 1, 0, datetime('now')),
('menu_bar', 'khukuri-rum', 26, 'Khukuri Rum', 'Domestic Liquor', '', '', '', '', '', '{"price":180,"sizes":[{"label":"30ml","price":180},{"label":"60ml","price":330},{"label":"180ml","price":930},{"label":"360ml","price":1750}]}', 1, 0, datetime('now')),
('menu_bar', 'golden-oak', 27, 'Golden Oak', 'Domestic Liquor', '', '', '', '', '', '{"price":115,"sizes":[{"label":"30ml","price":115},{"label":"60ml","price":210},{"label":"180ml","price":550},{"label":"360ml","price":850}]}', 1, 0, datetime('now')),
('menu_bar', 'blue-diamond', 28, 'Blue Diamond', 'Domestic Liquor', '', '', '', '', '', '{"price":115,"sizes":[{"label":"30ml","price":115},{"label":"60ml","price":210},{"label":"180ml","price":550},{"label":"360ml","price":850}]}', 1, 0, datetime('now')),
('menu_bar', 'carlsberg', 29, 'Carlsberg', 'Beer', '', '', '', '', '', '{"price":550,"sizes":[{"label":"Can 550ml","price":550},{"label":"Bottle 650ml","price":730}]}', 1, 0, datetime('now')),
('menu_bar', 'gorkha-strong', 30, 'Gorkha Strong', 'Beer', '', '', '', '', '', '{"price":430,"sizes":[{"label":"Can 550ml","price":430},{"label":"Bottle 650ml","price":590}]}', 1, 0, datetime('now')),
('menu_bar', 'tuborg', 31, 'Tuborg', 'Beer', '', '', '', '', '', '{"price":520,"sizes":[{"label":"Can 550ml","price":520},{"label":"Bottle 650ml","price":690}]}', 1, 0, datetime('now')),
('menu_bar', 'somersby-apple-cider-250ml', 32, 'Somersby Apple Cider (250ml)', 'Beer', '', '', '', '', '', '{"price":390}', 1, 0, datetime('now')),
('menu_bar', 'carlsberg-draught-beer', 33, 'Carlsberg Draught Beer', 'Draught Beer', '', '', '', '', '', '{"price":620,"sizes":[{"label":"Glass 500ml","price":620},{"label":"Jar 1500ml","price":1750}]}', 1, 0, datetime('now')),
('menu_bar', 'tuborg-draught-beer', 34, 'Tuborg Draught Beer', 'Draught Beer', '', '', '', '', '', '{"price":590,"sizes":[{"label":"Glass 500ml","price":590},{"label":"Jar 1500ml","price":1620}]}', 1, 0, datetime('now')),
('menu_bar', 'gorkha-draught-pilsner-craft-beer', 35, 'Gorkha Draught Pilsner/Craft Beer', 'Draught Beer', '', '', '', '', '', '{"price":510,"sizes":[{"label":"Glass 500ml","price":510},{"label":"Jar 1500ml","price":1490}]}', 1, 0, datetime('now')),
('menu_bar', 'barasingha-draught', 36, 'Barasingha Draught', 'Draught Beer', '', '', '', '', '', '{"price":495,"sizes":[{"label":"Glass 500ml","price":495},{"label":"Jar 1500ml","price":1420}]}', 1, 0, datetime('now')),
('menu_bar', 'domestic-wine-red-white', 37, 'Domestic Wine (Red/White)', 'Wine', '', '', '', '', '', '{"price":395,"sizes":[{"label":"Per Glass","price":395},{"label":"Per Bottle","price":1390}]}', 1, 0, datetime('now')),
('menu_bar', 'imported-wine-red-white', 38, 'Imported Wine (Red/White)', 'Wine', 'Brands: Robertson Wine, J.P. Chenet, Jacob''s Creek, Gossip.', '', '', '', '', '{"price":690,"sizes":[{"label":"Per Glass","price":690},{"label":"Per Bottle","price":2650}]}', 1, 0, datetime('now')),
('menu_bar', 'red-bull-domestic', 39, 'Red Bull (Domestic)', 'Red Bull', '', '', '', '', '', '{"price":295}', 1, 0, datetime('now')),
('menu_bar', 'red-bull-blue-imported', 40, 'Red Bull Blue (Imported)', 'Red Bull', '', '', '', '', '', '{"price":550}', 1, 0, datetime('now')),
('menu_bar', 'shisha-hukka-double-apple-mint-strawberry-apple-with-mint', 41, 'Shisha Hukka (Double Apple/Mint/Strawberry/Apple with Mint)', 'Shisha/Hukka', '', '', '', '', '', '{"price":695}', 1, 0, datetime('now')),
('menu_bar', 'extra-flavour', 42, 'Extra Flavour', 'Shisha/Hukka', '', '', '', '', '', '{"price":300}', 1, 0, datetime('now')),
('menu_bar', 'extra-coil', 43, 'Extra Coil', 'Shisha/Hukka', '', '', '', '', '', '{"price":50}', 1, 0, datetime('now')),
('menu_bar', 'surya-red-light-arctic', 44, 'Surya (Red/Light/Arctic)', 'Cigarette', '', '', '', '', '', '{"price":35,"sizes":[{"label":"Stick","price":35},{"label":"Packet","price":620}]}', 1, 0, datetime('now')),
('menu_bar', 'shikhar-ice', 45, 'Shikhar Ice', 'Cigarette', '', '', '', '', '', '{"price":30,"sizes":[{"label":"Stick","price":30},{"label":"Packet","price":450}]}', 1, 0, datetime('now'));
