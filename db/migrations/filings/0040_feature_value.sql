-- D171 (owner #358): computed values (TTM, EBITDA, adjusted figures, growth, ROE/ROCE) are stored here, and only here.
-- Every row is computed from filed figures in fin_value (which stays filed cells only, D170 / 0039) and says what it was
-- computed from (`inputs`: the period ends used) and when. An unavailable value is NULL with its reason, never a
-- sentinel (D52). Rebuilt company by company; a rebuild writes only values that changed.
CREATE TABLE IF NOT EXISTS feature_value (
  security_id  INTEGER NOT NULL,
  basis        TEXT NOT NULL CHECK (basis IN ('consolidated','standalone')),
  field        TEXT NOT NULL,
  period_end   TEXT NOT NULL,
  value        TEXT,
  reason       TEXT,
  inputs       TEXT NOT NULL,
  origin       TEXT NOT NULL DEFAULT 'computed' CHECK (origin = 'computed'),
  computed_at  TEXT NOT NULL,
  PRIMARY KEY (security_id, basis, field, period_end),
  CHECK (value IS NOT NULL OR reason IS NOT NULL)
) WITHOUT ROWID;
