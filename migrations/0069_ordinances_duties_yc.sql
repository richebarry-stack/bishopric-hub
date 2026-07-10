-- Ordinance & advancement tracker (baptisms, Aaronic Priesthood advancement)
CREATE TABLE IF NOT EXISTS ordinances (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  member_name TEXT NOT NULL,
  ordinance_type TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'Upcoming',
  target_date TEXT DEFAULT '',
  completed_date TEXT DEFAULT '',
  notes TEXT DEFAULT '',
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_by TEXT
);

-- Optional gender on the ward roster, used to suggest Aaronic Priesthood
-- advancement candidates (young men only) vs. baptism candidates (all children).
ALTER TABLE ward_members ADD COLUMN gender TEXT DEFAULT '';

-- Annual/seasonal administrative duties (tithing declaration, ward conference, etc.)
CREATE TABLE IF NOT EXISTS annual_duties (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  month_start INTEGER NOT NULL,
  month_end INTEGER NOT NULL,
  notes TEXT DEFAULT '',
  last_completed_year INTEGER,
  sort_order INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_by TEXT
);

INSERT INTO annual_duties (title, month_start, month_end, notes, sort_order) VALUES
  ('Tithing declaration', 9, 12, 'Meet with members to review their tithing status ahead of year-end.', 1),
  ('Ward conference', 9, 11, 'Coordinate with the stake presidency on the scheduled date — adjust this window to match your stake''s schedule.', 2),
  ('Annual ward budget', 11, 1, 'Prepare and submit next year''s budget with the ward clerk.', 3),
  ('Youth camps and activities planning', 1, 3, 'Confirm dates, leaders, and budget for youth camps.', 4),
  ('Ward history', 11, 12, 'Ensure the annual ward history is compiled and submitted.', 5);

-- Ward Youth Council meetings (mirrors wc_meetings)
CREATE TABLE IF NOT EXISTS yc_meetings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL,
  agenda TEXT DEFAULT '',
  notes TEXT DEFAULT '',
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_by TEXT
);
