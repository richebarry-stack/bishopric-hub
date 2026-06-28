-- Add category column so speakers and prayers have independent notes per person
ALTER TABLE speaker_notes RENAME TO speaker_notes_old;

CREATE TABLE speaker_notes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  person_name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'speaker',
  notes TEXT NOT NULL DEFAULT '',
  updated_at TEXT NOT NULL DEFAULT '',
  UNIQUE(person_name, category)
);

-- Migrate existing notes as speaker category
INSERT INTO speaker_notes (person_name, category, notes, updated_at)
SELECT person_name, 'speaker', notes, updated_at FROM speaker_notes_old WHERE notes != '';

DROP TABLE speaker_notes_old;
