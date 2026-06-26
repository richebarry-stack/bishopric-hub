CREATE TABLE IF NOT EXISTS members_without_callings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  potential_calling TEXT DEFAULT '',
  notes TEXT DEFAULT ''
);
