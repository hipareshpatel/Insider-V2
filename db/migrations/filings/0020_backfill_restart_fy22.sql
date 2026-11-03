-- D90: the FY22 old-format files (year-to-date context referenced but undefined) now give their full year (census:
-- 2,829 more March-quarter files, 0 newly failing). Restart the BS/CF + FY backfill from the first file so the files it
-- already passed get their full year too; existing rows are skipped (ON CONFLICT DO NOTHING), nothing is deleted.
DELETE FROM daily_refresh WHERE day = 'once' AND slot = 'bscf_backfill';
