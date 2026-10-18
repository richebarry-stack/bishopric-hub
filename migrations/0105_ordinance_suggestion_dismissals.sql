-- Roster-based ordinance suggestions (baptism at 8, priesthood advancement at
-- 12/14/16) the bishopric has dismissed, so they stay hidden across reloads
-- and for every user instead of only for the current page session.
CREATE TABLE IF NOT EXISTS ordinance_suggestion_dismissals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  member_name TEXT NOT NULL,
  ordinance_type TEXT NOT NULL,
  updated_at TEXT,
  updated_by TEXT,
  UNIQUE (member_name, ordinance_type)
);
