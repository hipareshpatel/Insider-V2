-- announce DB (§5.4). PDFs are not kept long-term (D17): URL + SHA-256 + per-page text (R2) are.

CREATE TABLE announcement (
  seq_id        TEXT PRIMARY KEY,           -- NSE seq id
  security_id   INTEGER,
  symbol        TEXT NOT NULL,              -- as filed
  category      TEXT,
  subject       TEXT,
  sm_industry   TEXT,                       -- smIndustry as filed (D121 sector fill)
  filed_at      TEXT NOT NULL,              -- UTC
  pdf_url       TEXT,
  sha256        TEXT,
  size_bytes    INTEGER,
  has_xbrl      INTEGER NOT NULL DEFAULT 0,
  lane          TEXT CHECK (lane IN ('A','B','C','noise')),
  status        TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new','triaged','extracted','verified','committed','memory_only','noise','failed','review')),
  event_id      INTEGER,
  first_seen_at TEXT NOT NULL
);
CREATE INDEX ix_ann_sec ON announcement (security_id, filed_at);
CREATE INDEX ix_ann_status ON announcement (status);

CREATE TABLE page_text (
  seq_id        TEXT NOT NULL REFERENCES announcement(seq_id),
  page          INTEGER NOT NULL,
  route         TEXT NOT NULL CHECK (route IN ('text','vision')),
  r2_key        TEXT NOT NULL,
  chars         INTEGER NOT NULL,
  PRIMARY KEY (seq_id, page)
);

CREATE TABLE event (
  event_id      INTEGER PRIMARY KEY,
  security_id   INTEGER NOT NULL,
  kind          TEXT NOT NULL,              -- 'results','order','capex','management_change','rating','m_and_a',...
  period        TEXT,
  opened_at     TEXT NOT NULL,
  status        TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','closed'))
);
