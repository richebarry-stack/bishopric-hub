-- Move music coordinator / website admin to calendar hub
UPDATE users SET hub = 'cal' WHERE church_role IN ('Music Coordinator', 'Website Administrator');

-- Simplify roles: editor and viewer become user
UPDATE users SET role = 'user' WHERE role IN ('editor', 'viewer');

-- All remaining BH-only users get WC access too
UPDATE users SET hub = 'both' WHERE hub = 'bh';
