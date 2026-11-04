-- Work list 1.8: NSE's bulk/block history JSON is capped at 70 rows a day (480 of 704 days hit it); the same call with
-- csv=true is not capped (3–12 Jun 2024: 656 deals over 8 days, 82 a day). Queue 10-day CSV windows from 2024-01-01 to
-- 2026-11-02 for both kinds (~210 calls, fetched by the Cloudflare prefetch); the market worker refills capped days.
INSERT OR IGNORE INTO fetch_job (kind, symbol, url, r2_key)
WITH RECURSIVE w(s) AS (SELECT '2024-01-01' UNION ALL SELECT date(s, '+10 days') FROM w WHERE date(s, '+10 days') <= '2026-11-02'),
k(opt, name) AS (SELECT 'bulk_deals', 'bulk' UNION ALL SELECT 'block_deals', 'block')
SELECT 'hist_deals_csv', NULL,
  'https://www.nseindia.com/api/historicalOR/bulk-block-short-deals?optionType=' || k.opt || '&from=' || strftime('%d-%m-%Y', w.s) || '&to=' || strftime('%d-%m-%Y', min(date(w.s, '+9 days'), '2026-11-02')) || '&csv=true',
  'api/market_structure/' || k.name || '_deals_csv/' || w.s || '.csv'
FROM w, k WHERE (SELECT count(*) FROM fetch_job) > 1000;
