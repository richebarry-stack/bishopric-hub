-- Rebuild interview_pipeline first to drop its FK to ward_members(id) --
-- D1 enforces foreign keys within the migration's implicit transaction, so the
-- table ward_members references cannot itself be dropped/rebuilt while that FK
-- is in place. ward_member_id remains a plain (app-managed) reference.
CREATE TABLE interview_pipeline_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  member TEXT,
  date_recommend_expires TEXT,
  type_of_interview TEXT,
  status TEXT DEFAULT 'Unassigned',
  assigned_to TEXT,
  last_interview_datetime TEXT,
  notes TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  next_interview_date TEXT DEFAULT '',
  comments TEXT DEFAULT '',
  updated_by TEXT,
  ward_member_id INTEGER,
  setup_assigned_to TEXT DEFAULT '',
  setup_status TEXT DEFAULT 'Not started',
  calling_id INTEGER REFERENCES calling_pipeline(id)
);

INSERT INTO interview_pipeline_new
  (id, member, date_recommend_expires, type_of_interview, status, assigned_to,
   last_interview_datetime, notes, created_at, updated_at, next_interview_date,
   comments, updated_by, ward_member_id, setup_assigned_to, setup_status, calling_id)
SELECT
  id, member, date_recommend_expires, type_of_interview, status, assigned_to,
  last_interview_datetime, notes, created_at, updated_at, next_interview_date,
  comments, updated_by, ward_member_id, setup_assigned_to, setup_status, calling_id
FROM interview_pipeline;

DROP TABLE interview_pipeline;
ALTER TABLE interview_pipeline_new RENAME TO interview_pipeline;

CREATE UNIQUE INDEX idx_interview_youth_member
  ON interview_pipeline(ward_member_id)
  WHERE ward_member_id IS NOT NULL AND type_of_interview IN ('Youth 12-15', 'Youth 16-17');
CREATE UNIQUE INDEX idx_interview_setting_apart_calling
  ON interview_pipeline(calling_id)
  WHERE calling_id IS NOT NULL AND type_of_interview = 'Setting Apart';

-- Now rebuild ward_members with the split name columns.
CREATE TABLE ward_members_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  first_name TEXT NOT NULL DEFAULT '',
  last_name TEXT NOT NULL DEFAULT '',
  preferred_first_name TEXT NOT NULL DEFAULT '',
  preferred_last_name TEXT NOT NULL DEFAULT '',
  active INTEGER NOT NULL DEFAULT 1,
  out_of_ward INTEGER NOT NULL DEFAULT 0,
  exclude_speakers INTEGER NOT NULL DEFAULT 0,
  exclude_prayers INTEGER NOT NULL DEFAULT 0,
  birth_date TEXT,
  gender TEXT DEFAULT '',
  updated_by TEXT,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT INTO ward_members_new
  (id, first_name, last_name, preferred_first_name, preferred_last_name,
   active, out_of_ward, exclude_speakers, exclude_prayers, birth_date, gender, updated_by, updated_at)
SELECT
  id,
  CASE WHEN instr(name, ',') > 0 THEN trim(substr(name, instr(name, ',') + 1)) ELSE '' END,
  CASE WHEN instr(name, ',') > 0 THEN trim(substr(name, 1, instr(name, ',') - 1)) ELSE trim(name) END,
  CASE
    WHEN coalesce(trim(preferred_name), '') <> '' AND instr(preferred_name, ',') > 0
      THEN trim(substr(preferred_name, instr(preferred_name, ',') + 1))
    WHEN coalesce(trim(preferred_name), '') <> ''
      THEN trim(preferred_name)
    WHEN instr(name, ',') > 0 THEN trim(substr(name, instr(name, ',') + 1))
    ELSE ''
  END,
  CASE
    WHEN coalesce(trim(preferred_name), '') <> '' AND instr(preferred_name, ',') > 0
      THEN trim(substr(preferred_name, 1, instr(preferred_name, ',') - 1))
    ELSE CASE WHEN instr(name, ',') > 0 THEN trim(substr(name, 1, instr(name, ',') - 1)) ELSE trim(name) END
  END,
  active, out_of_ward, exclude_speakers, exclude_prayers, birth_date, gender, updated_by, updated_at
FROM ward_members;

DROP TABLE ward_members;
ALTER TABLE ward_members_new RENAME TO ward_members;
CREATE UNIQUE INDEX IF NOT EXISTS idx_ward_members_legal_name ON ward_members(last_name, first_name);
