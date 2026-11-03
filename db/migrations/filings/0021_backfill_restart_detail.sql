-- D154: every reported balance-sheet and cash-flow line now loads with its statement (only when its own subtotals
-- pass). Restart the BS/CF + FY backfill so earlier filings of the 250 focus companies get their detail too; existing
-- rows are skipped (ON CONFLICT DO NOTHING), nothing is deleted.
DELETE FROM daily_refresh WHERE day = 'once' AND slot = 'bscf_backfill';
