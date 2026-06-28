CREATE TABLE IF NOT EXISTS security_questions (
  user_id INTEGER PRIMARY KEY,
  question1 TEXT NOT NULL,
  answer1_hash TEXT NOT NULL,
  question2 TEXT NOT NULL,
  answer2_hash TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
