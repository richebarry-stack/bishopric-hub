-- Vacant, non-custom callings LCR reports for the ward — full read-only
-- mirror, replaced wholesale on every LCR callings sync (see sync-callings
-- endpoint), same pattern as member_callings.
CREATE TABLE unfilled_callings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  calling TEXT NOT NULL,
  organization TEXT NOT NULL,
  synced_at TEXT NOT NULL
);
