-- Renumbered calling_pipeline statuses to plain sequential integers, except
-- "4.5 Call & accepted, handle in class/quorum" which stays a half-step (it's
-- a variant of "4. Called & accepted", not a new stage). "6.5 In release
-- discussion" becomes "7.", and everything after it shifts up by one.
UPDATE calling_pipeline SET status = '7. In release discussion' WHERE status = '6.5 In release discussion';
UPDATE calling_pipeline SET status = '8. Need to release' WHERE status = '7. Need to release';
UPDATE calling_pipeline SET status = '9. Need to thank at pulpit' WHERE status = '8. Need to thank at pulpit';
UPDATE calling_pipeline SET status = '10. Released' WHERE status = '9. Released';
UPDATE calling_pipeline SET status = '11. Declined' WHERE status = '10. Declined';
