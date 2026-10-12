-- '' = a normal sacrament meeting; otherwise why there is none that Sunday
-- ('Stake Conference' or 'General Conference').
ALTER TABLE sacrament_themes ADD COLUMN no_meeting TEXT NOT NULL DEFAULT '';
