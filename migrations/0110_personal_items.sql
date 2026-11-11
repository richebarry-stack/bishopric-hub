-- Private per-user notes and to-dos (hub suggestion #36). Only the owning user can
-- read or change their rows; the API scopes every query by user_id.
CREATE TABLE personal_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL DEFAULT 'todo',        -- 'todo' | 'note'
  title TEXT NOT NULL DEFAULT '',
  details TEXT,
  due_date TEXT,                            -- YYYY-MM-DD
  importance TEXT NOT NULL DEFAULT 'Medium', -- 'High' | 'Medium' | 'Low'
  done INTEGER NOT NULL DEFAULT 0,
  done_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT
);
CREATE INDEX idx_personal_items_user ON personal_items(user_id);
