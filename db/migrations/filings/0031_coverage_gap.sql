-- D90 coverage per company (work list A3): every (quarter, basis) on NSE's own results lists that is not loaded for the
-- focus companies. Basis-switch breaks (D50) now count only quarters NSE itself has no consolidated filing for.
CREATE TABLE coverage_gap (
  security_id INTEGER NOT NULL,
  period_end  TEXT NOT NULL,
  basis       TEXT NOT NULL,
  status      TEXT,              -- what happened to the file (fin_load status/detail), if anything
  PRIMARY KEY (security_id, period_end, basis)
);
