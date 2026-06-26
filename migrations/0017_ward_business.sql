CREATE TABLE IF NOT EXISTS sacrament_ward_business (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  meeting_date TEXT NOT NULL UNIQUE,
  sustainings_snapshot TEXT NOT NULL DEFAULT '[]',
  thanksgivings_snapshot TEXT NOT NULL DEFAULT '[]',
  updated_at TEXT DEFAULT (datetime('now'))
);
