CREATE TABLE IF NOT EXISTS bishopric_agenda_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  meeting_date TEXT NOT NULL,
  item TEXT NOT NULL DEFAULT '',
  notes TEXT DEFAULT '',
  done INTEGER NOT NULL DEFAULT 0,
  position INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_by TEXT
);
CREATE INDEX IF NOT EXISTS idx_bishopric_agenda_date ON bishopric_agenda_items(meeting_date);
