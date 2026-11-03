-- M2 events (owner #289): insider trades (PIT), SAST Reg 29, board meetings, credit ratings. One row per NSE row,
-- keyed so overlapping lists (latest-20 + full dated, D149) never double-count. Symbols as filed; identity joins at read.
-- Replaces the M0 placeholder tables insider_txn / credit_rating / board_meeting: never written by any code (empty), and
-- board_meeting's key (security, date, purpose) would merge a revised announcement into the original.
DROP TABLE IF EXISTS insider_txn;
DROP TABLE IF EXISTS credit_rating;
DROP TABLE IF EXISTS board_meeting;
CREATE TABLE insider_trade (
  key TEXT PRIMARY KEY, symbol TEXT NOT NULL, person TEXT, category TEXT, sec_type TEXT, txn TEXT, mode TEXT,
  qty INTEGER, value_rs TEXT, before_qty INTEGER, after_qty INTEGER, before_pct TEXT, after_pct TEXT,
  from_d INTEGER, to_d INTEGER, intimated INTEGER, disclosed_at TEXT, did TEXT, pid TEXT, exchange TEXT, derivative TEXT, job_id INTEGER
) WITHOUT ROWID;
CREATE INDEX ix_insider_symbol ON insider_trade (symbol, from_d);
CREATE TABLE sast_disclosure (
  key TEXT PRIMARY KEY, symbol TEXT NOT NULL, acquirer TEXT, promoter INTEGER, reg_type TEXT, action TEXT, mode TEXT, sec_type TEXT,
  shares_acq INTEGER, shares_sale INTEGER, shares_after INTEGER, pct_acq TEXT, pct_sale TEXT, pct_after TEXT, period TEXT, disclosed_at TEXT, job_id INTEGER
) WITHOUT ROWID;
CREATE INDEX ix_sast_symbol ON sast_disclosure (symbol, disclosed_at);
CREATE TABLE board_meeting (
  key TEXT PRIMARY KEY, symbol TEXT NOT NULL, meeting_d INTEGER, purpose TEXT, description TEXT, intimation TEXT, announced_at TEXT, xbrl TEXT, job_id INTEGER
) WITHOUT ROWID;
CREATE INDEX ix_board_meeting_symbol ON board_meeting (symbol, meeting_d);
CREATE TABLE credit_rating (
  key TEXT PRIMARY KEY, symbol TEXT NOT NULL, company TEXT, isin TEXT, agency TEXT, rating TEXT, outlook TEXT, action TEXT,
  rated_on INTEGER, earlier_rating TEXT, earlier_outlook TEXT, disclosed_at TEXT, app_id TEXT, job_id INTEGER
) WITHOUT ROWID;
CREATE INDEX ix_credit_rating_symbol ON credit_rating (symbol, rated_on);
