-- The daily job adds a "Create church record for …" task once a baby is blessed.
-- It used to dedupe only against existing tasks, so deleting the task made it come
-- back the next morning. Remember per baby that the task was made instead.
ALTER TABLE babies ADD COLUMN record_task_created INTEGER NOT NULL DEFAULT 0;
-- Every baby blessed before today has already had its task made.
UPDATE babies SET record_task_created = 1
 WHERE blessing_date IS NOT NULL AND blessing_date != '' AND blessing_date <= date('now');
