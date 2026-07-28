-- Replaces the generic mid/late-stage missionary statuses with ones that
-- mirror missionaryrecommendations.churchofjesuschrist.org's own stages
-- 1:1, so the LCR sync can set status directly without lossy mapping.
-- The three pre-candidacy stages (before an official recommendation
-- exists) are untouched -- the church site has no equivalent for those.
UPDATE missionary_pipeline SET status = 'With the Stake President' WHERE status = '3-Papers with Stake';
UPDATE missionary_pipeline SET status = 'With Church Headquarters' WHERE status = '4-Papers Submitted';
UPDATE missionary_pipeline SET status = 'Assignment Made' WHERE status = '5-Call Accepted';
UPDATE missionary_pipeline SET status = 'Entered the Mission Field' WHERE status = '6-Serving';
UPDATE missionary_pipeline SET status = 'Released from Mission Field' WHERE status = '7-Released';

ALTER TABLE missionary_pipeline ADD COLUMN ward_member_id INTEGER REFERENCES ward_members(id);
ALTER TABLE missionary_pipeline ADD COLUMN mission_end_estimated TEXT;
