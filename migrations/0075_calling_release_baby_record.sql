ALTER TABLE calling_pipeline ADD COLUMN release_recorded INTEGER NOT NULL DEFAULT 0;
ALTER TABLE babies ADD COLUMN church_record_created INTEGER NOT NULL DEFAULT 0;
UPDATE babies SET church_record_created = 1 WHERE status = 'Recorded';
