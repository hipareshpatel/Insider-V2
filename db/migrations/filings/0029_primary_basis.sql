-- D50/D51 (work list A3): primary basis per company and basis-switch series breaks, derived from the stored filings.
CREATE TABLE primary_basis (
  security_id  INTEGER PRIMARY KEY,
  basis        TEXT NOT NULL CHECK (basis IN ('consolidated','standalone','both')),
  reason       TEXT NOT NULL,
  cons_q       INTEGER NOT NULL,   -- quarters with consolidated results
  sa_q         INTEGER NOT NULL,   -- quarters with standalone results
  sa_share     TEXT,               -- latest standalone ÷ consolidated income (holding-company test)
  decided_at   TEXT NOT NULL
);
CREATE TABLE basis_break (
  security_id  INTEGER NOT NULL,
  period_end   TEXT NOT NULL,      -- first quarter of the new state
  change       TEXT NOT NULL CHECK (change IN ('consolidated starts','consolidated stops')),
  PRIMARY KEY (security_id, period_end)
);
