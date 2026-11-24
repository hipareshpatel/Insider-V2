-- Field catalogue §12 / §13 (log #382): results timing, filing timeliness and credit-rating fields of the focus
-- companies, from stored filings, board-meeting intimations and credit ratings. Computed values only; one row per
-- company and field, rewritten only when the value changes (same shape as ownership_feature).
CREATE TABLE event_feature (
  security_id  INTEGER NOT NULL,
  field        TEXT NOT NULL,
  value        TEXT,
  reason       TEXT,
  as_of        TEXT NOT NULL,             -- IST day computed for
  computed_at  TEXT NOT NULL,
  PRIMARY KEY (security_id, field)
) WITHOUT ROWID;
