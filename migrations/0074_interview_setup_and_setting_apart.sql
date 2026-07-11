ALTER TABLE interview_pipeline ADD COLUMN setup_assigned_to TEXT DEFAULT '';
ALTER TABLE interview_pipeline ADD COLUMN setup_status TEXT DEFAULT 'Not started';
ALTER TABLE interview_pipeline ADD COLUMN calling_id INTEGER REFERENCES calling_pipeline(id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_interview_setting_apart_calling
  ON interview_pipeline(calling_id)
  WHERE calling_id IS NOT NULL AND type_of_interview = 'Setting Apart';
