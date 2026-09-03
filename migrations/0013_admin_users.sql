-- Replaces the single shared admin password with individual, attributable
-- accounts. password_hash uses the exact PBKDF2 salt.hash format
-- lib/auth.ts's checkPassword() already verifies. Seeded rows are inserted
-- separately (not in this file) so no plaintext password ever touches a
-- committed migration or a command log — see audit_log.md for the seeding
-- procedure. Every seeded account starts with must_change_password = 1.
CREATE TABLE IF NOT EXISTS admin_users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL,
  must_change_password INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
