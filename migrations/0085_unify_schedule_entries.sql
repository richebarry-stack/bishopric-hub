-- Unifies bishop-schedule and counselor-schedule into one table so an
-- appointment can be shared across multiple calendars (e.g. Bishop and
-- First Counselor) as a single row, instead of living in two separate
-- owner-scoped tables. `calendars` is a JSON array of calendar names.
CREATE TABLE schedule_entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  calendars TEXT NOT NULL DEFAULT '[]',
  date TEXT NOT NULL,
  start_time TEXT NOT NULL,
  end_time TEXT NOT NULL,
  title TEXT NOT NULL,
  notes TEXT DEFAULT '',
  updated_at TEXT,
  updated_by TEXT,
  recurrence_id TEXT,
  recurrence_frequency TEXT,
  recurrence_interval INTEGER,
  recurrence_end_date TEXT
);

INSERT INTO schedule_entries
  (calendars, date, start_time, end_time, title, notes, updated_at, updated_by,
   recurrence_id, recurrence_frequency, recurrence_interval, recurrence_end_date)
SELECT '["Bishop"]', date, start_time, end_time, title, notes, updated_at, updated_by,
  recurrence_id, recurrence_frequency, recurrence_interval, recurrence_end_date
FROM "bishop-schedule";

INSERT INTO schedule_entries
  (calendars, date, start_time, end_time, title, notes, updated_at, updated_by,
   recurrence_id, recurrence_frequency, recurrence_interval, recurrence_end_date)
SELECT '["' || replace(owner, '"', '\"') || '"]', date, start_time, end_time, title, notes, updated_at, updated_by,
  recurrence_id, recurrence_frequency, recurrence_interval, recurrence_end_date
FROM "counselor-schedule";

DROP TABLE "bishop-schedule";
DROP TABLE "counselor-schedule";
