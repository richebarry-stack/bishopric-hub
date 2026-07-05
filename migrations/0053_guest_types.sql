-- Replace single guest account with two typed guests
DELETE FROM sessions WHERE user_id IN (SELECT id FROM users WHERE email IN ('guest', 'guest_yc', 'guest_sac') AND role = 'guest');
DELETE FROM users WHERE email IN ('guest', 'guest_yc', 'guest_sac') AND role = 'guest';
INSERT INTO users (name, email, password_hash, role, church_role, hub, last_login)
VALUES ('Youth Guest', 'guest_yc', '', 'guest', 'yc', 'yc', '');
INSERT INTO users (name, email, password_hash, role, church_role, hub, last_login)
VALUES ('Sacrament Guest', 'guest_sac', '', 'guest', 'sac', 'yc', '');
