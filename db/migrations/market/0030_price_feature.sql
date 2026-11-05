-- Field catalogue §3 (work list item 3): price returns, 52-week range, moving averages, RSI, volatility and liquidity of
-- the focus companies, computed from stored closes adjusted by the applied factors (D6). Computed values only (never
-- filed data); one row per security and field, rewritten only when the value changes.
CREATE TABLE price_feature (
  security_id  INTEGER NOT NULL,
  field        TEXT NOT NULL,
  value        TEXT,
  reason       TEXT,
  as_of        TEXT NOT NULL,             -- last session used (ISO)
  computed_at  TEXT NOT NULL,
  PRIMARY KEY (security_id, field)
) WITHOUT ROWID;
