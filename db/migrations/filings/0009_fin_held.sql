-- Scale-guard anchor (FMEA C6): a held value becomes the comparison point for the next filing, so a lasting
-- step change (demerger, merger) holds only its first period; a one-off scale slip is still caught.
CREATE TABLE fin_held (
  security_id  INTEGER NOT NULL,
  line         TEXT NOT NULL,
  basis        TEXT NOT NULL,
  period_kind  TEXT NOT NULL,
  period_end   TEXT NOT NULL,
  value        TEXT NOT NULL,
  job_id       INTEGER NOT NULL,
  PRIMARY KEY (security_id, line, basis, period_kind, period_end)
) WITHOUT ROWID;
DELETE FROM fin_load WHERE status = 'review' AND detail LIKE 'scale guard%';
