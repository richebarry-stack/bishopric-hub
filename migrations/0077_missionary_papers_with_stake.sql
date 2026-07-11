-- Insert a new "Papers with Stake" step between Papers Started and Papers
-- Submitted, renumbering existing rows at or after the old "3-Papers Submitted"
-- so their stored status strings keep matching the updated status list.
UPDATE missionary_pipeline SET status = '7-Released' WHERE status = '6-Released';
UPDATE missionary_pipeline SET status = '6-Serving' WHERE status = '5-Serving';
UPDATE missionary_pipeline SET status = '5-Call Accepted' WHERE status = '4-Call Accepted';
UPDATE missionary_pipeline SET status = '4-Papers Submitted' WHERE status = '3-Papers Submitted';
