-- Covenant Path page: patriarchal blessing status (tracked in the hub; LCR has
-- no field for it), household details from the LCR ordinance report, LCR's
-- part-member households list, and per-person exclusions from the page's lists.

-- 'Not received' | 'Recommend issued' | 'Received' (NULL = not set, treated as Not received)
ALTER TABLE ward_members ADD COLUMN pb_status TEXT;
ALTER TABLE ward_members ADD COLUMN pb_date TEXT;
-- From LCR's report: the household's head ("Last, First") and this member's place in it.
ALTER TABLE ward_members ADD COLUMN head_of_house TEXT;
ALTER TABLE ward_members ADD COLUMN household_position TEXT;
ALTER TABLE ward_members ADD COLUMN returned_missionary INTEGER;

-- LCR's Part-Member Households report, replaced on each sync.
CREATE TABLE IF NOT EXISTS part_member_households (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  household TEXT NOT NULL,
  relationships TEXT NOT NULL DEFAULT '',  -- e.g. "Spouse; Children Under Age 18"
  synced_at TEXT NOT NULL
);

-- Someone hidden from one Covenant Path list (for example a member who isn't
-- accountable and so won't be baptized). subject_key is "member:<id>" or
-- "household:<name>" for household lists.
CREATE TABLE IF NOT EXISTS covenant_path_exclusions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  category TEXT NOT NULL,
  subject_key TEXT NOT NULL,
  subject_name TEXT NOT NULL DEFAULT '',
  reason TEXT NOT NULL DEFAULT '',
  updated_at TEXT,
  updated_by TEXT,
  UNIQUE (category, subject_key)
);
