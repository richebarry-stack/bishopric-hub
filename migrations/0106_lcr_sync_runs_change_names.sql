-- Names behind the LCR sync's counts, so the Automation page can list which
-- records changed (callings/missionary changes already had this).
ALTER TABLE lcr_sync_runs ADD COLUMN roster_created_names TEXT;
ALTER TABLE lcr_sync_runs ADD COLUMN roster_filled_names TEXT;
ALTER TABLE lcr_sync_runs ADD COLUMN recommend_changed TEXT;
ALTER TABLE lcr_sync_runs ADD COLUMN stake_flagged_names TEXT;
ALTER TABLE lcr_sync_runs ADD COLUMN stake_cleared_names TEXT;
