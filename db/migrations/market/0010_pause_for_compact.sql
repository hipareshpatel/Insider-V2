-- D130: pause the market job before the compact-storage schema change (lifted by a later migration after the new code is live).
INSERT OR REPLACE INTO job_lock (name, holder, expires_at) VALUES ('paused', 'migration-0010', '9999-12-31T00:00:00Z');
