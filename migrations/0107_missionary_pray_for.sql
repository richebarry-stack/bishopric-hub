-- Dashboard Missionaries panel doubles as a prayer list. 1 = show (default);
-- tapping 🙏 on the dashboard sets 0 so the person stays off the list.
ALTER TABLE missionary_pipeline ADD COLUMN pray_for INTEGER DEFAULT 1;
