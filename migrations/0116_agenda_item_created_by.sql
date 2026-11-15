-- Hub suggestion #41: show who added each bishopric agenda item.
-- updated_by changes on every edit (even checking an item off), so the adder
-- needs its own column. Existing items are backfilled from updated_by, the
-- best record available.
ALTER TABLE bishopric_agenda_items ADD COLUMN created_by TEXT;
UPDATE bishopric_agenda_items SET created_by = updated_by WHERE created_by IS NULL;
