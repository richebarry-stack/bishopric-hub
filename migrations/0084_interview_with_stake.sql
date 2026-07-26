-- Marks a temple recommend interview as conducted with the stake (rather than the
-- bishop/counselors), so those can be filtered out of the Adult Temple Interviews list.
ALTER TABLE interview_pipeline ADD COLUMN with_stake INTEGER DEFAULT 0;
