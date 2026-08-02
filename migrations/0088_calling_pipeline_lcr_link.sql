-- Links calling_pipeline rows to ward_members (for the LCR callings sync to
-- reconcile reliably by id rather than fuzzy-matching free-text names every
-- run) and adds the sustained date, which wasn't tracked before.
ALTER TABLE calling_pipeline ADD COLUMN ward_member_id INTEGER REFERENCES ward_members(id);
ALTER TABLE calling_pipeline ADD COLUMN sustained_date TEXT;
