-- Add ward_business column to sacrament_themes to separate ward business from announcements
ALTER TABLE sacrament_themes ADD COLUMN ward_business TEXT NOT NULL DEFAULT '';
