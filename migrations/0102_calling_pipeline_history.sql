-- Field-level change history for calling pipeline entries, so it's clear who
-- changed what and when (e.g. who marked a release recorded in LCR).
CREATE TABLE IF NOT EXISTS calling_pipeline_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  calling_id INTEGER NOT NULL REFERENCES calling_pipeline(id) ON DELETE CASCADE,
  changed_at TEXT NOT NULL,
  changed_by TEXT NOT NULL,
  field TEXT NOT NULL,
  old_value TEXT,
  new_value TEXT
);

CREATE INDEX IF NOT EXISTS idx_calling_pipeline_history_calling_id ON calling_pipeline_history(calling_id);
