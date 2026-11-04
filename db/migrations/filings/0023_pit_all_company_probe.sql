-- C53: NSE's per-company insider-trade (PIT) lists end in Apr/May 2026 for every company. Decisive test through the
-- normal download queue (prefetch fetches it; the event loader reads it like any PIT list): the same API for ALL
-- companies, one recent month at a time. Rows found here mean the per-company lists were truncated, not NSE's data.
-- Inserted only into a database that already holds the download history (next ids; test databases untouched).
INSERT OR IGNORE INTO fetch_job (kind, symbol, url, r2_key)
  SELECT 'pit', NULL, u, k FROM (
    SELECT 'https://www.nseindia.com/api/corporates-pit?index=equities&from_date=01-06-2026&to_date=30-06-2026' AS u, 'api/pit/all/2026-06-probe.json' AS k
    UNION ALL SELECT 'https://www.nseindia.com/api/corporates-pit?index=equities&from_date=01-10-2026&to_date=31-10-2026', 'api/pit/all/2026-10-probe.json')
  WHERE (SELECT count(*) FROM fetch_job) > 1000;
