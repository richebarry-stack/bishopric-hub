-- Ledger of action items already emailed to a person, so the mailer Worker
-- (workers/mailer) sends a "new assignment" email exactly once per item.
CREATE TABLE IF NOT EXISTS action_item_notifications (
  user_id INTEGER NOT NULL,
  item_id TEXT NOT NULL,            -- ActionItem.id, e.g. 'interview-setup-42'
  sent_at TEXT NOT NULL,
  PRIMARY KEY (user_id, item_id)
);

-- Mailer run log, read-only mirror of lcr_sync_runs so the Automation page can
-- show the mailer's history the same way.
CREATE TABLE IF NOT EXISTS mailer_runs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ran_at TEXT NOT NULL,
  kind TEXT NOT NULL,               -- 'new-items' | 'weekly'
  emails_sent INTEGER NOT NULL DEFAULT 0,
  items_notified INTEGER NOT NULL DEFAULT 0,
  errors TEXT                       -- JSON [{recipient, error}]
);
