-- The generic PUT handler in functions/api/[[route]].ts always sets updated_at on
-- update. The bishop-schedule table was created without this column, so every
-- update (drag/move/resize/edit-save) failed with "no such column: updated_at".
ALTER TABLE "bishop-schedule" ADD COLUMN updated_at TEXT;
