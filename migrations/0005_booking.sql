-- Requests, not bookings. Nothing here is confirmed until a person replies, and
-- there is deliberately no status column — an 18-room property confirms by
-- email, and a workflow field nobody updates is worse than no field.
CREATE TABLE IF NOT EXISTS booking_requests (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT    NOT NULL,
  email      TEXT    NOT NULL,
  phone      TEXT    NOT NULL DEFAULT '',
  room       TEXT    NOT NULL,
  guests     INTEGER NOT NULL,
  check_in   TEXT    NOT NULL,   -- YYYY-MM-DD, Kathmandu local
  check_out  TEXT    NOT NULL,
  notes      TEXT    NOT NULL DEFAULT '',
  created_at TEXT    NOT NULL DEFAULT (datetime('now'))
);
