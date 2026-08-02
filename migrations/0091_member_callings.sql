-- Full read-only mirror of every filled calling LCR reports for the ward,
-- not just the ones the bishopric tracks in calling_pipeline. Replaced
-- wholesale on every LCR callings sync (see sync-callings endpoint).
CREATE TABLE member_callings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ward_member_id INTEGER NOT NULL REFERENCES ward_members(id),
  calling TEXT NOT NULL,
  organization TEXT NOT NULL,
  sustained_date TEXT,
  set_apart INTEGER NOT NULL DEFAULT 0,
  synced_at TEXT NOT NULL
);

CREATE INDEX idx_member_callings_ward_member_id ON member_callings(ward_member_id);
