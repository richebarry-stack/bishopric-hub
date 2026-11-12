-- Calling Pipeline organizations now follow the General Handbook's ward
-- organizations (shared/callingGroups.ts). Convert older names, and fill in the
-- organization on entries that had none where the calling makes it clear.

UPDATE calling_pipeline SET organization = 'Bishopric and Clerks' WHERE organization = 'Bishopric';
UPDATE calling_pipeline SET organization = 'Aaronic Priesthood (Young Men)'
  WHERE organization IN ('Young Men', 'YM', 'Aaronic Priesthood Quorums', 'Additional Aaronic Priesthood Quorums Callings', 'Priests Quorum Adult Leaders');
UPDATE calling_pipeline SET organization = 'Young Women'
  WHERE organization IN ('YW', 'Additional Young Women Callings', 'Builders of Faith Adult Leaders', 'Gatherers of Light Adult Leaders', 'Messengers of Hope Adult Leaders', 'Messengers of Hope Presidency');
UPDATE calling_pipeline SET organization = 'Primary' WHERE organization = 'Primary Presidency';
UPDATE calling_pipeline SET organization = 'Sunday School' WHERE organization IN ('Sundary School', 'Sunday School Presidency', 'Gospel Foundations');
UPDATE calling_pipeline SET organization = 'Young Single Adults' WHERE organization = 'Young Single Adult';
UPDATE calling_pipeline SET organization = 'Missionary Work' WHERE organization IN ('Ward Missionaries', 'Mission Responsibilities');
UPDATE calling_pipeline SET organization = 'Temple and Family History' WHERE organization = 'Temple Workers';
UPDATE calling_pipeline SET organization = 'Communication and Technology' WHERE organization = 'Technology';
UPDATE calling_pipeline SET organization = 'Meetinghouse' WHERE organization = 'Facilities';
UPDATE calling_pipeline SET organization = 'Bishopric and Clerks' WHERE organization = 'History';
UPDATE calling_pipeline SET organization = 'Stake' WHERE organization IN ('High Council', 'Stake Presidency', 'Stake Primary', 'Stake Young Men', 'Stake Temple and Family History');

-- Entries with no organization, placed by their calling.
UPDATE calling_pipeline SET organization = 'Aaronic Priesthood (Young Men)'
  WHERE COALESCE(organization, '') = '' AND lower(trim(replace(calling, '**', ''))) IN ('deacons advisor', 'teachers quorum', 'young mens advisor');
UPDATE calling_pipeline SET organization = 'Primary'
  WHERE COALESCE(organization, '') = '' AND lower(trim(replace(calling, '**', ''))) IN ('primary', 'primary teacher');
UPDATE calling_pipeline SET organization = 'Relief Society'
  WHERE COALESCE(organization, '') = '' AND lower(trim(replace(calling, '**', ''))) = 'rs activity chair';
UPDATE calling_pipeline SET organization = 'Sunday School'
  WHERE COALESCE(organization, '') = '' AND lower(trim(replace(calling, '**', ''))) = 'sunday school';
UPDATE calling_pipeline SET organization = 'Young Women'
  WHERE COALESCE(organization, '') = '' AND lower(trim(replace(calling, '**', ''))) = 'yw advisor';
