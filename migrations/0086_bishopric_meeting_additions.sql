-- Free-form updates/announcements box on the weekly bishopric meeting.
ALTER TABLE bishopric_meetings ADD COLUMN updates_announcements TEXT DEFAULT '';

-- Move-in / move-out / "other items" lists for the bishopric meeting, scoped by
-- meeting_date exactly like bishopric_agenda_items. One shared table across the
-- three lists (distinguished by `kind`) to avoid near-duplicate schemas.
CREATE TABLE IF NOT EXISTS bishopric_move_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  meeting_date TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'other', -- 'move_in' | 'move_out' | 'other'
  item TEXT NOT NULL DEFAULT '',
  done INTEGER NOT NULL DEFAULT 0,
  position INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_by TEXT
);
CREATE INDEX IF NOT EXISTS idx_bishopric_move_items_date ON bishopric_move_items(meeting_date);

-- Persistent "flag for bishopric meeting discussion" marker on interviews,
-- toggleable from the interview list pages or from the meeting page.
ALTER TABLE interview_pipeline ADD COLUMN flagged_for_meeting INTEGER DEFAULT 0;
