-- Results loader (M2): one row per attachment processed; values only when every check passes (FMEA B5–B9).
CREATE TABLE fin_load (
  job_id      INTEGER PRIMARY KEY,
  status      TEXT NOT NULL CHECK (status IN ('loaded','review','skipped','failed')),
  filing_id   INTEGER,
  detail      TEXT,
  at          TEXT NOT NULL
);
CREATE INDEX ix_fin_load_status ON fin_load (status);
