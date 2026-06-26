-- Users table for authentication
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'editor',
  created_at TEXT DEFAULT (datetime('now'))
);

-- Calling Pipeline
CREATE TABLE IF NOT EXISTS calling_pipeline (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  member TEXT,
  calling TEXT,
  status TEXT DEFAULT '1. Discussion',
  assigned_to TEXT,
  sustain_recorded INTEGER DEFAULT 0,
  set_apart_recorded INTEGER DEFAULT 0,
  organization TEXT,
  calling_release TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Interview Pipeline
CREATE TABLE IF NOT EXISTS interview_pipeline (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  member TEXT,
  date_recommend_expires TEXT,
  type_of_interview TEXT,
  status TEXT DEFAULT 'Unassigned',
  assigned_to TEXT,
  last_interview_datetime TEXT,
  notes TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- All Task List
CREATE TABLE IF NOT EXISTS tasks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  task TEXT,
  assigned_to TEXT,
  created_date TEXT DEFAULT (date('now')),
  done INTEGER DEFAULT 0,
  share_with TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Rotating Bishopric Assignments
CREATE TABLE IF NOT EXISTS rotating_assignments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  month TEXT,
  plan_conduct TEXT,
  primary_message TEXT
);

-- Bishopric Meeting Schedule
CREATE TABLE IF NOT EXISTS bishopric_meetings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT,
  spiritual_thought TEXT,
  opening_prayer TEXT,
  closing_prayer TEXT,
  handbook_training TEXT,
  handbook_section TEXT,
  minutes TEXT,
  no_meeting INTEGER DEFAULT 0,
  reason_not_meeting TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Out of Town Schedule
CREATE TABLE IF NOT EXISTS out_of_town (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  who TEXT,
  start_date TEXT,
  end_date TEXT,
  notes TEXT
);

-- Sacrament Speakers
CREATE TABLE IF NOT EXISTS sacrament_speakers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  meeting_date TEXT,
  speaker TEXT,
  speaker_type TEXT,
  accepted TEXT,
  speaking_order INTEGER,
  topic TEXT,
  notes TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Prayers
CREATE TABLE IF NOT EXISTS prayers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  meeting_date TEXT,
  name TEXT,
  opening_closing TEXT,
  notes TEXT
);

-- Sacrament Music
CREATE TABLE IF NOT EXISTS sacrament_music (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  meeting_date TEXT,
  chorister TEXT,
  organist TEXT,
  opening_hymn TEXT,
  sacrament_hymn TEXT,
  rest_special TEXT,
  closing_hymn TEXT,
  notes TEXT
);

-- Sacrament Meeting Theme and Resources
CREATE TABLE IF NOT EXISTS sacrament_themes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  meeting_date TEXT,
  theme TEXT,
  references_text TEXT,
  conducting TEXT,
  meeting_link TEXT
);

-- Member Needs
CREATE TABLE IF NOT EXISTS member_needs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  who TEXT,
  what TEXT,
  type TEXT,
  notes TEXT,
  share_with TEXT,
  resolved INTEGER DEFAULT 0,
  next_steps TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Calendaring
CREATE TABLE IF NOT EXISTS calendaring (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT,
  dates TEXT,
  notes TEXT,
  announce_in_sacrament INTEGER DEFAULT 0,
  share_with TEXT
);

-- Missionary Pipeline
CREATE TABLE IF NOT EXISTS missionary_pipeline (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  who TEXT,
  notes TEXT,
  mission_call TEXT,
  temple_status TEXT,
  next_steps TEXT,
  report_date TEXT,
  release_date TEXT,
  status TEXT DEFAULT '1-Considering',
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Babies
CREATE TABLE IF NOT EXISTS babies (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT,
  due_birth_date TEXT,
  status TEXT DEFAULT 'Expecting',
  blessing_date TEXT,
  notes TEXT,
  actions TEXT
);

-- Sessions for auth
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL,
  expires_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id)
);
