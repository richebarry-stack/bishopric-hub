-- History of local weekly LCR sync runs (scripts/lcr-sync), posted by the script
-- itself after each run so results are visible on the site, not just in a local log.
CREATE TABLE IF NOT EXISTS lcr_sync_runs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ran_at TEXT NOT NULL,
  success INTEGER NOT NULL DEFAULT 1,
  error TEXT,
  roster_created INTEGER,
  roster_filled INTEGER,
  roster_missing TEXT,
  recommend_updated INTEGER,
  recommend_unmatched TEXT,
  stake_flagged INTEGER,
  stake_cleared INTEGER,
  stake_unmatched TEXT,
  updated_by TEXT
);
