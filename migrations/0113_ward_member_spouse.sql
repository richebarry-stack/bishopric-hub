-- Spouse and sealing details from the LCR ordinance report, so the hub can tell
-- "married but not sealed" and fill in a sealing LCR's report left off one spouse.
ALTER TABLE ward_members ADD COLUMN spouse_name TEXT;
ALTER TABLE ward_members ADD COLUMN sealed_to_current_spouse INTEGER;
ALTER TABLE ward_members ADD COLUMN sealed_to_prior_spouse INTEGER;
