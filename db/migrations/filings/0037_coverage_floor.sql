-- D168 (owner #344): missing financial statements are required from 2024-01-01 only. Coverage-gap rows for earlier
-- quarters are marked out of scope (kept as evidence, never re-checked; nothing loaded or downloaded is touched).
UPDATE coverage_gap SET status = 'out of scope: before 2024-01-01 (D168)' WHERE period_end < '2024-01-01';
