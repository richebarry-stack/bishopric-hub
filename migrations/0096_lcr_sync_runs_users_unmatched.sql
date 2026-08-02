-- Records bishopric-hub accounts whose name didn't match anyone in the LCR roster
-- export, so a mistyped or outdated account name is visible in the sync history
-- (it silently breaks every name-matched assignment lookup for that person).
ALTER TABLE lcr_sync_runs ADD COLUMN users_unmatched TEXT;
