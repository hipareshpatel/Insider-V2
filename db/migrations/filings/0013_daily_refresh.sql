-- Plan item 2 (daily freshness): one row per IST day and slot ('evening' 20:30, 'morning' 07:30), so each runs once.
CREATE TABLE daily_refresh (
  day    TEXT NOT NULL,
  slot   TEXT NOT NULL,
  at     TEXT NOT NULL,
  detail TEXT,
  PRIMARY KEY (day, slot)
);
