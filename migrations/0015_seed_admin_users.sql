-- Seeds the 3 admin accounts with PBKDF2 hashes of one-time temporary
-- passwords generated locally (never through wrangler/CI output). Every row
-- starts must_change_password = 1, so each temp password is dead the moment
-- its owner signs in and sets a real one at /admin/change-password.
INSERT INTO admin_users (username, password_hash, role) VALUES ('owner', '876269ee4619f7ea3f5252ba68177864.522561568043fe73b196f1fc21ac7c778fd1b17a8ce183649890389c403d264b', 'owner');
INSERT INTO admin_users (username, password_hash, role) VALUES ('developer', '5c5d7482cf486a2bf4ebf2f10af7ddfa.e33d9c1a80527f3ad47b7d036298e11e6e334386b233feac33be0541d5f63578', 'developer');
INSERT INTO admin_users (username, password_hash, role) VALUES ('staff', '6582322c5fbe899d2cc4d82c386e229e.dceadef84e2693b9f45a6822d293eb8ddefd90e66b57f1c80ea35046675cd93a', 'staff');
