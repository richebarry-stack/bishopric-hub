-- Support the "Current Sacrament Meeting" agenda view.
-- Stake Business is a fixed agenda line with no prior home; store it on the theme row.
ALTER TABLE sacrament_themes ADD COLUMN stake_business TEXT;

-- Freeform agenda notes the user can add and position anywhere in the agenda.
-- position is a float so notes can be slotted between the fixed lines (which have
-- integer anchor positions) and reordered without renumbering everything.
CREATE TABLE IF NOT EXISTS sacrament_agenda_notes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  meeting_date TEXT NOT NULL,
  content TEXT,
  position REAL,
  updated_at TEXT
);
