-- Rain-on-glass is off by default, matching its prior commented-out state.
-- Split by daypart so it can be switched on for night only, day only, both, or neither.
INSERT INTO settings (key, value) VALUES ('rain_glass_day', '0');
INSERT INTO settings (key, value) VALUES ('rain_glass_night', '0');
