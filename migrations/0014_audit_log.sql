-- Append-only record of every admin write. Rows are inserted in the same
-- D1 batch as the write they describe (lib/audit.ts's auditedWrite), so a
-- write and its audit row land together or not at all. Nothing in the app
-- ever UPDATEs or DELETEs a row here except the archiver worker setting
-- archived_at once a row has been copied to the WORM bucket
-- (workers/audit-archiver).
CREATE TABLE IF NOT EXISTS audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  actor TEXT NOT NULL,
  action TEXT NOT NULL,
  section TEXT,
  slug TEXT,
  before TEXT,
  after TEXT,
  archived_at TEXT
);
CREATE INDEX IF NOT EXISTS audit_log_created_at ON audit_log(created_at);
CREATE INDEX IF NOT EXISTS audit_log_unarchived ON audit_log(archived_at) WHERE archived_at IS NULL;
