CREATE TABLE IF NOT EXISTS registration_requests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  church_role TEXT NOT NULL DEFAULT '',
  password_hash TEXT NOT NULL DEFAULT '',
  requested_at TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pending'
);
