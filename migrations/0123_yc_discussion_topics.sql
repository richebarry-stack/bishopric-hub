-- Youth Council agenda: one row per meeting per quorum/class (like wc_discussion_topics).
CREATE TABLE IF NOT EXISTS yc_discussion_topics (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  meeting_date TEXT NOT NULL,
  organization TEXT NOT NULL,
  status TEXT DEFAULT '',
  next_steps TEXT DEFAULT '',
  help_needed TEXT DEFAULT '',
  updated_at TEXT,
  updated_by TEXT
);
CREATE INDEX IF NOT EXISTS idx_yc_discussion_topics_date ON yc_discussion_topics(meeting_date);
