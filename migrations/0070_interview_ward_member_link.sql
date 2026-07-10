-- Preferred name (displayed on touched pages; Ward Members still shows the legal name)
ALTER TABLE ward_members ADD COLUMN preferred_name TEXT DEFAULT '';

-- Links a youth interview row to its ward member so edits can update the roster
-- name directly, and so the daily sync job can find/update the right row.
ALTER TABLE interview_pipeline ADD COLUMN ward_member_id INTEGER REFERENCES ward_members(id);

-- Backfill: link existing youth-type rows to ward_members by exact name match.
-- Rows with no exact match stay unlinked (reconciled manually via the UI's
-- "Link to member" picker).
UPDATE interview_pipeline
SET ward_member_id = (
  SELECT id FROM ward_members wm
  WHERE lower(trim(wm.name)) = lower(trim(interview_pipeline.member))
)
WHERE type_of_interview IN ('Annual Youth', 'Semi-Annual Youth');

-- Dedupe: earlier data (0034-0039 seeding, plus the "Add to pipeline" era) can have
-- left more than one youth row per person (e.g. one 'Annual Youth' and one
-- 'Semi-Annual Youth' row for the same 16-17-year-old). Keep exactly one per linked
-- member — prefer the row with the most recent last_interview_datetime, tiebreak by
-- lowest id — before the unique index below is created.
DELETE FROM interview_pipeline
WHERE id IN (
  SELECT id FROM (
    SELECT id,
      ROW_NUMBER() OVER (
        PARTITION BY ward_member_id
        ORDER BY
          (last_interview_datetime IS NULL OR last_interview_datetime = '') ASC,
          last_interview_datetime DESC,
          id ASC
      ) AS rn
    FROM interview_pipeline
    WHERE ward_member_id IS NOT NULL
      AND type_of_interview IN ('Annual Youth', 'Semi-Annual Youth')
  )
  WHERE rn > 1
);

-- Enforce one youth-interview row per linked person going forward.
CREATE UNIQUE INDEX IF NOT EXISTS idx_interview_youth_member
  ON interview_pipeline(ward_member_id)
  WHERE ward_member_id IS NOT NULL AND type_of_interview IN ('Annual Youth', 'Semi-Annual Youth');
