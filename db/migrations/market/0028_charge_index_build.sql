-- P0 deploy (4 Nov 10:47 IST): building the filings indexes (0034) wrote 15,708,824 billed rows (Cloudflare per-query
-- analytics; fin_value holds ~15M rows, far more than the ~3M estimated). Migration writes bypass the Workers' meters,
-- so the month's write cap (D136, write_budget) would not see them; charged here once to today's IST row.
-- Production only (staging's calendar holds a few recent weeks; its index build was small).
INSERT INTO write_budget (day, rows)
SELECT '2026-11-04', 15708824 WHERE (SELECT count(*) FROM trading_calendar) > 500
ON CONFLICT (day) DO UPDATE SET rows = rows + excluded.rows;
