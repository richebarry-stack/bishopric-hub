-- Handbook-driven additions (Nov 2026): Aaronic Priesthood sustainings, new &
-- returning member care, welfare follow-up, funerals, returned-missionary
-- follow-up, Primary Program Sundays, sacrament for homebound members,
-- member-bookable interview slots and per-person calendar subscriptions.

-- Aaronic Priesthood advancement: the Sunday the candidate is presented for sustaining.
ALTER TABLE ordinances ADD COLUMN sustain_date TEXT DEFAULT '';

-- Returned missionaries: JSON map of checklist key -> true (see shared/checklists.ts).
ALTER TABLE missionary_pipeline ADD COLUMN rm_checklist TEXT NOT NULL DEFAULT '{}';

-- A Sunday marked as the annual Primary children's sacrament meeting presentation.
ALTER TABLE sacrament_themes ADD COLUMN is_primary_program INTEGER NOT NULL DEFAULT 0;

-- New, returning and recently baptized members, followed until their checklist is done.
-- move_item_id links rows created automatically from a Current Bishopric Meeting move-in.
CREATE TABLE IF NOT EXISTS member_care (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  member_name TEXT NOT NULL DEFAULT '',
  kind TEXT NOT NULL DEFAULT 'Move-in',
  added_date TEXT NOT NULL DEFAULT '',
  move_item_id INTEGER UNIQUE,
  checklist TEXT NOT NULL DEFAULT '{}',
  notes TEXT DEFAULT '',
  archived INTEGER NOT NULL DEFAULT 0,
  created_by TEXT,
  updated_at TEXT,
  updated_by TEXT
);

-- Welfare follow-up. Bishop and Clerk only (enforced in the API). No amounts.
CREATE TABLE IF NOT EXISTS welfare_cases (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  member_name TEXT NOT NULL DEFAULT '',
  help_type TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'Open',
  next_follow_up TEXT DEFAULT '',
  notes TEXT DEFAULT '',
  created_by TEXT,
  updated_at TEXT,
  updated_by TEXT
);

CREATE TABLE IF NOT EXISTS funerals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  deceased_name TEXT NOT NULL DEFAULT '',
  funeral_date TEXT DEFAULT '',
  funeral_time TEXT DEFAULT '',
  viewing_time TEXT DEFAULT '',
  location TEXT DEFAULT '',
  family_contact TEXT DEFAULT '',
  conducting TEXT DEFAULT '',
  checklist TEXT NOT NULL DEFAULT '{}',
  notes TEXT DEFAULT '',
  archived INTEGER NOT NULL DEFAULT 0,
  created_by TEXT,
  updated_at TEXT,
  updated_by TEXT
);

CREATE TABLE IF NOT EXISTS homebound_sacrament (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  member_name TEXT NOT NULL DEFAULT '',
  location TEXT DEFAULT '',
  frequency TEXT DEFAULT 'Weekly',
  assigned_to TEXT DEFAULT '',
  last_administered TEXT DEFAULT '',
  notes TEXT DEFAULT '',
  active INTEGER NOT NULL DEFAULT 1,
  created_by TEXT,
  updated_at TEXT,
  updated_by TEXT
);

-- Open interview times members can book without logging in (/book-interview).
-- calendar is 'Bishop' | 'First Counselor' | 'Second Counselor'. A booking adds a
-- schedule_entries row on that calendar, linked by schedule_entry_id.
CREATE TABLE IF NOT EXISTS interview_slots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  calendar TEXT NOT NULL,
  date TEXT NOT NULL,
  start_time TEXT NOT NULL,
  end_time TEXT NOT NULL,
  location TEXT DEFAULT '',
  notes TEXT DEFAULT '',
  reserved_by TEXT,
  reserved_contact TEXT,
  reserved_purpose TEXT,
  reserved_at TEXT,
  schedule_entry_id INTEGER,
  created_by TEXT,
  updated_at TEXT,
  updated_by TEXT
);
CREATE INDEX IF NOT EXISTS idx_interview_slots_date ON interview_slots(date);

-- One private calendar subscription link per user (token in the URL).
CREATE TABLE IF NOT EXISTS calendar_feeds (
  user_id INTEGER PRIMARY KEY,
  token TEXT NOT NULL UNIQUE,
  calendars TEXT NOT NULL DEFAULT '[]',
  created_at TEXT
);
