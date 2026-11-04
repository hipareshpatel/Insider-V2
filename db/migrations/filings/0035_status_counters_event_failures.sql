-- Audit P1 (owner #341): /status reads cached counters instead of counting fin_value (~15M rows, ~7M rows read per
-- call before). The loader adds each run's deltas (rows offered per statement; exact for new files). Seeded once here
-- from the tables as they are: one read of each table, about a dozen rows written (zero-mass-write rule).
CREATE TABLE stat_counter (
  name TEXT PRIMARY KEY,   -- 'fin_load:<status>', 'filing:results', 'filing:shareholding', 'fin_value:<statement>', 'shareholding'
  n    INTEGER NOT NULL DEFAULT 0,
  at   TEXT NOT NULL
);
INSERT INTO stat_counter (name, n, at) SELECT 'fin_load:' || status, count(*), strftime('%Y-%m-%dT%H:%M:%fZ', 'now') FROM fin_load GROUP BY status;
INSERT INTO stat_counter (name, n, at) SELECT CASE WHEN kind = 'shareholding' THEN 'filing:shareholding' ELSE 'filing:results' END, count(*), strftime('%Y-%m-%dT%H:%M:%fZ', 'now') FROM filing GROUP BY 1;
INSERT INTO stat_counter (name, n, at) SELECT 'fin_value:' || statement, count(*), strftime('%Y-%m-%dT%H:%M:%fZ', 'now') FROM fin_value GROUP BY statement;
INSERT INTO stat_counter (name, n, at) SELECT 'shareholding', count(*), strftime('%Y-%m-%dT%H:%M:%fZ', 'now') FROM shareholding;
-- Audit P1: an event list or insider-trade XBRL that cannot be read is recorded here (was: 0 rows, cursor moved on,
-- nothing kept). Only failures are written.
CREATE TABLE event_load (
  job_id INTEGER PRIMARY KEY,
  kind   TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('failed','skipped')),
  detail TEXT,
  at     TEXT NOT NULL
);
