-- C53: since 3 May 2026 NSE publishes insider-trading filings on /api/corporates-pit-gg (the old /api/corporates-pit
-- answers an empty 28-byte list). Test through the normal download queue whether it honours a date range (May 2026
-- gap) — kind 'pit_gg_probe' so the event loader does not read it before its parser exists.
INSERT OR IGNORE INTO fetch_job (kind, symbol, url, r2_key)
  SELECT 'pit_gg_probe', NULL, u, k FROM (
    SELECT 'https://www.nseindia.com/api/corporates-pit-gg?index=equities' AS u, 'api/pit_gg/probe-latest.json' AS k
    UNION ALL SELECT 'https://www.nseindia.com/api/corporates-pit-gg?index=equities&from_date=03-05-2026&to_date=31-05-2026', 'api/pit_gg/probe-2026-05.json')
  WHERE (SELECT count(*) FROM fetch_job) > 1000;
