-- D1 rows-read circuit breaker (audit 4 Nov, C56 follow-up): rows read per IST day by every worker (market, filings,
-- prefetch); above the daily cap the optional passes stop. Writes keep their own monthly cap (write_budget, D136).
CREATE TABLE read_budget (
  day   TEXT PRIMARY KEY,  -- IST date
  rows  INTEGER NOT NULL DEFAULT 0
);
