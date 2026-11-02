-- One runner at a time per job (cron invocations can overlap).
CREATE TABLE job_lock (
  name        TEXT PRIMARY KEY,
  holder      TEXT NOT NULL,
  expires_at  TEXT NOT NULL
);
