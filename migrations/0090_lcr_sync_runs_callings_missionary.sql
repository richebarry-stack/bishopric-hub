-- Extends the LCR sync run log with results from the new callings and
-- missionary-status sync phases.
ALTER TABLE lcr_sync_runs ADD COLUMN callings_created INTEGER;
ALTER TABLE lcr_sync_runs ADD COLUMN callings_updated INTEGER;
ALTER TABLE lcr_sync_runs ADD COLUMN callings_released INTEGER;
ALTER TABLE lcr_sync_runs ADD COLUMN callings_changed TEXT;
ALTER TABLE lcr_sync_runs ADD COLUMN callings_unmatched TEXT;
ALTER TABLE lcr_sync_runs ADD COLUMN missionary_created INTEGER;
ALTER TABLE lcr_sync_runs ADD COLUMN missionary_updated INTEGER;
ALTER TABLE lcr_sync_runs ADD COLUMN missionary_changed TEXT;
ALTER TABLE lcr_sync_runs ADD COLUMN missionary_unmatched TEXT;
