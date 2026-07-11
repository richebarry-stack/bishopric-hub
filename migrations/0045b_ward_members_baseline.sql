-- Baseline schema for ward_members, standing in for the real-data import migrations
-- (0044_ward_members.sql, 0045_sync_ward_members.sql, 0047_ward_member_birthdates.sql)
-- which are gitignored because they contain actual ward roster data. Those files
-- created this table and added birth_date; this migration supplies just the schema
-- so a fresh clone (with no member data) has a ward_members table to build on before
-- migration 0046 onward alters it further, and before 0076 rebuilds it into the
-- first_name/last_name split. On any database that already has ward_members
-- (i.e. production, migrated historically via the files above), this is a no-op —
-- do not run it there.
CREATE TABLE IF NOT EXISTS ward_members (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  active INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

ALTER TABLE ward_members ADD COLUMN birth_date TEXT;
