-- Hub suggestion #27: bishopric-managed tithing declaration appointment slots
-- that members can reserve without logging in (one family per slot).
CREATE TABLE IF NOT EXISTS tithing_declaration_slots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL,
  start_time TEXT NOT NULL,
  end_time TEXT NOT NULL,
  location TEXT NOT NULL,
  notes TEXT DEFAULT '',
  reserved_by TEXT,
  reserved_contact TEXT,
  reserved_at TEXT,
  updated_at TEXT,
  updated_by TEXT
);
