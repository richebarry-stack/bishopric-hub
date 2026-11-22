-- Deleting a New & Returning Members row that came from a bishopric-meeting move-in
-- keeps a hidden tombstone (deleted = 1) so the automatic sync doesn't add it back.
ALTER TABLE member_care ADD COLUMN deleted INTEGER NOT NULL DEFAULT 0;
