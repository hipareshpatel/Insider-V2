-- Owner #336: restatement flags now cover every line of every statement (was 4 core P&L lines). Re-run the one-off
-- version pass over all periods filed more than once (1,363 groups at 3 Nov); flags are INSERT OR REPLACE.
DELETE FROM daily_refresh WHERE day = 'once' AND slot = 'version_backfill';
