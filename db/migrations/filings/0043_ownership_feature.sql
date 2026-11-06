-- Field catalogue §11 (activity 2, 6 Nov): ownership and pledge fields of the focus companies from their two latest
-- shareholding filings (computed from filed share counts), plus their promoter group's pledge. Computed values only;
-- one row per company and field, rewritten only when the value changes.
CREATE TABLE ownership_feature (
  security_id  INTEGER NOT NULL,
  field        TEXT NOT NULL,
  value        TEXT,
  reason       TEXT,
  as_of        TEXT NOT NULL,             -- shareholding date used (ISO)
  computed_at  TEXT NOT NULL,
  PRIMARY KEY (security_id, field)
) WITHOUT ROWID;
