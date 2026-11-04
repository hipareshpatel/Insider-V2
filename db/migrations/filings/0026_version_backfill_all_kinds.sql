-- Owner #334: the version pass now covers balance-sheet / cash-flow periods (H, 9M, FY) as well as the quarter;
-- re-run it over every period filed more than once.
DELETE FROM daily_refresh WHERE day = 'once' AND slot = 'version_backfill';
