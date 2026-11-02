-- D128: raw API prefetch queue. One row per URL; the raw response lives in R2 at r2_key.
CREATE TABLE fetch_job (
  job_id       INTEGER PRIMARY KEY,
  kind         TEXT NOT NULL,              -- endpoint name, e.g. 'shareholding'
  symbol       TEXT,                       -- NULL for bulk jobs
  url          TEXT NOT NULL UNIQUE,
  r2_key       TEXT NOT NULL,
  status       TEXT NOT NULL DEFAULT 'todo' CHECK (status IN ('todo','done','empty','failed')),
  attempts     INTEGER NOT NULL DEFAULT 0,
  http_status  INTEGER,
  bytes        INTEGER,
  sha256       TEXT,
  fetched_at   TEXT,
  error        TEXT
);
CREATE INDEX ix_fetch_todo ON fetch_job (status, attempts, job_id);
CREATE TABLE job_lock (
  name        TEXT PRIMARY KEY,
  holder      TEXT NOT NULL,
  expires_at  TEXT NOT NULL
);
