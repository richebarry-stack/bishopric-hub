-- Whether this calling row's free-text `calling` value has ever been
-- confirmed to text-match LCR's own wording for that org during a sync.
-- Auto-release reconciliation only fires for confirmed rows — a row whose
-- legacy wording (e.g. "Nursery" vs LCR's "Nursery Worker") never matched
-- just means "we can't tell from LCR's dump," not "they were released,"
-- and that mismatch persists across every future sync run, not just the
-- first one after backfill (the earlier, insufficient fix).
ALTER TABLE calling_pipeline ADD COLUMN lcr_calling_confirmed INTEGER NOT NULL DEFAULT 0;
