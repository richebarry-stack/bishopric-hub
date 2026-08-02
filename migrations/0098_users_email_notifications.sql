-- Per-user opt-out for the action-item mailer (workers/mailer). Defaults on.
ALTER TABLE users ADD COLUMN email_notifications INTEGER NOT NULL DEFAULT 1;
