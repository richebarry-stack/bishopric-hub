-- Tracks which page each user is currently viewing (heartbeat-updated), for a
-- "who else is here" indicator. Bounded at one row per user.
CREATE TABLE IF NOT EXISTS presence (
  user_id INTEGER PRIMARY KEY,
  user_name TEXT NOT NULL,
  path TEXT NOT NULL,
  editing INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL
);
