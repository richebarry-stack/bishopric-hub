-- Tracks the recommend_expires value that was last used to auto-create a temple
-- recommend interview for this member, so a manually-deleted interview row isn't
-- recreated on the next resync unless the recommend date has actually changed.
ALTER TABLE ward_members ADD COLUMN recommend_interview_synced_expires TEXT DEFAULT '';
