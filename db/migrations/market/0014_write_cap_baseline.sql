-- D136 baseline: Cloudflare GraphQL analytics, 2026-11-03 08:30 IST: 24,435,842 D1 rows written this month (all
-- databases). Our counter only counted part of it, so the difference goes into the month's baseline row 'YYYY-MM-00'.
INSERT INTO write_budget (day, rows)
SELECT '2026-11-00', 24435842 - IFNULL((SELECT sum(rows) FROM write_budget WHERE day LIKE '2026-11-%'), 0)
ON CONFLICT (day) DO UPDATE SET rows = excluded.rows;
