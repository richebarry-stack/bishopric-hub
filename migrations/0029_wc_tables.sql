CREATE TABLE IF NOT EXISTS wc_meetings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL,
  opening_prayer TEXT DEFAULT '',
  spiritual_thought TEXT DEFAULT '',
  closing_prayer TEXT DEFAULT '',
  updated_at TEXT DEFAULT (datetime('now')),
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS wc_wins (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT DEFAULT '',
  description TEXT DEFAULT '',
  updated_at TEXT DEFAULT (datetime('now')),
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS wc_family_needs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  family_name TEXT DEFAULT '',
  details TEXT DEFAULT '',
  status TEXT DEFAULT '',
  assignments TEXT DEFAULT '',
  updated_at TEXT DEFAULT (datetime('now')),
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS wc_discussion_topics (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  meeting_date TEXT NOT NULL,
  organization TEXT NOT NULL,
  topic TEXT DEFAULT '',
  updated_at TEXT DEFAULT (datetime('now')),
  created_at TEXT DEFAULT (datetime('now'))
);
