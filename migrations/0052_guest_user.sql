-- Read-only guest account for youth schedule viewing (no password)
INSERT OR IGNORE INTO users (name, email, password_hash, role, church_role, hub, last_login)
VALUES ('Guest', 'guest', '', 'guest', '', 'yc', '');
