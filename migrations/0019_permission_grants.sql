-- Permission grants: a capability, lent to one person, for one day.
--
-- Three roles were doing all the work of an access model, and doing it badly:
-- any signed-in account -- including the front desk -- could delete a room, a
-- page or a photo, and read the whole audit log. Nobody chose that; it is what
-- happens when every page guards on "is there a session" and stops there.
--
-- The four dangerous things are now developer-only, and an owner gets them by
-- asking. There will be several owners; they phone or message the developer,
-- who approves here. A grant expires 24 hours after it is made, which is the
-- whole reason it is a row with an expiry rather than a flag someone has to
-- remember to turn off -- the failure mode of every "temporarily give them
-- access" switch is that temporarily never ends.
--
-- revoked_at is separate from deleting the row: a grant that was cut short is
-- a thing that happened, and the audit log points at an id that has to still
-- exist. Nothing is ever deleted from this table.
--
-- lib/permissions.ts is the only reader. It fails CLOSED -- if this table is
-- missing, every grantable capability is simply denied rather than throwing,
-- so a migration that has not run yet locks doors instead of opening them.

CREATE TABLE IF NOT EXISTS permission_grants (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  capability TEXT NOT NULL,
  grantee    TEXT NOT NULL,                              -- admin_users.username
  granted_by TEXT NOT NULL,
  granted_at TEXT NOT NULL DEFAULT (datetime('now')),    -- UTC, like every other timestamp here
  expires_at TEXT NOT NULL,
  revoked_at TEXT
);

-- The shape of the only question ever asked of this table: "does this person
-- hold this capability right now?" Ordered so that lookup is an index seek
-- rather than a scan that grows with every grant ever made.
CREATE INDEX IF NOT EXISTS idx_grants_live
  ON permission_grants(grantee, capability, expires_at);
