-- Drop the "(Young Men)" from the Aaronic Priesthood organization name.
UPDATE calling_pipeline SET organization = 'Aaronic Priesthood' WHERE organization = 'Aaronic Priesthood (Young Men)';
