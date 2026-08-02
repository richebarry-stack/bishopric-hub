CREATE TABLE IF NOT EXISTS "counselor-schedule" (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  owner TEXT NOT NULL DEFAULT '',
  date TEXT NOT NULL,
  start_time TEXT NOT NULL,
  end_time TEXT NOT NULL,
  title TEXT NOT NULL,
  notes TEXT DEFAULT '',
  updated_at TEXT,
  updated_by TEXT,
  recurrence_id TEXT,
  recurrence_frequency TEXT,
  recurrence_interval INTEGER,
  recurrence_end_date TEXT
);
