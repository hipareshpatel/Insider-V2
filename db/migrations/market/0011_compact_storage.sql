-- D130 compact storage (+ D127 no debt, D131 write budget). Integer dates (YYYYMMDD), integer paise, WITHOUT ROWID.
-- Old data is dropped and reloaded from the R2 cache (raw files are the lossless copy). The pause (0010) stays on.
DELETE FROM latest_snapshot;
DELETE FROM market_structure;
DELETE FROM index_membership;
DELETE FROM classification;
DELETE FROM adj_factor;
DELETE FROM corp_action;
DROP TABLE price_daily;
DROP TABLE delivery_daily;
DROP TABLE shares_daily;
DROP TABLE index_daily;
DELETE FROM security_identifier;
DELETE FROM security;
DELETE FROM source_file;
DELETE FROM trading_calendar;
DELETE FROM pipeline_run;

CREATE TABLE price_daily (
  security_id    INTEGER NOT NULL REFERENCES security(security_id),
  d              INTEGER NOT NULL,          -- trade date YYYYMMDD (IST)
  series         TEXT NOT NULL,
  open           INTEGER, high INTEGER, low INTEGER,
  close          INTEGER NOT NULL,          -- paise
  prev_close     INTEGER,
  volume         INTEGER NOT NULL,
  turnover_paise INTEGER,
  trades         INTEGER,
  file_id        INTEGER NOT NULL,
  PRIMARY KEY (security_id, d, series)
) WITHOUT ROWID;
CREATE INDEX ix_price_d ON price_daily (d);

CREATE TABLE delivery_daily (
  security_id     INTEGER NOT NULL REFERENCES security(security_id),
  d               INTEGER NOT NULL,
  series          TEXT NOT NULL,
  deliverable_qty INTEGER,                  -- delivery % = deliverable_qty / volume
  PRIMARY KEY (security_id, d, series)
) WITHOUT ROWID;

CREATE TABLE shares_daily (
  security_id  INTEGER NOT NULL REFERENCES security(security_id),
  d            INTEGER NOT NULL,
  issue_size   INTEGER NOT NULL,
  mcap_paise   INTEGER,                     -- exactly as NSE published (D5); not derivable (D130)
  mcap_source  TEXT NOT NULL CHECK (mcap_source IN ('nse','derived')),
  face_value_paise INTEGER,
  PRIMARY KEY (security_id, d)
) WITHOUT ROWID;

CREATE TABLE index_daily (
  index_name TEXT NOT NULL,
  d          INTEGER NOT NULL,
  open TEXT, high TEXT, low TEXT, close TEXT NOT NULL, pe TEXT, pb TEXT, div_yield TEXT,
  PRIMARY KEY (index_name, d)
) WITHOUT ROWID;

-- Row-count gate reads this instead of scanning price_daily (D131 read discipline).
ALTER TABLE trading_calendar ADD COLUMN universe_rows INTEGER;

-- D131 daily write budget.
CREATE TABLE write_budget (
  day   TEXT PRIMARY KEY,                   -- IST date
  rows  INTEGER NOT NULL DEFAULT 0
);
