-- Ordinance details synced nightly from LCR's "Bishopric Hub – Ordinances" custom
-- report. NULL = never synced (unknown); the sync writes 0/1 for the flags.
ALTER TABLE ward_members ADD COLUMN baptized INTEGER;
ALTER TABLE ward_members ADD COLUMN baptism_date TEXT;
ALTER TABLE ward_members ADD COLUMN priesthood_office TEXT;
ALTER TABLE ward_members ADD COLUMN ordination_date TEXT;
ALTER TABLE ward_members ADD COLUMN endowed INTEGER;
ALTER TABLE ward_members ADD COLUMN endowment_date TEXT;
ALTER TABLE ward_members ADD COLUMN sealed_to_spouse INTEGER;
ALTER TABLE ward_members ADD COLUMN sealing_date TEXT;
ALTER TABLE ward_members ADD COLUMN ordinances_synced_at TEXT;

ALTER TABLE lcr_sync_runs ADD COLUMN ordinances_updated INTEGER;
ALTER TABLE lcr_sync_runs ADD COLUMN ordinances_changed TEXT;
ALTER TABLE lcr_sync_runs ADD COLUMN ordinances_unmatched TEXT;
