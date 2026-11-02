-- filings DB (§5.3). Three layers (D47): as filed -> canonical -> views (computed, not stored here).
-- Provenance columns on every value (§2a schema rules): period, disclosed_at, basis, version, supersedes, source, origin, access.

CREATE TABLE filing (
  filing_id     INTEGER PRIMARY KEY,
  security_id   INTEGER NOT NULL,
  kind          TEXT NOT NULL,              -- 'results_xbrl','integrated_financials','integrated_governance','shareholding','brsr','annual_report','pit','sast29','credit_rating','board_meeting','corp_action'
  period_end    TEXT,                       -- YYYY-MM-DD the filing is about
  period_kind   TEXT CHECK (period_kind IN ('Q','H','9M','FY','event')),
  basis         TEXT CHECK (basis IN ('consolidated','standalone','na')),
  disclosed_at  TEXT NOT NULL,              -- UTC, when the market learned it (D32)
  source_url    TEXT NOT NULL,
  sha256        TEXT,
  nse_ref       TEXT,                       -- NSE's own id for the row
  status        TEXT NOT NULL DEFAULT 'fetched' CHECK (status IN ('fetched','parsed','loaded','review','failed')),
  UNIQUE (kind, source_url)
);
CREATE INDEX ix_filing_sec ON filing (security_id, kind, period_end);

-- Layer 1: every XBRL fact, lossless.
CREATE TABLE xbrl_fact (
  filing_id     INTEGER NOT NULL REFERENCES filing(filing_id),
  tag           TEXT NOT NULL,
  context_id    TEXT NOT NULL,
  period_start  TEXT,
  period_end    TEXT,
  instant       TEXT,
  dimensions    TEXT,                       -- JSON of axis->member
  unit          TEXT,
  decimals      TEXT,
  value         TEXT,
  PRIMARY KEY (filing_id, tag, context_id)
);

-- Layer 2: canonical line items. Value key (security, statement, line, period, basis, version) (D48).
CREATE TABLE fin_value (
  security_id   INTEGER NOT NULL,
  template      TEXT NOT NULL CHECK (template IN ('industrial','bank','nbfc','insurance')),
  statement     TEXT NOT NULL CHECK (statement IN ('pl','bs','cf','segment','geo','customer')),
  line          TEXT NOT NULL,              -- canonical line key (B9)
  dims          TEXT NOT NULL DEFAULT '',   -- segment/region key, '' for none
  period_end    TEXT NOT NULL,
  period_kind   TEXT NOT NULL CHECK (period_kind IN ('Q','H','9M','FY')),
  basis         TEXT NOT NULL CHECK (basis IN ('consolidated','standalone')),
  version       TEXT NOT NULL CHECK (version IN ('original','restated','corrected')),
  value         TEXT,                       -- exact decimal, rupees; NULL only with null_reason (D52)
  null_reason   TEXT,
  disclosed_at  TEXT NOT NULL,
  filing_id     INTEGER NOT NULL REFERENCES filing(filing_id),
  source_tag    TEXT,                       -- XBRL tag or PDF page ref
  origin        TEXT NOT NULL CHECK (origin IN ('reported','computed','extracted')),
  supersedes    TEXT,                       -- disclosed_at of the version it replaces
  extractor_version TEXT NOT NULL,
  PRIMARY KEY (security_id, statement, line, dims, period_end, period_kind, basis, version, disclosed_at),
  CHECK (value IS NOT NULL OR null_reason IS NOT NULL)
);

CREATE TABLE company_basis (
  security_id   INTEGER NOT NULL,
  valid_from    TEXT NOT NULL,
  primary_basis TEXT NOT NULL CHECK (primary_basis IN ('consolidated','standalone','both')),
  template      TEXT NOT NULL CHECK (template IN ('industrial','bank','nbfc','insurance')),
  fy_end_month  INTEGER NOT NULL DEFAULT 3 CHECK (fy_end_month BETWEEN 1 AND 12),
  PRIMARY KEY (security_id, valid_from)
);

CREATE TABLE shareholding (
  filing_id     INTEGER NOT NULL REFERENCES filing(filing_id),
  security_id   INTEGER NOT NULL,
  as_of         TEXT NOT NULL,
  category      TEXT NOT NULL,              -- 'promoter','fii','dii','mf','public','employee_trust',...
  holder_name   TEXT NOT NULL DEFAULT '',   -- named holders >= 1% (D67); '' for category totals
  shares        INTEGER,
  pct           TEXT,
  pledged_shares INTEGER,
  PRIMARY KEY (filing_id, category, holder_name)
);

-- Insider (PIT) and SAST Reg 29 transactions (D28).
CREATE TABLE insider_txn (
  txn_id        INTEGER PRIMARY KEY,
  security_id   INTEGER NOT NULL,
  regime        TEXT NOT NULL CHECK (regime IN ('pit','sast29')),
  person        TEXT NOT NULL,
  person_category TEXT,
  txn_type      TEXT,                       -- buy/sell/pledge/revoke/esop...
  mode          TEXT,
  shares        INTEGER,
  value_rs      TEXT,
  txn_from      TEXT, txn_to TEXT,
  disclosed_at  TEXT NOT NULL,
  nse_ref       TEXT NOT NULL,
  UNIQUE (regime, nse_ref)
);

CREATE TABLE credit_rating (
  rating_id     INTEGER PRIMARY KEY,
  security_id   INTEGER,                    -- NULL when the ISIN isn't an equity we track (bulk feed)
  isin          TEXT,
  company_name  TEXT NOT NULL,
  agency        TEXT NOT NULL,
  instrument    TEXT,
  rating        TEXT,
  action        TEXT,
  outlook       TEXT,
  rated_on      TEXT,
  disclosed_at  TEXT NOT NULL,
  nse_ref       TEXT NOT NULL UNIQUE
);

CREATE TABLE governance_fact (
  filing_id     INTEGER NOT NULL REFERENCES filing(filing_id),
  security_id   INTEGER NOT NULL,
  key           TEXT NOT NULL,
  value         TEXT,
  PRIMARY KEY (filing_id, key)
);

CREATE TABLE brsr_fact (
  filing_id     INTEGER NOT NULL REFERENCES filing(filing_id),
  security_id   INTEGER NOT NULL,
  key           TEXT NOT NULL,              -- e.g. 'nic_product_share:243', 'exports_pct', 'plants_national'
  value         TEXT,
  unit          TEXT,
  PRIMARY KEY (filing_id, key)
);

CREATE TABLE board_meeting (
  security_id   INTEGER NOT NULL,
  meeting_date  TEXT NOT NULL,
  purpose       TEXT NOT NULL,
  disclosed_at  TEXT NOT NULL,
  PRIMARY KEY (security_id, meeting_date, purpose)
);
