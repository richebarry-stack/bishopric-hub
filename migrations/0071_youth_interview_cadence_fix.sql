-- Handbook correction: youth 12-15 also get TWO interviews a year (bishop, then
-- an assigned counselor ~6 months later) — not one. The old 'Annual Youth' /
-- 'Semi-Annual Youth' labels implied different frequencies (wrong); rename to
-- reflect that the real distinction is age bracket (and who conducts), not cadence.
DROP INDEX IF EXISTS idx_interview_youth_member;

UPDATE interview_pipeline SET type_of_interview = 'Youth 12-15' WHERE type_of_interview = 'Annual Youth';
UPDATE interview_pipeline SET type_of_interview = 'Youth 16-17' WHERE type_of_interview = 'Semi-Annual Youth';

CREATE UNIQUE INDEX IF NOT EXISTS idx_interview_youth_member
  ON interview_pipeline(ward_member_id)
  WHERE ward_member_id IS NOT NULL AND type_of_interview IN ('Youth 12-15', 'Youth 16-17');

-- Default unassigned youth interviews to the bishop (per Handbook: the bishop
-- conducts both 16-17 interviews, and typically starts the 12-15 cycle before it
-- alternates to an assigned counselor). Only fills in rows with no one assigned yet.
UPDATE interview_pipeline
SET assigned_to = (SELECT name FROM users WHERE church_role = 'Bishop' LIMIT 1)
WHERE type_of_interview IN ('Youth 12-15', 'Youth 16-17')
  AND (assigned_to IS NULL OR assigned_to = '')
  AND EXISTS (SELECT 1 FROM users WHERE church_role = 'Bishop');
