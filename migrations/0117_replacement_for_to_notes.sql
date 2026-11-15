-- Calling Pipeline: "Replacement for [person]" placeholder entries now keep that
-- text in Notes and leave Member blank until someone is picked. Move existing ones.
UPDATE calling_pipeline
   SET notes = CASE WHEN TRIM(COALESCE(notes, '')) = '' THEN TRIM(member)
                    ELSE TRIM(member) || char(10) || notes END,
       member = '',
       updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
 WHERE member LIKE 'Replacement for %' AND ward_member_id IS NULL;
