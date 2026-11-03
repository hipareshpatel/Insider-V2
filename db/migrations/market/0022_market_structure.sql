-- M1 market structure (D76, D144). Compact (D130): integer dates YYYYMMDD, integer paise / quantities.
-- Per-source day ledger: every session of every source is recorded (loaded, missing, possibly truncated), so a gap is visible.
CREATE TABLE ms_day (
  source  TEXT NOT NULL,            -- fo_oi, fo_ban, price_band, bulk, block, short, surveillance, fii_dii
  d       INTEGER NOT NULL,
  rows    INTEGER NOT NULL,         -- -1 = file missing in R2
  note    TEXT,                     -- e.g. 'possibly truncated (API cap 70)', 'complete daily file'
  PRIMARY KEY (source, d)
) WITHOUT ROWID;
CREATE TABLE deal (
  kind         TEXT NOT NULL CHECK (kind IN ('bulk','block')),
  d            INTEGER NOT NULL,
  symbol       TEXT NOT NULL,
  client       TEXT NOT NULL,
  side         TEXT NOT NULL CHECK (side IN ('B','S')),
  qty          INTEGER NOT NULL,
  price_paise  INTEGER NOT NULL,
  security_id  INTEGER,
  remarks      TEXT,
  PRIMARY KEY (kind, d, symbol, client, side, qty, price_paise)
) WITHOUT ROWID;
CREATE TABLE short_sell (
  d INTEGER NOT NULL, symbol TEXT NOT NULL, qty INTEGER NOT NULL, security_id INTEGER,
  PRIMARY KEY (d, symbol)
) WITHOUT ROWID;
CREATE TABLE fo_oi_participant (
  d INTEGER NOT NULL, client_type TEXT NOT NULL,
  fut_idx_long INTEGER, fut_idx_short INTEGER, fut_stk_long INTEGER, fut_stk_short INTEGER,
  opt_idx_call_long INTEGER, opt_idx_put_long INTEGER, opt_idx_call_short INTEGER, opt_idx_put_short INTEGER,
  opt_stk_call_long INTEGER, opt_stk_put_long INTEGER, opt_stk_call_short INTEGER, opt_stk_put_short INTEGER,
  total_long INTEGER, total_short INTEGER,
  PRIMARY KEY (d, client_type)
) WITHOUT ROWID;
CREATE TABLE fo_ban (
  d INTEGER NOT NULL, symbol TEXT NOT NULL,
  PRIMARY KEY (d, symbol)
) WITHOUT ROWID;
-- Price bands and surveillance lists change rarely: intervals, not one row per day.
CREATE TABLE price_band (
  symbol TEXT NOT NULL, series TEXT NOT NULL, band TEXT NOT NULL, valid_from INTEGER NOT NULL, valid_to INTEGER,
  PRIMARY KEY (symbol, series, valid_from)
) WITHOUT ROWID;
CREATE INDEX ix_price_band_open ON price_band (valid_to);
CREATE TABLE surveillance (
  list TEXT NOT NULL, symbol TEXT NOT NULL, stage TEXT NOT NULL, valid_from INTEGER NOT NULL, valid_to INTEGER,
  PRIMARY KEY (list, symbol, valid_from)
) WITHOUT ROWID;
CREATE INDEX ix_surveillance_open ON surveillance (valid_to);
CREATE TABLE fii_dii (
  d INTEGER NOT NULL, category TEXT NOT NULL, buy_cr TEXT, sell_cr TEXT, net_cr TEXT,
  PRIMARY KEY (d, category)
) WITHOUT ROWID;
