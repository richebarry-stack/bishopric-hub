ALTER TABLE hub_suggestions ADD COLUMN hub TEXT DEFAULT '';

UPDATE hub_suggestions
SET hub = COALESCE(
  (SELECT CASE u.hub
     WHEN 'wc' THEN 'Ward Council'
     WHEN 'both' THEN 'Bishopric'
     ELSE 'Bishopric'
   END
   FROM users u
   WHERE LOWER(TRIM(u.name)) = LOWER(TRIM(hub_suggestions.submitted_by))
   LIMIT 1),
  'Bishopric'
)
WHERE hub IS NULL OR hub = '';
