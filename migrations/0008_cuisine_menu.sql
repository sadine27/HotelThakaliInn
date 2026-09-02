-- The full à la carte restaurant menu, transcribed from the property's
-- printed menu (assets/menu/*.jpeg) by hand, then converted to these INSERT
-- statements by DeepSeek (scripts/ds.mjs, briefs in .ds/briefs/cuisine-menu-*.md)
-- and reviewed against the photos before being committed.
--
-- Every row's `extra` carries one numeric price: {"price": N}. A printed
-- line with multiple sizes/portions (half/full, 30-360ml pours, momo by
-- style) is split into one row per price point rather than one row holding
-- a slash-separated string, so price is always a plain sortable/filterable
-- number and a future currency toggle is just `price * rate` at render time.
--
-- Four sections, matching how the printed menu itself groups pages:
--   menu_breakfast — the restaurant's own paid breakfast (distinct from the
--                    hotel's included breakfast in the `breakfast` section)
--   menu_snacks    — kebabs, burgers, sandwiches, salads, soups, starters,
--                    noodles/fried rice
--   menu_mains     — curries, sekuwa, rice, bread, momo, platters, biryani,
--                    roti, the Thakali set, add-ons, dessert
--   menu_bar       — tea, juices, and the full alcohol/beer/wine/cigarette
--                    list
--
-- `tag` is the printed category heading; rows sharing a tag are adjacent so
-- a future UI can group by it with no extra column. Not yet rendered on any
-- page or wired into the admin whitelist — see app/admin/content/page.tsx.

INSERT INTO content (section, slug, position, title, tag, body, extra) VALUES ('menu_breakfast', 'big-boss-breakfast', 0, 'Big Boss Breakfast', 'Breakfast', 'Farm fresh eggs prepared to your preference, served with golden homemade potatoes and your choice of toasted bread. Accompanied by grilled sausage or sautéed seasonal vegetables, fresh seasonal fruits, and your selection of tea, coffee, or chilled milk.', '{"price": 495}');
INSERT INTO content (section, slug, position, title, tag, body, extra) VALUES ('menu_breakfast', 'fruit-crunchy-bowl', 1, 'Fruit & Crunchy Bowl', 'Breakfast', 'A wholesome bowl of crisp breakfast cereals with chilled milk, topped with fresh seasonal fruits. Served with your choice of tea, coffee, or milk.', '{"price": 395}');
INSERT INTO content (section, slug, position, title, tag, body, extra) VALUES ('menu_breakfast', 'toast-chill-combo', 2, 'Toast & Chill Combo', 'Breakfast', 'Golden French toast, lightly sweetened and served warm for a comforting start to your day. Accompanied by your choice of tea, coffee, or milk.', '{"price": 320}');
INSERT INTO content (section, slug, position, title, tag, body, extra) VALUES ('menu_breakfast', 'puri-bhaji', 3, 'Puri Bhaji', 'Breakfast', 'Golden fried puris served with traditional spiced potato bhaji. Served with pickle and your choice of tea or coffee.', '{"price": 485}');
INSERT INTO content (section, slug, position, title, tag, body, extra) VALUES ('menu_breakfast', 'sunrise-fruit-pancake-stack', 4, 'Sunrise Fruit Pancake Stack', 'Breakfast', 'Freshly prepared fluffy pancakes layered with vibrant seasonal fruits and delicately finished with honey or maple syrup.', '{"price": 495}');
INSERT INTO content (section, slug, position, title, tag, body, extra) VALUES ('menu_breakfast', 'choice-of-egg-breakfast', 5, 'Choice of Egg Breakfast', 'Breakfast', 'Boiled eggs / Sunny side fried eggs / Scramble eggs / Poached eggs / Plain omelet / Masala omelet.', '{"price": 300}');
INSERT INTO content (section, slug, position, title, tag, body, extra) VALUES ('menu_breakfast', 'avocado-toast', 6, 'Avocado Toast', 'Breakfast', 'Fresh avocado spread on toasted seeded sourdough bread, seasoned and served with garnish.', '{"price": 350}');
INSERT INTO content (section, slug, position, title, tag, body, extra) VALUES ('menu_breakfast', 'plain-toast', 7, 'Plain toast', 'Any Choice Sides', '', '{"price": 100}');
INSERT INTO content (section, slug, position, title, tag, body, extra) VALUES ('menu_breakfast', 'butter-toast', 8, 'Butter toast', 'Any Choice Sides', '', '{"price": 120}');
INSERT INTO content (section, slug, position, title, tag, body, extra) VALUES ('menu_breakfast', 'grilled-sausage', 9, 'Grilled sausage', 'Any Choice Sides', '', '{"price": 100}');
INSERT INTO content (section, slug, position, title, tag, body, extra) VALUES ('menu_breakfast', 'grilled-mushroom', 10, 'Grilled mushroom', 'Any Choice Sides', '', '{"price": 80}');
INSERT INTO content (section, slug, position, title, tag, body, extra) VALUES ('menu_breakfast', 'hash-brown-potato', 11, 'Hash brown potato', 'Any Choice Sides', '', '{"price": 80}');
INSERT INTO content (section, slug, position, title, tag, body, extra) VALUES
('menu_snacks', 'paneer-tikka', 0, 'Paneer Tikka', 'Indian Veg Kebab/Snacks', '', '{"price": 590}'),
('menu_snacks', 'paneer-chilly-kebab', 1, 'Paneer Chilly', 'Indian Veg Kebab/Snacks', '', '{"price": 510}'),
('menu_snacks', 'kaju-fry', 2, 'Kaju Fry', 'Indian Veg Kebab/Snacks', '', '{"price": 490}'),
('menu_snacks', 'tandoori-chatpata', 3, 'Tandoori Chatpata', 'Indian Veg Kebab/Snacks', '', '{"price": 480}'),
('menu_snacks', 'pakoda-paneer', 4, 'Pakoda (Paneer)', 'Indian Veg Kebab/Snacks', '', '{"price": 480}'),
('menu_snacks', 'pakoda-veggies', 5, 'Pakoda (Veggies)', 'Indian Veg Kebab/Snacks', '', '{"price": 530}'),
('menu_snacks', 'mushroom-kebab', 6, 'Mushroom Kebab', 'Indian Veg Kebab/Snacks', '', '{"price": 470}'),
('menu_snacks', 'corn-peri-peri-or-boil', 7, 'Corn (Peri-Peri or Boil)', 'Indian Veg Kebab/Snacks', '', '{"price": 350}'),
('menu_snacks', 'mix-veg-tempura', 8, 'Mix Veg Tempura', 'Indian Veg Kebab/Snacks', '', '{"price": 440}'),
('menu_snacks', 'manchurian-veg-gobi', 9, 'Manchurian (Veg/Gobi)', 'Indian Veg Kebab/Snacks', '', '{"price": 390}'),
('menu_snacks', 'french-fry', 10, 'French Fry', 'Indian Veg Kebab/Snacks', '', '{"price": 350}'),
('menu_snacks', 'chips-chilly', 11, 'Chips Chilly', 'Indian Veg Kebab/Snacks', '', '{"price": 410}'),
('menu_snacks', 'seekh-kabab-chicken', 12, 'Seekh Kabab (Chicken)', 'Indian Non-Veg Kabab & Snacks', '', '{"price": 680}'),
('menu_snacks', 'seekh-kabab-mutton', 13, 'Seekh Kabab (Mutton)', 'Indian Non-Veg Kabab & Snacks', '', '{"price": 780}'),
('menu_snacks', 'tandoori-chicken-half', 14, 'Tandoori Chicken (Half)', 'Indian Non-Veg Kabab & Snacks', '', '{"price": 650}'),
('menu_snacks', 'tandoori-chicken-full', 15, 'Tandoori Chicken (Full)', 'Indian Non-Veg Kabab & Snacks', '', '{"price": 1200}'),
('menu_snacks', 'fish-tikka', 16, 'Fish Tikka', 'Indian Non-Veg Kabab & Snacks', '', '{"price": 650}'),
('menu_snacks', 'murgh-malai-tikka', 17, 'Murgh Malai Tikka', 'Indian Non-Veg Kabab & Snacks', '', '{"price": 695}'),
('menu_snacks', 'crispy-chicken', 18, 'Crispy Chicken', 'Indian Non-Veg Kabab & Snacks', '', '{"price": 550}'),
('menu_snacks', 'choila-buff-chicken', 19, 'Choila (Buff/Chicken)', 'Indian Non-Veg Kabab & Snacks', '', '{"price": 450}'),
('menu_snacks', 'mutton-banjara-kabab', 20, 'Mutton Banjara Kabab', 'Indian Non-Veg Kabab & Snacks', '', '{"price": 590}'),
('menu_snacks', 'chicken-65', 21, 'Chicken 65', 'Indian Non-Veg Kabab & Snacks', '', '{"price": 560}'),
('menu_snacks', 'kathi-roll-veg', 22, 'Kathi Roll (Veg)', 'Indian Non-Veg Kabab & Snacks', '', '{"price": 280}'),
('menu_snacks', 'kathi-roll-egg', 23, 'Kathi Roll (Egg)', 'Indian Non-Veg Kabab & Snacks', '', '{"price": 330}'),
('menu_snacks', 'kathi-roll-chicken', 24, 'Kathi Roll (Chicken)', 'Indian Non-Veg Kabab & Snacks', '', '{"price": 390}'),
('menu_snacks', 'veg-cheese-burger', 25, 'Veg Cheese Burger', 'Burger', '', '{"price": 395}'),
('menu_snacks', 'crispy-chicken-burger', 26, 'Crispy Chicken Burger', 'Burger', '', '{"price": 450}'),
('menu_snacks', 'veg-sandwich', 27, 'Veg Sandwich', 'Sandwich', '', '{"price": 370}'),
('menu_snacks', 'chicken-sandwich', 28, 'Chicken Sandwich', 'Sandwich', '', '{"price": 430}'),
('menu_snacks', 'nepali-green-salad', 29, 'Nepali/Green Salad', 'Salad', '', '{"price": 350}'),
('menu_snacks', 'classical-caesar-salad-veg', 30, 'Classical Caesar Salad (Veg)', 'Salad', '', '{"price": 295}'),
('menu_snacks', 'classical-caesar-salad-non-veg', 31, 'Classical Caesar Salad (Non-Veg)', 'Salad', '', '{"price": 350}'),
('menu_snacks', 'fruit-salad-plain', 32, 'Fruit Salad (Plain)', 'Salad', '', '{"price": 350}'),
('menu_snacks', 'fruit-salad-with-curd-honey', 33, 'Fruit Salad (with Curd & Honey)', 'Salad', '', '{"price": 395}'),
('menu_snacks', 'noodles-soup-thukpa-veg', 34, 'Noodles Soup / Thukpa (Veg)', 'Soup', '', '{"price": 350}'),
('menu_snacks', 'noodles-soup-thukpa-chicken-or-buff', 35, 'Noodles Soup / Thukpa (Chicken or Buff)', 'Soup', '', '{"price": 425}'),
('menu_snacks', 'noodles-soup-thukpa-mixed', 36, 'Noodles Soup / Thukpa (Mixed)', 'Soup', '', '{"price": 470}'),
('menu_snacks', 'cream-of-soup-mushroom', 37, 'Cream Of Soup (Mushroom)', 'Soup', '', '{"price": 310}'),
('menu_snacks', 'cream-of-soup-chicken', 38, 'Cream Of Soup (Chicken)', 'Soup', '', '{"price": 360}'),
('menu_snacks', 'hot-sour-soup-veg', 39, 'Hot & Sour Soup (Veg)', 'Soup', '', '{"price": 310}'),
('menu_snacks', 'hot-sour-soup-chicken', 40, 'Hot & Sour Soup (Chicken)', 'Soup', '', '{"price": 360}'),
('menu_snacks', 'clear-soup-veg', 41, 'Clear Soup (Veg)', 'Soup', '', '{"price": 310}'),
('menu_snacks', 'clear-soup-chicken', 42, 'Clear Soup (Chicken)', 'Soup', '', '{"price": 350}'),
('menu_snacks', 'garlic-kaju-fry', 43, 'Garlic Kaju Fry', 'Starter — Veg', '', '{"price": 570}'),
('menu_snacks', 'paneer-chilly-starter', 44, 'Paneer Chilly', 'Starter — Veg', '', '{"price": 550}'),
('menu_snacks', 'cheese-ball', 45, 'Cheese Ball', 'Starter — Veg', '', '{"price": 520}'),
('menu_snacks', 'cheese-nachos', 46, 'Cheese Nachos', 'Starter — Veg', '', '{"price": 450}'),
('menu_snacks', 'corn-masala', 47, 'Corn (Masala)', 'Starter — Veg', '', '{"price": 380}'),
('menu_snacks', 'corn-boiled', 48, 'Corn (Boiled)', 'Starter — Veg', '', '{"price": 350}'),
('menu_snacks', 'french-fries-starter', 49, 'French Fries', 'Starter — Veg', '', '{"price": 335}'),
('menu_snacks', 'chips-chilly-starter', 50, 'Chips Chilly', 'Starter — Veg', '', '{"price": 370}'),
('menu_snacks', 'jhurmure-aloo-fry', 51, 'Jhurmure Aloo Fry', 'Starter — Veg', '', '{"price": 295}'),
('menu_snacks', 'mustang-aloo', 52, 'Mustang Aloo', 'Starter — Veg', '', '{"price": 310}'),
('menu_snacks', 'aloo-achar', 53, 'Aloo Achar', 'Starter — Veg', '', '{"price": 310}'),
('menu_snacks', 'sandeko-bhatmas-peanuts', 54, 'Sandeko (Bhatmas/Peanuts)', 'Starter — Veg', '', '{"price": 290}'),
('menu_snacks', 'mixed-boil-vegetables', 55, 'Mixed Boil Vegetables', 'Starter — Veg', '', '{"price": 290}'),
('menu_snacks', 'bhuja-chatpatey', 56, 'Bhuja Chatpatey', 'Starter — Veg', '', '{"price": 220}'),
('menu_snacks', 'pakoda-veg', 57, 'Pakoda (Veg)', 'Starter — Veg', '', '{"price": 390}'),
('menu_snacks', 'pakoda-paneer-starter', 58, 'Pakoda (Paneer)', 'Starter — Veg', '', '{"price": 490}'),
('menu_snacks', 'papad-dry', 59, 'Papad (Dry)', 'Starter — Veg', '', '{"price": 250}'),
('menu_snacks', 'papad-fry-or-masala', 60, 'Papad (Fry/Masala)', 'Starter — Veg', '', '{"price": 320}'),
('menu_snacks', 'mutton-sukuti-fry-sandeko', 61, 'Mutton Sukuti (Fry/Sandeko)', 'Starter — Non Veg', '', '{"price": 850}'),
('menu_snacks', 'mutton-boil', 62, 'Mutton (Boil)', 'Starter — Non Veg', '', '{"price": 700}'),
('menu_snacks', 'mutton-fry', 63, 'Mutton (Fry)', 'Starter — Non Veg', '', '{"price": 750}'),
('menu_snacks', 'mutton-bhutan-fry', 64, 'Mutton Bhutan Fry', 'Starter — Non Veg', '', '{"price": 350}'),
('menu_snacks', 'kakani-trout-fry-250g', 65, 'Kakani Trout (Fry, 250g)', 'Starter — Non Veg', '', '{"price": 690}'),
('menu_snacks', 'kakani-trout-fry-500g', 66, 'Kakani Trout (Fry, 500g)', 'Starter — Non Veg', '', '{"price": 1460}'),
('menu_snacks', 'fish-and-chips', 67, 'Fish And Chips', 'Starter — Non Veg', '', '{"price": 650}'),
('menu_snacks', 'boneless-fish-chilly', 68, 'Boneless Fish Chilly', 'Starter — Non Veg', '', '{"price": 580}'),
('menu_snacks', 'crispy-chicken-wings-6pcs', 69, 'Crispy Chicken (Wings 6pcs)', 'Starter — Non Veg', '', '{"price": 480}'),
('menu_snacks', 'crispy-chicken-boneless', 70, 'Crispy Chicken (Boneless)', 'Starter — Non Veg', '', '{"price": 520}'),
('menu_snacks', 'chicken-nachos', 71, 'Chicken Nachos', 'Starter — Non Veg', '', '{"price": 520}'),
('menu_snacks', 'chicken-pangra-fry', 72, 'Chicken Pangra Fry', 'Starter — Non Veg', '', '{"price": 370}'),
('menu_snacks', 'special-hassko-choila', 73, 'Special Hassko Choila', 'Starter — Non Veg', '', '{"price": 600}'),
('menu_snacks', 'szechuan-flavour-chicken', 74, 'Szechuan Flavour (Chicken)', 'Starter — Non Veg', '', '{"price": 540}'),
('menu_snacks', 'szechuan-flavour-badel', 75, 'Szechuan Flavour (Badel)', 'Starter — Non Veg', '', '{"price": 580}'),
('menu_snacks', 'bandel-tawa', 76, 'Bandel Tawa', 'Starter — Non Veg', '', '{"price": 550}'),
('menu_snacks', 'badel-boil', 77, 'Badel (Boil)', 'Starter — Non Veg', '', '{"price": 500}'),
('menu_snacks', 'badel-fry', 78, 'Badel (Fry)', 'Starter — Non Veg', '', '{"price": 550}'),
('menu_snacks', 'buffalo-wings-chicken-6pcs', 79, 'Buffalo Wings (Chicken 6pcs)', 'Starter — Non Veg', '', '{"price": 495}'),
('menu_snacks', 'buff-sukuti-fry-sandeko', 80, 'Buff Sukuti (Fry/Sandeko)', 'Starter — Non Veg', '', '{"price": 450}'),
('menu_snacks', 'noodles-mixed', 81, 'Noodles (Mixed)', 'Noodles/Fried Rice', '', '{"price": 425}'),
('menu_snacks', 'fried-rice-mixed', 82, 'Fried Rice (Mixed)', 'Noodles/Fried Rice', '', '{"price": 425}'),
('menu_snacks', 'noodles-chicken-buff', 83, 'Noodles (Chicken/Buff)', 'Noodles/Fried Rice', '', '{"price": 380}'),
('menu_snacks', 'fried-rice-chicken-buff', 84, 'Fried Rice (Chicken/Buff)', 'Noodles/Fried Rice', '', '{"price": 380}'),
('menu_snacks', 'noodles-egg', 85, 'Noodles (Egg)', 'Noodles/Fried Rice', '', '{"price": 360}'),
('menu_snacks', 'fried-rice-egg', 86, 'Fried Rice (Egg)', 'Noodles/Fried Rice', '', '{"price": 360}'),
('menu_snacks', 'noodles-veg', 87, 'Noodles (Veg)', 'Noodles/Fried Rice', '', '{"price": 310}'),
('menu_snacks', 'fried-rice-veg', 88, 'Fried Rice (Veg)', 'Noodles/Fried Rice', '', '{"price": 310}');
-- Indian Curry-Veg (Mid-Night Menu)
INSERT INTO content (section, slug, position, title, tag, body, extra) VALUES ('menu_mains', 'paneer-butter-masala', 0, 'Paneer Butter Masala', 'Indian Curry-Veg', '', '{"price": 585}');
INSERT INTO content (section, slug, position, title, tag, body, extra) VALUES ('menu_mains', 'palak-paneer', 1, 'Palak Paneer', 'Indian Curry-Veg', '', '{"price": 550}');
INSERT INTO content (section, slug, position, title, tag, body, extra) VALUES ('menu_mains', 'matar-paneer', 2, 'Matar Paneer', 'Indian Curry-Veg', '', '{"price": 550}');
INSERT INTO content (section, slug, position, title, tag, body, extra) VALUES ('menu_mains', 'mix-veg-curry', 3, 'Mix Veg Curry', 'Indian Curry-Veg', '', '{"price": 480}');
INSERT INTO content (section, slug, position, title, tag, body, extra) VALUES ('menu_mains', 'daal-makhani', 4, 'Daal Makhani', 'Indian Curry-Veg', '', '{"price": 480}');
INSERT INTO content (section, slug, position, title, tag, body, extra) VALUES ('menu_mains', 'rajma-curry', 5, 'Rajma Curry', 'Indian Curry-Veg', '', '{"price": 440}');
INSERT INTO content (section, slug, position, title, tag, body, extra) VALUES ('menu_mains', 'chana-masala', 6, 'Chana Masala', 'Indian Curry-Veg', '', '{"price": 440}');
INSERT INTO content (section, slug, position, title, tag, body, extra) VALUES ('menu_mains', 'daal-tadka', 7, 'Daal Tadka', 'Indian Curry-Veg', '', '{"price": 390}');
INSERT INTO content (section, slug, position, title, tag, body, extra) VALUES ('menu_mains', 'alu-mutter-curry', 8, 'Alu Mutter Curry', 'Indian Curry-Veg', '', '{"price": 390}');

-- Indian Curry-Non Veg (Mid-Night Menu)
INSERT INTO content (section, slug, position, title, tag, body, extra) VALUES ('menu_mains', 'mutton-rogan-josh', 9, 'Mutton Rogan Josh', 'Indian Curry-Non Veg', '', '{"price": 850}');
INSERT INTO content (section, slug, position, title, tag, body, extra) VALUES ('menu_mains', 'chicken-tikka-masala', 10, 'Chicken Tikka Masala', 'Indian Curry-Non Veg', '', '{"price": 695}');
INSERT INTO content (section, slug, position, title, tag, body, extra) VALUES ('menu_mains', 'chicken-butter-masala', 11, 'Chicken Butter Masala', 'Indian Curry-Non Veg', '', '{"price": 590}');
INSERT INTO content (section, slug, position, title, tag, body, extra) VALUES ('menu_mains', 'chicken-lababdar-boneless', 12, 'Chicken Lababdar (Boneless)', 'Indian Curry-Non Veg', '', '{"price": 595}');
INSERT INTO content (section, slug, position, title, tag, body, extra) VALUES ('menu_mains', 'mutton-kadai', 13, 'Mutton Kadai', 'Indian Curry-Non Veg', '', '{"price": 850}');
INSERT INTO content (section, slug, position, title, tag, body, extra) VALUES ('menu_mains', 'kadai-chicken', 14, 'Kadai Chicken', 'Indian Curry-Non Veg', '', '{"price": 595}');
INSERT INTO content (section, slug, position, title, tag, body, extra) VALUES ('menu_mains', 'fish-curry', 15, 'Fish Curry', 'Indian Curry-Non Veg', '', '{"price": 600}');

-- Sekuwa (Nepalese Style Barbeque)
INSERT INTO content (section, slug, position, title, tag, body, extra) VALUES ('menu_mains', 'mutton-500gm', 16, 'Mutton (500gm)', 'Sekuwa', '', '{"price": 1525}');
INSERT INTO content (section, slug, position, title, tag, body, extra) VALUES ('menu_mains', 'mutton-1kg', 17, 'Mutton (1kg)', 'Sekuwa', '', '{"price": 2900}');
INSERT INTO content (section, slug, position, title, tag, body, extra) VALUES ('menu_mains', 'pork-500gm', 18, 'Pork (500gm)', 'Sekuwa', '', '{"price": 815}');
INSERT INTO content (section, slug, position, title, tag, body, extra) VALUES ('menu_mains', 'pork-1kg', 19, 'Pork (1kg)', 'Sekuwa', '', '{"price": 1500}');
INSERT INTO content (section, slug, position, title, tag, body, extra) VALUES ('menu_mains', 'chicken-sekuwa-500gm', 20, 'Chicken (500gm)', 'Sekuwa', '', '{"price": 815}');
INSERT INTO content (section, slug, position, title, tag, body, extra) VALUES ('menu_mains', 'chicken-sekuwa-1kg', 21, 'Chicken (1kg)', 'Sekuwa', '', '{"price": 1500}');
INSERT INTO content (section, slug, position, title, tag, body, extra) VALUES ('menu_mains', 'mutton-sekuwa', 22, 'Mutton Sekuwa', 'Sekuwa', '', '{"price": 550}');
INSERT INTO content (section, slug, position, title, tag, body, extra) VALUES ('menu_mains', 'mutton-sekuwa-set', 23, 'Mutton Sekuwa Set', 'Sekuwa', '', '{"price": 610}');
INSERT INTO content (section, slug, position, title, tag, body, extra) VALUES ('menu_mains', 'chicken-sekuwa', 24, 'Chicken Sekuwa', 'Sekuwa', '', '{"price": 450}');
INSERT INTO content (section, slug, position, title, tag, body, extra) VALUES ('menu_mains', 'chicken-sekuwa-set', 25, 'Chicken Sekuwa Set', 'Sekuwa', '', '{"price": 510}');
INSERT INTO content (section, slug, position, title, tag, body, extra) VALUES ('menu_mains', 'pork-sekuwa', 26, 'Pork Sekuwa', 'Sekuwa', '', '{"price": 450}');
INSERT INTO content (section, slug, position, title, tag, body, extra) VALUES ('menu_mains', 'pork-sekuwa-set', 27, 'Pork Sekuwa Set', 'Sekuwa', '', '{"price": 510}');
INSERT INTO content (section, slug, position, title, tag, body, extra) VALUES ('menu_mains', 'mutton-hyakula-damakeko', 28, 'Mutton Hyakula Damakeko', 'Sekuwa', '', '{"price": 610}');
INSERT INTO content (section, slug, position, title, tag, body, extra) VALUES ('menu_mains', 'lasun-poleko', 29, 'Lasun Poleko', 'Sekuwa', '', '{"price": 290}');
INSERT INTO content (section, slug, position, title, tag, body, extra) VALUES ('menu_mains', 'chatpate-sekuwa', 30, 'Chatpate', 'Sekuwa', '', '{"price": 290}');
INSERT INTO content (section, slug, position, title, tag, body, extra) VALUES ('menu_mains', 'bhuja-set', 31, 'Bhuja Set', 'Sekuwa', '', '{"price": 150}');
INSERT INTO content (section, slug, position, title, tag, body, extra) VALUES ('menu_mains', 'tandoori-wings', 32, 'Tandoori Wings', 'Sekuwa', '', '{"price": 480}');

-- Indian Rice
INSERT INTO content (section, slug, position, title, tag, body, extra) VALUES ('menu_mains', 'butter-basmati-rice', 33, 'Butter Basmati Rice', 'Indian Rice', '', '{"price": 250}');
INSERT INTO content (section, slug, position, title, tag, body, extra) VALUES ('menu_mains', 'jeera-basmati-rice', 34, 'Jeera Basmati Rice', 'Indian Rice', '', '{"price": 230}');
INSERT INTO content (section, slug, position, title, tag, body, extra) VALUES ('menu_mains', 'plain-basmati-rice', 35, 'Plain Basmati Rice', 'Indian Rice', '', '{"price": 220}');
INSERT INTO content (section, slug, position, title, tag, body, extra) VALUES ('menu_mains', 'kasmeri-veg-pulao', 36, 'Kasmeri/Veg Pulao', 'Indian Rice', '', '{"price": 250}');

-- Indian Bread
INSERT INTO content (section, slug, position, title, tag, body, extra) VALUES ('menu_mains', 'plain-naan', 37, 'Plain Naan', 'Indian Bread', '', '{"price": 110}');
INSERT INTO content (section, slug, position, title, tag, body, extra) VALUES ('menu_mains', 'butter-naan', 38, 'Butter Naan', 'Indian Bread', '', '{"price": 140}');
INSERT INTO content (section, slug, position, title, tag, body, extra) VALUES ('menu_mains', 'garlic-naan', 39, 'Garlic Naan', 'Indian Bread', '', '{"price": 160}');
INSERT INTO content (section, slug, position, title, tag, body, extra) VALUES ('menu_mains', 'kulcha', 40, 'Kulcha', 'Indian Bread', '', '{"price": 180}');
-- CHECK: printed as 70, unusually low next to Kulcha 180; flag, don't silently "fix"
INSERT INTO content (section, slug, position, title, tag, body, extra) VALUES ('menu_mains', 'keema-naan-chicken', 41, 'Keema Naan (Chicken)', 'Indian Bread', '', '{"price": 70}');

-- Special Momo (style: Steam/Jhol/Kothy-Fry/'C' dry-or-gravy)
INSERT INTO content (section, slug, position, title, tag, body, extra) VALUES ('menu_mains', 'momo-veg-steam', 42, 'Momo (Veg, Steam)', 'Special Momo', '', '{"price": 250}');
INSERT INTO content (section, slug, position, title, tag, body, extra) VALUES ('menu_mains', 'momo-veg-jhol', 43, 'Momo (Veg, Jhol)', 'Special Momo', '', '{"price": 285}');
INSERT INTO content (section, slug, position, title, tag, body, extra) VALUES ('menu_mains', 'momo-veg-kothy-fry', 44, 'Momo (Veg, Kothy/Fry)', 'Special Momo', '', '{"price": 300}');
INSERT INTO content (section, slug, position, title, tag, body, extra) VALUES ('menu_mains', 'momo-veg-c-dry-gravy', 45, 'Momo (Veg, C Dry/Gravy)', 'Special Momo', '', '{"price": 310}');
INSERT INTO content (section, slug, position, title, tag, body, extra) VALUES ('menu_mains', 'momo-chicken-steam', 46, 'Momo (Chicken, Steam)', 'Special Momo', '', '{"price": 300}');
INSERT INTO content (section, slug, position, title, tag, body, extra) VALUES ('menu_mains', 'momo-chicken-jhol', 47, 'Momo (Chicken, Jhol)', 'Special Momo', '', '{"price": 325}');
INSERT INTO content (section, slug, position, title, tag, body, extra) VALUES ('menu_mains', 'momo-chicken-kothy-fry', 48, 'Momo (Chicken, Kothy/Fry)', 'Special Momo', '', '{"price": 335}');
INSERT INTO content (section, slug, position, title, tag, body, extra) VALUES ('menu_mains', 'momo-chicken-c-dry-gravy', 49, 'Momo (Chicken, C Dry/Gravy)', 'Special Momo', '', '{"price": 310}');
INSERT INTO content (section, slug, position, title, tag, body, extra) VALUES ('menu_mains', 'momo-buff-steam', 50, 'Momo (Buff, Steam)', 'Special Momo', '', '{"price": 300}');
INSERT INTO content (section, slug, position, title, tag, body, extra) VALUES ('menu_mains', 'momo-buff-jhol', 51, 'Momo (Buff, Jhol)', 'Special Momo', '', '{"price": 335}');
INSERT INTO content (section, slug, position, title, tag, body, extra) VALUES ('menu_mains', 'momo-buff-kothy-fry', 52, 'Momo (Buff, Kothy/Fry)', 'Special Momo', '', '{"price": 335}');
INSERT INTO content (section, slug, position, title, tag, body, extra) VALUES ('menu_mains', 'momo-buff-c-dry-gravy', 53, 'Momo (Buff, C Dry/Gravy)', 'Special Momo', '', '{"price": 355}');
INSERT INTO content (section, slug, position, title, tag, body, extra) VALUES ('menu_mains', 'momo-pork-steam', 54, 'Momo (Pork, Steam)', 'Special Momo', '', '{"price": 300}');
INSERT INTO content (section, slug, position, title, tag, body, extra) VALUES ('menu_mains', 'momo-pork-jhol', 55, 'Momo (Pork, Jhol)', 'Special Momo', '', '{"price": 335}');
INSERT INTO content (section, slug, position, title, tag, body, extra) VALUES ('menu_mains', 'momo-pork-kothy-fry', 56, 'Momo (Pork, Kothy/Fry)', 'Special Momo', '', '{"price": 350}');
INSERT INTO content (section, slug, position, title, tag, body, extra) VALUES ('menu_mains', 'momo-pork-c-dry-gravy', 57, 'Momo (Pork, C Dry/Gravy)', 'Special Momo', '', '{"price": 370}');

-- Special Platter
INSERT INTO content (section, slug, position, title, tag, body, extra) VALUES ('menu_mains', 'platter-alu-sadheko-paneer-pakoda-chicken-chilly-momo', 58, 'Alu Sadheko, Paneer Pakoda, Chicken Chilly & Chicken Mo:Mo', 'Special Platter', '', '{"price": 700}');
INSERT INTO content (section, slug, position, title, tag, body, extra) VALUES ('menu_mains', 'platter-pork-chilly-veg-momo-egg-pakoda-alu-jeera', 59, 'Pork Chilly, Veg Mo:Mo, Egg Pakoda & Alu Jeera', 'Special Platter', '', '{"price": 700}');
INSERT INTO content (section, slug, position, title, tag, body, extra) VALUES ('menu_mains', 'platter-mushroom-fried-veg-momo-french-fries-paneer-chilly', 60, 'Mushroom Fried, Veg Mo:Mo, French Fries & Paneer Chilly', 'Special Platter', '', '{"price": 700}');

-- Biryani
INSERT INTO content (section, slug, position, title, tag, body, extra) VALUES ('menu_mains', 'mutton-biryani', 61, 'Mutton Biryani', 'Biryani', '', '{"price": 660}');
INSERT INTO content (section, slug, position, title, tag, body, extra) VALUES ('menu_mains', 'chicken-biryani', 62, 'Chicken Biryani', 'Biryani', '', '{"price": 610}');
INSERT INTO content (section, slug, position, title, tag, body, extra) VALUES ('menu_mains', 'egg-biryani', 63, 'Egg Biryani', 'Biryani', '', '{"price": 510}');
INSERT INTO content (section, slug, position, title, tag, body, extra) VALUES ('menu_mains', 'veg-biryani', 64, 'Veg Biryani', 'Biryani', '', '{"price": 425}');

-- Roti
INSERT INTO content (section, slug, position, title, tag, body, extra) VALUES ('menu_mains', 'tawa-roti-plain', 65, 'Tawa Roti (Plain)', 'Roti', '', '{"price": 45}');
INSERT INTO content (section, slug, position, title, tag, body, extra) VALUES ('menu_mains', 'tawa-roti-butter', 66, 'Tawa Roti (Butter)', 'Roti', '', '{"price": 60}');
INSERT INTO content (section, slug, position, title, tag, body, extra) VALUES ('menu_mains', 'alu-paratha-set', 67, 'Alu Paratha Set', 'Roti', '20 mins, 2 pieces. Served with juju dhau and pickle.', '{"price": 310}');

-- Curry
INSERT INTO content (section, slug, position, title, tag, body, extra) VALUES ('menu_mains', 'curry-mix-veg', 68, 'Mix Veg Curry', 'Curry', '', '{"price": 350}');
INSERT INTO content (section, slug, position, title, tag, body, extra) VALUES ('menu_mains', 'curry-paneer', 69, 'Paneer Curry', 'Curry', '', '{"price": 380}');
INSERT INTO content (section, slug, position, title, tag, body, extra) VALUES ('menu_mains', 'dal-fry', 70, 'Dal Fry', 'Curry', '', '{"price": 295}');
INSERT INTO content (section, slug, position, title, tag, body, extra) VALUES ('menu_mains', 'plain-dal', 71, 'Plain Dal', 'Curry', '', '{"price": 200}');
INSERT INTO content (section, slug, position, title, tag, body, extra) VALUES ('menu_mains', 'egg-curry', 72, 'Egg Curry', 'Curry', '', '{"price": 250}');
INSERT INTO content (section, slug, position, title, tag, body, extra) VALUES ('menu_mains', 'curry-chicken', 73, 'Chicken Curry', 'Curry', '', '{"price": 390}');
INSERT INTO content (section, slug, position, title, tag, body, extra) VALUES ('menu_mains', 'curry-mutton', 74, 'Mutton Curry', 'Curry', '', '{"price": 480}');
INSERT INTO content (section, slug, position, title, tag, body, extra) VALUES ('menu_mains', 'mushroom-curry', 75, 'Mushroom Curry', 'Curry', '', '{"price": 470}');

-- Special Thakali Set
INSERT INTO content (section, slug, position, title, tag, body, extra) VALUES ('menu_mains', 'thakali-set-veg', 76, 'Veg Thakali Set', 'Special Thakali Set', 'Thakali Dhindo Set available with extra Rs 50 on this price. Includes: basmati rice, vegetable curry with potato, chicken/mutton/fish/badel/trout, green spinach, curd, mustang daal, green salad, typical chutney, tomato pickles, local organic ghee, papad, gundruk achar, juju dhau (curd).', '{"price": 450}');
INSERT INTO content (section, slug, position, title, tag, body, extra) VALUES ('menu_mains', 'thakali-set-chicken', 77, 'Chicken Thakali Set', 'Special Thakali Set', 'Thakali Dhindo Set available with extra Rs 50 on this price. Includes: basmati rice, vegetable curry with potato, chicken/mutton/fish/badel/trout, green spinach, curd, mustang daal, green salad, typical chutney, tomato pickles, local organic ghee, papad, gundruk achar, juju dhau (curd).', '{"price": 650}');
INSERT INTO content (section, slug, position, title, tag, body, extra) VALUES ('menu_mains', 'thakali-set-fish', 78, 'Fish Thakali Set', 'Special Thakali Set', 'Thakali Dhindo Set available with extra Rs 50 on this price. Includes: basmati rice, vegetable curry with potato, chicken/mutton/fish/badel/trout, green spinach, curd, mustang daal, green salad, typical chutney, tomato pickles, local organic ghee, papad, gundruk achar, juju dhau (curd).', '{"price": 650}');
INSERT INTO content (section, slug, position, title, tag, body, extra) VALUES ('menu_mains', 'thakali-set-badel', 79, 'Badel Thakali Set', 'Special Thakali Set', 'Thakali Dhindo Set available with extra Rs 50 on this price. Includes: basmati rice, vegetable curry with potato, chicken/mutton/fish/badel/trout, green spinach, curd, mustang daal, green salad, typical chutney, tomato pickles, local organic ghee, papad, gundruk achar, juju dhau (curd).', '{"price": 670}');
INSERT INTO content (section, slug, position, title, tag, body, extra) VALUES ('menu_mains', 'thakali-set-mutton', 80, 'Mutton Thakali Set', 'Special Thakali Set', 'Thakali Dhindo Set available with extra Rs 50 on this price. Includes: basmati rice, vegetable curry with potato, chicken/mutton/fish/badel/trout, green spinach, curd, mustang daal, green salad, typical chutney, tomato pickles, local organic ghee, papad, gundruk achar, juju dhau (curd).', '{"price": 695}');
INSERT INTO content (section, slug, position, title, tag, body, extra) VALUES ('menu_mains', 'thakali-set-trout', 81, 'Trout Thakali Set', 'Special Thakali Set', 'Thakali Dhindo Set available with extra Rs 50 on this price. Includes: basmati rice, vegetable curry with potato, chicken/mutton/fish/badel/trout, green spinach, curd, mustang daal, green salad, typical chutney, tomato pickles, local organic ghee, papad, gundruk achar, juju dhau (curd).', '{"price": 710}');

-- Add On
INSERT INTO content (section, slug, position, title, tag, body, extra) VALUES ('menu_mains', 'addon-chicken-bowl', 82, 'Chicken Bowl', 'Add On', '', '{"price": 225}');
INSERT INTO content (section, slug, position, title, tag, body, extra) VALUES ('menu_mains', 'addon-fish-bowl', 83, 'Fish Bowl', 'Add On', '', '{"price": 245}');
INSERT INTO content (section, slug, position, title, tag, body, extra) VALUES ('menu_mains', 'addon-mutton-bowl', 84, 'Mutton Bowl', 'Add On', '', '{"price": 300}');

-- Dessert
INSERT INTO content (section, slug, position, title, tag, body, extra) VALUES ('menu_mains', 'juju-dhau', 85, 'JuJu Dhau', 'Dessert', '', '{"price": 190}');
INSERT INTO content (section, slug, position, title, tag, body, extra) VALUES ('menu_mains', 'plain-dahi', 86, 'Plain Dahi', 'Dessert', '', '{"price": 130}');
INSERT INTO content (section, slug, position, title, tag, body, extra) VALUES ('menu_mains', 'lalomohan', 87, 'Lalomohan', 'Dessert', '', '{"price": 50}');
INSERT INTO content (section, slug, position, title, tag, body, extra) VALUES
('menu_bar', 'tea-black-milk-black', 0, 'Tea (Black/Milk) — Black', 'Nepali Tea', '', '{"price": 50}'),
('menu_bar', 'tea-black-milk-milk', 1, 'Tea (Black/Milk) — Milk', 'Nepali Tea', '', '{"price": 80}'),
('menu_bar', 'nepali-masala-tea-black-milk-black', 2, 'Nepali Masala Tea (Black/Milk) — Black', 'Nepali Tea', '', '{"price": 55}'),
('menu_bar', 'nepali-masala-tea-black-milk-milk', 3, 'Nepali Masala Tea (Black/Milk) — Milk', 'Nepali Tea', '', '{"price": 90}'),
('menu_bar', 'coffee-black-milk-black', 4, 'Coffee (Black/Milk) — Black', 'Nepali Tea', '', '{"price": 80}'),
('menu_bar', 'coffee-black-milk-milk', 5, 'Coffee (Black/Milk) — Milk', 'Nepali Tea', '', '{"price": 100}'),
('menu_bar', 'green-tea', 6, 'Green Tea', 'Nepali Tea', '', '{"price": 95}'),
('menu_bar', 'hot-lemon-lemon-tea', 7, 'Hot Lemon/Lemon Tea', 'Nepali Tea', '', '{"price": 80}'),
('menu_bar', 'hot-lemon-with-honey-ginger', 8, 'Hot Lemon with Honey & Ginger', 'Nepali Tea', '', '{"price": 210}'),
('menu_bar', 'hot-lemon-with-honey-or-ginger-single', 9, 'Hot Lemon with Honey or Ginger (single)', 'Nepali Tea', '', '{"price": 150}'),
('menu_bar', 'seasonal-mixed-fruits-seasonal', 10, 'Seasonal/Mixed Fruits — Seasonal', 'Fresh Juices', '', '{"price": 340}'),
('menu_bar', 'seasonal-mixed-fruits-mixed-fruits', 11, 'Seasonal/Mixed Fruits — Mixed Fruits', 'Fresh Juices', '', '{"price": 380}'),
('menu_bar', 'real-juice-per-glass-bottle-per-glass', 12, 'Real Juice (Per Glass/Bottle) — Per Glass', 'Fresh Juices', '', '{"price": 230}'),
('menu_bar', 'real-juice-per-glass-bottle-per-bottle', 13, 'Real Juice (Per Glass/Bottle) — Per Bottle', 'Fresh Juices', '', '{"price": 570}'),
('menu_bar', 'glenfiddich-12yrs-30ml', 14, 'Glenfiddich (12yrs) — 30ml', 'Imported Liquor', '', '{"price": 820}'),
('menu_bar', 'glenfiddich-12yrs-60ml', 15, 'Glenfiddich (12yrs) — 60ml', 'Imported Liquor', '', '{"price": 1550}'),
('menu_bar', 'glenfiddich-12yrs-180ml', 16, 'Glenfiddich (12yrs) — 180ml', 'Imported Liquor', '', '{"price": 4550}'),
('menu_bar', 'glenfiddich-12yrs-360ml', 17, 'Glenfiddich (12yrs) — 360ml', 'Imported Liquor', '', '{"price": 8550}'),
('menu_bar', 'gold-label-whisky-30ml', 18, 'Gold Label (Whisky) — 30ml', 'Imported Liquor', '', '{"price": 750}'),
('menu_bar', 'gold-label-whisky-60ml', 19, 'Gold Label (Whisky) — 60ml', 'Imported Liquor', '', '{"price": 1450}'),
('menu_bar', 'gold-label-whisky-180ml', 20, 'Gold Label (Whisky) — 180ml', 'Imported Liquor', '', '{"price": 4150}'),
('menu_bar', 'gold-label-whisky-360ml', 21, 'Gold Label (Whisky) — 360ml', 'Imported Liquor', '', '{"price": 7950}'),
('menu_bar', 'double-black-label-30ml', 22, 'Double Black Label — 30ml', 'Imported Liquor', '', '{"price": 730}'),
('menu_bar', 'double-black-label-60ml', 23, 'Double Black Label — 60ml', 'Imported Liquor', '', '{"price": 1390}'),
('menu_bar', 'double-black-label-180ml', 24, 'Double Black Label — 180ml', 'Imported Liquor', '', '{"price": 3990}'),
('menu_bar', 'double-black-label-360ml', 25, 'Double Black Label — 360ml', 'Imported Liquor', '', '{"price": 7500}'),
('menu_bar', 'chivas-regal-12yrs-30ml', 26, 'Chivas Regal (12yrs) — 30ml', 'Imported Liquor', '', '{"price": 620}'),
('menu_bar', 'chivas-regal-12yrs-60ml', 27, 'Chivas Regal (12yrs) — 60ml', 'Imported Liquor', '', '{"price": 1180}'),
('menu_bar', 'chivas-regal-12yrs-180ml', 28, 'Chivas Regal (12yrs) — 180ml', 'Imported Liquor', '', '{"price": 3390}'),
('menu_bar', 'chivas-regal-12yrs-360ml', 29, 'Chivas Regal (12yrs) — 360ml', 'Imported Liquor', '', '{"price": 6450}'),
('menu_bar', 'black-label-30ml', 30, 'Black Label — 30ml', 'Imported Liquor', '', '{"price": 580}'),
('menu_bar', 'black-label-60ml', 31, 'Black Label — 60ml', 'Imported Liquor', '', '{"price": 1110}'),
('menu_bar', 'black-label-180ml', 32, 'Black Label — 180ml', 'Imported Liquor', '', '{"price": 3210}'),
('menu_bar', 'black-label-360ml', 33, 'Black Label — 360ml', 'Imported Liquor', '', '{"price": 5950}'),
('menu_bar', 'jack-daniels-30ml', 34, 'Jack Daniels — 30ml', 'Imported Liquor', '', '{"price": 540}'),
('menu_bar', 'jack-daniels-60ml', 35, 'Jack Daniels — 60ml', 'Imported Liquor', '', '{"price": 1020}'),
('menu_bar', 'jack-daniels-180ml', 36, 'Jack Daniels — 180ml', 'Imported Liquor', '', '{"price": 2950}'),
('menu_bar', 'jack-daniels-360ml', 37, 'Jack Daniels — 360ml', 'Imported Liquor', '', '{"price": 5550}'),
('menu_bar', 'red-label-30ml', 38, 'Red Label — 30ml', 'Imported Liquor', '', '{"price": 510}'),
('menu_bar', 'red-label-60ml', 39, 'Red Label — 60ml', 'Imported Liquor', '', '{"price": 950}'),
('menu_bar', 'red-label-180ml', 40, 'Red Label — 180ml', 'Imported Liquor', '', '{"price": 2790}'),
('menu_bar', 'red-label-360ml', 41, 'Red Label — 360ml', 'Imported Liquor', '', '{"price": 5290}'),
('menu_bar', 'jameson-irish-whisky-30ml', 42, 'Jameson (Irish Whisky) — 30ml', 'Imported Liquor', '', '{"price": 495}'),
('menu_bar', 'jameson-irish-whisky-60ml', 43, 'Jameson (Irish Whisky) — 60ml', 'Imported Liquor', '', '{"price": 970}'),
('menu_bar', 'jameson-irish-whisky-180ml', 44, 'Jameson (Irish Whisky) — 180ml', 'Imported Liquor', '', '{"price": 2820}'),
('menu_bar', 'jameson-irish-whisky-360ml', 45, 'Jameson (Irish Whisky) — 360ml', 'Imported Liquor', '', '{"price": 5250}'),
('menu_bar', 'absolut-vodka-30ml', 46, 'Absolut Vodka — 30ml', 'Imported Liquor', '', '{"price": 450}'),
('menu_bar', 'absolut-vodka-60ml', 47, 'Absolut Vodka — 60ml', 'Imported Liquor', '', '{"price": 850}'),
('menu_bar', 'absolut-vodka-180ml', 48, 'Absolut Vodka — 180ml', 'Imported Liquor', '', '{"price": 2450}'),
('menu_bar', 'absolut-vodka-360ml', 49, 'Absolut Vodka — 360ml', 'Imported Liquor', '', '{"price": 4650}'),
('menu_bar', 'vat-69-30ml', 50, 'VAT 69 — 30ml', 'Imported Liquor', '', '{"price": 450}'),
('menu_bar', 'vat-69-60ml', 51, 'VAT 69 — 60ml', 'Imported Liquor', '', '{"price": 850}'),
('menu_bar', 'vat-69-180ml', 52, 'VAT 69 — 180ml', 'Imported Liquor', '', '{"price": 2450}'),
('menu_bar', 'vat-69-360ml', 53, 'VAT 69 — 360ml', 'Imported Liquor', '', '{"price": 4650}'),
('menu_bar', 'od-chimney-black-30ml', 54, 'OD Chimney (Black) — 30ml', 'Domestic Liquor', '', '{"price": 310}'),
('menu_bar', 'od-chimney-black-60ml', 55, 'OD Chimney (Black) — 60ml', 'Domestic Liquor', '', '{"price": 575}'),
('menu_bar', 'od-chimney-black-180ml', 56, 'OD Chimney (Black) — 180ml', 'Domestic Liquor', '', '{"price": 1595}'),
('menu_bar', 'od-chimney-black-360ml', 57, 'OD Chimney (Black) — 360ml', 'Domestic Liquor', '', '{"price": 2950}'),
('menu_bar', 'spiced-khukuri-rum-30ml', 58, 'Spiced Khukuri Rum — 30ml', 'Domestic Liquor', '', '{"price": 290}'),
('menu_bar', 'spiced-khukuri-rum-60ml', 59, 'Spiced Khukuri Rum — 60ml', 'Domestic Liquor', '', '{"price": 580}'),
('menu_bar', 'spiced-khukuri-rum-180ml', 60, 'Spiced Khukuri Rum — 180ml', 'Domestic Liquor', '', '{"price": 1550}'),
('menu_bar', 'spiced-khukuri-rum-360ml', 61, 'Spiced Khukuri Rum — 360ml', 'Domestic Liquor', '', '{"price": 3090}'),
('menu_bar', 'od-reserve-yellow-30ml', 62, 'OD Reserve (Yellow) — 30ml', 'Domestic Liquor', '', '{"price": 275}'),
('menu_bar', 'od-reserve-yellow-60ml', 63, 'OD Reserve (Yellow) — 60ml', 'Domestic Liquor', '', '{"price": 525}'),
('menu_bar', 'od-reserve-yellow-180ml', 64, 'OD Reserve (Yellow) — 180ml', 'Domestic Liquor', '', '{"price": 1450}'),
('menu_bar', 'od-reserve-yellow-360ml', 65, 'OD Reserve (Yellow) — 360ml', 'Domestic Liquor', '', '{"price": 2750}'),
('menu_bar', 'signature-rare-30ml', 66, 'Signature Rare — 30ml', 'Domestic Liquor', '', '{"price": 230}'),
('menu_bar', 'signature-rare-60ml', 67, 'Signature Rare — 60ml', 'Domestic Liquor', '', '{"price": 430}'),
('menu_bar', 'signature-rare-180ml', 68, 'Signature Rare — 180ml', 'Domestic Liquor', '', '{"price": 1220}'),
('menu_bar', 'signature-rare-360ml', 69, 'Signature Rare — 360ml', 'Domestic Liquor', '', '{"price": 2310}'),
('menu_bar', 'signature-premier-30ml', 70, 'Signature Premier — 30ml', 'Domestic Liquor', '', '{"price": 220}'),
('menu_bar', 'signature-premier-60ml', 71, 'Signature Premier — 60ml', 'Domestic Liquor', '', '{"price": 410}'),
('menu_bar', 'signature-premier-180ml', 72, 'Signature Premier — 180ml', 'Domestic Liquor', '', '{"price": 1150}'),
('menu_bar', 'signature-premier-360ml', 73, 'Signature Premier — 360ml', 'Domestic Liquor', '', '{"price": 2190}'),
('menu_bar', '8848-vodka-30ml', 74, '8848 Vodka — 30ml', 'Domestic Liquor', '', '{"price": 195}'),
('menu_bar', '8848-vodka-60ml', 75, '8848 Vodka — 60ml', 'Domestic Liquor', '', '{"price": 350}'),
('menu_bar', '8848-vodka-180ml', 76, '8848 Vodka — 180ml', 'Domestic Liquor', '', '{"price": 995}'),
('menu_bar', '8848-vodka-360ml', 77, '8848 Vodka — 360ml', 'Domestic Liquor', '', '{"price": 1890}'),
('menu_bar', 'ruslan-vodka-30ml', 78, 'Ruslan Vodka — 30ml', 'Domestic Liquor', '', '{"price": 180}'),
('menu_bar', 'ruslan-vodka-60ml', 79, 'Ruslan Vodka — 60ml', 'Domestic Liquor', '', '{"price": 340}'),
('menu_bar', 'ruslan-vodka-180ml', 80, 'Ruslan Vodka — 180ml', 'Domestic Liquor', '', '{"price": 950}'),
('menu_bar', 'ruslan-vodka-360ml', 81, 'Ruslan Vodka — 360ml', 'Domestic Liquor', '', '{"price": 1790}'),
('menu_bar', 'khukuri-rum-30ml', 82, 'Khukuri Rum — 30ml', 'Domestic Liquor', '', '{"price": 180}'),
('menu_bar', 'khukuri-rum-60ml', 83, 'Khukuri Rum — 60ml', 'Domestic Liquor', '', '{"price": 330}'),
('menu_bar', 'khukuri-rum-180ml', 84, 'Khukuri Rum — 180ml', 'Domestic Liquor', '', '{"price": 930}'),
('menu_bar', 'khukuri-rum-360ml', 85, 'Khukuri Rum — 360ml', 'Domestic Liquor', '', '{"price": 1750}'),
('menu_bar', 'golden-oak-30ml', 86, 'Golden Oak — 30ml', 'Domestic Liquor', '', '{"price": 115}'),
('menu_bar', 'golden-oak-60ml', 87, 'Golden Oak — 60ml', 'Domestic Liquor', '', '{"price": 210}'),
('menu_bar', 'golden-oak-180ml', 88, 'Golden Oak — 180ml', 'Domestic Liquor', '', '{"price": 550}'),
('menu_bar', 'golden-oak-360ml', 89, 'Golden Oak — 360ml', 'Domestic Liquor', '', '{"price": 850}'),
('menu_bar', 'blue-diamond-30ml', 90, 'Blue Diamond — 30ml', 'Domestic Liquor', '', '{"price": 115}'),
('menu_bar', 'blue-diamond-60ml', 91, 'Blue Diamond — 60ml', 'Domestic Liquor', '', '{"price": 210}'),
('menu_bar', 'blue-diamond-180ml', 92, 'Blue Diamond — 180ml', 'Domestic Liquor', '', '{"price": 550}'),
('menu_bar', 'blue-diamond-360ml', 93, 'Blue Diamond — 360ml', 'Domestic Liquor', '', '{"price": 850}'),
('menu_bar', 'carlsberg-can-550ml', 94, 'Carlsberg — Can 550ml', 'Beer', '', '{"price": 550}'),
('menu_bar', 'carlsberg-bottle-650ml', 95, 'Carlsberg — Bottle 650ml', 'Beer', '', '{"price": 730}'),
('menu_bar', 'gorkha-strong-can-550ml', 96, 'Gorkha Strong — Can 550ml', 'Beer', '', '{"price": 430}'),
('menu_bar', 'gorkha-strong-bottle-650ml', 97, 'Gorkha Strong — Bottle 650ml', 'Beer', '', '{"price": 590}'),
('menu_bar', 'tuborg-can-550ml', 98, 'Tuborg — Can 550ml', 'Beer', '', '{"price": 520}'),
('menu_bar', 'tuborg-bottle-650ml', 99, 'Tuborg — Bottle 650ml', 'Beer', '', '{"price": 690}'),
('menu_bar', 'somersby-apple-cider-250ml', 100, 'Somersby Apple Cider (250ml)', 'Beer', '', '{"price": 390}'),
('menu_bar', 'carlsberg-draught-beer-glass-500ml', 101, 'Carlsberg Draught Beer — Glass 500ml', 'Draught Beer', '', '{"price": 620}'),
('menu_bar', 'carlsberg-draught-beer-jar-1500ml', 102, 'Carlsberg Draught Beer — Jar 1500ml', 'Draught Beer', '', '{"price": 1750}'),
('menu_bar', 'tuborg-draught-beer-glass-500ml', 103, 'Tuborg Draught Beer — Glass 500ml', 'Draught Beer', '', '{"price": 590}'),
('menu_bar', 'tuborg-draught-beer-jar-1500ml', 104, 'Tuborg Draught Beer — Jar 1500ml', 'Draught Beer', '', '{"price": 1620}'),
('menu_bar', 'gorkha-draught-pilsner-craft-beer-glass-500ml', 105, 'Gorkha Draught Pilsner/Craft Beer — Glass 500ml', 'Draught Beer', '', '{"price": 510}'),
('menu_bar', 'gorkha-draught-pilsner-craft-beer-jar-1500ml', 106, 'Gorkha Draught Pilsner/Craft Beer — Jar 1500ml', 'Draught Beer', '', '{"price": 1490}'),
('menu_bar', 'barasingha-draught-glass-500ml', 107, 'Barasingha Draught — Glass 500ml', 'Draught Beer', '', '{"price": 495}'),
('menu_bar', 'barasingha-draught-jar-1500ml', 108, 'Barasingha Draught — Jar 1500ml', 'Draught Beer', '', '{"price": 1420}'),
('menu_bar', 'domestic-wine-red-white-per-glass', 109, 'Domestic Wine (Red/White) — Per Glass', 'Wine', '', '{"price": 395}'),
('menu_bar', 'domestic-wine-red-white-per-bottle', 110, 'Domestic Wine (Red/White) — Per Bottle', 'Wine', '', '{"price": 1390}'),
('menu_bar', 'imported-wine-red-white-per-glass', 111, 'Imported Wine (Red/White) — Per Glass', 'Wine', '', '{"price": 690}'),
('menu_bar', 'imported-wine-red-white-per-bottle', 112, 'Imported Wine (Red/White) — Per Bottle', 'Wine', 'Brands: Robertson Wine, J.P. Chenet, Jacob''s Creek, Gossip.', '{"price": 2650}'),
('menu_bar', 'red-bull-domestic', 113, 'Red Bull (Domestic)', 'Red Bull', '', '{"price": 295}'),
('menu_bar', 'red-bull-blue-imported', 114, 'Red Bull Blue (Imported)', 'Red Bull', '', '{"price": 550}'),
('menu_bar', 'shisha-hukka-double-apple-mint-strawberry-apple-with-mint', 115, 'Shisha Hukka (Double Apple/Mint/Strawberry/Apple with Mint)', 'Shisha/Hukka', '', '{"price": 695}'),
('menu_bar', 'extra-flavour', 116, 'Extra Flavour', 'Shisha/Hukka', '', '{"price": 300}'),
('menu_bar', 'extra-coil', 117, 'Extra Coil', 'Shisha/Hukka', '', '{"price": 50}'),
('menu_bar', 'surya-red-light-arctic-stick', 118, 'Surya (Red/Light/Arctic) — Stick', 'Cigarette', '', '{"price": 35}'),
('menu_bar', 'surya-red-light-arctic-packet', 119, 'Surya (Red/Light/Arctic) — Packet', 'Cigarette', '', '{"price": 620}'),
('menu_bar', 'shikhar-ice-stick', 120, 'Shikhar Ice — Stick', 'Cigarette', '', '{"price": 30}'),
('menu_bar', 'shikhar-ice-packet', 121, 'Shikhar Ice — Packet', 'Cigarette', '', '{"price": 450}');
