-- market DB (PLAN §5.1, §5.2). Identity lives here; other DBs reference security_id by value.
-- Conventions: timestamps are UTC ISO-8601 text (D114); trade_date is the IST calendar date (YYYY-MM-DD).
-- Money stored exact in rupees (REAL is avoided for money: paise integers or TEXT decimals). Prices: TEXT decimal as filed.

CREATE TABLE security (
  security_id   INTEGER PRIMARY KEY,
  kind          TEXT NOT NULL DEFAULT 'equity' CHECK (kind IN ('equity','reit','invit','etf','other')),
  name          TEXT NOT NULL,
  listed_on     TEXT,                       -- NSE listing date
  delisted_on   TEXT,
  entity_id     INTEGER,                    -- graph.entity (every listed security has one, §5.1)
  created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

-- Symbol / ISIN / series are attributes with history, never keys (§5.1).
CREATE TABLE security_identifier (
  id            INTEGER PRIMARY KEY,
  security_id   INTEGER NOT NULL REFERENCES security(security_id),
  id_type       TEXT NOT NULL CHECK (id_type IN ('nse_symbol','isin','bse_code','name')),
  value         TEXT NOT NULL,
  valid_from    TEXT NOT NULL,              -- first trade_date seen (or listing date)
  valid_to      TEXT,                       -- NULL = current
  source        TEXT NOT NULL,              -- e.g. 'EQUITY_L', 'bhavcopy:2026-10-30'
  UNIQUE (id_type, value, valid_from)
);
CREATE INDEX ix_sid_lookup ON security_identifier (id_type, value);
CREATE INDEX ix_sid_security ON security_identifier (security_id);

-- Sector history from our first fetch onward (D121): NSE index CSV Industry, else announcement smIndustry.
CREATE TABLE classification (
  security_id     INTEGER NOT NULL REFERENCES security(security_id),
  as_of           TEXT NOT NULL,
  sector          TEXT,                     -- one of NSE's 22 broad sectors, NULL = Unclassified
  industry_detail TEXT,                     -- announcement smIndustry, as filed
  sector_source   TEXT NOT NULL CHECK (sector_source IN ('index_csv','announcement_map','none')),
  source_ref      TEXT NOT NULL,            -- file name + date, or announcement seq id
  PRIMARY KEY (security_id, as_of)
);

CREATE TABLE trading_calendar (
  trade_date    TEXT PRIMARY KEY,
  is_session    INTEGER NOT NULL CHECK (is_session IN (0,1)),
  note          TEXT                        -- e.g. 'weekend session', 'holiday'
);

-- B4 run log: one row per (pipeline, key) attempt.
CREATE TABLE pipeline_run (
  run_id        INTEGER PRIMARY KEY,
  pipeline      TEXT NOT NULL,              -- e.g. 'market.daily'
  run_key       TEXT NOT NULL,              -- e.g. trade date
  started_at    TEXT NOT NULL,
  finished_at   TEXT,
  status        TEXT NOT NULL CHECK (status IN ('running','ok','failed','skipped')),
  detail        TEXT                        -- JSON: counts, errors, gate results
);
CREATE INDEX ix_run ON pipeline_run (pipeline, run_key);

-- Raw source files (B4): every fetched file, hashed; bytes live in R2 (or are re-fetchable).
CREATE TABLE source_file (
  file_id       INTEGER PRIMARY KEY,
  source        TEXT NOT NULL,              -- 'udiff_bhavcopy', 'pr_mcap', 'pr_bc', 'equity_l', 'index_csv:<name>', ...
  file_date     TEXT,                       -- IST date the file is about
  url           TEXT NOT NULL,
  sha256        TEXT NOT NULL,
  bytes         INTEGER NOT NULL,
  fetched_at    TEXT NOT NULL,
  r2_key        TEXT,
  UNIQUE (source, file_date, sha256)
);

-- Raw OHLCV per series, never mutated (§5.2). A revised file creates a new source_file and replaces via version.
CREATE TABLE price_daily (
  security_id   INTEGER NOT NULL REFERENCES security(security_id),
  trade_date    TEXT NOT NULL,
  series        TEXT NOT NULL,
  open          TEXT, high TEXT, low TEXT, close TEXT NOT NULL, last TEXT, prev_close TEXT,
  volume        INTEGER NOT NULL,
  turnover_rs   TEXT,                       -- rupees, exact decimal text
  trades        INTEGER,
  isin          TEXT NOT NULL,              -- ISIN on that day, as filed
  file_id       INTEGER NOT NULL REFERENCES source_file(file_id),
  PRIMARY KEY (security_id, trade_date, series)
);
CREATE INDEX ix_price_date ON price_daily (trade_date);

CREATE TABLE delivery_daily (
  security_id   INTEGER NOT NULL REFERENCES security(security_id),
  trade_date    TEXT NOT NULL,
  series        TEXT NOT NULL,
  deliverable_qty INTEGER,
  delivery_pct  TEXT,
  file_id       INTEGER NOT NULL REFERENCES source_file(file_id),
  PRIMARY KEY (security_id, trade_date, series)
);

-- Share count + market cap (D5): mcap stored exact in rupees, never adjusted.
CREATE TABLE shares_daily (
  security_id   INTEGER NOT NULL REFERENCES security(security_id),
  trade_date    TEXT NOT NULL,
  issue_size    INTEGER NOT NULL,
  face_value    TEXT,
  mcap_rs       TEXT NOT NULL,
  mcap_source   TEXT NOT NULL CHECK (mcap_source IN ('nse','derived')),
  file_id       INTEGER REFERENCES source_file(file_id),
  PRIMARY KEY (security_id, trade_date)
);

CREATE TABLE corp_action (
  ca_id         INTEGER PRIMARY KEY,
  security_id   INTEGER NOT NULL REFERENCES security(security_id),
  ex_date       TEXT NOT NULL,
  type          TEXT NOT NULL CHECK (type IN ('split','bonus','rights','dividend','demerger','capital_reduction','consolidation','other')),
  raw_purpose   TEXT NOT NULL,
  ratio_num     TEXT,                       -- e.g. bonus 1:1 -> new 1 for held 1
  ratio_den     TEXT,
  rights_price  TEXT,
  amount        TEXT,                       -- dividend per share, rupees
  status        TEXT NOT NULL CHECK (status IN ('parsed','review','confirmed','rejected')),
  file_id       INTEGER REFERENCES source_file(file_id),
  UNIQUE (security_id, ex_date, raw_purpose)  -- Bc rows repeat per series (§5.2)
);

CREATE TABLE adj_factor (
  security_id   INTEGER NOT NULL REFERENCES security(security_id),
  ex_date       TEXT NOT NULL,
  factor        TEXT NOT NULL,              -- multiply prices before ex_date by this
  method        TEXT NOT NULL CHECK (method IN ('share_ratio','bc_ratio','terp','price_ratio','manual')),
  ca_id         INTEGER REFERENCES corp_action(ca_id),
  status        TEXT NOT NULL CHECK (status IN ('auto','review','confirmed')),
  PRIMARY KEY (security_id, ex_date)
);

CREATE TABLE index_daily (
  index_name    TEXT NOT NULL,
  trade_date    TEXT NOT NULL,
  open TEXT, high TEXT, low TEXT, close TEXT NOT NULL,
  pe TEXT, pb TEXT, div_yield TEXT,
  file_id       INTEGER NOT NULL REFERENCES source_file(file_id),
  PRIMARY KEY (index_name, trade_date)
);

CREATE TABLE index_membership (
  index_name    TEXT NOT NULL,
  security_id   INTEGER NOT NULL REFERENCES security(security_id),
  valid_from    TEXT NOT NULL,
  valid_to      TEXT,
  PRIMARY KEY (index_name, security_id, valid_from)
);

-- Market structure (D76): one generic long table; kinds fixed by code.
CREATE TABLE market_structure (
  trade_date    TEXT NOT NULL,
  kind          TEXT NOT NULL,              -- 'fo_ban','asm','gsm','price_band','bulk_deal','block_deal','short_sell','fii_dii','fo_oi_participant'
  security_id   INTEGER REFERENCES security(security_id),
  payload       TEXT NOT NULL,              -- JSON as parsed
  file_id       INTEGER REFERENCES source_file(file_id)
);
CREATE INDEX ix_ms ON market_structure (kind, trade_date);

-- Precomputed for the site; rebuilt nightly.
CREATE TABLE latest_snapshot (
  security_id   INTEGER PRIMARY KEY REFERENCES security(security_id),
  as_of         TEXT NOT NULL,
  payload       TEXT NOT NULL               -- JSON
);
