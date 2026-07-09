-- Tracks callings/releases individually removed from a specific week's sustain/thank
-- lists (e.g. deferred to a later week) without changing the underlying calling status,
-- so old agendas accurately reflect what actually happened that Sunday.
CREATE TABLE sacrament_agenda_exclusions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  meeting_date TEXT NOT NULL,
  calling_id INTEGER NOT NULL,
  type TEXT NOT NULL, -- 'sustain' or 'thank'
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX idx_agenda_exclusions_date ON sacrament_agenda_exclusions(meeting_date);
