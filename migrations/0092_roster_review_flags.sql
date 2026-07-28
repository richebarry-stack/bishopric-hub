-- Members the LCR roster sync could no longer find in LCR's Member Directory,
-- surfaced on Ward Members for the user to flag "records elsewhere", remove
-- from the ward, or dismiss as a false alarm. Re-flagged on the next sync if
-- still missing after a dismiss (dismissing only clears the current row).
CREATE TABLE roster_review_flags (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ward_member_id INTEGER NOT NULL UNIQUE REFERENCES ward_members(id),
  flagged_at TEXT NOT NULL
);
