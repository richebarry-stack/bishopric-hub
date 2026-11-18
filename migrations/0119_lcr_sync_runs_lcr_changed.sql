-- Every calling change in LCR per sync run (sustained / set apart / released),
-- including callings the Calling Pipeline doesn't track.
ALTER TABLE lcr_sync_runs ADD COLUMN callings_lcr_changed TEXT;
