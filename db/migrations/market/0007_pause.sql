-- Maintenance pause before a clean reset (runner checks this before every date).
INSERT OR REPLACE INTO job_lock (name, holder, expires_at) VALUES ('paused', 'migration-0007', '9999-12-31T00:00:00Z');
