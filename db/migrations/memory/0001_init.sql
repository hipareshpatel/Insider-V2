-- memory DB (§5.5). Every row: source filing, page, quote, period, disclosed_at, confidence, claim type, model/prompt/extractor version.

CREATE TABLE fact (
  fact_id       INTEGER PRIMARY KEY,
  security_id   INTEGER NOT NULL,
  kind          TEXT NOT NULL,              -- 'fact','guidance','commitment','capex_project','order','capacity','management_change','litigation','market_concern','rated_facility','commissioning'
  subject       TEXT NOT NULL,
  predicate     TEXT NOT NULL,
  value         TEXT,
  unit          TEXT,
  period        TEXT,
  basis         TEXT CHECK (basis IN ('consolidated','standalone','na')),
  claim_type    TEXT NOT NULL CHECK (claim_type IN ('reported','guidance','target','aspiration','analyst_question','third_party')),
  status        TEXT,                       -- commitments: open|met|missed|revised_up|revised_down|delayed|withdrawn|silently_dropped
  due_by        TEXT,
  detail        TEXT,                       -- JSON for kind-specific fields
  source_seq_id TEXT NOT NULL,
  page          INTEGER,
  quote         TEXT NOT NULL,
  disclosed_at  TEXT NOT NULL,
  confidence    REAL NOT NULL,
  origin        TEXT NOT NULL CHECK (origin IN ('reported','computed','extracted','industry_default','estimate')),
  access        TEXT NOT NULL DEFAULT 'public' CHECK (access IN ('public','signed_in','owner')),
  version       INTEGER NOT NULL DEFAULT 1,
  supersedes    INTEGER REFERENCES fact(fact_id),
  model         TEXT,
  prompt_version TEXT,
  extractor_version TEXT NOT NULL
);
CREATE INDEX ix_fact_sec ON fact (security_id, kind, disclosed_at);

CREATE TABLE timeline (
  security_id   INTEGER NOT NULL,
  seq_id        TEXT NOT NULL,
  at            TEXT NOT NULL,
  headline      TEXT NOT NULL,
  card_id       INTEGER,
  PRIMARY KEY (security_id, seq_id)
);

CREATE TABLE card (
  card_id       INTEGER PRIMARY KEY,
  security_id   INTEGER NOT NULL,
  event_seq_id  TEXT NOT NULL,
  version       INTEGER NOT NULL,
  body          TEXT NOT NULL,              -- JSON
  derived_from  INTEGER,                    -- linked card source company (D38)
  model         TEXT NOT NULL,
  prompt_version TEXT NOT NULL,
  created_at    TEXT NOT NULL,
  access        TEXT NOT NULL DEFAULT 'public' CHECK (access IN ('public','signed_in','owner')),
  UNIQUE (security_id, event_seq_id, version)
);

CREATE TABLE dossier (
  security_id   INTEGER PRIMARY KEY,
  rebuilt_at    TEXT NOT NULL,
  body          TEXT NOT NULL
);
