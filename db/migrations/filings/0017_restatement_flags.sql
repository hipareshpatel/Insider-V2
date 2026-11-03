-- D48 (owner #290 known-case checks): a later filing for the same company, period and basis is 'restated' (the earliest
-- is 'original'; nothing is overwritten). Core-line differences above 0.5% are recorded here for the site's marker / review.
CREATE TABLE restatement_flag (
  security_id INTEGER NOT NULL, statement TEXT NOT NULL, line TEXT NOT NULL, period_end TEXT NOT NULL, period_kind TEXT NOT NULL, basis TEXT NOT NULL,
  original_value TEXT, restated_value TEXT, change_pct TEXT, original_at TEXT NOT NULL, restated_at TEXT NOT NULL,
  PRIMARY KEY (security_id, statement, line, period_end, period_kind, basis, restated_at)
) WITHOUT ROWID;
