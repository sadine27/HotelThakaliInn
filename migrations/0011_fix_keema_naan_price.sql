-- Corrects the price flagged in 0008_cuisine_menu.sql: confirmed against the
-- printed menu as 170, not 70.
UPDATE content SET extra = '{"price": 170}' WHERE section = 'menu_mains' AND slug = 'keema-naan-chicken';
