-- Tie missionary pipeline to sacrament speakers: a missionary's farewell (leaving)
-- or homecoming (returning) talk is a single sacrament_speakers row, linked back to
-- the missionary. The Missionary Pipeline drives these dates; Sacrament Planning shows
-- and can edit the same row, so the speaking date stays identical on both.
ALTER TABLE sacrament_speakers ADD COLUMN missionary_id INTEGER;
ALTER TABLE sacrament_speakers ADD COLUMN speaker_occasion TEXT;
