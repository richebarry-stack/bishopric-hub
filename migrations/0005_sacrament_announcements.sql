CREATE TABLE IF NOT EXISTS sacrament_announcements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  meeting_date TEXT NOT NULL,
  title TEXT NOT NULL,
  notes TEXT DEFAULT ''
);
