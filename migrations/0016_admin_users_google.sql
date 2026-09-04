-- Swaps password auth for Google Sign-In: admin_users now carries the
-- whitelisted email that a verified Google identity must match, not a
-- password hash. Login only ever creates a session for an email already in
-- this table — there is no signup, Google or otherwise.
ALTER TABLE admin_users ADD COLUMN email TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS admin_users_email ON admin_users(email);

UPDATE admin_users SET email = 'sharmadivyesh20070727@gmail.com' WHERE username = 'developer';
UPDATE admin_users SET email = 'hotelthakaliinn1@gmail.com' WHERE username = 'staff';
-- 'owner' keeps email = NULL until that person is known; added later via /admin/accounts.

ALTER TABLE admin_users DROP COLUMN password_hash;
ALTER TABLE admin_users DROP COLUMN must_change_password;
