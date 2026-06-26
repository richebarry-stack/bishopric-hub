ALTER TABLE calling_pipeline ADD COLUMN type TEXT NOT NULL DEFAULT 'Calling';
UPDATE calling_pipeline SET type = 'Release' WHERE status IN ('7. Need to release', '8. Need to thank at pulpit', '9. Released');
