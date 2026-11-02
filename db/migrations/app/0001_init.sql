-- app DB (§5.7) + B5 review queue + cost ledger.

CREATE TABLE review_item (
  review_id     INTEGER PRIMARY KEY,
  kind          TEXT NOT NULL,              -- 'corp_action','entity_merge','demerger','triage_audit','brsr_plant_mismatch','unmatched_kpi','bc_unparsed','error_report','owner_correction','sector_map'
  subject_db    TEXT NOT NULL,              -- which domain DB the subject lives in
  subject_ref   TEXT NOT NULL,              -- key in that DB (JSON or text)
  summary       TEXT NOT NULL,
  evidence      TEXT,                       -- JSON: source refs, quotes, numbers
  proposed      TEXT,                       -- JSON: what the system would do
  status        TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','approved','rejected','edited','superseded')),
  decision      TEXT,                       -- JSON: what the owner decided
  created_at    TEXT NOT NULL,
  decided_at    TEXT,
  UNIQUE (kind, subject_db, subject_ref)
);
CREATE INDEX ix_review_open ON review_item (status, kind);

CREATE TABLE app_user (
  user_id       INTEGER PRIMARY KEY,
  google_sub    TEXT NOT NULL UNIQUE,
  email         TEXT NOT NULL,
  created_at    TEXT NOT NULL,
  deleted_at    TEXT
);

CREATE TABLE watchlist (
  user_id       INTEGER NOT NULL REFERENCES app_user(user_id),
  security_id   INTEGER NOT NULL,
  added_at      TEXT NOT NULL,
  PRIMARY KEY (user_id, security_id)
);

CREATE TABLE saved_item (
  item_id       INTEGER PRIMARY KEY,
  user_id       INTEGER NOT NULL REFERENCES app_user(user_id),
  kind          TEXT NOT NULL CHECK (kind IN ('query','tracker','basket')),
  name          TEXT NOT NULL,
  body          TEXT NOT NULL,              -- JSON
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL
);

CREATE TABLE alert (
  alert_id      INTEGER PRIMARY KEY,
  user_id       INTEGER NOT NULL REFERENCES app_user(user_id),
  rule          TEXT NOT NULL,              -- JSON
  created_at    TEXT NOT NULL,
  last_fired_at TEXT
);

CREATE TABLE error_report (
  report_id     INTEGER PRIMARY KEY,
  user_id       INTEGER,
  page          TEXT NOT NULL,
  body          TEXT NOT NULL,
  created_at    TEXT NOT NULL,
  review_id     INTEGER REFERENCES review_item(review_id)
);

CREATE TABLE owner_correction (
  correction_id INTEGER PRIMARY KEY,
  subject_db    TEXT NOT NULL,
  subject_ref   TEXT NOT NULL,
  before_value  TEXT,
  after_value   TEXT,
  reason        TEXT NOT NULL,
  created_at    TEXT NOT NULL
);

CREATE TABLE audit_log (
  audit_id      INTEGER PRIMARY KEY,
  actor         TEXT NOT NULL,              -- 'system', 'owner', 'user:<id>'
  action        TEXT NOT NULL,
  target        TEXT,
  detail        TEXT,
  at            TEXT NOT NULL
);

CREATE TABLE query_cache (
  cache_key     TEXT PRIMARY KEY,
  body          TEXT NOT NULL,
  created_at    TEXT NOT NULL,
  expires_at    TEXT NOT NULL
);

-- Every LLM call (B7, D18): cost is enforced against a daily cap.
CREATE TABLE cost_ledger (
  ledger_id     INTEGER PRIMARY KEY,
  at            TEXT NOT NULL,
  provider      TEXT NOT NULL,
  model         TEXT NOT NULL,
  tier          TEXT NOT NULL CHECK (tier IN ('standard','flex','batch')),
  purpose       TEXT NOT NULL,
  input_tokens  INTEGER NOT NULL,
  cached_tokens INTEGER NOT NULL DEFAULT 0,
  output_tokens INTEGER NOT NULL,
  cost_usd_micros INTEGER NOT NULL,
  ref           TEXT
);
CREATE INDEX ix_cost_day ON cost_ledger (at);
