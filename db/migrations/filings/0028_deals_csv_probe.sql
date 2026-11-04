-- Work list 1.8: NSE's bulk/block history API caps its JSON answer at 70 rows a day (480 of 704 days hit it). Test
-- whether the same call with csv=true is uncapped (a public tracker notes it serves history back to 2004), through the
-- normal download queue: 4 Jun 2024 (election-result day) alone, and a 10-day window.
INSERT OR IGNORE INTO fetch_job (kind, symbol, url, r2_key)
  SELECT 'deals_probe', NULL, u, k FROM (
    SELECT 'https://www.nseindia.com/api/historicalOR/bulk-block-short-deals?optionType=bulk_deals&from=04-06-2024&to=04-06-2024&csv=true' AS u, 'api/probe/bulk_20240604_csv.csv' AS k
    UNION ALL SELECT 'https://www.nseindia.com/api/historicalOR/bulk-block-short-deals?optionType=bulk_deals&from=03-06-2024&to=12-06-2024&csv=true', 'api/probe/bulk_20240603_12_csv.csv')
  WHERE (SELECT count(*) FROM fetch_job) > 1000;
