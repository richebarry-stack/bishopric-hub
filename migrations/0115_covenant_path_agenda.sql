-- People the bishopric picked from the Covenant Path page to discuss in upcoming
-- bishopric and/or ward council meetings. An entry stays on the agendas until it's
-- removed, or until the person drops off that Covenant Path list (action done).
-- Ward council only sees entries with for_ward_council = 1, and only the name,
-- a neutral topic and the note.
CREATE TABLE IF NOT EXISTS covenant_path_agenda (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  category TEXT NOT NULL,
  subject_key TEXT NOT NULL,
  subject_name TEXT NOT NULL DEFAULT '',
  for_bishopric INTEGER NOT NULL DEFAULT 0,
  for_ward_council INTEGER NOT NULL DEFAULT 0,
  note TEXT NOT NULL DEFAULT '',
  updated_at TEXT,
  updated_by TEXT,
  UNIQUE (category, subject_key)
);
